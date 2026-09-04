import type { ColDef, ValueGetterParams } from 'ag-grid-community';
import { describe, expect, it } from 'vitest';
import { SELECT_COL_ID, toColDefs } from '@/shared/grid/columnDefs';
import type { GridRow } from '@/shared/grid/rows';
import type { ColumnDef } from '@/shared/grid/types';

interface Row {
  name: string;
}

interface Flag {
  useYn: boolean;
}

/**
 * 시스템 컬럼의 <b>순서와 번호</b> — frontend/grid.md.
 *
 * <p><b>번호는 값이 아니라 자리다.</b> 페이지마다 1부터 다시 세면 <i>"몇 번째 데이터인가"</i>
 * 를 사용자가 손으로 계산하게 된다 — 21번째 행은 2페이지 첫 줄에서도 21이어야 한다.
 *
 * <p>순서가 조용히 깨지는 종류다. 어느 배열이든 화면은 그럴듯해 보이고, <b>체크박스가
 * 번호 왼쪽에 서면</b> *행을 부르는 이름* 앞에 *행에 하는 일* 이 놓인다.
 */
describe('시스템 컬럼', () => {
  const columns: ColumnDef<Row>[] = [{ field: 'name', header: 'x', type: 'text' }];

  const build = (extra: Partial<Parameters<typeof toColDefs<Row>>[0]> = {}) =>
    toColDefs<Row>({
      columns,
      onEdit: () => undefined,
      onEditDenied: () => undefined,
      onInvalidEdit: () => undefined,
      menuCd: 'TEST',
      issues: [],
      serverSort: false,
      editable: false,
      showState: false,
      onRevert: () => undefined,
      multiSelect: false,
      ...extra,
    });

  const ids = (defs: ColDef<GridRow<Row>>[]) => defs.map((def) => def.colId);

  it('번호가 맨 왼쪽이다 — 옆 사람에게 3번 행이라고 말할 수 있어야 한다', () => {
    expect(ids(build())).toEqual(['__rowNo', 'name']);
  });

  it('다중 선택이면 체크박스가 번호 오른쪽이다 — 판이 붙이는 선택 컬럼을 쓰지 않는 이유', () => {
    // 판의 선택 컬럼은 언제나 맨 앞이라 번호보다 왼쪽에 선다.
    expect(ids(build({ multiSelect: true }))).toEqual(['__rowNo', SELECT_COL_ID, 'name']);
  });

  it('단일 선택에는 체크박스가 없다 — 고를 것이 하나면 표시할 상태도 없다', () => {
    expect(ids(build())).not.toContain(SELECT_COL_ID);
  });

  it('상태 컬럼은 번호와 체크박스 다음이다 — frontend/grid.md 의 자리는 그대로다', () => {
    expect(ids(build({ showState: true, multiSelect: true })))
      .toEqual(['__rowNo', SELECT_COL_ID, '__grid.col.state', 'name']);
  });

  describe('번호', () => {
    /**
     * 판이 주는 것은 <b>지금 보이는 자리</b>이고, offset 은 <b>문맥</b>에서 온다.
     *
     * <p>선언에 박았더니 페이지가 한 장씩 늦었다(2026-08-30) — 새 행과 새 선언이 같은
     * 렌더에 들어가는데 판은 <b>행부터</b> 그리고 그때 쓰는 선언은 앞 페이지의 것이다.
     */
    const numberAt = (rowIndex: number | null, rowOffset: number) => {
      const def = build()[0];
      const getter = def.valueGetter as (params: ValueGetterParams<GridRow<Row>>) => unknown;
      return getter({
        node: { rowIndex },
        context: { rowOffset },
      } as ValueGetterParams<GridRow<Row>>);
    };

    it('첫 페이지는 1부터다', () => {
      expect(numberAt(0, 0)).toBe(1);
    });

    it('페이지를 넘으면 앞 페이지 마지막에 이어진다 — 20건씩 보면 2페이지 첫 줄이 21이다', () => {
      expect(numberAt(0, 20)).toBe(21);
      expect(numberAt(19, 20)).toBe(40);
    });

    it('자리를 모르는 행은 번호도 없다 — 0 을 그리면 있는 번호처럼 보인다', () => {
      expect(numberAt(null, 20)).toBeNull();
    });
  });

  /**
   * 삭제 컬럼의 <b>라벨과 게이트</b> — frontend/grid.md · screen/code/requirements.md.
   *
   * <p>시스템 환경설정에서는 헤더가 <i>되돌리기</i> 다. 행을 지우면 값이 사라지는 것이
   * 아니라 `yml` 이 드러나며, 라벨이 <i>삭제</i> 면 관리자는 값이 사라질 것을 기대하고
   * <b>목록에 같은 키가 남아 있으면 버그로 읽는다</b>.
   */
  describe('삭제 컬럼', () => {
    const withDelete = (extra: Record<string, unknown> = {}) =>
      build({ onToggleDelete: () => undefined, ...extra });

    it('선언이 없으면 컬럼 자체가 없다 — 물리 삭제하는 테이블에만 선다', () => {
      expect(ids(build())).not.toContain('__grid.col.delete');
    });

    it('기본 헤더는 삭제다', () => {
      expect(ids(withDelete())).toContain('__grid.col.delete');
    });

    it('라벨을 바꾸면 컬럼도 그 이름이다 — 기대를 라벨이 만든다', () => {
      const defs = withDelete({ deleteColumn: { header: 'config.col.revert' } });
      expect(ids(defs)).toContain('__config.col.revert');
      expect(ids(defs)).not.toContain('__grid.col.delete');
    });

    it('맨 오른쪽에 고정된다 — 상태 컬럼과 붙으면 무엇이 무엇인지 읽히지 않는다', () => {
      const defs = withDelete();
      expect(defs[defs.length - 1].pinned).toBe('right');
    });

    it('폭을 선언에서 받는다 — 라벨이 길면 넓혀야 글자가 잘리지 않는다', () => {
      const defs = withDelete({ deleteColumn: { header: 'config.col.revert', width: 104 } });
      const del = defs[defs.length - 1];
      // 시스템 컬럼은 폭이 고정이다 — 셋이 함께 움직여야 사용자가 늘릴 수 없다.
      expect([del.width, del.minWidth, del.maxWidth]).toEqual([104, 104, 104]);
    });
  });

  /**
   * 취소선의 범위 — frontend/grid.md 는 <b>행 전체</b>이고 screen/code/requirements.md 가 그 예외다.
   *
   * <p>거기서는 행이 사라지지 않는다. 지우는 것은 오버라이드 한 줄이고 <b>키는 목록에
   * 남으므로</b>, 전 셀에 그으면 *"이 행이 통째로 없어진다"* 로 읽혀 저장 뒤에 기대가
   * 어긋난다.
   */
  describe('삭제 표시의 범위', () => {
    const removedRule = (extra: Record<string, unknown> = {}) => {
      const def = build({ onToggleDelete: () => undefined, ...extra })
        .find((candidate) => candidate.colId === 'name');
      const rules = def?.cellClassRules as Record<string, (params: unknown) => boolean>;
      return (state: string) => rules['bo-cell-removed']({ data: { state } });
    };

    it('선언이 없으면 어느 셀에도 붙지 않는다 — 행 전체가 긋는다', () => {
      expect(removedRule()('D')).toBe(false);
    });

    it('그 컬럼이면 삭제 상태에서 붙는다', () => {
      expect(removedRule({ deleteColumn: { strikeField: 'name' } })('D')).toBe(true);
    });

    it('삭제가 아닌 상태에는 붙지 않는다', () => {
      expect(removedRule({ deleteColumn: { strikeField: 'name' } })('U')).toBe(false);
    });

    it('다른 컬럼을 지목했으면 붙지 않는다', () => {
      expect(removedRule({ deleteColumn: { strikeField: 'other' } })('D')).toBe(false);
    });
  });

  /**
   * 남는 폭을 먹는 컬럼 — frontend/grid.md.
   *
   * <p>선언한 폭이 <b>최소 폭</b>이 되는 것이 요점이다. 폭으로 남으면 판이 그것을 지켜
   * 늘어나지 않고, 최소가 없으면 좁은 화면에서 이 칸만 뭉개진다.
   */
  describe('남는 폭 채우기', () => {
    const fillDef = () =>
      build({ columns: [{ field: 'name', header: 'x', type: 'text', width: 200, fill: true }] })
        .find((candidate) => candidate.colId === 'name');

    it('선언한 폭이 최소 폭이 된다', () => {
      expect(fillDef()?.minWidth).toBe(200);
      expect(fillDef()?.width).toBeUndefined();
      expect(fillDef()?.flex).toBe(1);
    });

    it('선언하지 않으면 폭 그대로다 — 기본이 채우기가 아니다', () => {
      const plain = build().find((candidate) => candidate.colId === 'name');
      expect(plain?.flex).toBeUndefined();
    });
  });
  /**
   * 동적 컬럼 — frontend/grid.md. <b>`CODE_MGMT` 의 참조 코드가 첫 실물이다</b>(screen/code/requirements.md).
   *
   * <p>여기서 지키는 것 둘이다. ① 헤더가 <b>메시지 키가 아니다</b> — 정의 행의 `REF_NM`
   * 이며 그대로 나가야 한다, ② 값이 <b>맵의 한 칸</b>이라 읽기는 `derive`, 쓰기는 `patch`
   * 다. ②가 빠지면 편집한 값이 `ref.PARENT` 라는 <b>있지도 않은 필드</b>에 얹힌다.
   */
  describe('동적 컬럼', () => {
    interface RefRow {
      refs: Record<string, string>;
    }

    const dynamic: ColumnDef<RefRow> = {
      field: 'ref.PARENT',
      header: '상위 창고',
      dynamic: true,
      type: 'text',
      editable: true,
      derive: (row) => row.refs?.PARENT ?? '',
      patch: (row, value) => ({ refs: { ...row.refs, PARENT: String(value) } }),
    };

    const defOf = (edits: { rowId: string; patch: Partial<RefRow> }[] = []) =>
      toColDefs<RefRow>({
        columns: [dynamic],
        onEdit: (rowId, patch) => edits.push({ rowId, patch }),
        onEditDenied: () => undefined,
        onInvalidEdit: () => undefined,
        menuCd: 'TEST',
        issues: [],
        serverSort: false,
        editable: true,
        showState: false,
        onRevert: () => undefined,
        multiSelect: false,
      }).find((candidate) => candidate.colId === 'ref.PARENT');

    const row = (refs: Record<string, string>): GridRow<RefRow> => ({
      id: 'r1',
      state: null,
      data: { refs },
      original: { refs },
    });

    it('헤더가 정의의 이름 그대로다 — 메시지 키로 읽지 않는다', () => {
      expect(defOf()?.headerName).toBe('상위 창고');
    });

    it('값은 맵에서 읽는다', () => {
      const getter = defOf()?.valueGetter as (params: unknown) => unknown;
      expect(getter({ data: row({ PARENT: 'SEOUL' }) })).toBe('SEOUL');
    });

    it('편집은 맵을 통째로 되쓴다 — `ref.PARENT` 라는 필드는 존재하지 않는다', () => {
      const edits: { rowId: string; patch: Partial<RefRow> }[] = [];
      const setter = defOf(edits)?.valueSetter as (params: unknown) => boolean;

      setter({ data: row({ OTHER: 'X' }), newValue: 'SEOUL' });

      expect(edits).toEqual([{ rowId: 'r1', patch: { refs: { OTHER: 'X', PARENT: 'SEOUL' } } }]);
    });
  });
});

