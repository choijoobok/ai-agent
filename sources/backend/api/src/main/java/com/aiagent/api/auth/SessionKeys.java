package com.aiagent.api.auth;

/** 세션에 담는 값의 키. 문자열을 여러 곳에 흩지 않는다 — 오타가 조용한 결함이 된다. */
public final class SessionKeys {

    /**
     * 제한 세션 표시 — 접근 제어 체인 #5(security-design.md §4).
     *
     * <p>참이면 세션은 살아 있으되 비밀번호 변경 API 외에는 403 이다. <b>인가 인터셉터가
     * 그것을 강제한다</b> — 아직 없으므로 지금은 프론트가 화면을 돌리는 근거로만 쓰인다.
     *
     * <p><b>권한({@code GrantedAuthority})으로 표현하지 않는 것이 결정이다.</b> 권한 자리는
     * (메뉴, 액션) 유효 권한의 것이고(security-design.md §4 권한 캐싱), 거기에 상태 플래그를 섞으면 인가
     * 판정이 두 종류의 원소를 구분해야 한다.
     */
    public static final String PASSWORD_CHANGE_REQUIRED = "BACKOFFICE_PWD_CHANGE_REQUIRED";

    private SessionKeys() {}
}
