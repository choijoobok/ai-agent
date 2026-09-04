import { useEffect, useRef } from 'react';
import type { CustomCellEditorProps } from 'ag-grid-react';
import { usePopup } from '@/shared/popup/popupContext';
import type { PopupRow } from '@/shared/popup/types';

/**
 * 참조 팝업 셀의 편집기 — frontend/grid.md · playbook/INDEX.md.
 *
 * <p><b>그리는 것이 없다.</b> 편집이 시작되는 순간 모달을 열고, 닫히면 편집을 끝낸다 —
 * 셀 자리에 입력칸을 두면 <b>사람이 거기 타이핑할 수 있게</b> 되고, 그렇게 들어온 값은
 * 팝업을 거치지 않았으므로 <i>딸려 오는 칸</i>이 채워지지 않는다. 그것이 정확히 frontend/grid.md 이
 * 없애려던 불일치다.
 *
 * <p><b>한 번만 연다.</b> 판은 편집기를 다시 그릴 수 있고({@code StrictMode} 는 두 번
 * 마운트한다) 그때마다 열면 <b>모달이 겹쳐 뜬다</b> — 앞의 것이 취소로 닫히면서 사용자가
 * 고른 값이 사라진다.
 *
 * <p><b>값을 {@code onValueChange} 로 넘기지 않는다.</b> 채워지는 것이 이 칸 하나가
 * 아니라 <b>여러 칸</b>이라(그것이 이 컬럼의 존재 이유다) 판의 값 통로로는 표현되지
 * 않는다 — 어댑터가 준 {@code onPick} 이 {@code apply} 를 태워 행에 머지한다.
 */
export interface PopupCellEditorParams {
  popupKey: string;
  /** 이 행에서 만든 팝업의 조회 조건 — frontend/grid.md 의 `param`. */
  param?: (data: unknown) => unknown;
  /** 인가가 매이는 메뉴 — <b>부르는 화면의 것</b>이다(backend/api.md). */
  menuCd: string;
  /** 고른 행을 행에 머지한다. {@code null} 이면 지우는 것이다 — 취소는 여기까지 오지 않는다. */
  onPick: (data: unknown, picked: PopupRow | null) => void;
}

export function PopupCellEditor(props: CustomCellEditorProps<unknown, unknown>) {
  const params = props as CustomCellEditorProps<unknown, unknown> & Partial<PopupCellEditorParams>;
  const open = usePopup();
  const started = useRef(false);
  /*
    <b>판이 넘긴 것들을 ref 로 붙든다.</b> 아래 효과는 <i>한 번만</i> 돌아야 하는데
    (모달이 겹쳐 뜨면 안 된다) 의존성 배열에 이것들을 적으면 렌더마다 새 함수가 와서
    다시 돈다 — 빼면 린트가 옳게 걸린다. 붙들어 두는 것이 <b>의도를 적는 방법</b>이다.

    <b>렌더 중에 쓰지 않는다.</b> 렌더는 순수해야 하고(동시성 모드에서 버려질 수 있다)
    효과는 <b>선언 순서대로</b> 돌므로, 첫 렌더에서도 아래 여는 효과가 보는 값은 이미
    갱신된 것이다.
  */
  const latest = useRef(params);
  useEffect(() => {
    latest.current = params;
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const current = latest.current;
    const key = current.popupKey;
    if (key === undefined) {
      current.stopEditing();
      return;
    }

    void (async () => {
      const data: unknown = current.data;
      const outcome = await open(key, {
        param: current.param ? current.param(data) : undefined,
        menuCd: current.menuCd ?? '',
        // 지금 값이 있는 칸에서만 지우기가 뜬다 — 빈 칸의 지우기는 아무 일도 안 하는 버튼이다.
        clearable: current.value !== null && current.value !== undefined && current.value !== '',
      });

      // 취소는 <b>아무 일도 없음</b>이다 — 값이 그대로 남아야 한다(`PopupOutcome`).
      if (outcome.kind === 'picked') current.onPick?.(data, outcome.row);
      else if (outcome.kind === 'cleared') current.onPick?.(data, null);

      current.stopEditing();
    })();
  }, [open]);

  /*
    <b>셀 자리를 비운다.</b> 판은 편집기 자리에 무언가를 그리길 기대하지만, 여기서는
    모달이 화면 가운데에 뜨므로 셀에 겹쳐 그릴 것이 없다 — 빈 입력칸을 두면 아래 값이
    가려져 <i>고르는 동안 원래 값이 사라진 것</i>처럼 보인다.
  */
  return null;
}
