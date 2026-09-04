package com.aiagent.domain.notification.request;

import com.aiagent.domain.notification.ReqStatus;
import com.aiagent.domain.notification.ReqType;
import java.time.Instant;

/**
 * 요청함의 한 행 — 66 §5.2. <b>전 컬럼이 읽기 전용이다.</b>
 *
 * <p>62~65 를 통틀어 편집 열이 통째로 없는 첫 화면이며(grid-standard.md §1.1 의 예외), 이유가 셋이다 —
 * 처리는 <b>저장이 아니라 판정</b>이고, <b>부수 효과가 있고</b>(요청자에게 알림이 나간다),
 * <b>반려는 두 값을 함께 강제</b>해야 하는데 셀 하나로는 안 된다.
 *
 * <p>그래서 짝이 되는 {@code SaveRow} 가 없다. 저장 입력은 {@code NotiRequestHandleRequest}
 * 이며 <b>대상 목록 + 상태 + 메모</b> 셋뿐이다.
 *
 * @param userNm 요청자 이름 — 조인해서 온다. {@code USER_ID} 만으로는 누가 낸 것인지
 *     판단할 수 없다
 * @param userUseYn <b>미사용 계정인가</b>(66 §5.7.1). 화면이 이름 옆에 {@code (미사용)} 을
 *     붙인다 — <i>지금 로그인할 수 없는 사람</i>임을 알리되 <b>처리는 막지 않는다</b>:
 *     요청은 계정이 살아 있을 때 낸 것이다. <b>{@code (삭제된 사용자)} 라는 상태는 없다</b>
 *     — {@code SYS_USER} 는 물리 삭제를 하지 않는다(USER-02 · 41 §4.5)
 * @param handlerNm 처리자 이름 — 미처리면 {@code null} 이다
 */
public record NotiRequestRow(
        Long reqId,
        Instant creDtm,
        String userId,
        String userNm,
        Boolean userUseYn,
        ReqType reqTypeCd,
        String reqContent,
        ReqStatus reqStatCd,
        String handlerId,
        String handlerNm,
        Instant handleDtm,
        String handleMemo) {}
