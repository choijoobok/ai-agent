// @feat FEAT-509
export type NoticeStatus = 'DOWN' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED';

export interface NoticeBrief {
  noticeId: number;
  title: string;
  noticeFromDtm: string;
  noticeToDtm: string | null;
  regId: string;
  regNm: string;
  noticeStat: NoticeStatus;
}

export interface NoticeDetail extends NoticeBrief {
  content: string;
  contentTypeCd: string;
}

export interface NoticePopup {
  notice: NoticeDetail | null;
  moreCount: number;
}
