package com.aiagent.support.config;

import java.util.Map;

/**
 * {@code SYS_CONFIG} 를 읽는 쪽 — sys/config.md.
 *
 * <p><b>인터페이스인 것은 모듈 방향 때문이다.</b> 조회 유틸은 {@code support} 에 있고
 * 그 테이블은 {@code domain} 의 것이다(backend/packages.md) — {@code support} 가 {@code domain} 을
 * 참조할 수 없으므로 <b>구멍만 여기 두고 채우는 것은 저쪽</b>이다.
 *
 * <p><b>작업당 한 번 불린다.</b> 캐시도 조건도 두지 않는다 — 그 판단은
 * {@link ConfigLookup} 의 스냅샷이 이미 하고 있고, 여기서 또 하면 <b>같은 캐시가 두 겹</b>
 * 이 되어 무효화 시점이 둘이 된다.
 */
public interface ConfigOverrideSource {

    /**
     * 오버라이드 전량 — {@code CFG_KEY → CFG_VAL}.
     *
     * <p><b>전건이지 조건 조회가 아니다.</b> 스무 줄짜리 표이고, 어느 키가 필요한지는
     * 부르는 시점에 알 수 없다 — 한 작업이 어느 클래스를 읽을지 미리 알 수 없기 때문이다.
     *
     * <p><b>비어 있는 것이 정상이다.</b> 아무도 바꾸지 않은 배포가 그렇다.
     */
    Map<String, String> load();
}
