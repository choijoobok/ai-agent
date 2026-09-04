import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Form, Input, List, Select, Skeleton, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { createMyRequest, getMyRequests } from '@/features/notification/api/notificationApi';
import type { MyRequests, ReqStatus, ReqType } from '@/features/notification/types';

/** 요청 유형의 라벨 — **요청함 화면과 같은 키**다(같은 값을 두 곳에서 다르게 번역하지 않는다). */
const TYPE_LABEL: Record<ReqType, string> = {
  ROLE_GRANT: MSG.NOTI_REQUEST_TYPE_ROLE_GRANT,
  UNLOCK: MSG.NOTI_REQUEST_TYPE_UNLOCK,
  ETC: MSG.NOTI_REQUEST_TYPE_ETC,
};

const STAT_LABEL: Record<ReqStatus, string> = {
  RECEIVED: MSG.NOTI_REQUEST_STAT_RECEIVED,
  DONE: MSG.NOTI_REQUEST_STAT_DONE,
  REJECTED: MSG.NOTI_REQUEST_STAT_REJECTED,
};

/** 상태의 색 — 요청함 화면의 배지 색과 같다(grid-api-contract.md §6). */
const STAT_TONE: Record<ReqStatus, string | undefined> = {
  RECEIVED: undefined,
  DONE: 'green',
  REJECTED: 'red',
};

/**
 * 내 요청 탭 — NOTI-06 사용자 측(60 §8).
 *
 * <h2>방향이 반대다</h2>
 *
 * <p>앞의 두 탭은 **받는 것**이고 여기는 **보내는 것**이다. 그래서 미읽음이 없고
 * (`NI-15`), 정렬이 최신순이며(내 이력이지 대기열이 아니다 — 66 §5.2.1), 목록에 **버튼이
 * 하나 붙는다.**
 *
 * <h2>처리는 여기서 하지 않는다 — `NI-13`</h2>
 *
 * <p>`NOTI_REQUEST` 메뉴의 일이며 `(NOTI_REQUEST, SAVE)` 권한이 필요하다(52 §7.3).
 * **모달에는 권한을 걸 자리가 없다** — 권한은 `(MENU_CD, ACTION_CD)` 쌍이고 메뉴 밖
 * 화면에는 `MENU_CD` 가 없다(60 §1.1).
 *
 * <h2>같은 유형을 두 번 열지 않는다</h2>
 *
 * <p>접수 상태로 열려 있는 유형은 폼에서 고를 수 있되 **보내기가 막힌다.** 서버도
 * 거부하지만(마지막 방어) 눌러서 오류를 보는 것보다 낫다 — 워크플로가 없으므로(01 §2)
 * 같은 것을 또 내도 진행이 빨라지지 않고, 관리자는 그 여벌을 **하나씩 반려**해야 하며
 * 반려마다 알림이 나간다(66 §5.4).
 */
