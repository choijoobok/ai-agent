package com.aiagent.domain.config.admin;

import com.aiagent.core.error.BusinessException;
import com.aiagent.domain.config.entity.SysConfig;
import com.aiagent.domain.config.repository.SysConfigRepository;
import com.aiagent.domain.message.entity.SysCacheVersion;
import com.aiagent.domain.message.repository.SysCacheVersionRepository;
import com.aiagent.support.config.ConfigCatalog;
import com.aiagent.support.config.ConfigValidator;
import com.aiagent.support.config.ConfigViolation;
import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code CONFIG_MGMT} 의 저장 — screen/config/requirements.md. <b>저장 하나가 두 가지를 한다.</b>
 *
 * <p>적용값 수정({@code U} — 행 생성 또는 갱신)과 되돌리기({@code D} — 행 삭제)가 <b>한
 * 트랜잭션</b>이다(UX-14). 되돌리기가 별도 API 가 아닌 것은 화면이 <b>일괄 저장</b>이기
 * 때문이며, 체크만 하고 저장하지 않으면 아무 일도 일어나지 않는다.
 *
 * <p><b>검증은 규칙을 읽지 않고 만들어 본다</b>(screen/config/requirements.md). 저장 <b>후의 전체 오버라이드</b>를
 * {@code yml} 위에 얹어 전 props 클래스를 다시 바인딩하며, {@code @Min} 도 상호 제약도 타입
 * 변환도 그 한 문에서 걸린다. 델타가 아니라 전량인 것이 요점이다 — 상호 제약은 형제 값을
 * 봐야 판정되므로 <i>"둘을 함께 올리는"</i> 저장이 중간 상태에서 거부되면 안 된다.
 *
 * <p><b>검증이 쓰기보다 먼저다.</b> 거부되면 트랜잭션이 롤백되므로 순서가 정합성을 바꾸지는
 * 않지만, 먼저 보면 <b>DB 를 건드리지 않고</b> 끝난다.
 */
@Service
public class ConfigService {

    private final SysConfigRepository overrides;
    private final SysCacheVersionRepository versions;
    private final ConfigCatalog catalog;
    private final ConfigValidator validator;
    private final Clock clock;

    public ConfigService(
            SysConfigRepository overrides,
            SysCacheVersionRepository versions,
            ConfigCatalog catalog,
            ConfigValidator validator,
            Clock clock) {
        this.overrides = overrides;
        this.versions = versions;
        this.catalog = catalog;
        this.validator = validator;
        this.clock = clock;
    }

    @Transactional
    public void save(List<ConfigSaveRow> rows) {
        checkKeys(rows);
        checkValues(rows);

        for (ConfigSaveRow row : rows) {
            switch (row.rowState()) {
                case U -> upsert(row);
                case D -> revert(row);
                // 행 추가가 없다 — 왼쪽에 없는 키는 아무 데도 읽히지 않는다(screen/config/requirements.md).
                case C -> throw new BusinessException(
                        ConfigErrorCode.KEY_UNKNOWN,
                        "이 화면은 키를 만들지 않는다 — " + row.cfgKey(),
                        List.of(new BusinessException.FieldError(
                                row.cfgKey(), "코드가 정하지 않은 설정 키입니다")));
            }
        }
        bumpVersion();
    }

    // ── 행 상태 둘 ───────────────────────────────────────────────────

    /** <b>행이 없으면 만든다.</b> 화면이 보는 행은 언제나 있으므로 둘을 가르지 않는다. */
    private void upsert(ConfigSaveRow row) {
        String value = row.cfgVal() == null ? "" : row.cfgVal().strip();
        overrides.findById(row.cfgKey())
                .ifPresentOrElse(
                        entity -> entity.changeValue(value),
                        () -> overrides.save(SysConfig.of(row.cfgKey(), value)));
    }

    /**
     * 되돌리기 — <b>값이 사라지는 것이 아니라 {@code yml} 이 드러난다</b>(screen/config/requirements.md).
     *
     * <p>행이 없으면 거부한다. 조용히 넘기면 화면은 되돌렸다고 말하는데 <b>그 사이 다른
     * 사람이 이미 되돌린</b> 것을 아무도 모른다 — 결과가 같아 보여도 <i>내가 한 것</i> 과
     * <i>남이 한 것</i> 은 다른 사실이다.
     */
    private void revert(ConfigSaveRow row) {
        SysConfig entity = overrides.findById(row.cfgKey())
                .orElseThrow(() -> new BusinessException(
                        ConfigErrorCode.NOT_OVERRIDDEN,
                        "되돌릴 행이 없다 — " + row.cfgKey(),
                        List.of(new BusinessException.FieldError(
                                row.cfgKey(), "이미 기본값으로 되돌아간 설정입니다"))));
        overrides.delete(entity);
    }

