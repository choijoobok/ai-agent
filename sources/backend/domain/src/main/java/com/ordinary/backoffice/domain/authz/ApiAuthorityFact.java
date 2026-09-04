package com.ordinary.backoffice.domain.authz;

import java.util.Set;

/**
 * 한 업무 API 를 인가하는 데 필요한 사실 전부 — security-design.md §4.
 *
 * <p>둘이며 성격이 다르다. <b>액션은 API 의 속성</b>이고({@code SYS_API}) <b>메뉴 목록은
 * 정책</b>이다({@code SYS_MENU_API}). 판정 시점에는 합쳐 두는 편이 낫지만 <b>저장은 갈라야</b>
 * 같은 API 가 메뉴마다 다른 액션을 갖는 모순이 불가능해진다(ADR-0016).
 *
 * @param menuCds <b>비어 있을 수 있다.</b> 그것은 "등록됐으나 어느 메뉴도 쓰지 않는다" 이며
 *     미등록과 <b>다른 실패</b>다 — 둘 다 403 이지만 고치는 곳이 다르다
 */
public record ApiAuthorityFact(String apiUrl, ActionType action, Set<String> menuCds) {

    /** 매핑이 0건이면 아무도 권한을 가질 수 없다 — {@code err.api-not-mapped}. */
    public boolean isMapped() {
        return !menuCds.isEmpty();
    }

    /**
     * 매핑된 메뉴 중 <b>하나라도</b> 이 액션의 권한이 있으면 통과한다 — OR 이다.
     *
     * <p>정당한 이유: 사용자가 얻는 것은 화면이 아니라 <b>API 능력</b>이고 능력은 호출 경로와
     * 무관하다. 그래서 <b>"지금 보고 있는 메뉴"({@code X-Menu-Code})는 판정에 쓰이지 않는다</b> —
     * 그것은 클라이언트 주장 값이며 이력용이다.
     *
     * <p>어긋나는 경우가 하나 있다. API 가 메뉴 A·B 에 매핑돼 있고 사용자가 (B, SAVE) 만
     * 가졌다면 <b>A 화면의 저장 버튼은 숨겨지지만 그 API 호출은 서버가 허용한다.</b>
     * 의도된 결과다 — 화면마다 허용 범위가 달라야 한다면 그것은 공유 API 가 아니라
     * <b>분리해야 할 두 API</b> 다.
     */
    public boolean isAllowedBy(EffectiveAuthority authority) {
        return menuCds.stream().anyMatch(menuCd -> authority.allows(menuCd, action));
    }
}
