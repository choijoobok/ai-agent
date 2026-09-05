/** 요청 유형 셋 — sys/notification.md. 공통코드가 아니라 소스의 값이다(sys/notification.md). */
export type ReqType = 'ROLE_GRANT' | 'UNLOCK' | 'ETC';

/** 처리 상태 셋 — sys/notification.md. <b>되돌아가는 전이가 없다</b>(screen/notice/requirements.md). */
export type ReqStatus = 'RECEIVED' | 'DONE' | 'REJECTED';

/**
 * 서버 `NotiRequestRow` 와 1:1 — screen/noti-request/requirements.md.
 *
 * <p><b>짝이 되는 `SaveRow` 가 없다.</b> 이 화면은 셀을 고치지 않으므로(screen/noti-request/requirements.md) 행 단위
 * 저장이 성립하지 않는다 — 입력은 대상 목록 + 상태 + 메모 셋뿐이며 그 셋이 곧 하나의
 * 판정이다.
 */
export interface NotiRequestRow {
  reqId: number;
  /** <b>오름차순</b>이 기본이다 — 대기열은 오래 기다린 것이 먼저다(screen/noti-request/requirements.md). */
  creDtm: string;
  userId: string;
  /** 요청자 이름 — `USER_ID` 만으로는 누가 낸 것인지 판단할 수 없다. */
  userNm: string;
  /**
   * <b>미사용 계정인가</b> — screen/noti-request/requirements.md.
   *
   * <p>이름 옆에 `(미사용)` 을 붙여 *지금 로그인할 수 없는 사람* 임을 알리되
   * <b>처리는 막지 않는다</b>: 요청은 계정이 살아 있을 때 낸 것이다.
   *
   * <p><b>`(삭제된 사용자)` 라는 상태는 없다</b> — `SYS_USER` 는 물리 삭제를 하지
   * 않는다(USER-02 · sys/user-role.md). 65 의 `(삭제된 배치)` 와 갈리는 자리다.
   */
  userUseYn: boolean;
  reqTypeCd: ReqType;
  /** `VARCHAR(2000)` 인데 셀 한 줄에 안 들어간다 — <b>읽기 모드로 연다</b>(frontend/grid.md). */
  reqContent: string;
  reqStatCd: ReqStatus;
  /** 미처리면 `null` 이다. */
  handlerId: string | null;
  handlerNm: string | null;
  handleDtm: string | null;
  handleMemo: string | null;
}
