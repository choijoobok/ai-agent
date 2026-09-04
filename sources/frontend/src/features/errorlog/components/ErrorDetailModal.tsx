import { skipToken, useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Modal, Space, Spin, Tabs, Tooltip, Typography } from 'antd';
import { ApiError } from '@/shared/api';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { getErrorLogDetail } from '@/features/errorlog/api/errorLogApi';

/**
 * 상세 — screen/log/access/requirements.md 의 <b>탭 둘</b>. 각각 `textModal` 읽기 전용(frontend/grid.md).
 *
 * <p><b>편집기가 아니다.</b> 이력 행은 불변이며(screen/log/access/requirements.md) 여는 순간 고칠 수 있는 것처럼
 * 보이면 안 된다 — 큰 textarea 지만 잠겨 있고, 여기서 하는 일은 <b>읽고 복사하는 것</b>뿐이다.
 *
 * <h2>왕복이 하나다</h2>
 *
 * <p>둘 다 `nclob` 이고, <b>스택을 보다가 전문을 보는 것이 진단의 기본 동선</b>이다. 탭마다
 * 부르면 왕복이 둘이 되고 두 번째가 실패하면 <b>절반만 열린 모달</b>이 된다.
 *
 * <h2>비어 있는 이유를 탭마다 <b>따로</b> 말한다</h2>
 *
 * <table><caption></caption>
 * <tr><td>스택이 없다</td><td><b>4xx 라 저장하지 않았다</b>(screen/log/access/requirements.md). 인가 거부의 스택은
 *     인터셉터 프레임뿐이고 전 행이 같아서 <b>일부러</b> 비운 것이다</td></tr>
 * <tr><td>전문이 없다</td><td><b>사용 이력 90일이 지났다</b>(screen/log/access/requirements.md). 오류 행은 180일을
 *     살아 멀쩡히 있는데 <b>전문만 다른 테이블에 있어</b> 먼저 파기된다</td></tr>
 * </table>
 *
 * <p><b>둘을 한 문구로 합치지 않는다.</b> 합치면 4xx 를 열어 본 사람이 <i>데이터가
 * 날아갔다</i> 로 읽고, 실제로 파기된 행을 본 사람은 <i>원래 없는 것</i> 으로 읽는다 —
 * 한쪽은 없는 사고를 걱정하고 다른 쪽은 있는 한계를 모른다.
 *
 * <p><b>사유는 탭 이름의 툴팁이 낸다.</b> 처음에는 탭 <i>안</i> 에 두었는데, 비활성 탭은
 * 열리지 않으므로 <b>그 안내를 볼 방법이 없었다</b>(2026-08-30 실측 — 이 파일이 세 문단에
 * 걸쳐 피하려던 바로 그 실패다). 꺼진 것에 이유를 붙이는 자리는 툴팁이며, 설정 창의 꺼진
 * 초기화 버튼과 같은 수법이다(frontend/grid.md) — 거기서도 `<span>` 하나를 덧대야 마우스 이벤트가
 * 산다.
 */
export function ErrorDetailModal(props: { exceptionLogSeq: number | null; onClose: () => void }) {
  const { exceptionLogSeq } = props;

  const detail = useQuery({
    queryKey: ['errorLog', 'detail', exceptionLogSeq],
    queryFn:
      exceptionLogSeq === null ? skipToken : () => getErrorLogDetail(exceptionLogSeq),
    /*
      <b>이력은 불변이다</b>(screen/log/access/requirements.md) — 한 번 읽은 스택이 바뀔 일이 없으므로 다시 물을
      이유도 없다. 같은 행을 두 번 열어도 왕복은 한 번이다.
    */
    staleTime: Infinity,
    // 파기된 행(400)에 재시도를 걸면 같은 안내가 늦게 뜬다 — 고쳐질 실패가 아니다.
    retry: false,
  });

  const data = detail.data;

  return (
    <Modal
      open={exceptionLogSeq !== null}
      title={label(MSG.ERROR_LOG_DETAIL_TITLE)}
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
          message={detail.error instanceof ApiError ? detail.error.message : String(detail.error)}
        />
      ) : (
        <Tabs
          /*
            <b>행마다 새로 세운다.</b> `staleTime: Infinity` 라 두 번째로 여는 행은 대기
            상태를 거치지 않는데, 그러면 `defaultActiveKey` 가 다시 계산되지 않아
            <b>앞 행의 탭이 그대로 선택된 채</b> 뜬다.
          */
          key={exceptionLogSeq ?? 'none'}
          /*
            <b>전문이 먼저다.</b> 스택은 5xx 에만 있고 전문은 대개 있으므로, 스택을 앞에 두면
            403 을 연 사람이 <b>언제나 빈 탭을 먼저</b> 본다 — 이 화면에 403 이 가장 많다.

            <b>다만 전문이 비었으면 스택으로 연다.</b> 꺼진 탭을 골라 두면 모달이 빈 채로
            열리고, 사용자는 <i>아무것도 없다</i> 로 읽는다.
          */
          defaultActiveKey={data?.parameters ? 'payload' : 'stack'}
          items={[
            tab({
              key: 'payload',
              labelKey: MSG.ERROR_LOG_TAB_PAYLOAD,
              text: data?.parameters ?? null,
              truncated: data?.parametersTruncated ?? false,
              // 파기된 것과 원래 없는 것을 가른다 — 서버가 그 둘을 따로 준다(screen/log/access/requirements.md).
              emptyKey: data?.parametersFound
                ? MSG.ERROR_LOG_PAYLOAD_NONE
                : MSG.ERROR_LOG_PAYLOAD_PURGED,
            }),
            tab({
              key: 'stack',
              labelKey: MSG.ERROR_LOG_TAB_STACK,
              text: data?.rootCauseStack ?? null,
              truncated: data?.stackTruncated ?? false,
              // 4xx 는 저장하지 않았다 — 없는 것이 아니라 두지 않은 것이다(screen/log/access/requirements.md).
              emptyKey: MSG.ERROR_LOG_STACK_NONE,
            }),
          ]}
        />
      )}
    </Modal>
  );
}

