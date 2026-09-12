import { get, post } from '@/shared/api';
import { NOTIFICATION_ENDPOINTS } from '@/features/notification/api/endpoints';
import type {
  MyNotifications,
  MyRequests,
  ReqType,
  SystemInfo,
} from '@/features/notification/types';

/**
 * 시스템 정보 — frontend/tabs.md.
 *
 * <p>**버튼을 눌러야 나간다.** 모달을 열 때 함께 읽지 않는 이유는 알림을 보러 온 사람이
 * 이것을 볼 일이 거의 없기 때문이다 — 문의할 때 한 번 읽는 값이다.
 */
export function getSystemInfo(): Promise<SystemInfo> {
  return get<SystemInfo>(NOTIFICATION_ENDPOINTS.getSystemInfo);
}

/**
 * 내 알림 — 목록 · 미읽음 · 전건.
 *
 * **여는 것만으로 읽음이 되지 않는다**(frontend/tabs.md).
 */
export function getMyNotifications(): Promise<MyNotifications> {
  return get<MyNotifications>(NOTIFICATION_ENDPOINTS.getNotiList);
}

/** 배지 하나 — 모달을 열지 않은 채로도 벨이 숫자를 보여야 한다(frontend/tabs.md). */
export function getUnreadCount(): Promise<number> {
  return get<number>(NOTIFICATION_ENDPOINTS.getUnreadCount);
}

/** 이 항목만 읽음으로 — frontend/tabs.md. 목록을 되돌린다. */
export function markNotiRead(notiId: number): Promise<MyNotifications> {
  return post<MyNotifications>(NOTIFICATION_ENDPOINTS.saveNotiRead, { notiId });
}

/** 모두 읽음 — 사용자가 **의도적으로 비우는** 경로다(frontend/tabs.md). */
export function markAllNotiRead(): Promise<MyNotifications> {
  return post<MyNotifications>(NOTIFICATION_ENDPOINTS.saveAllNotiRead);
}

/** 내가 낸 요청 — **최신이 위**다(대기열이 아니라 이력이다 · screen/admin/system/notice/requirements.md). */
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
