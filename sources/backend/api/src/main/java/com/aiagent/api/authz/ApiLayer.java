package com.aiagent.api.authz;

/**
 * {@code /api/**} 의 세 계층 — backend/security.md.
 *
 * <p><b>분류가 URL 에 새겨져 있으므로 별도 상수 목록이 없다.</b> 컨트롤러의 경로가 곧 보안
 * 등급 선언이며, 코드 리뷰가 <i>"이 API 가 여기 있어도 되나"</i> 를 눈으로 볼 수 있다.
 *
 * <p><b>{@link #UNCLASSIFIED} 가 이 enum 의 핵심이다.</b> 세 프리픽스 밖의 {@code /api/**} 는
 * 무조건 403 이다 — 미분류가 경로 차원에서 fail-closed 이며, 새 컨트롤러를 잘못된 자리에
 * 두면 조용히 열리는 것이 아니라 조용히 잠긴다.
 */
public enum ApiLayer {

    /** 익명. 로그인, 비밀번호 재설정(분실) 등 최소한. */
    PUBLIC("/api/public/"),

    /**
     * 인증만. <b>특정 메뉴에 소속시킬 수 없는 것</b> — 공통코드 조회, 사용자 검색 팝업,
     * {@code auth/me}, 메뉴 선택 기록, 진행률 폴링, 파일 다운로드 류.
     *
     * <p>판별 신호: 매핑하려니 <b>메뉴를 전부 나열하게 되는</b> API 는 업무 API 가 아니다.
     *
     * <p>오배치 위험이 여기 하나 있다 — 업무 API 를 이 아래 두면 조용히 열린다.
     * URL 에 보이므로 <b>코드 리뷰가 지키는 지점</b>이다.
     */
    COMMON("/api/common/"),

    /** 인증 + {@code SYS_API} · {@code SYS_MENU_API} 판정. */
    SERVICE("/api/service/"),

    /** 셋 중 어디에도 속하지 않는 {@code /api/**}. */
    UNCLASSIFIED(null);

    private final String prefix;

    ApiLayer(String prefix) {
        this.prefix = prefix;
    }

    /**
     * 경로가 어느 계층인가. {@code /api/} 로 시작하지 않으면 {@code null} 이다 —
     * 정적 리소스·SPA 라우트는 이 판정의 대상이 아니다.
     *
     * <p>쿼리스트링은 넘어오지 않는다({@code getRequestURI}). 매칭에 참여하지 않는 것이
     * 규약이다(backend/security.md).
     */
    public static ApiLayer of(String path) {
        if (path == null || !path.startsWith("/api/")) {
            return null;
        }
        for (ApiLayer layer : values()) {
            if (layer.prefix != null && path.startsWith(layer.prefix)) {
                return layer;
            }
        }
        return UNCLASSIFIED;
    }
}
