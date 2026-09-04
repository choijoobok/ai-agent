package com.ordinary.backoffice.domain.message.service;

import com.ordinary.backoffice.domain.message.entity.SysCacheVersion;
import com.ordinary.backoffice.domain.message.repository.SysCacheVersionRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 프론트 캐시 버전 — 43 §8.1.
 *
 * <p><b>읽는 시점이 정해져 있다</b> — 로그인 응답과 공개 번들 요청 둘뿐이다. 폴링하지 않으며
 * 백엔드 캐시의 유효성과는 아무 관계가 없다(그쪽은 TTL 이다 — {@link MessageService}).
 *
 * <p>표에 없는 이름을 물으면 <b>0</b> 이다. 프론트가 들고 있는 값과 절대 같지 않으므로
 * <i>"버전을 모르면 캐시를 버린다"</i> 가 되며, 그것이 이 자리의 안전한 방향이다.
 */
@Service
public class CacheVersionService {

    private final SysCacheVersionRepository versions;

    public CacheVersionService(SysCacheVersionRepository versions) {
        this.versions = versions;
    }

    @Transactional(readOnly = true)
    public long current(String cacheName) {
        return versions.findById(cacheName).map(SysCacheVersion::getVersion).orElse(0L);
    }

    /** 로그인 응답이 싣는 전부 — 이름을 코드에 나열하지 않는다. 표가 곧 목록이다. */
    @Transactional(readOnly = true)
    public Map<String, Long> all() {
        Map<String, Long> result = new LinkedHashMap<>();
        versions.findAll().forEach(row -> result.put(row.getCacheName(), row.getVersion()));
        return result;
    }
}
