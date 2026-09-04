import { useCallback, useRef, useState } from 'react';
import { Input, Modal } from 'antd';
import type { CustomCellEditorProps } from 'ag-grid-react';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';

/**
 * 긴 텍스트의 <b>넓은 쪽</b> — `textModal`(frontend/grid.md · playbook/INDEX.md).
 *
 * <p>`largeText`(셀 위 팝업)와 <b>같은 어휘의 다른 크기</b>다. 갈리는 것이 셋이다 —
 * 자리(셀 위 vs 화면 중앙) · 크기(셀 너비 기준 vs 넓다) · <b>글자 수</b>. 마지막이
 * 이 편집기의 실질이며, 판의 {@code agLargeTextCellEditor} 에는 <b>글자 수가 없다</b>
 * (frontend/grid.md 의 표가 그 칸을 <i>감수한 것</i> 으로 적었다).
 *
 * <p><b>글자 수가 왜 필요한가</b> — `nclob` 이라 상한이 화면에만 있다. 서버가 자르면
 * 사용자는 <b>저장한 뒤에</b> 알고, 그때 잘린 앞부분만 남아 있어 무엇이 사라졌는지
 * 화면 어디에도 없다.
 *
 * <p><b>한 행에 모달 대상이 둘일 때</b>(frontend/grid.md 미결) — 샘플은 `MEMO`(`largeText`)와
 * `RMK`(`textModal`)로 <b>에디터를 갈라</b> 두었다(playbook/INDEX.md). screen/log/access/requirements.md 의 *모달 하나 + 탭 둘*
 * 은 읽기 전용의 해법이고, 편집 대상 둘은 <b>여는 모양이 다르면</b> 사용자가 어느 칸을
 * 열었는지 창을 보고 안다.
 *
 * <p><b>취소는 되돌리기이지 비우기가 아니다</b> — {@code onValueChange} 를 부르지 않으면
 * 판이 원래 값을 남긴다. 취소가 값을 지우면 <b>취소가 데이터를 바꾼 것</b>이 된다
 * (frontend/grid.md 이 검색 콤보에 대해 적은 것과 같은 규칙이다).
 */
export interface TextModalCellEditorParams {
  /** 창의 제목 — 컬럼 헤더다. */
  title: string;
  /** 글자 수 상한. 세는 것이 이 편집기의 존재 이유이므로 <b>없을 수 없다</b>. */
  maxLength: number;
  /** 편집이 닫힌 칸이면 <b>읽고 닫는다</b> — frontend/grid.md. */
  readOnly?: boolean;
}

export function TextModalCellEditor(props: CustomCellEditorProps<unknown, unknown>) {
  const params = props as CustomCellEditorProps<unknown, unknown> &
    Partial<TextModalCellEditorParams>;
  const [text, setText] = useState(() => (typeof props.value === 'string' ? props.value : ''));
  const done = useRef(false);

  const close = useCallback(
    (next: string | null) => {
      if (done.current) return;
      done.current = true;
      /*
        <b>빈 칸은 {@code null} 이다.</b> 빈 문자열을 그대로 보내면 <i>지웠다</i> 와
        <i>원래 없었다</i> 가 DB 에서 갈리고(`NULL` 과 `''`), 그 둘은 조회 조건에서
        다르게 걸린다 — `isNull` 이 지운 행을 찾지 못한다.
      */
      if (next !== null) props.onValueChange(next === '' ? null : next);
      props.stopEditing();
    },
    [props],
  );

  return (
    <Modal
      open
      title={params.title}
      // 판이 자기 안으로 세는 팝업이다 — {@code ListModalCellEditor} 와 같은 자리.
      rootClassName="ag-custom-component-popup"
      onCancel={() => close(null)}
      onOk={() => close(text)}
      okText={label(MSG.GRID_CONFIRM_OK)}
      cancelText={label(MSG.COMMON_CANCEL)}
      // 읽기 전용은 <b>읽고 닫는다</b> — 확인이 할 일이 없다(frontend/grid.md).
      okButtonProps={{ style: params.readOnly ? { display: 'none' } : undefined }}
      width={720}
      destroyOnHidden
    >
      <Input.TextArea
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        readOnly={params.readOnly}
        rows={14}
        // 세는 것이 이 편집기의 존재 이유다 — 상한이 없으면 `largeText` 와 다를 것이 없다.
        showCount
        maxLength={params.maxLength ?? DEFAULT_MAX_LENGTH}
      />
    </Modal>
  );
}

/**
 * 선언이 상한을 빠뜨렸을 때 — 판의 긴 글 편집기와 <b>같은 값</b>이다({@code maxLength: 2000}).
 *
 * <p>무제한으로 두지 않는 것은 <b>글자 수 표시가 사라지기 때문</b>이다 — AntD 의
 * {@code showCount} 는 상한이 있어야 <i>n / 상한</i> 을 그리고, 없으면 센 수만 보여
 * <b>얼마나 남았는지</b> 를 말하지 못한다.
 */
const DEFAULT_MAX_LENGTH = 2000;
