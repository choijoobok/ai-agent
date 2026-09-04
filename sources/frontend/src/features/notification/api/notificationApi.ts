import { get, post } from '@/shared/api';
import { NOTIFICATION_ENDPOINTS } from '@/features/notification/api/endpoints';
import type {
  MyNotifications,
  MyRequests,
  NoticeBrief,
  NoticeDetail,
  NoticePopup,
  ReqType,
  SystemInfo,
} from '@/features/notification/types';

/**
 * 시스템 정보 — main-shell.md §7.3.
 *
 * <p>**버튼을 눌러야 나간다.** 모달을 열 때 함께 읽지 않는 이유는 알림을 보러 온 사람이
 * 이것을 볼 일이 거의 없기 때문이다 — 문의할 때 한 번 읽는 값이다.
 */
export function getSystemInfo(): Promise<SystemInfo> {
  return get<SystemInfo>(NOTIFICATION_ENDPOINTS.getSystemInfo);
}

/**
 * 공지 탭의 목록 — 60 §8.
 *
 * @param includeExpired `NI-04` 의 "지난 공지 포함". 켜도 **내린 공지는 오지 않는다**
 */
export function getNoticeList(includeExpired: boolean): Promise<NoticeBrief[]> {
  return get<NoticeBrief[]>(NOTIFICATION_ENDPOINTS.getNoticeList, {
    params: { includeExpired },
  });
}

/** 고른 공지 하나 — 본문이 여기서 온다. */
export function getNoticeOne(
  noticeId: number,
  includeExpired: boolean,
): Promise<NoticeDetail> {
  return get<NoticeDetail>(NOTIFICATION_ENDPOINTS.getNoticeOne, {
    params: { noticeId, includeExpired },
  });
}

/**
 * 로그인 뒤 띄울 것 — 60 §9.
 *
 * **실패해도 셸은 동작한다**(`NP-02`). 부르는 쪽이 기다리지 않으며, 셸 부팅을 막는 것은
 * 메시지 번들 하나뿐이다(50 §5).
 */
export function getNoticePopup(): Promise<NoticePopup> {
  return get<NoticePopup>(NOTIFICATION_ENDPOINTS.getNoticePopup);
}

/**
 * 내 알림 — 목록 · 미읽음 · 전건.
 *
 * **여는 것만으로 읽음이 되지 않는다**(main-shell.md §7.2).
 */
export function getMyNotifications(): Promise<MyNotifications> {
  return get<MyNotifications>(NOTIFICATION_ENDPOINTS.getNotiList);
}

/** 배지 하나 — 모달을 열지 않은 채로도 벨이 숫자를 보여야 한다(main-shell.md §7.1). */
export function getUnreadCount(): Promise<number> {
  return get<number>(NOTIFICATION_ENDPOINTS.getUnreadCount);
}

/** 이 항목만 읽음으로 — main-shell.md §7.2. 목록을 되돌린다. */
export function markNotiRead(notiId: number): Promise<MyNotifications> {
  return post<MyNotifications>(NOTIFICATION_ENDPOINTS.saveNotiRead, { notiId });
}

/** 모두 읽음 — 사용자가 **의도적으로 비우는** 경로다(main-shell.md §7.2). */
export function markAllNotiRead(): Promise<MyNotifications> {
  return post<MyNotifications>(NOTIFICATION_ENDPOINTS.saveAllNotiRead);
}

/** 내가 낸 요청 — **최신이 위**다(대기열이 아니라 이력이다 · 66 §5.2.1). */
export function getMyRequests(): Promise<MyRequests> {
  return get<MyRequests>(NOTIFICATION_ENDPOINTS.getMyRequests);
}

/**
 * 새 요청 — 목록을 되돌린다.
 *
 * 같은 유형이 **접수 상태로 열려 있으면 서버가 거부한다**. 화면도 버튼을 막지만 그것은
 * 마지막 방어가 아니다 — 더블클릭 한 번이 여벌을 만든다.
 */
export function createMyRequest(
  reqTypeCd: ReqType,
  reqContent: string,
): Promise<MyRequests> {
  return post<MyRequests>(NOTIFICATION_ENDPOINTS.saveRequest, { reqTypeCd, reqContent });
}
