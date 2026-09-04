import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getGridPref, resetGridPref, saveGridPref } from '@/shared/grid/pref/api/gridPrefApi';
import {
  applyPref,
  parsePref,
  signatureOf,
  toPrefValue,
  type GridPrefValue,
} from '@/shared/grid/pref/gridPref';
import type { ColumnDef } from '@/shared/grid/types';

/**
 * 저장된 그리드 설정을 읽어 선언에 입힌다 — UX-06 · frontend/grid.md.
 *
 * <p><b>실패하면 조용히 선언 그대로 간다.</b> 개인 편의 기능이고, 화면에 들어올 때마다 뜨는
 * 빨간 토스트는 **고칠 수 없는 경고**다 — 그리드 자체는 그것 없이도 제 일을 한다
 * (`SavedCondControl` 과 같은 태도다).
 *
 * <p><b>시그니처는 선언에서만 만든다.</b> 사용자가 바꾼 순서를 넣으면 순서를 바꿀 때마다
 * 시그니처가 달라져 **자기 설정이 자기를 폐기한다**(UX-13).
 */
export interface GridPrefHandle<T> {
  /** 저장된 것을 입힌 컬럼 — 그리드가 이것을 그린다. */
  columns: ColumnDef<T>[];
  /**
   * <b>저장된 개인화가 있는가</b> — 설정 창의 <i>초기화</i> 가 이것으로 켜지고 꺼진다(frontend/grid.md).
   *
   * <p><b>화면이 선언과 다른가</b> 가 아니라 <b>DB 에 행이 있는가</b> 다. 앞엣것으로
   * 판정했더니 창에서 컬럼을 켜고 끄기만 해도 초기화가 켜졌고, 사용자는 그것을
   * <b>저장됐다</b> 로 읽었다(2026-08-30 실물 — <i>"저장을 안 눌렀는데 자동 저장인가"</i>).
   *
   * <p>저장하지 않은 변경을 되돌리는 일은 <b>취소</b>가 맡는다 — 버튼 하나가 두 일을
   * 겸하면 그 상태를 사람이 구분할 수 없다.
   */
  saved: boolean;
  /**
   * <b>헤더를 끌어 순서를 바꿨을 때</b> 그 순서를 받는다 — 저장하지는 않는다(frontend/grid.md).
   *
   * <p>받지 않으면 <b>판만 아는 순서</b>가 생긴다. 그러면 설정 창을 열었을 때 <i>처음
   * 순서</i> 가 나오고, 창에서 순서를 바꿔 저장해도 판이 자기 순서를 고집한다 — 사용자가
   * 겪는 것은 <b>양쪽이 서로를 무시하는</b> 화면이다(2026-08-30 실물).
   */
  reorder: (fields: string[]) => void;
  /**
   * <b>지금 화면에 바로 입힌다</b> — 서버에 보내지 않는다(frontend/grid.md).
   *
   * <p>설정 창에서 컬럼을 옮기거나 껐을 때 부른다. <b>적용과 저장은 다른 일</b>이다:
   * 사용자는 껐다 켜보며 맞추는데(그래서 저장 버튼이 있다) 그 <i>맞춰 보는 것</i> 이
   * 창을 닫아야만 보인다면 <b>맞춰 볼 수가 없다</b>(2026-08-30 실물).
   */
  apply: (next: ColumnDef<T>[]) => void;
  /**
   * <b>지금 화면의 것을 되감을 자리로 삼는다</b> — 설정 창의 <i>적용</i> 이 부른다(frontend/grid.md).
   *
   * <p><b>{@code apply} 와 다른 것이다.</b> 저것은 창에서 <b>한 칸 고칠 때마다</b> 불려
   * 화면에 즉시 입히는 미리보기이고, 이것은 <b>버튼 하나</b>다 — <i>여기까지를 남기겠다</i>
   * 는 선언이며, 그래서 <b>{@code cancel} 이 여기로 돌아온다</b>.
   *
   * <p><b>DB 에는 아무것도 가지 않는다.</b> {@code saved} 는 그대로 <i>DB 에 행이 있는가</i>
   * 이므로 <b>초기화는 여전히 꺼져 있다</b> — 이 버튼이 옮기는 것은 되감기 자리 하나다.
   */
  keep: (next: ColumnDef<T>[]) => void;
  /**
   * <b>적용한 것을 물린다</b> — 설정 창의 <i>취소</i> 가 부른다(frontend/grid.md).
   *
   * <p>돌아가는 자리는 <b>마지막으로 남기기로 한 상태</b>다: 저장했거나({@code save})
   * 적용한({@code keep}) 것, 둘 다 없으면 선언이다. 창 밖에서 만든 변경(헤더 드래그)과 창
   * 안에서 고치는 중인 것은 <b>아직 남기기로 한 것이 아니므로</b> 함께 물린다.
   *
   * <p><b>DB 가 기준이 아니다</b>(2026-08-31 — 지시). 전에는 저장된 것으로만 돌아갔는데,
   * 그러면 <i>적용</i> 으로 맞춰 둔 화면이 <b>그 뒤에 창을 열어 무엇 하나만 고치고 취소해도
   * 함께 날아갔다</b> — 남기기로 한 것과 해 보는 중인 것을 가르는 선이 <b>저장 하나뿐</b>
   * 이었기 때문이다.
   */
  cancel: () => void;
  save: (next: ColumnDef<T>[]) => Promise<void>;
  reset: () => Promise<void>;
}

