package com.aiagent.domain.message.service;

import com.aiagent.domain.message.MessageRow;
import com.aiagent.domain.message.repository.SysMessageRepository;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.MessageProps;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * 메시지 조회 — 43 §7.3 · §8.
 *
 * <p><b>폴백은 한 방향이다.</b> 요청 언어의 값이 있으면 그것, 없으면 기본 언어, 그것도 없으면
 * <b>부르는 쪽이 마지막 수단을 정한다</b> — {@link #find}는 비어 있는 답을 그대로 돌려준다.
 * 화면은 키 문자열을 그대로 보이고(43 §7.3) 에러 응답은 {@code defaultMessage()} 로 간다
 * (architecture.md §6-1.2). 마지막 수단이 둘이라 여기서 하나로 정하면 한쪽이 거짓을 말한다.
 *
 * <h2>캐시가 두 축이다</h2>
 *
 * 여기의 TTL 은 <b>DB 왕복을 줄이는 것</b>이고, 프론트가 캐시를 버리는 기준은
 * {@code SYS_CACHE_VERSION} 이다(43 §8.1). <b>이 캐시는 그 표를 읽지 않는다</b> — 읽으려면 매
 * 요청 PK 조회가 붙어 캐시의 의미가 사라진다. 대가는 <i>"메시지를 고치고 최대 TTL 만큼 옛
 * 문구가 나간다"</i> 이며, 그것이 43 §8 이 이 대상에 TTL 을 고른 이유다.
 */
@Service
public class MessageService {

    private final SysMessageRepository messages;
    private final ConfigLookup configs;
    private final Clock clock;

    /** 언어별 스냅샷. 노드마다 따로 만든다 — 노드 간 공유가 필요한 캐시는 없다(ADR-0017). */
    private final Map<String, Snapshot> snapshots = new ConcurrentHashMap<>();

    public MessageService(SysMessageRepository messages, ConfigLookup configs, Clock clock) {
        this.messages = messages;
        this.configs = configs;
        this.clock = clock;
    }

    /** 값이 있으면 그것. 없으면 비어 있다 — 마지막 수단은 부르는 쪽의 것이다. */
    public Optional<String> find(String msgKey, String lang) {
        return Optional.ofNullable(snapshot(lang).all().get(msgKey));
    }

    /** 화면에 그대로 낼 문자열. <b>없으면 키를 그대로 낸다</b> — 누락이 시끄럽게 드러난다(43 §7.3). */
    public String text(String msgKey, String lang) {
        return find(msgKey, lang).orElse(msgKey);
    }

    /**
     * 공개 번들 — {@code USE_SCOPE ∈ {FRONT, BOTH, DATA}}(50 §3.2 · ADR-0023 §4).
     *
     * <p><b>에러 문구({@code BACK})가 빠지는 것이 요점이다.</b> 서버가 응답에 완성해 담으므로
     * 프론트가 쓰지 않는다 — 경계는 <i>프론트가 쓰는가</i> 하나다(architecture.md §6-1.2).
     */
    public Map<String, String> bundle(String lang) {
        return snapshot(lang).bundled();
    }

    /** 메시지를 고친 뒤 부른다 — 관리 화면(63)이 생기면 그 저장이 이 자리를 부른다. */
    public void evict() {
        snapshots.clear();
    }

    private Snapshot snapshot(String lang) {
        Snapshot cached = snapshots.get(lang);
        Instant now = clock.instant();
        if (cached != null && now.isBefore(cached.expiresAt())) {
            return cached;
        }
        Snapshot loaded = load(lang, now);
        snapshots.put(lang, loaded);
        return loaded;
    }

    /**
     * <b>{@code @Transactional} 을 붙이지 않는다.</b> 같은 클래스 안에서 부르므로 프록시를
     * 지나지 않아 <b>붙여도 아무 일이 없다</b> — 붙어 있으면 트랜잭션이 걸린 줄 알게 된다.
     * 조회가 하나뿐이라 Spring Data 가 여는 것으로 충분하다.
     */
    private Snapshot load(String lang, Instant now) {
        MessageProps props = configs.get(MessageProps.class);
        String defaultLang = props.defaultLang();

        // LinkedHashSet 이라 lang == defaultLang 이면 원소가 하나다 — 같은 언어를 두 번 넣으면
        // IN 절이 중복되고, 아래의 "요청 언어가 이긴다" 판정이 자기 자신과 겨룬다.
        Set<String> langs = new LinkedHashSet<>(List.of(lang, defaultLang));

        Map<String, String> fallback = new HashMap<>();
        Map<String, String> requested = new HashMap<>();
        Set<String> bundledKeys = new HashSet<>();

        for (MessageRow row : messages.findRows(langs)) {
            if (row.useScope().bundled()) {
                bundledKeys.add(row.msgKey());
            }
            (lang.equals(row.langCd()) ? requested : fallback).put(row.msgKey(), row.msgVal());
        }

        Map<String, String> all = new HashMap<>(fallback);
        all.putAll(requested);

        Map<String, String> bundled = new HashMap<>();
        all.forEach((key, value) -> {
            if (bundledKeys.contains(key)) {
                bundled.put(key, value);
            }
        });

        Duration ttl = Duration.ofMinutes(props.cacheTtlMinutes());
        return new Snapshot(Map.copyOf(all), Map.copyOf(bundled), now.plus(ttl));
    }

    /** TTL 이 0 이면 {@code expiresAt} 이 곧 현재라 다음 조회가 바로 다시 읽는다(개발용). */
    private record Snapshot(Map<String, String> all, Map<String, String> bundled, Instant expiresAt) {}
}
