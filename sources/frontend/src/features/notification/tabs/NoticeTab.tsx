import { useEffect, useState } from 'react';
import { Alert, Checkbox, Empty, List, Skeleton, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { getNoticeList } from '@/features/notification/api/notificationApi';
import type { NoticeBrief } from '@/features/notification/types';

interface Props {
  /** 고른 항목을 상세로 — **새 탭을 열지 않는다**(frontend/tabs.md). */
  onOpen: (notice: NoticeBrief) => void;
  /** 상세가 조회 조건을 그대로 써야 한다 — 지난 공지를 켜서 본 것은 켠 채로 열린다. */
  includeExpired: boolean;
  onIncludeExpiredChange: (value: boolean) => void;
}

/**
 * 공지사항 탭 — screen/_standalone/README.md · screen/notice/requirements.md.
 *
 * <h2>여기가 공지 목록의 실질 자리다</h2>
 *
 * <p>팝업이 최신 1건만 띄우므로(screen/notice/requirements.md C안) 나머지를 볼 곳이 필요하고, 그것을 **여기
 * 하나로** 둔 것이 그 결정의 절반이다 — 팝업의 *"공지 N건 더 있음"* 이 이 탭으로 온다.
 * **목록을 두 곳에 만들지 않는다.**
 *
 * <h2>미읽음 강조를 쓰지 않는다 — `NI-03`</h2>
 *
 * <p>공지에는 읽음 상태가 없다(screen/notice/requirements.md). 전체 공개라 `(NOTICE_ID, USER_ID)` 교차 테이블이
 * **사용자 수 × 공지 수**로 자라고, 배지가 공지를 세지 않으므로(frontend/tabs.md) 저장해도
 * **나타날 곳이 없다.**
 *
 * <h2>지난 공지는 흐리다 — `NI-04`</h2>
 *
 * <p>기본은 감추고 체크박스로 켠다. **켜도 내려진 공지는 오지 않는다**(screen/notice/requirements.md) —
 * *"지난 공지"* 는 기간이 끝난 것이지 내려진 것이 아니다.
 */
export function NoticeTab({ onOpen, includeExpired, onIncludeExpiredChange }: Props) {
  const [rows, setRows] = useState<NoticeBrief[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
    **다시 읽는 동안 앞의 목록을 지우지 않는다.** 효과 안에서 `setRows(null)` 을 부르면
    연쇄 렌더가 되고(`react-hooks/set-state-in-effect`), 화면에서도 체크박스를 켤 때마다
    목록이 사라졌다 나타난다 — 대부분 같은 행이 다시 그려지는데도 그렇다.

    비어 있는 것은 **처음 한 번**뿐이며 그때가 스켈레톤의 자리다.
  */
  useEffect(() => {
    let alive = true;
    getNoticeList(includeExpired).then(
      (loaded) => {
        if (!alive) return;
        setRows(loaded);
        setError(null);
      },
      (failure: unknown) => {
        if (alive) setError(failure instanceof Error ? failure.message : String(failure));
      },
    );
    return () => {
      alive = false;
    };
  }, [includeExpired]);

  return (
    <>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

      {rows === null && !error ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <List
          size="small"
          bordered
          dataSource={rows ?? []}
          locale={{ emptyText: <Empty description={label(MSG.NOTIFICATION_NOTICE_EMPTY)} /> }}
          style={{ maxHeight: 360, overflow: 'auto' }}
          renderItem={(row) => (
            <List.Item
              onClick={() => onOpen(row)}
              style={{
                cursor: 'pointer',
                // 게시가 끝난 것은 흐리다 — `NI-04`. 지우지 않고 **약하게** 보인다.
                opacity: row.noticeStat === 'EXPIRED' ? 0.55 : 1,
              }}
            >
              <List.Item.Meta
                title={<Typography.Text>{row.title}</Typography.Text>}
                description={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(row.noticeFromDtm).format('YYYY-MM-DD')} · {row.regNm}
                  </Typography.Text>
                }
              />
              {/*
                흐린 것만으로는 **왜** 흐린지 말하지 못한다. 배지 하나가 그 이유를 적는다 —
                게시 상태는 서버가 판정한 값이며(screen/notice/requirements.md) 화면이 다시 계산하지 않는다.
              */}
              {row.noticeStat === 'EXPIRED' && (
                <Tag>{label(MSG.NOTIFICATION_NOTICE_EXPIRED)}</Tag>
              )}
            </List.Item>
          )}
        />
      )}

      <div style={{ marginTop: 10, textAlign: 'right' }}>
        <Checkbox
          checked={includeExpired}
          onChange={(event) => onIncludeExpiredChange(event.target.checked)}
        >
          {label(MSG.NOTIFICATION_NOTICE_INCLUDE_EXPIRED)}
        </Checkbox>
      </div>
    </>
  );
}
