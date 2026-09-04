import { describe, expect, it } from 'vitest';
import { commitPopupPick, toColDefs } from '@/shared/grid/columnDefs';
import { PopupCellEditor, type PopupCellEditorParams } from '@/shared/grid/PopupCellEditor';
import type { GridRow } from '@/shared/grid/rows';
import type { ColumnDef } from '@/shared/grid/types';

interface Item {
  itemCd: string | null;
  itemNm: string | null;
  unitPrice: number | null;
  qty: number;
  amount: number | null;
}

/**
 * 참조 팝업 컬럼 — grid-column-contract.md §6 · 68 §9.4.
 *
 * <p><b>이 컬럼이 존재하는 이유가 곧 검사 대상이다</b>(grid-column-contract.md §6.1). 상품 아이디와 상품명을
 * 따로 입력받으면 <b>불일치가 저장된다</b> — 아이디는 `P-001` 인데 이름은 다른 상품인
 * 행이 만들어지고, 그것을 막을 제약이 화면에 없다. 그래서 여기서 세는 것은 <b>한 번
 * 골라 여러 칸이 함께 채워지는가</b>와 <b>지울 때도 함께 지워지는가</b> 둘이다.
 *
 * <p>세 번째가 <b>순서</b>다. 셀 편집기 밖에서 온 값이라고 {@code afterEdit} 를 건너뛰면
 * <b>같은 컬럼이 어떻게 채워졌는가에 따라 다른 행</b>이 된다 — 손으로 친 단가에는 금액이
 * 붙고 팝업으로 고른 단가에는 안 붙는 식이다.
 */
