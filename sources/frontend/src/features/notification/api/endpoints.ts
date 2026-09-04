/**
 * 알림 모달의 API — frontend/tabs.md · screen/_standalone/README.md.
 *
 * <p>호출 URL 은 `api/endpoints.ts` 에만 둔다(frontend/packages.md). **`common` 계층이라 `SYS_MENU_API`
 * 시드의 입력이 아니다** — 특정 메뉴에 소속시킬 수 없다(backend/security.md). 이 파일이
 * `generateApiSeed` 에 안 읽히는 유일한 `endpoints.ts` 이며, 그래서 여기 늘어난 여덟
 * 줄은 인가 시드를 건드리지 않는다.
 */
export const NOTIFICATION_ENDPOINTS = {
  getSystemInfo: '/common/system/getSystemInfo',

  // ── 공지사항 탭 · 팝업 (screen/_standalone/README.md) ─────────────────────────
  //
  // 셋 다 조회조건 봉투를 쓰지 않는다 — 동적 조회가 아니다(backend/api.md). 보이는 범위가
  // 서버 코드에 박혀 있는 것이 보안 경계다(screen/notice/requirements.md).
  getNoticeList: '/common/notice/getList',
  getNoticeOne: '/common/notice/getOne',
  getNoticePopup: '/common/notice/getPopup',

  // ── 내 알림 탭 (frontend/tabs.md) ─────────────────────────────
  //
  // 목록 조회는 읽음을 만들지 않는다 — 훑어만 봐도 배지가 사라지면 놓친 알림을 찾을 수
  // 없다. 읽음이 되는 경로는 아래 둘뿐이다.
  getNotiList: '/common/noti/getList',
  getUnreadCount: '/common/noti/getUnreadCount',
  saveNotiRead: '/common/noti/saveRead',
  saveAllNotiRead: '/common/noti/saveAllRead',

  // ── 내 요청 탭 (NOTI-06 사용자 측) ──────────────────────────
  //
  // 처리는 여기 없다 — `NOTI_REQUEST` 메뉴의 일이고 권한이 필요하다(sys/menu.md).
  // **모달에는 권한을 걸 자리가 없다**(NI-13).
  getMyRequests: '/common/notiRequest/getMyList',
  saveRequest: '/common/notiRequest/save',
} as const;
