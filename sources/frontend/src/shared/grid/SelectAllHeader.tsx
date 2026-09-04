import { useEffect, useState } from 'react';
import type { GridApi, IHeaderParams } from 'ag-grid-community';
import { Checkbox } from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import type { GridRow } from '@/shared/grid/rows';

/**
 * 전체 선택 — <b>보이는 행</b>이 대상이다.
 *
 * <p>판이 선택을 바꿀 때마다 스스로 다시 읽는다. 셀 렌더러와 달리 헤더는 행에 매여 있지
 * 않아 <b>판이 알아서 다시 그려 주지 않는다.</b>
 */
export function SelectAllHeader<T>(params: IHeaderParams<GridRow<T>>): React.ReactNode {
  const [flags, setFlags] = useState(() => selectionFlags(params.api));

  useEffect(() => {
    const sync = () => setFlags(selectionFlags(params.api));
    params.api.addEventListener('selectionChanged', sync);
    params.api.addEventListener('modelUpdated', sync);
    return () => {
      params.api.removeEventListener('selectionChanged', sync);
      params.api.removeEventListener('modelUpdated', sync);
    };
  }, [params.api]);

  return (
    <Checkbox
      checked={flags.all}
      indeterminate={flags.some && !flags.all}
      aria-label={label(MSG.GRID_SELECT_ALL)}
      onChange={(event) =>
        // 걸러진 행까지 고르지 않는다 — 보이지 않는 것을 고른 줄 모른 채 저장하게 된다.
        params.api.forEachNodeAfterFilter((node) => node.setSelected(event.target.checked))}
    />
  );
}

function selectionFlags<T>(api: GridApi<GridRow<T>>): { all: boolean; some: boolean } {
  const total = api.getDisplayedRowCount();
  const selected = api.getSelectedNodes().length;
  return { all: total > 0 && selected === total, some: selected > 0 };
}
