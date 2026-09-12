// @feat FEAT-507
import { skipToken, useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Modal, Space, Spin, Typography } from 'antd';
import { ApiError } from '@/shared/api';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { getAccessLogDetail } from '@/modules/system/features/accesslog/api/accessLogApi';

/**
 * 요청 전문 — screen/admin/system/log/access/requirements.md 의 `textModal` 읽기 전용.
 *
 * <p><b>편집기가 아니다.</b> 이력 행은 불변이며(screen/admin/system/log/access/requirements.md) 여는 순간 고칠 수 있는 것처럼
 * 보이면 안 된다 — 큰 textarea 지만 잠겨 있고, 여기서 하는 일은 <b>읽고 복사하는 것</b>뿐이다.
 *
 * <p><b>열 때 부른다.</b> 목록에 값이 없으므로(100행 × 1MB) 이 모달이 그 한 행의 `nclob` 만
 * 가져온다 — 그것이 `getDetail` 이 돌아온 유일한 이유다.
 *
 * <p><b>잘렸음을 말한다.</b> 전문은 1MB 에서 잘리며(backend/packages.md), 말하지 않으면 잘린 JSON 을
 * 받은 사람이 *"저장이 깨졌다"* 로 읽는다 — 이 화면에서 가장 흔한 오독이다.
 *
 * <p><b>이미 파기된 행은 목록을 다시 읽지 않는다</b>(screen/admin/system/log/access/requirements.md). 모달만 안내하고 화면은
 * 그대로 둔다 — 보던 목록이 눈앞에서 갈리는 것이 더 나쁘다.
 */
export function PayloadModal(props: { accessLogSeq: number | null; onClose: () => void }) {
  const { accessLogSeq } = props;

  const detail = useQuery({
    queryKey: ['accessLog', 'detail', accessLogSeq],
    queryFn: accessLogSeq === null ? skipToken : () => getAccessLogDetail(accessLogSeq),
    /*
      <b>이력은 불변이다</b>(screen/admin/system/log/access/requirements.md) — 한 번 읽은 전문이 바뀔 일이 없으므로 다시 물을
      이유도 없다. 같은 행의 `[보기]` 를 두 번 눌러도 왕복은 한 번이다.
    */
    staleTime: Infinity,
    // 파기된 행(400)에 재시도를 걸면 같은 안내가 늦게 뜬다 — 고쳐질 실패가 아니다.
    retry: false,
  });

  const text = detail.data?.parameters ?? '';

  return (
    <Modal
      open={accessLogSeq !== null}
      title={label(MSG.ACCESS_LOG_PAYLOAD_TITLE)}
      onCancel={props.onClose}
      footer={[
        <Button key="close" onClick={props.onClose}>
          {label(MSG.COMMON_CLOSE)}
        </Button>,
      ]}
      width={860}
    >
      {detail.isPending ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Spin />
        </div>
      ) : detail.isError ? (
        /* 문구는 서버가 완성해 내려준다 — 화면은 `code` 로 분기하지 않는다(backend/packages.md). */
        <Alert
          type="warning"
          showIcon
          message={
            detail.error instanceof ApiError ? detail.error.message : String(detail.error)
          }
        />
      ) : (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Input.TextArea value={text} readOnly autoSize={{ minRows: 12, maxRows: 24 }} />
          <Space size={8}>
            <Typography.Text type="secondary">
              {label(MSG.ACCESS_LOG_PAYLOAD_LENGTH, { count: text.length })}
            </Typography.Text>
            {detail.data?.truncated ? (
              <Typography.Text type="warning">
                {label(MSG.ACCESS_LOG_PAYLOAD_TRUNCATED)}
              </Typography.Text>
            ) : null}
          </Space>
        </Space>
      )}
    </Modal>
  );
}