export function useGridPref<T>(
  menuCd: string,
  gridId: string,
  declared: ColumnDef<T>[],
  /**
   * 끄면 <b>읽지 않는다</b> — 설정 버튼이 없는 그리드다(frontend/grid.md).
   *
   * <p>버튼만 감추고 여기는 그대로 두면 <b>바꿀 길이 없는 설정을 화면마다 한 번씩</b>
   * 물어본다. 화면에 그리드가 둘이면 왕복도 둘이며, 그중 하나는 쓰이지 않는다.
   */
  enabled = true,
): GridPrefHandle<T> {
  /** <b>지금 화면에 입혀진 것</b> — 저장하지 않은 적용도 여기 담긴다. */
  const [pref, setPref] = useState<GridPrefValue | null>(null);
  /**
   * <b>DB 에 있는 것</b> — 읽고·저장하고·지울 때만 움직인다. 적용은 건드리지 않는다.
   *
   * <p>둘을 가른 것이 이 훅의 요점이다. 하나로 두면 <i>저장했다</i> 와 <i>해 보는
   * 중이다</i> 가 같은 값이 되고, 화면은 그 둘을 다르게 그려야 한다(frontend/grid.md).
   */
  const [committed, setCommitted] = useState<GridPrefValue | null>(null);
  /**
   * <b>되감을 자리</b> — <i>취소</i> 가 여기로 돌아온다.
   *
   * <p><b>{@code committed} 와 갈린다.</b> 저것은 <i>DB 에 행이 있는가</i>(초기화가 켜지는
   * 조건)이고 이것은 <i>어디까지를 남기기로 했는가</i> 다. 둘은 대개 같은 값인데
   * <b>적용을 누른 뒤에만 갈라진다</b> — 화면에는 남기기로 했지만 DB 에는 없는 상태다.
   */
  const [baseline, setBaseline] = useState<GridPrefValue | null>(null);
  const signature = useMemo(() => signatureOf(declared), [declared]);

  // 선언은 매 렌더 새 배열일 수 있다 — 효과가 그것을 보면 렌더마다 서버를 부른다.
  const latest = useRef(declared);
  useEffect(() => {
    latest.current = declared;
  }, [declared]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    getGridPref(menuCd, gridId, signature)
      .then((stored) => {
        if (!alive) return;
        const value = stored ? parsePref(stored.prefJson) : null;
        setPref(value);
        setCommitted(value);
        setBaseline(value);
      })
      .catch(() => {
        if (!alive) return;
        setPref(null);
        setCommitted(null);
        setBaseline(null);
      });
    return () => {
      alive = false;
    };
  }, [menuCd, gridId, signature, enabled]);

  const columns = useMemo(() => applyPref(declared, pref), [declared, pref]);

  const reorder = useCallback((fields: string[]) => {
    setPref((current) => {
      /*
        <b>바닥값은 지금 화면에 입혀진 것</b>이지 <i>전부 보임</i> 이 아니다.

        저장된 설정이 없으면 {@code current} 가 비어 있는데, 그때 모르는 칸을
        `{visible:true, pinned:null}` 로 채우면 <b>선언이 꺼 둔 컬럼이 전부 켜지고 틀고정도
        풀린다</b> — 순서만 바꾼 사람에게 <i>헤더를 한 번 끌었더니 숨겨 둔 컬럼이 쏟아졌다</i>
        가 된다(2026-08-31 실물). 판은 <b>꺼진 컬럼도 함께</b> 알려 주므로(`getAllGridColumns`)
        그 칸들이 전부 이 경로를 지난다.

        선언을 그대로 읽지 않고 {@code applyPref} 를 한 번 지나는 것은, 창에서 껐다 켠 것도
        <b>아직 확정되지 않았을 뿐 지금 화면의 상태</b>이기 때문이다.
      */
      const known = new Map(
        applyPref(latest.current, current).map((column) => [
          column.field,
          {
            field: column.field,
            visible: column.visible !== false,
            pinned: column.pinned ?? null,
          },
        ]),
      );
      const moved = new Set(fields);
      const ordered = fields.flatMap((field) => {
        const entry = known.get(field);
        return entry ? [entry] : [];
      });
      // 판이 말하지 않은 칸(`hidden` 등)은 뒤에 남긴다 — 그리지 않으므로 자리가 뜻이 없다.
      const rest = [...known.values()].filter((entry) => !moved.has(entry.field));
      return { columns: [...ordered, ...rest] };
    });
  }, []);

  const apply = useCallback((next: ColumnDef<T>[]) => setPref(toPrefValue(next)), []);

  /*
    <b>둘을 함께 놓는다</b> — 화면과 되감을 자리가 갈리면 <i>적용</i> 이 무엇을 남겼는지
    말할 수 없다. 미리보기가 이미 같은 값을 넣어 두었으므로 앞엣것은 대개 같은 값을 다시
    적는 셈이지만, <b>버튼이 자기가 남기는 것을 스스로 정하는</b> 편이 안전하다.
  */
  const keep = useCallback((next: ColumnDef<T>[]) => {
    const value = toPrefValue(next);
    setPref(value);
    setBaseline(value);
  }, []);

  // 남기기로 한 자리로 되감는다 — 저장했거나 적용한 것, 없으면 선언이다.
  const cancel = useCallback(() => setPref(baseline), [baseline]);

  const save = useCallback(
    async (next: ColumnDef<T>[]) => {
      const value = toPrefValue(next);
      await saveGridPref(menuCd, gridId, JSON.stringify(value), signatureOf(latest.current));
      setPref(value);
      setCommitted(value);
      setBaseline(value);
    },
    [menuCd, gridId],
  );

  const reset = useCallback(async () => {
    await resetGridPref(menuCd, gridId);
    // 기본값을 계산해 넣지 않는다 — 기본값은 선언이고 그것은 배포마다 바뀔 수 있다.
    setPref(null);
    setCommitted(null);
    setBaseline(null);
  }, [menuCd, gridId]);

  /*
    <b>버튼들이 축 둘을 나눠 갖는다</b>(frontend/grid.md). 초기화는 `committed` 를 보고(지울 행이
    있는가) 취소는 `baseline` 으로 되감는다 — 하나가 둘을 겸하면 <i>저장했다</i> 와
    <i>해 보는 중이다</i> 를 사람이 구분할 수 없다.
  */
  return { columns, saved: committed !== null, reorder, apply, keep, cancel, save, reset };
}