describe('popupRef 컬럼', () => {
  const column: ColumnDef<Item> = {
    field: 'itemCd',
    header: 'h',
    type: 'popupRef',
    editable: true,
    popup: {
      key: 'sample.item',
      param: (row) => ({ qty: row.qty }),
      apply: (_row, picked) =>
        picked
          ? {
              itemCd: String(picked.itemCd),
              itemNm: String(picked.itemNm),
              unitPrice: Number(picked.unitPrice),
            }
          : { itemCd: null, itemNm: null, unitPrice: null },
    },
    // 단가가 들어왔으면 금액이 계산된다 — grid-column-contract.md §6.3 의 <i>후작업이 이어서 돈다</i>.
    afterEdit: (row) => ({ amount: row.unitPrice === null ? null : row.unitPrice * row.qty }),
  };

  const row = (data: Partial<Item>): GridRow<Item> => {
    const full: Item = {
      itemCd: null, itemNm: null, unitPrice: null, qty: 3, amount: null, ...data,
    };
    // `original` 은 되돌리기의 기준이다 — 여기서는 안 쓰지만 봉투의 일부다(rows.ts).
    return { id: 'r1', state: 'U', data: full, original: full };
  };

  const options = (edits: { rowId: string; patch: Partial<Item> }[] = [], denied: string[] = []) => ({
    columns: [column],
    onEdit: (rowId: string, patch: Partial<Item>) => edits.push({ rowId, patch }),
    onEditDenied: (message: string) => denied.push(message),
    onInvalidEdit: () => undefined,
    menuCd: 'TEST',
    issues: [],
    serverSort: true,
    editable: true,
    showState: false,
    onRevert: () => undefined,
    multiSelect: false,
  });

  it('한 번 고르면 딸려 오는 칸이 함께 채워진다 — 이 컬럼의 존재 이유다', () => {
    const edits: { rowId: string; patch: Partial<Item> }[] = [];

    commitPopupPick(column, options(edits), row({}), {
      itemCd: 'P-001',
      itemNm: '볼펜',
      unitPrice: 500,
    });

    expect(edits).toHaveLength(1);
    expect(edits[0].rowId).toBe('r1');
    expect(edits[0].patch).toMatchObject({ itemCd: 'P-001', itemNm: '볼펜', unitPrice: 500 });
  });

  /*
    <b>머지한 값에도 후작업이 돈다</b>(grid-column-contract.md §6.3 · grid-edit-validation.md §2.3). 빠뜨리면 팝업으로 채운 행만
    금액이 비고, 그 행은 저장까지 그대로 간다.
  */
  it('afterEdit 이 이어서 돈다 — 단가가 들어왔으면 금액이 계산된다', () => {
    const edits: { rowId: string; patch: Partial<Item> }[] = [];

    commitPopupPick(column, options(edits), row({}), {
      itemCd: 'P-001',
      itemNm: '볼펜',
      unitPrice: 500,
    });

    // 3 개 × 500 — 후작업이 돌지 않았으면 이 키 자체가 없다.
    expect(edits[0].patch.amount).toBe(1500);
  });

  /*
    <b>채울 때와 지울 때가 대칭이어야 한다</b>(grid-column-contract.md §6.3). 아이디만 비우고 이름을 남기면
    <b>그것이 곧 불일치</b>이며, 이 컬럼이 없애려던 상태가 그대로 돌아온다.
  */
  it('지우면 딸려 온 칸도 함께 비고 금액도 따라 비운다', () => {
    const edits: { rowId: string; patch: Partial<Item> }[] = [];

    commitPopupPick(
      column,
      options(edits),
      row({ itemCd: 'P-001', itemNm: '볼펜', unitPrice: 500, amount: 1500 }),
      null,
    );

    expect(edits[0].patch).toMatchObject({ itemCd: null, itemNm: null, unitPrice: null });
    expect(edits[0].patch.amount).toBeNull();
  });

  it('편집이 닫힌 행에서는 아무 일도 없고 사유가 나간다 — 셀 편집과 같은 판정이다', () => {
    const edits: { rowId: string; patch: Partial<Item> }[] = [];
    const denied: string[] = [];
    const locked: ColumnDef<Item> = {
      ...column,
      editable: () => ({ ok: false, message: '확정된 주문은 고칠 수 없다' }),
    };

    commitPopupPick(locked, { ...options(edits, denied), columns: [locked] }, row({}), {
      itemCd: 'P-001',
    });

    expect(edits).toHaveLength(0);
    expect(denied).toEqual(['확정된 주문은 고칠 수 없다']);
  });

  it('선언이 반쪽이면 아무 일도 하지 않는다 — popup 없는 popupRef', () => {
    const edits: { rowId: string; patch: Partial<Item> }[] = [];
    const half: ColumnDef<Item> = { field: 'itemCd', header: 'h', type: 'popupRef', editable: true };

    expect(commitPopupPick(half, { ...options(edits), columns: [half] }, row({}), { itemCd: 'x' }))
      .toBe(false);
    expect(edits).toHaveLength(0);
  });

  describe('어댑터 배선', () => {
    const defOf = (given: ColumnDef<Item>) => {
      const defs = toColDefs<Item>({ ...options(), columns: [given] });
      const def = defs.find((candidate) => candidate.colId === given.field);
      if (!def) throw new Error('컬럼이 없다');
      return def;
    };

    it('팝업 편집기가 붙고 메뉴와 키가 흘러간다 — 팝업은 자기 메뉴가 없다', () => {
      const def = defOf(column);

      expect(def.cellEditor).toBe(PopupCellEditor);
      // 셀 안에 가두면 모달 클릭이 <i>그리드를 떠났다</i> 로 읽혀 편집이 끝난다.
      expect(def.cellEditorPopup).toBe(true);
      const params = def.cellEditorParams as PopupCellEditorParams;
      expect(params.popupKey).toBe('sample.item');
      expect(params.menuCd).toBe('TEST');
    });

    it('param 이 현재 행에서 만들어진다 — 창고가 정해졌으면 그 창고의 상품만', () => {
      const params = defOf(column).cellEditorParams as PopupCellEditorParams;

      expect(params.param?.({ itemCd: null, itemNm: null, unitPrice: null, qty: 7, amount: null }))
        .toEqual({ qty: 7 });
    });

    /*
      <b>선언이 반쪽이면 편집기를 달지 않는다.</b> 달면 <i>더블클릭했는데 아무 일도 없는</i>
      셀이 되고 그 원인은 화면 어디에도 없다 — 판의 기본 편집기로 떨어지는 편이 적어도
      무슨 일이 일어났는지 보인다.
    */
    it('popup 이 없으면 팝업 편집기를 달지 않는다', () => {
      const half: ColumnDef<Item> = { field: 'itemCd', header: 'h', type: 'popupRef' };

      expect(defOf(half).cellEditor).not.toBe(PopupCellEditor);
    });
  });
});
