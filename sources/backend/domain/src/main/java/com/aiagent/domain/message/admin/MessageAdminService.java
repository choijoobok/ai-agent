package com.aiagent.domain.message.admin;

import com.aiagent.core.error.BusinessException;
import com.aiagent.domain.message.entity.SysCacheVersion;
import com.aiagent.domain.message.entity.SysMessage;
import com.aiagent.domain.message.entity.SysMessageKey;
import com.aiagent.domain.message.repository.SysCacheVersionRepository;
import com.aiagent.domain.message.repository.SysMessageKeyRepository;
import com.aiagent.domain.message.repository.SysMessageRepository;
import com.aiagent.domain.message.service.MessageService;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.MessageProps;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * {@code MESSAGE_MGMT} 의 저장 — 63 §3.2. <b>한 트랜잭션이다.</b>
 *
 * <p>키와 값이 같은 요청에 있어야 FK 순서를 서버가 정할 수 있다 — 추가는 키 → 값, 삭제는
 * <b>값 → 키</b> 다. 그래서 grid-standard.md §6.2 의 삭제 게이트가 필요 없다: DB 가 거부할 것이 없다.
 *
 * <p><b>버전은 저장 한 번에 {@code +1}</b> 이고 행 수만큼 올리지 않는다(43 §8.1).
 */
@Service
public class MessageAdminService {

    private final SysMessageKeyRepository keys;
    private final SysMessageRepository values;
    private final SysCacheVersionRepository versions;
    private final MessageService messages;
    private final ConfigLookup configs;
    private final Clock clock;

    public MessageAdminService(
            SysMessageKeyRepository keys,
            SysMessageRepository values,
            SysCacheVersionRepository versions,
            MessageService messages,
            ConfigLookup configs,
            Clock clock) {
        this.keys = keys;
        this.values = values;
        this.versions = versions;
        this.messages = messages;
        this.configs = configs;
        this.clock = clock;
    }

    @Transactional
    public void save(List<MessageSaveRow> rows) {
        Set<String> supported = Set.copyOf(configs.get(MessageProps.class).supported());
        Set<String> seen = new HashSet<>();

        for (MessageSaveRow row : rows) {
            // 같은 요청 안의 중복은 화면이 막지만(63 §3.2), 막혔다고 서버가 안 봐도 되는 것은
            // 아니다 — 두 번째 C 의 존재 확인이 첫 번째의 flush 를 만나지 못해 조용히 덮인다.
            if (!seen.add(row.msgKey())) {
                throw duplicate(row.msgKey());
            }
            switch (row.rowState()) {
                case C -> create(row, supported);
                case U -> update(row, supported);
                case D -> delete(row);
            }
        }
        bumpVersion();
        evictAfterCommit();
    }

    // ── 행 상태 셋 ───────────────────────────────────────────────────

    private void create(MessageSaveRow row, Set<String> supported) {
        if (keys.existsById(row.msgKey())) {
            throw duplicate(row.msgKey());
        }
        keys.save(SysMessageKey.created(row.msgKey()));
        for (MessageValue value : row.valuesOrEmpty()) {
            checkLang(value, supported);
            // 값이 있는 것만 만든다 — 빈 언어의 행을 만들면 MSG_VAL IS NULL 인 행이 남는다.
            if (!value.blank()) {
                values.save(SysMessage.of(row.msgKey(), value.langCd(), value.msgVal()));
            }
        }
    }

    /** {@code values} 가 전량이므로 <b>없는 언어는 지운다</b> — 서버가 상태를 추론하지 않는다. */
    private void update(MessageSaveRow row, Set<String> supported) {
        requireKey(row.msgKey());

        Map<String, SysMessage> existing = new HashMap<>();
        values.findByMsgKey(row.msgKey()).forEach(entity -> existing.put(entity.getLangCd(), entity));

        for (MessageValue value : row.valuesOrEmpty()) {
            checkLang(value, supported);
            SysMessage current = existing.get(value.langCd());
            if (value.blank()) {
                if (current != null) {
                    values.delete(current);
                }
            } else if (current == null) {
                values.save(SysMessage.of(row.msgKey(), value.langCd(), value.msgVal()));
            } else {
                current.changeValue(value.msgVal());
            }
        }
    }

    private void delete(MessageSaveRow row) {
        SysMessageKey key = requireKey(row.msgKey());
        values.deleteByMsgKey(row.msgKey());
        keys.delete(key);
    }

    // ── 캐시 ─────────────────────────────────────────────────────────

    private void bumpVersion() {
        Instant now = clock.instant();
        versions.findById(SysCacheVersion.MESSAGE)
                .ifPresentOrElse(
                        version -> version.bump(now),
                        () -> versions.save(SysCacheVersion.started(SysCacheVersion.MESSAGE, now)));
    }

    /**
     * <b>커밋 뒤에 비운다.</b> 커밋 전에 비우면 다른 스레드가 <b>아직 옛 값인 DB</b> 를 읽어
     * 캐시를 다시 채우고, 그 뒤에 커밋이 앉아 <b>TTL 만큼 옛 문구가 나간다</b> — 비우는 목적
     * 자체가 사라진다.
     *
     * <p>롤백이면 부르지 않는다. 안 불러도 캐시는 바뀐 적 없는 DB 와 일치하므로 할 일이 없다.
     *
     * <p><b>이 노드만 비워진다</b> — 다중화에서 다른 노드는 TTL 만큼 옛 값을 낸다. 그것이
     * 43 §8 이 이 대상에 TTL 을 고른 대가이며, 프론트가 보는 갱신 시점은 여기가 아니라
     * {@code SYS_CACHE_VERSION} 이다(43 §8.1).
     */
    private void evictAfterCommit() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            messages.evict();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                messages.evict();
            }
        });
    }

    // ── 검증 ─────────────────────────────────────────────────────────

    private SysMessageKey requireKey(String msgKey) {
        return keys.findById(msgKey)
                .orElseThrow(() -> new BusinessException(
                        MessageErrorCode.KEY_MISSING, "이미 지워진 키다 — " + msgKey));
    }

    private static void checkLang(MessageValue value, Set<String> supported) {
        if (!supported.contains(value.langCd())) {
            throw new BusinessException(
                    MessageErrorCode.LANG_UNKNOWN, "지원하지 않는 언어 — " + value.langCd());
        }
    }

    private static BusinessException duplicate(String msgKey) {
        return new BusinessException(
                MessageErrorCode.KEY_DUPLICATE,
                "이미 있는 키다 — " + msgKey,
                List.of(new BusinessException.FieldError("msgKey", "이미 있는 메시지 키입니다")));
    }
}
