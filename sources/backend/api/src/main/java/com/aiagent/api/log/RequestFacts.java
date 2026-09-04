package com.aiagent.api.log;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * 이력 두 테이블이 <b>똑같이 적는 것</b> — backend/packages.md 의 <i>공통 컬럼</i> 칸이다.
 *
 * <p>{@code USER_ID} · {@code MENU_CD} · {@code REQUEST_URI} 를 만드는 규칙이 여기 하나다.
 * 사용 이력은 인터셉터가, 에러 로그는 예외 기록기가 쓰는데 <b>모듈도 시점도 다르다</b> —
 * 규칙을 각자 두면 같은 요청이 두 테이블에 <b>다른 사용자·다른 메뉴</b>로 남고, 그 둘을
 * {@code TRACE_ID} 로 이어 보는 화면이(screen/log/access/requirements.md) 그것을 <b>버그로 드러낸다</b>.
 */
public final class RequestFacts {

    /** frontend/packages.md 가 매 요청 붙이는 현재 메뉴 코드. <b>인가에 쓰지 않는다</b>(backend/security.md). */
    private static final String MENU_HEADER = "X-Menu-Code";

    /** {@code MENU_CD} 는 {@code VARCHAR(30)} 이다 — 클라이언트 값이라 길이를 믿지 않는다. */
    private static final int MENU_CD_MAX = 30;

    private RequestFacts() {}

    /** 컨텍스트 경로를 뺀 순수 경로 — {@code SYS_API.API_URL} 과 같은 모양이다. */
    public static String path(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String contextPath = request.getContextPath();
        return contextPath.isEmpty() ? uri : uri.substring(contextPath.length());
    }

    /**
     * {@code null} 을 허용한다 — screen/log/access/requirements.md.
     *
     * <p>로그인·하트비트는 셸 진입 전이라 현재 메뉴가 존재하지 않는다. <b>빈 문자열로 두지
     * 않는다</b>: Oracle 에서 {@code ''} 는 {@code null} 이라(backend/persistence.md) 넷 중 하나에서만
     * 구분이 성립하지 않는다.
     */
    public static String menuCd(HttpServletRequest request) {
        String menuCd = request.getHeader(MENU_HEADER);
        if (menuCd == null || menuCd.isBlank()) {
            return null;
        }
        String trimmed = menuCd.trim();
        return trimmed.length() > MENU_CD_MAX ? trimmed.substring(0, MENU_CD_MAX) : trimmed;
    }

    /**
     * 미인증이면 {@code null} — 화면이 {@code (익명)} 으로 그린다(screen/log/access/requirements.md).
     *
     * <p>{@code anonymousUser} 를 걸러 내는 것이 요점이다. Security 는 익명에도
     * {@link Authentication} 을 채워 두므로 이름을 그대로 쓰면 <b>사용자 조건에
     * {@code anonymousUser} 가 후보로 뜬다</b>.
     */
    public static String userId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getName())) {
            return null;
        }
        return authentication.getName();
    }
}
