// @feat FEAT-508
import { skipToken, useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Modal, Space, Spin, Tabs, Tooltip, Typography } from 'antd';
import { ApiError } from '@/shared/api';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { getBatchHistoryDetail } from '@/modules/system/features/batchhistory/api/batchHistoryApi';

/**
 * 실행 상세 — screen/admin/system/batch/schedule/requirements.md 의 <b>탭 둘</b>. 각각 `textModal` 읽기 전용(frontend/grid.md).
 *
 * <p><b>처음에는 탭 하나였다.</b> *"`RSLT_MSG` 는 `VARCHAR(1000)` 이라 목록 컬럼으로 이미
 * 보인다"* 가 근거였는데, sys/batch.md 이 <b>요약과 상세를 가르면서</b> 한 행에 `nclob` 이 둘이
 * 됐다 — screen/admin/system/log/access/requirements.md 의 *한 행에 둘* 과 같은 모양이 된다.
 *
 * <h2>왕복이 하나다</h2>
 *
 * <p>둘 다 `nclob` 이고 <b>같은 행의 두 컬럼</b>이다. 탭마다 부르면 왕복이 둘이 되고
 * 두 번째가 실패하면 <b>절반만 열린 모달</b>이 된다.
 *
 * <h2>비어 있는 이유를 탭마다 <b>따로</b> 말한다</h2>
 *
 * <table><caption></caption>
 * <tr><td>결과 상세가 없다</td><td><b>이 배치가 대상 목록을 남기지 않는다</b>(sys/batch.md).
 *     <b>대개의 배치가 그렇다</b> — 고장이 아니라 기본값이다</td></tr>
 * <tr><td>오류가 없다</td><td><b>실패하지 않았다</b>. 성공한 실행이며 이쪽이야말로
 *     비어 있는 것이 정상이다</td></tr>
 * </table>
 *
 * <p><b>사유는 탭 이름의 툴팁이 낸다.</b> screen/admin/system/log/access/requirements.md 이 <i>"탭 안에 두었더니 비활성 탭이
 * 열리지 않아 볼 방법이 없었다"</i> 를 <b>실측으로</b> 적은 자리이며, 이 파일은 그 실측을
 * 그대로 물려받는다 — 같은 실패를 두 번 배우지 않는다.
 *
 * <p><b>둘 다 없으면 이 모달이 열리지 않는다</b> — 목록의 `[보기]` 자체가 없다(screen/admin/system/batch/history/requirements.md).
 */
export function BatchDetailModal(props: { histId: number | null; onClose: () => void }) {
  const { histId } = props;

  const detail = useQuery({
    queryKey: ['batchHistory', 'detail', histId],
    queryFn: histId === null ? skipToken : () => getBatchHistoryDetail(histId),
    /*
      <b>끝난 실행의 상세는 바뀌지 않는다.</b> 진행 중인 행은 애초에 `[보기]` 가 없고
      (러너가 종료 시점에야 두 컬럼을 채운다 — sys/batch.md) 끝난 뒤에는 불변이다.
    */
    staleTime: Infinity,
    // 파기된 행(400)에 재시도를 걸면 같은 안내가 늦게 뜬다 — 고쳐질 실패가 아니다.
    retry: false,
  });

  const data = detail.data;

  return (
    <Modal
      open={histId !== null}
      title={label(MSG.BATCH_HISTORY_DETAIL_TITLE)}
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
            <b>앞 행의 탭이 그대로 선택된 채</b> 뜬다(screen/admin/system/log/access/requirements.md 에서 겪은 것과 같다).
          */
          key={histId ?? 'none'}
          /*
            <b>오류가 있으면 오류부터 연다.</b> 실패한 실행을 열어 보는 사람이 찾는 것은
            스택이며, 성공한 실행에는 오류 탭이 아예 꺼져 있다.

            에러 로그가 *전문* 을 먼저 연 것과 방향이 반대인데(screen/admin/system/log/access/requirements.md) 근거는 같다 —
            <b>그 화면에서 대개 있는 쪽</b>을 먼저 연다. 저기는 403 이 압도적이라 스택이
            대개 없었고, 여기는 상세를 남기는 배치가 드물다.
          */
          defaultActiveKey={data?.errMsg ? 'error' : 'result'}
          items={[
            tab({
              key: 'result',
              labelKey: MSG.BATCH_HISTORY_DETAIL_TAB_RESULT,
              text: data?.rsltDtlMsg ?? null,
              // 대개의 배치가 남기지 않는다 — 고장이 아니라 기본값이다(sys/batch.md).
              emptyKey: MSG.BATCH_HISTORY_DETAIL_NO_RESULT,
            }),
            tab({
              key: 'error',
              labelKey: MSG.BATCH_HISTORY_DETAIL_TAB_ERROR,
              text: data?.errMsg ?? null,
              // 성공한 실행이다 — 위와 <b>사유가 다르다</b>.
              emptyKey: MSG.BATCH_HISTORY_DETAIL_NO_ERROR,
            }),
          ]}
        />
      )}
    </Modal>
  );
}

/**
 * 탭 하나 — <b>비었으면 꺼지고, 꺼진 이유는 이름에 붙는다</b>(screen/admin/system/log/access/requirements.md).
 *
 * <p>둘을 한 함수가 만드는 것이 요점이다. 따로 두면 <i>꺼지는 조건</i> 과 <i>사유를 다는
 * 자리</i> 가 한쪽에서만 빠지고, 빠진 쪽은 <b>이유 없이 꺼진 탭</b>이 된다.
 */
function tab(props: { key: string; labelKey: string; text: string | null; emptyKey: string }) {
  const empty = !props.text;
  return {
    key: props.key,
    label: empty ? (
      <Tooltip
        title={label(props.emptyKey)}
        /*
          <b>아래로 연다.</b> 탭 줄이 모달 맨 위라 위쪽에 자리가 없고, 기본값인 위쪽으로
          두면 화면 밖(음수 좌표)에 그려진다 — screen/admin/system/log/access/requirements.md 의 실측이다.
        */
        placement="bottom"
      >
        {/*
          <b>`<span>` 을 덧대야 툴팁이 뜬다.</b> 꺼진 탭은 마우스 이벤트를 내지 않으므로
          (antd 가 `pointer-events` 를 끈다) 겉을 하나 두르고 그 겉에서 다시 켠다.
        */}
        <span style={{ pointerEvents: 'auto' }}>{label(props.labelKey)}</span>
      </Tooltip>
    ) : (
      label(props.labelKey)
    ),
    disabled: empty,
    children: <TextPane text={props.text} emptyKey={props.emptyKey} />,
  };
}

/**
 * 탭 하나의 속 — <b>둘이 똑같이 생겼다</b>.
 *
 * <p><b>잘림 표시가 없다.</b> 에러 로그는 그것을 냈지만(screen/admin/system/log/access/requirements.md) 거기서는 서버가 자르는
 * 상한이 정해져 있었다. 배치의 상세는 <b>절단 상한이 아직 미결</b>이며(sys/batch.md) 그것이
 * 정해지기 전에 표시부터 두면 <i>언제나 안 잘렸다</i> 고 말하는 칸이 된다.
 */
function TextPane(props: { text: string | null; emptyKey: string }) {
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
      <Typography.Text type="secondary">
        {label(MSG.ERROR_LOG_DETAIL_LENGTH, { count: props.text.length })}
      </Typography.Text>
    </Space>
  );
}
