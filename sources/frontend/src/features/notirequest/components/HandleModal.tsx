import { useState } from 'react';
import { Alert, Form, Input, Modal, Typography } from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import type { NotiRequestRow, ReqStatus } from '@/features/notirequest/types';

interface Props {
  /** `null` 이면 닫혀 있다. `DONE` 인지 `REJECTED` 인지가 모달의 모양을 가른다. */
  to: ReqStatus | null;
  targets: NotiRequestRow[];
  onCancel: () => void;
  onConfirm: (memo: string) => void;
  busy?: boolean;
}

/**
 * 처리 · 반려 모달 — screen/notice/requirements.md.
 *
 * <h2>셀 편집이 아닌 이유가 이 모달의 존재 이유다</h2>
 *
 * <p>screen/noti-request/requirements.md 가 이 화면에서 편집 열을 통째로 없앤 근거 셋 중 <b>셋째</b>가 여기 있다 —
 * <i>반려는 두 값을 함께 강제해야 하는데 셀 하나로는 안 된다</i>. 상태와 사유가 한 번에
 * 정해져야 하고, 그 둘의 관계(반려면 사유가 필수)를 셀 검증으로는 표현할 수 없다.
 *
 * <h2>확인 문구가 실행마다 다르다</h2>
 *
 * <p>frontend/grid.md 의 `confirm: string` 이 <b>두 번째로 쓰이는 자리</b>다(첫째는 배치 중단 —
 * screen/batch/schedule/requirements.md). 일반 문구는 <i>무엇을 몇 건</i> 만 말하는데, <b>반려에서 중요한 것은
 * 사유가 상대에게 간다는 사실</b>이다 — 그것을 모르고 쓴 메모가 그대로 나간다.
 *
 * <p>처리 쪽은 <b>알림이 들어간다</b>는 사실을 말한다(screen/noti-request/requirements.md). 되돌리는 길이 없으므로
 * 누르기 전에 알아야 한다.
 *
 * <h2>비대칭이 의도다</h2>
 *
 * <p>처리는 메모가 선택이고 반려는 필수다(sys/notification.md). 처리는 <b>결과 자체가 답</b>이지만
 * 반려는 <b>이유가 없으면 답이 아니다</b> — 사유 없는 반려는 요청자가 같은 요청을 다시
 * 내게 만들고, 그것이 워크플로를 만들지 않기로 한 대가를 실제 비용으로 바꾼다.
 */
export function HandleModal({ to, targets, onCancel, onConfirm, busy }: Props) {
  /*
    <b>부모가 `key` 로 다시 마운트한다</b> — 열 때마다 여기가 새로 서므로 사유 칸이
    저절로 빈다. 효과에서 비우면 연쇄 렌더가 되고(react-hooks/set-state-in-effect),
    비우는 시점도 *열린 뒤* 라 한 프레임 동안 앞의 메모가 보인다.
  */
  const [memo, setMemo] = useState('');
  const reject = to === 'REJECTED';

  const blocked = reject && memo.trim() === '';

  return (
    <Modal
      open={to !== null}
      title={label(reject ? MSG.NOTI_REQUEST_MODAL_REJECT : MSG.NOTI_REQUEST_MODAL_DONE)}
      onCancel={onCancel}
      onOk={() => onConfirm(memo)}
      okButtonProps={{ disabled: blocked, loading: busy }}
      destroyOnHidden
      width={520}
    >
      <Typography.Paragraph>
        {label(
          reject ? MSG.NOTI_REQUEST_REJECT_NOTICE : MSG.NOTI_REQUEST_DONE_NOTICE,
          { count: targets.length },
        )}
      </Typography.Paragraph>

      {/*
        <b>대상을 이름으로 보인다.</b> 건수만 말하면 여러 건을 고른 사람이 *무엇을* 처리하는지
        모른 채 누른다 — 되돌릴 수 없는 실행이라(screen/noti-request/requirements.md) 그 확인이 마지막 기회다.
      */}
      <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
        {targets.map((row) => (
          <li key={row.reqId}>
            <Typography.Text>{row.userNm}</Typography.Text>
            <Typography.Text type="secondary"> — {row.reqContent.slice(0, 40)}</Typography.Text>
          </li>
        ))}
      </ul>

      <Form layout="vertical">
        <Form.Item
          label={label(reject ? MSG.NOTI_REQUEST_MEMO_REQUIRED : MSG.NOTI_REQUEST_MEMO_OPTIONAL)}
          required={reject}
          /*
            <b>비어 있을 때만 말한다.</b> 확인 버튼이 이미 비활성이므로(위) 문구는 *왜*
            를 담당한다 — frontend/grid.md 이 <i>눌러서 안내를 받지 않는다</i> 고 한 것과 짝이다.
          */
          validateStatus={blocked ? 'error' : undefined}
          help={blocked ? label(MSG.NOTI_REQUEST_MEMO_REQUIRED) : undefined}
        >
          <Input.TextArea
            rows={4}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder={label(MSG.NOTI_REQUEST_MEMO_PLACEHOLDER)}
            maxLength={2000}
            showCount
          />
        </Form.Item>
      </Form>

      {/*
        미사용 계정이 낸 요청 — <b>처리는 막지 않는다</b>(screen/noti-request/requirements.md). 요청은 계정이 살아
        있을 때 낸 것이고, 계정이 다시 살아나면 그 알림을 본다. <b>`(삭제된 사용자)` 라는
        상태는 없다</b> — `SYS_USER` 는 물리 삭제를 하지 않는다(USER-02 · sys/user-role.md).
      */}
      {targets.some((row) => !row.userUseYn) && (
        <Alert
          type="info"
          showIcon
          message={label(MSG.NOTI_REQUEST_USER_DISABLED)}
        />
      )}
    </Modal>
  );
}
