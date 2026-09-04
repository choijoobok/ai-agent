package com.aiagent.domain.config;

import com.aiagent.domain.config.repository.SysConfigRepository;
import com.aiagent.support.config.ConfigOverrideSource;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code support} 가 낸 구멍을 {@code domain} 이 채운다 — sys/config.md · backend/packages.md.
 *
 * <p><b>전건 조회가 정상 사용법이다.</b> 스무 줄짜리 표이고 <b>작업당 한 번</b> 불린다
 * (backend/caching.md) — 어느 키가 필요한지는 부르는 시점에 알 수 없으므로 조건절을 둘 자리가
 * 없다.
 *
 * <p><b>여기에 캐시를 두지 않는다.</b> 그 판단은 조회 유틸의 스냅샷이 이미 하고 있고,
 * 여기서 또 하면 같은 캐시가 두 겹이 되어 <b>무효화 시점이 둘</b>이 된다 — 화면에서
 * 저장했는데 다음 작업이 여전히 옛 값을 보는 경로가 그렇게 생긴다.
 */
@Component
public class SysConfigOverrideSource implements ConfigOverrideSource {

    private final SysConfigRepository overrides;

    public SysConfigOverrideSource(SysConfigRepository overrides) {
        this.overrides = overrides;
    }

    /**
     * <b>{@code readOnly} 로 자기 트랜잭션을 연다.</b> 부르는 자리가 요청 필터라 아직 아무
     * 트랜잭션도 없을 수 있고, 없으면 조회마다 커넥션을 새로 잡는다 — 이미 열려 있으면
     * 그것에 참여한다.
     */
    @Override
    @Transactional(readOnly = true)
    public Map<String, String> load() {
        Map<String, String> values = new LinkedHashMap<>();
        overrides.findAll().forEach(entity -> values.put(entity.getCfgKey(), entity.getCfgVal()));
        return values;
    }
}