/**
 * 탭 하나 — <b>비었으면 꺼지고, 꺼진 이유는 이름에 붙는다</b>(screen/log/access/requirements.md).
 *
 * <p>둘을 한 함수가 만드는 것이 요점이다. 따로 두면 <i>꺼지는 조건</i> 과 <i>사유를 다는
 * 자리</i> 가 한쪽에서만 빠지고, 빠진 쪽은 <b>이유 없이 꺼진 탭</b>이 된다.
 */
function tab(props: {
  key: string;
  labelKey: string;
  text: string | null;
  truncated: boolean;
  emptyKey: string;
}) {
  const empty = !props.text;
  return {
    key: props.key,
    label: empty ? (
      <Tooltip
        title={label(props.emptyKey)}
        /*
          <b>아래로 연다.</b> 탭 줄은 모달 <b>맨 위</b>라 위쪽에 자리가 없고, 기본값인
          위쪽으로 두면 화면 밖(음수 좌표)에 그려진다(2026-08-30 실측 — 툴팁은 열렸는데
          보이지 않았다). 가리키는 곳이 아래의 내용 칸이기도 하다.
        */
        placement="bottom"
      >
        {/*
          <b>`<span>` 을 덧대야 툴팁이 뜬다.</b> 꺼진 탭은 마우스 이벤트를 내지 않으므로
          (antd 가 `pointer-events` 를 끈다) 겉을 하나 두르고 그 겉에서 다시 켠다 —
          설정 창의 꺼진 초기화 버튼에서 같은 수법을 썼다(frontend/grid.md).
        */}
        <span style={{ pointerEvents: 'auto' }}>{label(props.labelKey)}</span>
      </Tooltip>
    ) : (
      label(props.labelKey)
    ),
    disabled: empty,
    children: (
      <TextPane text={props.text} truncated={props.truncated} emptyKey={props.emptyKey} />
    ),
  };
}

/**
 * 탭 하나의 속 — <b>둘이 똑같이 생겼다</b>.
 *
 * <p>다른 것은 <i>비었을 때 무엇이라 말하는가</i> 뿐이며, 그것만 밖에서 받는다. 탭마다
 * 따로 만들면 글자 수 표시나 잘림 문구가 한쪽에서만 빠지는 일이 생긴다.
 */
function TextPane(props: { text: string | null; truncated: boolean; emptyKey: string }) {
  if (!props.text) {
    /*
      꺼진 탭은 열리지 않으므로 이 안내는 <b>사람이 읽는 자리가 아니다</b> — 읽는 자리는
      탭 이름의 툴팁이다. 그래도 남기는 것은, 둘 다 비어 antd 가 첫 탭을 강제로 열 때
      모달이 <b>완전히 빈 채</b>로 뜨는 것을 막기 위해서다.
    */
    return <Alert type="info" showIcon message={label(props.emptyKey)} />;
  }
  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Input.TextArea value={props.text} readOnly autoSize={{ minRows: 12, maxRows: 24 }} />
      <Space size={8}>
        <Typography.Text type="secondary">
          {label(MSG.ERROR_LOG_DETAIL_LENGTH, { count: props.text.length })}
        </Typography.Text>
        {props.truncated ? (
          <Typography.Text type="warning">{label(MSG.ERROR_LOG_DETAIL_TRUNCATED)}</Typography.Text>
        ) : null}
      </Space>
    </Space>
  );
}
