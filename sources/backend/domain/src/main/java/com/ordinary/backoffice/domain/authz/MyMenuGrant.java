package com.ordinary.backoffice.domain.authz;

import java.time.LocalDate;

/**
 * 나에게 걸린 개인 예외 하나 — 42 §6 · AUTHZ-07.
 *
 * <p><b>사유를 함께 보여준다.</b> 개인 예외는 부여할 때 사유가 필수이고(마찰이 있어야 한다),
 * 받은 사람이 <i>왜 이것이 나에게 있는가</i> 를 볼 수 없으면 그 마찰이 기록으로만 남는다.
 *
 * <p><b>기간이 NOT NULL 이다</b> — 역할 부여와 달리 무기한 예외가 없다. 그래서
 * {@code validToDt} 가 언제나 값이며, 언제 끝나는지 화면이 반드시 말할 수 있다(main-shell.md §8).
 *
 * @param menuNm 이름이 아니라 메시지 키({@code menu.{MENU_CD}})다 — 43 §3.
 */
public record MyMenuGrant(
        String menuCd,
        String menuNm,
        ActionType actionCd,
        LocalDate validFromDt,
        LocalDate validToDt,
        String grantRsn,
        boolean effective) {}