    // ── 검증 ─────────────────────────────────────────────────────────

    /** 왼쪽 테이블에 없는 키는 <b>읽을 경로가 없다</b> — 저장은 되고 동작하지 않는다(frontend/grid.md). */
    private void checkKeys(List<ConfigSaveRow> rows) {
        Set<String> known = new HashSet<>();
        catalog.keys().forEach(key -> known.add(key.key()));

        Set<String> seen = new HashSet<>();
        for (ConfigSaveRow row : rows) {
            if (!known.contains(row.cfgKey())) {
                throw new BusinessException(
                        ConfigErrorCode.KEY_UNKNOWN,
                        "코드가 정하지 않은 키다 — " + row.cfgKey(),
                        List.of(new BusinessException.FieldError(
                                row.cfgKey(), "코드가 정하지 않은 설정 키입니다")));
            }
            // 같은 키가 두 번 오면 뒤가 앞을 조용히 덮는다 — 화면의 버그가 데이터로 남는다.
            if (!seen.add(row.cfgKey())) {
                throw new BusinessException(
                        ConfigErrorCode.KEY_UNKNOWN,
                        "같은 키가 두 번 왔다 — " + row.cfgKey(),
                        List.of(new BusinessException.FieldError(
                                row.cfgKey(), "같은 설정 키가 두 번 왔습니다")));
            }
        }
    }

    /**
     * <b>저장 후의 상태</b>를 만들어 바인딩해 본다 — screen/code/requirements.md · sys/config.md.
     *
     * <p>지금 DB 에 있는 오버라이드에 이 요청을 얹은 것이 그 상태다. 되돌리기({@code D})는
     * <b>빼는 것</b>이므로 함께 반영해야 한다 — 빼기를 무시하면 <i>"A 를 내리고 B 를 올려
     * 관계를 맞추는"</i> 저장이 거부된다.
     */
    private void checkValues(List<ConfigSaveRow> rows) {
        Map<String, String> effective = new LinkedHashMap<>();
        overrides.findAll().forEach(entity -> effective.put(entity.getCfgKey(), entity.getCfgVal()));

        for (ConfigSaveRow row : rows) {
            switch (row.rowState()) {
                case U -> effective.put(row.cfgKey(), row.cfgVal() == null ? "" : row.cfgVal().strip());
                case D -> effective.remove(row.cfgKey());
                case C -> { /* 위에서 거부된다 */ }
            }
        }
        List<ConfigViolation> violations = validator.validate(effective);
        if (violations.isEmpty()) {
            return;
        }
        // 어느 셀인지가 이 응답의 값이다 — field 가 곧 CFG_KEY 다(frontend/grid.md).
        List<BusinessException.FieldError> fields = violations.stream()
                .map(violation -> new BusinessException.FieldError(
                        violation.key(), violation.message()))
                .toList();
        throw new BusinessException(
                ConfigErrorCode.INVALID_VALUE, describe(violations), fields);
    }

    /** 로그의 문구다 — 서버 언어이며 <b>어느 키가 왜</b> 를 그대로 적는다(backend/packages.md). */
    private static String describe(List<ConfigViolation> violations) {
        StringBuilder text = new StringBuilder("설정값이 바인딩을 통과하지 못했다 —");
        violations.forEach(violation ->
                text.append(' ').append(violation.key()).append(": ").append(violation.message()));
        return text.toString();
    }

    // ── 캐시 ─────────────────────────────────────────────────────────

    /**
     * <b>저장 한 번에 {@code +1}</b> — 행 수만큼 올리지 않는다(sys/code.md).
     *
     * <p>비우는 캐시가 없다. 메시지와 달리 백엔드가 이 값을 캐시로 들고 있지 않으며,
     * 값을 읽는 쪽은 <b>작업 스코프 스냅샷</b>이라 다음 작업이 저절로 새 값을 뜬다
     * (sys/config.md · backend/caching.md). 그래서 여기에는 {@code evictAfterCommit} 이 없다.
     */
    private void bumpVersion() {
        Instant now = clock.instant();
        versions.findById(SysCacheVersion.CONFIG)
                .ifPresentOrElse(
                        version -> version.bump(now),
                        () -> versions.save(SysCacheVersion.started(SysCacheVersion.CONFIG, now)));
    }
}
