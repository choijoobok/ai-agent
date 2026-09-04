import { useEffect, useState } from 'react';
import { Button, Checkbox, Descriptions, Modal, Typography } from 'antd';
import dayjs from 'dayjs';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { getNoticePopup } from '@/features/notification/api/notificationApi';
import { dismiss, isDismissed } from '@/features/notification/noticeDismissal';
import type { NoticeDetail } from '@/features/notification/types';

interface Props {
  /** *"N건 더 있음"* 이 여는 곳 — 알림 모달의 공지 탭이다(screen/notice/requirements.md C안). */
  onOpenNotifications: () => void;
}

/**
 * 공지 팝업 — screen/_standalone/README.md · screen/notice/requirements.md **C안**.
 *
 * <h2>최신 1건만 띄운다</h2>
 *
 * <p>나머지는 알림 모달의 공지 탭으로 보낸다 — frontend/tabs.md 에 이미 그 탭이 있으므로 **목록을 두
 * 곳에 만들지 않는다.** 팝업은 **도달을 보장하는 장치**이고 목록은 그 탭이다.
 *
 * <p>어느 건이 뜨는지는 서버가 정한다 — 목록 정렬의 첫 건이며(screen/notice/requirements.md) 그 정렬이
 * 결정적이라 **매 로그인마다 달라지지 않는다.**
 *
 * <h2>셸이 선 뒤에 뜬다 — `NP-01` · `NP-02`</h2>
 *
 * <p>로그인 직후가 아니다. 셸 부팅을 막는 것은 메시지 번들 하나뿐이며 공지는
 * **셸과 병렬로 받아 나중에 띄운다** — 조회가 실패해도 셸은 정상 동작한다. 그래서 이
 * 컴포넌트에는 **오류 표시가 없다**: 뜨지 않는 것이 곧 처리다.
 *
 * <h2>"오늘 하루 보지 않기" 는 기기에 담긴다</h2>
 *
 * <p>`localStorage` · 다음 자정까지 · 영구 숨김 없음(screen/notice/requirements.md · `noticeDismissal`).
 */
export function NoticePopupModal({ onOpenNotifications }: Props) {
  const [notice, setNotice] = useState<NoticeDetail | null>(null);
  const [moreCount, setMoreCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [hideToday, setHideToday] = useState(false);

  useEffect(() => {
    let alive = true;
    getNoticePopup().then(
      (popup) => {
        if (!alive || popup.notice === null || isDismissed(popup.notice.noticeId)) {
          return;
        }
        setNotice(popup.notice);
        setMoreCount(popup.moreCount);
        setOpen(true);
      },
      () => {
        /*
          **삼킨다** — `NP-02`. 공지를 못 읽은 것이 셸을 막지 않는다. 토스트조차 내지
          않는 것은 로그인할 때마다 뜨는 오류가 **팝업보다 더 성가시기** 때문이며, 실패는
          서버 로그에 남는다(backend/packages.md).
        */
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const close = () => {
    if (hideToday && notice !== null) {
      dismiss(notice.noticeId);
    }
    setOpen(false);
  };

  if (notice === null) {
    return null;
  }

  return (
    <Modal
      open={open}
      onCancel={close}
      title={notice.title}
      width={520}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Checkbox
            checked={hideToday}
            onChange={(event) => setHideToday(event.target.checked)}
          >
            {label(MSG.NOTICE_POPUP_DISMISS)}
          </Checkbox>
          <Button type="primary" onClick={close}>
            {label(MSG.COMMON_CLOSE)}
          </Button>
        </div>
      }
    >
      <Descriptions size="small" column={1} style={{ marginBottom: 12 }}>
        <Descriptions.Item label={label(MSG.NOTIFICATION_NOTICE_FROM)}>
          {dayjs(notice.noticeFromDtm).format('YYYY-MM-DD')}
        </Descriptions.Item>
        <Descriptions.Item label={label(MSG.NOTIFICATION_NOTICE_AUTHOR)}>
          {notice.regNm}
        </Descriptions.Item>
      </Descriptions>

      {/* 본문은 텍스트다 — 모르는 형식이 와도 해석하지 않는다(screen/notice/requirements.md · `NoticeDetailView`). */}
      <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
        {notice.content}
      </Typography.Paragraph>

      {/*
        **나머지로 가는 길이 여기 하나다.** 이 링크가 없으면 C안은 "나머지를 못 보는 안" 이
        된다 — 팝업이 최신 1건만 띄우는 근거가 *목록은 탭에 있다* 이므로.

        **가면서 팝업을 닫는다.** 처음에는 열어 둔 채 모달을 띄웠는데, 그러면 목록을 다 보고
        모달을 닫았을 때 **읽고 지나온 팝업이 다시 눈앞에 있다** — 브라우저로 눌러 보고서야
        드러났다. 닫는 경로가 `close` 인 것도 요건이다: 체크해 둔 *오늘 하루 보지 않기* 가
        이 길로 나갈 때도 지켜져야 한다.
      */}
      {moreCount > 0 && (
        <Typography.Link
          onClick={() => {
            close();
            onOpenNotifications();
          }}
        >
          {label(MSG.NOTICE_POPUP_MORE, { count: moreCount })}
        </Typography.Link>
      )}
    </Modal>
  );
}
