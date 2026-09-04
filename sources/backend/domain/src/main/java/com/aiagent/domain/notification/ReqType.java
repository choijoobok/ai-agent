package com.aiagent.domain.notification;

/**
 * 요청의 종류 — sys/notification.md · screen/notice/requirements.md. <b>셋이고, 공통코드가 아니다.</b>
 *
 * <p>sys/notification.md 이 {@link NotiType} 과 같은 판단으로 닫았다 — 값은 소스가 분기하는 것이라
 * 관리자가 늘리면 처리 코드가 없는 값이 생긴다. 라벨만 메시지 키({@code notiReq.type.*})다.
 *
 * <p><b>{@link #ETC} 가 있는 것이 셋에서 닫히는 이유</b>다. 유형을 늘리는 대신 여기로
 * 받고 {@code REQ_CONTENT} 가 사정을 말한다 — 유형을 늘리면 <b>그 유형을 처리하는 코드가
 * 어디에도 없는</b> 상태가 만들어진다.
 */
public enum ReqType {

    /** 권한 신청 — 역할 부여 요청. */
    ROLE_GRANT,

    /** 잠금 해제 요청 — AUTH-04. */
    UNLOCK,

    /** 그 밖 — 내용이 사정을 말한다. */
    ETC
}
