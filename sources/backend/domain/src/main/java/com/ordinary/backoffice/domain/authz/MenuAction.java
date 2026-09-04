package com.ordinary.backoffice.domain.authz;

import java.io.Serializable;

/**
 * 유효 권한 합집합의 <b>원소</b> — security-design.md §4.
 *
 * <p><b>쌍이 원소인 것이 이 타입의 존재 이유다.</b> {@code MENU_CD} 집합과 {@code ACTION_CD}
 * 집합을 각각 합치면 곱집합이 되어 <b>아무 역할도 주지 않은 조합이 생긴다</b> — 권한 상승이다.
 *
 * <pre>
 * 유효 권한 = { (MENU_CD, ACTION_CD) } 의 집합 합집합      ← 쌍이 원소다
 *           ≠ {MENU_CD} × {ACTION_CD}                     ← 곱집합. 금지
 * </pre>
 *
 * <p>그래서 판정은 {@code contains} 한 번이고 <b>어느 역할에서 왔는지는 판정에 쓰이지
 * 않는다</b>. 출처는 권한 화면의 표시용이며 여기 담지 않는다.
 *
 * <p>{@link Serializable} 인 것은 세션 스토어(JDBC·Redis)에 직렬화되기 때문이다 —
 * security-design.md §4 권한 캐싱.
 */
public record MenuAction(String menuCd, ActionType action) implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 프론트에 내리는 표기 — {@code MENU_CD:ACTION}. 화면은 이 문자열로 버튼을 판정한다. */
    public String toToken() {
        return menuCd + ":" + action.name();
    }
}
