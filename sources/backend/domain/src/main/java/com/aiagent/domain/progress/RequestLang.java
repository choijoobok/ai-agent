package com.aiagent.domain.progress;

/**
 * 이 요청의 언어를 <b>도메인이 보는 통로</b> — backend/packages.md ·.
 *
 * <p><b>왜 인터페이스인가.</b> 언어를 정하는 규칙(세션의 {@code LOCALE_CD} → 요청의
 * {@code Accept-Language} → 지원 언어로 닫기)은 요청을 아는 쪽의 것이라 {@code api} 에
 * 산다({@code RequestLocale}). 그런데 <b>도메인은 api 를 참조하지 않으므로</b>
 * ({@code LayerDependencyTest}) 그 값을 받을 구멍을 도메인이 선언한다 — 사용자 id 를
 * {@code AuditorAware} 로 받는 것과 같은 자리다.
 *
 * <p><b>요청 스레드에서만 부를 수 있다.</b> {@code LocaleContextHolder} 를 채우는 필터가
 * 이 프로젝트에 없고({@code RequestLocale} 의 주석 — 401 을 쓰는 자리가 보안 필터보다
 * 앞이라 그때는 비어 있다), 작업 스레드에는 요청도 {@code SecurityContext} 도 없다.
 * 그래서 오래 걸리는 작업은 <b>맡기기 전에 값을 받아 들고 간다</b>
 * ({@link ProgressHelper#start}).
 *
 * <p>{@code RequestLocale} 이 <i>"비동기·배치 경로는 아직 없다 — backend/packages.md 가 예고한
 * 전파는 그 경로가 생기는 슬라이스의 것이다"</i> 라고 적어 둔 그 슬라이스가 여기다.
 */
public interface RequestLang {

    /** 지원 언어 코드 하나({@code ko} · {@code en}) — 빈 값을 돌려주지 않는다. */
    String current();
}
