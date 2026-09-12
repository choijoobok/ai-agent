// @feat FEAT-509
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoticePopupModal } from '@/modules/system/public/notice/NoticePopupModal';
import { getNoticePopup } from '@/modules/system/public/notice/api/noticeApi';

vi.mock('@/modules/system/public/notice/api/noticeApi', () => ({
  getNoticePopup: vi.fn(),
}));

const loadPopup = vi.mocked(getNoticePopup);

describe('공지 팝업', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-5093 기간 밖 공지를 서버가 미노출로 돌려주면 팝업을 열지 않는다', async () => {
    loadPopup.mockResolvedValue({ notice: null, moreCount: 0 });

    render(<NoticePopupModal onOpenNotifications={vi.fn()} />);

    await waitFor(() => expect(loadPopup).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
