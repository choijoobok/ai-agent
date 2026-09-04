/**
 * 시스템 정보 — frontend/tabs.md. 서버 record 와 1:1 이다.
 *
 * **셋이 `null` 일 수 있다** — `version` · `commit` · `buildTime`. `build-info.properties`
 * 는 Gradle 이 만들므로 IDE 가 클래스만 컴파일해 띄운 서버에는 없다. 없는 것을 있는 것처럼
 * 채우면 그 값이 곧 잘못된 단서가 된다.
 */
export interface SystemInfo {
  /** 활성 Spring 프로필. 비면 `default` 하나로 도는 중이다. */
  profiles: string[];
  version: string | null;
  /** git 리비전. `-dirty` 접미가 붙으면 그 커밋과 같지 않은 빌드다. */
  commit: string | null;
  branch: string | null;
  /** 빌드 시각 — **배포된 것이 만들어진 때**. */
  buildTime: string | null;
  /** 기동 시각 — **마지막으로 올라온 때**. 빌드 시각과 갈리면 재기동만 한 것이다. */
  startedAt: string;
  cacheVersions: Record<string, number>;
}

/**
 * 공지의 게시 상태 — screen/notice/requirements.md. **서버가 판정한다.**
 *
 * <p>클라이언트가 계산하면 PC 시계가 틀린 사람에게 다른 상태가 뜨고, 기준 시각은
 * 브라우저가 아니라 업무 타임존이다(sys/INDEX.md).
 *
 * <p>이 탭에는 `ACTIVE` 와 `EXPIRED` 만 온다 — 내림(`DOWN`)과 예정(`SCHEDULED`)은 아예
 * 조회에서 빠진다(screen/notice/requirements.md). 넷을 다 적는 것은 서버 열거형과 1:1 이라야 하기 때문이다.
 */
export type NoticeStatus = 'DOWN' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED';

/** 알림의 생산자 — screen/notice/requirements.md 의 넷과 1:1 이다. */
export type NotiType = 'REQUEST' | 'AUTH' | 'AUTHZ' | 'BATCH';

/** 요청 유형 — sys/notification.md. 공통코드가 아니다(screen/notice/requirements.md). */
export type ReqType = 'ROLE_GRANT' | 'UNLOCK' | 'ETC';

/** 요청 상태 — **셋에서 닫힌다**(sys/notification.md · NI-12). 워크플로가 아니다. */
export type ReqStatus = 'RECEIVED' | 'DONE' | 'REJECTED';

/**
 * 공지 탭의 한 줄 — screen/_standalone/README.md.
 *
 * **본문이 없다.** 고른 하나만 따로 읽는다(`getNoticeOne`) — `nclob` 을 50건 실어 놓고
 * 그중 하나를 보는 것은 모달을 여는 비용을 안 볼 49건에 매기는 것이다.
 */
export interface NoticeBrief {
  noticeId: number;
  title: string;
  noticeFromDtm: string;
  noticeToDtm: string | null;
  regId: string;
  /** 작성자 **이름**. 못 찾으면 ID 가 그대로 온다. */
  regNm: string;
  /** `EXPIRED` 를 흐리게 그린다 — `NI-04`. */
  noticeStat: NoticeStatus;
}

/**
 * 공지 하나 — 팝업(screen/_standalone/README.md)과 공지 탭의 상세(screen/_standalone/README.md)가 **같은 것을 본다**.
 *
 * `contentTypeCd` 는 지금 언제나 `TEXT` 다(screen/notice/requirements.md). 화면은 **`TEXT` 가 아니면 그대로
 * 텍스트**로 그린다 — 모르는 형식을 해석하는 것이 더 나쁘다.
 */
export interface NoticeDetail extends NoticeBrief {
  content: string;
  contentTypeCd: string;
}

/**
 * 로그인 뒤 뜨는 팝업 — screen/notice/requirements.md **C안**.
 *
 * `notice` 가 `null` 인 것이 **정상**이다 — 팝업 대상이 없는 날이 대부분이며 그때 화면은
 * 아무것도 열지 않는다.
 */
export interface NoticePopup {
  notice: NoticeDetail | null;
  /** 지금 게시중인 공지 중 이 하나를 뺀 수. 0 이면 "N건 더 있음" 링크를 감춘다. */
  moreCount: number;
}

/** 내 알림 한 줄 — frontend/tabs.md. */
export interface MyNotiRow {
  notiId: number;
  notiTypeCd: NotiType;
  title: string;
  content: string | null;
  /**
   * 클릭하면 갈 메뉴. `null` 이면 이동 없음이다.
   *
   * **내 메뉴 트리에 없으면 이동 버튼을 비활성한다**(`NI-11`) — 눌러서 403 을 보는 것보다
   * 낫다. **알림이 권한을 주지 않는다.**
   */
  linkMenuCd: string | null;
  linkParam: string | null;
  readYn: boolean;
  creDtm: string;
}

/**
 * 내 알림 탭이 한 번에 받는 것.
 *
 * **셋이 함께 온다.** 목록에는 상한이 있으므로 화면이 미읽음을 세면 그 셈은 상한 안에서만
 * 맞다 — 배지가 세야 하는 것은 **전건의 미읽음**이다(frontend/tabs.md).
 */
export interface MyNotifications {
  rows: MyNotiRow[];
  unreadCount: number;
  /** `rows.length` 와 다르면 **잘렸다** — 화면이 "최근 N건" 이라고 말한다. */
  totalCount: number;
}

/** 내 요청 한 줄 — screen/_standalone/README.md. 요청자는 언제나 나라서 싣지 않는다. */
export interface MyRequestRow {
  reqId: number;
  creDtm: string;
  reqTypeCd: ReqType;
  reqContent: string;
  reqStatCd: ReqStatus;
  handleDtm: string | null;
  /** **반려 사유가 여기 온다**(screen/notice/requirements.md). 처리에서는 비어 있을 수 있다. */
  handleMemo: string | null;
}

/** 내 요청 탭이 받는 것 — **미읽음이 없다**(내가 보낸 것이다 · frontend/tabs.md). */
export interface MyRequests {
  rows: MyRequestRow[];
  totalCount: number;
}
