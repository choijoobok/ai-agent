import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Empty, List, Skeleton, Typography } from 'antd';
import dayjs from 'dayjs';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import {
  getMyNotifications,
  markAllNotiRead,
  markNotiRead,
} from '@/features/notification/api/notificationApi';
import type { MyNotiRow, MyNotifications } from '@/features/notification/types';

interface Props {
  /** 고른 항목을 상세로 — 열기 **전에** 읽음이 된다. */
  onOpen: (row: MyNotiRow) => void;
  /** 헤더 벨의 배지 — main-shell.md §7.1. 이 탭이 유일한 출처다. */
  onUnread: (count: number) => void;
}

/**
 * 내 알림 탭 — main-shell.md §7.1 · §7.2.
 *
 * <h2>배지가 세는 유일한 탭이다</h2>
 *
 * <p>공지는 팝업으로 이미 도달했고(`NI-02`), 요청은 내가 보낸 것이라 *"읽지 않음"* 이
 * 성립하지 않는다(`NI-15`). **배지 하나가 세는 대상이 하나면** *"배지가 3인데 어디에 3이
 * 있나"* 가 생기지 않는다.
 *
 * <h2>목록을 열었다고 전체 읽음 처리하지 않는다 — `NI-06`</h2>
 *
 * <p>훑어만 봐도 배지가 사라지면 **놓친 알림을 찾을 수 없다.** 읽음이 되는 경로는 둘뿐이며
 * (main-shell.md §7.2) 둘 다 사람의 명시적 조작이다 — 항목을 열거나, *모두 읽음* 을 누르거나.
 *
 * <p>그래서 이 컴포넌트의 조회는 `GET` 이고 서버도 `readOnly` 다. **없는 것으로 집행되는
 * 규칙**이라 눈에 띄지 않으므로 여기 적어 둔다.
 */
export function MyNotiTab({ onOpen, onUnread }: Props) {
  const [loaded, setLoaded] = useState<MyNotifications | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = (next: MyNotifications) => {
    setLoaded(next);
    onUnread(next.unreadCount);
  };

  useEffect(() => {
    let alive = true;
    getMyNotifications().then(
      (next) => {
        if (alive) apply(next);
      },
      (failure: unknown) => {
        if (alive) setError(failure instanceof Error ? failure.message : String(failure));
      },
    );
    return () => {
      alive = false;
    };
    // 마운트 때 한 번 — 상세에서 돌아오면 이 컴포넌트가 다시 서고 그때 새로 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 항목을 연다 — **읽음이 먼저다.**
   *
   * 상세를 먼저 띄우고 읽음을 뒤로 미루면, 사용자가 곧바로 모달을 닫았을 때 요청이
   * 취소되어 **본 것이 안 본 것으로 남는다.**
   */
  const open = (row: MyNotiRow) => {
    if (!row.readYn) {
      markNotiRead(row.notiId).then(apply, () => {
        /*
          **읽음 실패가 상세를 막지 않는다.** 읽는 것이 목적이고 표시는 부수 효과다 —
          여기서 막으면 서버가 잠깐 흔들릴 때 알림을 아예 못 읽는다. 배지는 다음 조회에
          맞춰진다.
        */
      });
    }
    onOpen(row);
  };

  const markAll = () => {
    setBusy(true);
    markAllNotiRead()
      .then(apply, (failure: unknown) =>
        setError(failure instanceof Error ? failure.message : String(failure)),
      )
      .finally(() => setBusy(false));
  };

  const rows = loaded?.rows ?? [];
  const truncated = loaded !== null && loaded.totalCount > rows.length;

  return (
    <>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

      {loaded === null && !error ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <List
          size="small"
          bordered
          dataSource={rows}
          locale={{ emptyText: <Empty description={label(MSG.NOTIFICATION_MINE_EMPTY)} /> }}
          style={{ maxHeight: 340, overflow: 'auto' }}
          renderItem={(row) => (
            <List.Item onClick={() => open(row)} style={{ cursor: 'pointer' }}>
              <List.Item.Meta
                // 미읽음은 **점 하나**다 — 공지 탭이 강조를 쓰지 않는 것과 갈리는 자리이며,
                // 여기서는 그 강조가 배지의 근거다(main-shell.md §7.1).
                avatar={row.readYn ? <Badge status="default" /> : <Badge status="processing" />}
                title={
                  <Typography.Text strong={!row.readYn}>{row.title}</Typography.Text>
                }
                description={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {row.content}
                  </Typography.Text>
                }
              />
              <Typography.Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                {dayjs(row.creDtm).format('YYYY-MM-DD HH:mm')}
              </Typography.Text>
            </List.Item>
          )}
        />
      )}

      <div
        style={{
          marginTop: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {label(MSG.NOTIFICATION_MINE_UNREAD, { count: loaded?.unreadCount ?? 0 })}
          {/*
            **잘렸으면 말한다.** 조용히 자르면 목록이 전부로 읽히고, 그러면 없는 알림을
            없다고 확신한다 — 상한은 `sys-config.ui.noti.list-size` 다.
          */}
          {truncated && ` · ${label(MSG.NOTIFICATION_TRUNCATED, { count: rows.length })}`}
        </Typography.Text>
        <Button
          onClick={markAll}
          loading={busy}
          disabled={(loaded?.unreadCount ?? 0) === 0}
        >
          {label(MSG.NOTIFICATION_MINE_MARK_ALL)}
        </Button>
      </div>
    </>
  );
}
