/**
 * 게시 상태 넷 — 66 §4.4. <b>저장되지 않는 파생 값</b>이다.
 *
 * <p><b>순서가 서버 열거형과 같다</b>({@code NoticeStatus}) — `features/notification` 에도
 * 같은 선언이 있고(전 사용자에게 열리는 표시 측이다), 기능끼리 import 하지 않는 규칙
 * (frontend-stack.md §2)이라 <b>사본이 둘인 것은 의도다</b>. 그렇다면 최소한 같아야 한다: 순서가
 * 갈리면 같은 열거형이 두 파일에서 다르게 읽힌다.
 */
export type NoticeStatus = 'DOWN' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED';

/** 서버 `NoticeRow` 와 1:1 — 66 §4.2. */
export interface NoticeRow {
  /** 상단 고정용. <b>드래그가 아니라 숫자다</b>(66 §4.2.1). */
  sortNo: number | null;
  /** 채번이라 <b>신규 행에서 `null`</b> 이다. 문의 대조용이며 기본 숨김이다. */
  noticeId: number | null;
  /** <b>필수</b>. */
  title: string;
  /**
   * 본문 — `nclob` 인데 <b>목록이 싣는다</b>(66 §4.2).
   *
   * <p>64 가 이력에서 전문을 싣지 않은 것과 갈리는데 근거가 양이었기 때문이다 — 이력은
   * 수천만 행이고 공지는 수백 건이며 페이지 사이즈가 20 이다. 그리고 여기서는
   * <b>본문이 편집 대상</b>이라 별도 조회로 빼면 열 때마다 왕복이 하나 는다.
   */
  content: string;
  /** 게시 시작 — <b>필수</b>다. 예약 게시가 여기서 성립한다(47 §9.2). */
  noticeFromDtm: string;
  /** 게시 종료 — <b>`null` 이면 무기한</b>이다(47 §9.2). */
  noticeToDtm: string | null;
  /**
   * 파생 — <b>서버가 판정한다</b>(66 §4.4).
   *
   * <p>클라이언트가 계산하면 PC 시계가 틀린 사람에게 다른 배지가 뜨고, 기준 시각은
   * 브라우저가 아니라 `app.business-timezone` 이다(40 §4.3).
   */
  noticeStat: NoticeStatus;
  /**
   * <b>즉시 내림</b>이며 기간과 축이 다르다(47 §9.2).
   *
   * <p>표시 판정에서 이것이 기간을 이긴다 — `false` 면 기간 안이어도 목록에서 사라진다.
   * 기간을 고쳐 내리게 하면 <b>미래의 게시 계획을 손으로 지우는 일</b>이 된다.
   */
  useYn: boolean;
  popupYn: boolean;
  /** 팝업 기간 — <b>게시 기간 안</b>이어야 하며 저장이 막는다(66 §4.5). */
  popupFromDtm: string | null;
  popupToDtm: string | null;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}
