import { useCallback, useMemo, useRef, useState } from 'react';
import { Select, theme } from 'antd';
import type { CustomCellEditorProps } from 'ag-grid-react';
import type { SelectOption } from '@/shared/grid/types';

/**
 * 검색 콤보 셀 편집기 — `richSelect` 의 자체 구현(frontend/grid.md · playbook/INDEX.md).
 *
 * <p><b>고르는 것이지 쓰는 것이 아니다.</b> 이 한 줄이 아래 전부를 정한다 — 타이핑은
 * <b>필터</b>이고 그 문자열이 값이 되지 않으며, 고르지 않고 벗어나면 <b>편집 전 값</b>이
 * 남는다. 자유 입력을 남기면 목록에 없는 값이 저장되고 <i>"저장은 되는데 동작하지 않는"</i>
 * 상태가 만들어진다(screen/menu/requirements.md 의 URL 칸이 그 사례다).
 *
 * <p><b>{@code select} 와 갈리는 자리는 후보 수 하나다</b>(playbook/INDEX.md) — 스무 개를 넘으면
 * 스크롤로 찾게 되고, 그때부터 <i>고르는 것</i>이 <i>뒤지는 것</i>이 된다. 판의
 * {@code agSelectCellEditor} 에는 검색이 없어(Enterprise 의 `agRichSelectCellEditor` 가
 * 그 자리다) 여기서 만든다 — frontend/grid.md 이 어댑터 경계를 둔 이유이며, 화면 선언
 * ({@code editor: 'richSelect'})은 판을 바꿔도 그대로다.
 *
 * <h2>후보가 하나로 좁혀지면 확정한다</h2>
 *
 * <p>남은 하나를 <b>다시 고르게 하는 것</b>은 헛수고다(frontend/grid.md). 부분 일치라 검색어를
 * 늘리면 후보는 <b>줄기만 하므로</b>, 지금 하나면 더 쳐도 그 하나이거나 0건이다 —
 * 사용자가 고를 것이 남아 있는데 가로채는 경로가 없다.
 *
 * <p><b>빈 검색어에는 하지 않는다.</b> 후보가 원래 하나뿐인 컬럼이면 창이 열리자마자
 * 값이 확정되어, <i>더블클릭했더니 값이 바뀌었다</i> 가 된다.
 *
 * <h2>바탕과 폭은 {@code DateCellEditor} 와 같은 이유로 우리가 준다</h2>
 *
 * <p>{@code .ag-popup-editor} 는 <b>위치만</b> 갖는다 — 칠하지 않으면 셀에 이미 그려진
 * 글자가 편집기 아래로 비친다.
 */
/** 목록에 보이는 줄 수 × 판의 줄 높이(32px) — 열두 줄. */
const LIST_HEIGHT = 12 * 32;

export interface SearchSelectCellEditorParams {
  options?: SelectOption[];
}

export function SearchSelectCellEditor(props: CustomCellEditorProps<unknown, unknown>) {
  const params = props as CustomCellEditorProps<unknown, unknown> &
    Partial<SearchSelectCellEditorParams>;
  const options = useMemo(() => params.options ?? [], [params.options]);

  const { token } = theme.useToken();
  const cellWidth = props.eGridCell.getBoundingClientRect().width;
  const [open, setOpen] = useState(true);
  /*
    <b>확정은 한 번뿐이다.</b> 자동 확정과 사용자의 선택이 겹칠 수 있고(마지막 글자를
    치는 순간 목록에서 클릭), 두 번 커밋하면 두 번째가 <i>이미 끝난 편집</i>에 값을 쓴다.
  */
  const done = useRef(false);

  const commit = useCallback(
    (value: string) => {
      if (done.current) return;
      done.current = true;
      props.onValueChange(value);
      props.stopEditing();
    },
    [props],
  );

  return (
    <div
      style={{
        width: Math.max(cellWidth, MIN_WIDTH),
        background: token.colorBgElevated,
        borderRadius: token.borderRadius,
        boxShadow: token.boxShadowSecondary,
      }}
    >
      <Select
        autoFocus
        open={open}
        showSearch
        /*
          <b>열두 줄이 한 번에 보인다</b>(판의 기본은 256px — 여덟 줄). 이 편집기가 서는
          자리는 <b>후보가 스무 개를 넘는 칸</b>이고(playbook/INDEX.md), 여덟 줄은 검색으로
          좁힌 뒤에도 <i>뒤지는 느낌</i>을 남긴다 — screen/batch/schedule/requirements.md §4-1
          이 시간대 600개에 대고 *열 줄 이상* 을 요구한 것이 그 이유다.
        */
        listHeight={LIST_HEIGHT}
        variant="borderless"
        style={{ width: '100%' }}
        // 라벨로 거른다 — 사용자가 보는 것이 그것이다. 코드로 거르면 `CH01` 을 쳐야 한다.
        optionFilterProp="label"
        value={scalar(props.value)}
        options={options.map((option) => ({ value: option.value, label: option.text }))}
        // 판이 <b>자기 안으로 세는 팝업</b>이다 — 없으면 고르는 순간 편집이 끝난다.
        classNames={{ popup: { root: 'ag-custom-component-popup' } }}
        onSearch={(text) => {
          if (text === '') return;
          const matched = options.filter((option) => matches(option, text));
          // 남은 하나를 다시 고르게 하지 않는다 — frontend/grid.md.
          if (matched.length === 1) commit(matched[0].value);
        }}
        onChange={(value: string) => commit(value)}
        onOpenChange={(next) => {
          setOpen(next);
          /*
            <b>고르지 않고 닫으면 편집 전 값이 남는다</b>(frontend/grid.md) — {@code onValueChange}
            를 부르지 않았으므로 판이 원래 값을 그대로 둔다. 타이핑한 문자열은 버려진다.
          */
          if (!next && !done.current) props.stopEditing();
        }}
      />
    </div>
  );
}

/** 좁은 컬럼에서도 라벨 하나와 화살표는 들어가야 한다 — {@code DateCellEditor} 와 같다. */
const MIN_WIDTH = 180;

/**
 * AntD 의 기본 필터와 <b>같은 판정</b>이다 — 대소문자 무시 부분 일치.
 *
 * <p>여기서 자동 확정을 재는데 판정이 다르면, <b>목록에는 둘이 보이는데 하나로 확정</b>
 * 되거나 그 반대가 된다.
 */
function matches(option: SelectOption, text: string): boolean {
  return option.text.toLowerCase().includes(text.toLowerCase());
}

function scalar(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
