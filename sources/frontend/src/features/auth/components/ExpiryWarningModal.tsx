import { Button, Modal, Typography } from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';

/**
 * 만료 예고 — 50 §7.
 *
 * <p><b>재인증 모달과 다른 것이다.</b> 저것은 <i>이미 만료된 뒤</i> 복구하는 것이고
 * (ADR-0021) 이것은 <i>아직 살아 있을 때</i> 묻는 것이다 — 둘이 동시에 뜰 수는 없다:
 * 만료되면 이 모달이 사라지고 401 이 저것을 띄운다.
 *
 * <p><b>닫기(✕)를 둔다.</b> 재인증 모달과 갈리는 자리다 — 저기서는 출구가 셋뿐이었지만
 * (ADR-0021) 여기서는 <b>세션이 아직 살아 있어</b> 그냥 계속 일하는 것이 정당한 선택이다.
 * 닫아도 시한은 그대로이며, 그 사이 아무 요청이나 나가면 세션이 밀려 예고가 사라진다.
 */

interface Props {
  open: boolean;
  remainingMinutes: number;
  onExtend: () => void;
  onLogout: () => void;
  onClose: () => void;
}

export function ExpiryWarningModal({ open, remainingMinutes, onExtend, onLogout, onClose }: Props) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={label(MSG.SESSION_EXPIRY_TITLE)}
      footer={[
        <Button key="logout" onClick={onLogout}>
          {label(MSG.SESSION_EXPIRY_LOGOUT)}
        </Button>,
        <Button key="extend" type="primary" onClick={onExtend}>
          {label(MSG.SESSION_EXPIRY_EXTEND)}
        </Button>,
      ]}
    >
      <Typography.Paragraph>
        {/* 훅이 올림해 넘긴다 — 바닥을 1 로 잡는 것은 "0분 뒤" 가 이미 지난 것처럼 읽히기 때문이다. */}
        {label(MSG.SESSION_EXPIRY_BODY, { minutes: Math.max(1, remainingMinutes) })}
      </Typography.Paragraph>
    </Modal>
  );
}
