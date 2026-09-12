// @feat FEAT-509
import { get } from '@/shared/api';
import { SYSTEM_NOTICE_ENDPOINTS } from '@/modules/system/public/notice/api/endpoints';
import type { NoticeBrief, NoticeDetail, NoticePopup } from '@/modules/system/public/notice/types';

export function getNoticeList(includeExpired: boolean): Promise<NoticeBrief[]> {
  return get<NoticeBrief[]>(SYSTEM_NOTICE_ENDPOINTS.getList, { params: { includeExpired } });
}

export function getNoticeOne(noticeId: number, includeExpired: boolean): Promise<NoticeDetail> {
  return get<NoticeDetail>(SYSTEM_NOTICE_ENDPOINTS.getOne, {
    params: { noticeId, includeExpired },
  });
}

export function getNoticePopup(): Promise<NoticePopup> {
  return get<NoticePopup>(SYSTEM_NOTICE_ENDPOINTS.getPopup);
}