export function MyRequestTab() {
  const [loaded, setLoaded] = useState<MyRequests | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'new'>('list');

  const [reqTypeCd, setReqTypeCd] = useState<ReqType>('ROLE_GRANT');
  const [reqContent, setReqContent] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getMyRequests().then(
      (next) => {
        if (alive) setLoaded(next);
      },
      (failure: unknown) => {
        if (alive) setError(failure instanceof Error ? failure.message : String(failure));
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const rows = loaded?.rows ?? [];
  const pending = new Set(
    rows.filter((row) => row.reqStatCd === 'RECEIVED').map((row) => row.reqTypeCd),
  );
  const blocked = pending.has(reqTypeCd);

  const submit = () => {
    setBusy(true);
    setError(null);
    createMyRequest(reqTypeCd, reqContent)
      .then(
        (next) => {
          setLoaded(next);
          setReqContent('');
          setMode('list');
        },
        (failure: unknown) =>
          setError(failure instanceof Error ? failure.message : String(failure)),
      )
      .finally(() => setBusy(false));
  };

  if (mode === 'new') {
    return (
      <>
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
        <Form layout="vertical">
          <Form.Item label={label(MSG.NOTIFICATION_REQUEST_TYPE)}>
            <Select
              value={reqTypeCd}
              onChange={setReqTypeCd}
              options={(Object.keys(TYPE_LABEL) as ReqType[]).map((type) => ({
                value: type,
                label: label(TYPE_LABEL[type]),
              }))}
            />
          </Form.Item>
          <Form.Item
            label={label(MSG.NOTIFICATION_REQUEST_CONTENT)}
            required
            /*
              **왜 못 보내는지 말한다.** 버튼이 죽어 있기만 하면 사용자는 권한을 의심한다 —
              여기서 막히는 것은 권한이 아니라 **이미 낸 것이 있다**는 사실이다.
            */
            validateStatus={blocked ? 'warning' : undefined}
            help={blocked ? label(MSG.NOTIFICATION_REQUEST_PENDING) : undefined}
          >
            <Input.TextArea
              rows={4}
              value={reqContent}
              onChange={(event) => setReqContent(event.target.value)}
              placeholder={label(MSG.NOTIFICATION_REQUEST_PLACEHOLDER)}
              maxLength={2000}
              showCount
            />
          </Form.Item>
        </Form>
        {/*
          <b>둘을 양끝으로 가른다</b>(2026-09-01 요청). 나란히 붙여 두었더니 <i>취소를
          실수로 누를 것 같다</i> 는 말이 먼저 나왔다 — 손이 가는 곳은 오른쪽 끝이고,
          그 옆 8px 에 <b>되돌아가는 버튼</b>이 있었다.

          <b>방향이 반대인 둘이다.</b> 하나는 이 폼을 떠나는 것이고 하나는 보내는 것이라,
          같은 무리로 묶을 이유가 애초에 없었다 — 판의 모달 푸터가 둘을 나란히 두는 것은
          <i>확인/취소</i> 처럼 <b>같은 질문의 두 답</b>일 때다.

          <b>초안은 취소로 사라지지 않는다</b> — {@code reqContent} 가 탭의 상태라 다시
          열면 그대로다(모달을 닫으면 사라진다 — {@code destroyOnHidden}). 그래도 자리를
          가르는 편이 맞다: 되돌아간 사람이 <b>글이 남아 있는지 모르는 채</b> 다시 여는
          것이 이미 비용이다.
        */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <Button onClick={() => setMode('list')}>{label(MSG.COMMON_CANCEL)}</Button>
          <Button
            type="primary"
            loading={busy}
            disabled={blocked || reqContent.trim() === ''}
            onClick={submit}
          >
            {label(MSG.NOTIFICATION_REQUEST_SUBMIT)}
          </Button>
        </div>
      </>
    );
  }

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
          locale={{ emptyText: <Empty description={label(MSG.NOTIFICATION_REQUEST_EMPTY)} /> }}
          style={{ maxHeight: 340, overflow: 'auto' }}
          renderItem={(row) => (
            <List.Item>
              <List.Item.Meta
                title={<Typography.Text>{label(TYPE_LABEL[row.reqTypeCd])}</Typography.Text>}
                description={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {row.reqContent}
                    <br />
                    {label(MSG.NOTIFICATION_REQUEST_AT, {
                      date: dayjs(row.creDtm).format('YYYY-MM-DD'),
                    })}
                    {/*
                      **처리자가 쓴 글을 줄에 붙인다.** 상태만 보이면 왜 그렇게 됐는지 알 수
                      없고, 그것을 되묻는 단계가 없다(01 §2) — 한 번의 답이 전부여야 한다.

                      **라벨이 상태마다 다르다.** 반려면 *사유* 이고 처리면 *처리 메모* 다
                      (66 §5.3 의 비대칭 그대로) — 처리된 요청에 "사유" 를 붙이면 <b>처리된
                      것이 반려된 것처럼</b> 읽힌다. 브라우저에서 눌러 보고 드러났다.
                    */}
                    {row.handleMemo &&
                      ` · ${label(
                        row.reqStatCd === 'REJECTED'
                          ? MSG.NOTIFICATION_REQUEST_REASON
                          : MSG.NOTI_REQUEST_COL_MEMO,
                      )}: ${row.handleMemo}`}
                  </Typography.Text>
                }
              />
              <Tag color={STAT_TONE[row.reqStatCd]}>{label(STAT_LABEL[row.reqStatCd])}</Tag>
            </List.Item>
          )}
        />
      )}

      <div style={{ marginTop: 10 }}>
        <Button onClick={() => setMode('new')}>
          {label(MSG.NOTIFICATION_REQUEST_NEW)}
        </Button>
      </div>
    </>
  );
}
