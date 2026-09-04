import { useCallback, useRef, useState, type ReactNode } from 'react';
import { DatePicker, Form, InputNumber, Modal, Typography } from 'antd';
import dayjs from 'dayjs';
import { datePattern } from '@/shared/grid/dateFormat';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { ParamModalContextProvider } from '@/shared/formmodal/paramModalContext';
import type { OpenParamModal, ParamField, ParamModalSpec } from '@/shared/formmodal/types';

/**
 * 실행 파라미터 모달이 열리는 <b>단 한 자리</b> — frontend/grid.md · playbook/INDEX.md. frontend/packages.md 의 `<FormModal>`.
 *
 * <p><b>팝업 호스트와 같은 모양</b>이다(`PopupHost`) — 앱 루트에 하나만 서고, 열려 있는데
 * 또 부르면 앞의 약속을 <b>취소로 닫는다</b>: 매달아 두면 앞의 실행이 영영 기다린다.
 *
 * <p><b>레지스트리가 없다.</b> 팝업은 <i>고르는 창</i>이라 화면 여럿이 같은 것을 쓰지만,
 * 실행 인자는 <b>그 실행 하나의 것</b>이다 — 등록해 두면 어느 실행의 인자인지 키 이름으로
 * 추측하게 되고, 그 키는 쓰는 곳이 하나뿐이라 <b>이름을 지을 근거가 없다</b>.
 *
 * <p><b>확인을 겸한다</b>(frontend/grid.md) — 건수를 위에 적고 실행/취소를 둔다. 그래서 그리드는
 * {@code params} 가 있으면 확인 다이얼로그를 띄우지 않는다({@code useGridController}).
 */
export function FormModalHost({ children }: { children: ReactNode }) {
  const [spec, setSpec] = useState<ParamModalSpec | null>(null);
  // 약속을 상태에 담지 않는다 — 렌더마다 새 객체가 되면 어느 쪽 약속인지 알 수 없다.
  const pending = useRef<((value: Record<string, unknown> | null) => void) | null>(null);

  const settle = useCallback((value: Record<string, unknown> | null) => {
    const resolve = pending.current;
    pending.current = null;
    setSpec(null);
    if (resolve) resolve(value);
  }, []);

  const open = useCallback<OpenParamModal>((next) => {
    const previous = pending.current;
    pending.current = null;
    // 앞의 것은 취소다 — 실행이 일어나지 않는다(frontend/grid.md 의 `null`).
    if (previous) previous(null);

    return new Promise<Record<string, unknown> | null>((resolve) => {
      pending.current = resolve;
      setSpec(next);
    });
  }, []);

  return (
    <ParamModalContextProvider value={open}>
      {children}
      {/*
        <b>{@code key} 로 새로 만든다</b> — 같은 호스트가 실행 둘의 인자를 번갈아 받으므로,
        남겨 두면 <b>앞 실행에 입력한 값</b>이 다음 창에 그대로 남는다. 칸 이름이 같으면
        (`baseDt`) 사용자는 그것을 <i>기본값</i> 으로 읽고 그대로 실행한다.
      */}
      {spec && <ParamModal key={spec.title} spec={spec} onSettle={settle} />}
    </ParamModalContextProvider>
  );
}

function ParamModal(props: {
  spec: ParamModalSpec;
  onSettle: (value: Record<string, unknown> | null) => void;
}) {
  const { spec } = props;
  const [form] = Form.useForm<Record<string, unknown>>();

  const submit = useCallback(async () => {
    /*
      <b>검증에 걸리면 창이 닫히지 않는다.</b> AntD 는 실패를 예외로 내므로 여기서
      삼킨다 — frontend/grid.md 의 <i>검증 실패도 실행하지 않는다</i> 는 <b>취소와 같은 결과</b>이지만
      <b>같은 동작이 아니다</b>: 취소는 창이 닫히고 이쪽은 열린 채로 이유가 붙는다.
    */
    let values: Record<string, unknown>;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    props.onSettle(serialize(values, spec.fields));
  }, [form, props, spec.fields]);

  return (
    <Modal
      open
      title={label(spec.title)}
      onCancel={() => props.onSettle(null)}
      onOk={() => void submit()}
      okText={label(MSG.PARAMS_RUN)}
      cancelText={label(MSG.COMMON_CANCEL)}
      width={480}
      destroyOnHidden
    >
      {/*
        <b>건수가 곧 확인 문구다</b>(frontend/grid.md) — 이것이 없으면 사용자는 자기가 무엇에 대해
        값을 넣고 있는지 모른 채 실행한다. {@code target: 'none'} 인 실행에는 건수가
        없으므로 줄도 없다.
      */}
      {spec.count !== undefined && (
        <Typography.Paragraph type="secondary">
          {label(MSG.PARAMS_COUNT, { count: spec.count })}
        </Typography.Paragraph>
      )}
      <Form form={form} layout="vertical" initialValues={initialValues(spec.fields)}>
        {spec.fields.map((field) => (
          <Form.Item
            key={field.name}
            name={field.name}
            label={label(field.label)}
            // 문구는 판이 만든다 — 칸마다 규칙 하나뿐이라 우리 문구를 더할 것이 없다.
            rules={[{ required: field.required === true }]}
          >
            {control(field)}
          </Form.Item>
        ))}
      </Form>
    </Modal>
  );
}

function control(field: ParamField) {
  if (field.type === 'date') {
    // 조회조건·셀 편집기와 <b>같은 달력</b>이다 — 다르면 한 앱에서 날짜 고르는 법이 둘이다.
    return <DatePicker style={{ width: '100%' }} format={datePattern('day')} />;
  }
  return <InputNumber style={{ width: '100%' }} />;
}

/**
 * 기본값 — <b>날짜만 판의 객체로 바꾼다</b>.
 *
 * <p>선언은 문자열(`'2026-09-01'`)이고 {@code DatePicker} 는 {@code Dayjs} 를 받는다.
 * 문자열을 그대로 주면 칸이 <b>빈 채로</b> 뜨는데, 선언에는 기본값이 있으므로 그것은
 * <i>기본값이 안 먹는</i> 상태다.
 */
function initialValues(fields: ParamField[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.defaultValue === undefined) continue;
    values[field.name] =
      field.type === 'date' ? dayjs(String(field.defaultValue)) : field.defaultValue;
  }
  return values;
}

/**
 * 나가는 모양으로 — <b>표시 형식과 다른 축이다</b>({@code DateCellEditor} 와 같은 규칙).
 *
 * <p>{@code ui.date-format.*} 가 `YYYY.MM.DD` 로 바뀌어도 서버가 받는 것은 `LocalDate`
 * 그대로여야 한다 — 표시 형식을 그대로 보내면 <b>설정을 바꾼 날 파싱이 깨진다</b>.
 */
function serialize(
  values: Record<string, unknown>,
  fields: ParamField[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.name];
    if (value === undefined || value === null) {
      // 비운 칸은 <b>키째 빼지 않는다</b> — 서버가 *안 보냈다* 와 *비웠다* 를 가르지 않는다.
      out[field.name] = null;
      continue;
    }
    out[field.name] = field.type === 'date' ? dayjs(value as string).format('YYYY-MM-DD') : value;
  }
  return out;
}