/**
 * 스위치 칸은 <b>판의 편집기를 열지 않는다</b> — frontend/grid.md.
 *
 * <p>2026-08-31 실물: {@code def.editable} 을 켜 둔 채 {@code Enter}·{@code F2} 만 막았더니
 * <b>더블 클릭이 남았다</b> — 스위치를 비껴 셀 배경을 두 번 누르면 텍스트 편집기가 열려
 * {@code true}/{@code false} 를 손으로 치게 됐다.
 *
 * <p>이 테스트가 지키는 것은 <b>그 문이 닫혀 있다</b>는 것 하나다. 열리면 증상이 조용하다 —
 * 편집기가 뜨는 것은 사고처럼 보이지 않고 <i>원래 그런 칸</i> 처럼 보인다.
 */
describe('ynFlag 셀', () => {
  const columns: ColumnDef<Flag>[] = [
    { field: 'useYn', header: 'x', type: 'ynFlag', editable: true },
  ];

  const defOf = () =>
    toColDefs<Flag>({
      columns,
      onEdit: () => undefined,
      onEditDenied: () => undefined,
      onInvalidEdit: () => undefined,
      menuCd: 'TEST',
      issues: [],
      serverSort: false,
      editable: true,
      showState: false,
      onRevert: () => undefined,
      multiSelect: false,
    }).find((candidate) => candidate.colId === 'useYn');

  it('편집을 선언해도 판의 편집기는 닫혀 있다 — 스위치가 편집기다', () => {
    expect(defOf()?.editable).toBe(false);
  });

  it('셀 렌더러가 있다 — 잠긴 칸이 아니라 스위치가 그려지는 칸이다', () => {
    expect(defOf()?.cellRenderer).toBeTypeOf('function');
  });
});
