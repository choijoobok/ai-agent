package com.aiagent.domain.notification.request;

import com.aiagent.domain.notification.ReqStatus;
import com.aiagent.domain.notification.ReqType;
import java.time.Instant;

/**
 * 알림 모달 <i>내 요청</i> 탭의 한 줄 — frontend/tabs.md · screen/_standalone/README.md.
 *
 * <p><b>{@link NotiRequestRow} 와 방향이 반대다.</b> 저쪽은 관리자가 <i>남의 요청</i> 을
 * 보는 것이라 요청자 이름이 있고, 여기는 <b>내가 낸 것</b>이라 요청자가 언제나 나다 —
 * 실을 이유가 없다.
 *
 * <p><b>처리자 이름이 없다.</b> 관리 화면은 <i>누가 처리했는가</i> 를 알아야 하지만(감사),
 * 요청자에게 답은 <b>무엇이 어떻게 됐는가</b> 하나다 — 담당자 이름은 그 답을 바꾸지
 * 않으면서 <i>그 사람에게 따지는 경로</i>를 만든다. 워크플로를 만들지 않기로 한 것의
 * 같은 방향이다.
 *
 * @param handleMemo <b>반려 사유가 여기 온다</b>(screen/notice/requirements.md). 목업이
 *     <i>"사유: 관리자 직접 해제됨"</i> 을 줄에 붙인 자리이며, 처리에서는 비어 있을 수
 * 있다(메모가 선택이다 — sys/notification.md)
 */
public record MyRequestRow(
        Long reqId,
        Instant creDtm,
        ReqType reqTypeCd,
        String reqContent,
        ReqStatus reqStatCd,
        Instant handleDtm,
        String handleMemo) {}
