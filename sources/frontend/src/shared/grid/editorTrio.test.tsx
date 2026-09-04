import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toColDefs } from '@/shared/grid/columnDefs';
import { SearchSelectCellEditor, type SearchSelectCellEditorParams } from '@/shared/grid/SearchSelectCellEditor';
import { ListModalCellEditor, type ListModalCellEditorParams } from '@/shared/grid/ListModalCellEditor';
import { TextModalCellEditor, type TextModalCellEditorParams } from '@/shared/grid/TextModalCellEditor';
import type { GridRow } from '@/shared/grid/rows';
import type { ColumnDef } from '@/shared/grid/types';

interface Row {
  chnlCd: string;
  tagList: { tagNm: string }[];
  rmk: string | null;
}

/**
 * 에디터 셋의 <b>배선</b> — playbook/INDEX.md 의 4단계(§9.5 · §9.6 · §9.7).
 *
 * <p><b>어댑터 층에서 잰다.</b> 셋 다 모달·드롭다운을 여는 컴포넌트라 UI 로 몰면 검사가
 * 흔들리고(2026-09-02 — 날짜 필터에서 그것을 겪고 지웠다), <b>흔들리는 검사는 없는 것보다
 * 나쁘다</b>: 붉은 줄이 일상이 되면 진짜 실패도 다시 돌려 보게 된다.
 *
 * <p>여기서 세는 것은 <b>선언이 편집기에 닿는가</b> 하나다. 닿지 않으면 화면에는
 * <i>더블클릭했는데 판의 텍스트 칸이 열린다</i> 로 보이고, 그 원인은 선언 어디에도 없다.
 */
describe('에디터 셋의 배선', () => {
  const defOf = (column: ColumnDef<Row>): ColDef<GridRow<Row>> => {
    const defs = toColDefs<Row>({
      columns: [column],
      onEdit: () => undefined,
      onEditDenied: () => undefined,
      onInvalidEdit: () => undefined,
      menuCd: 'TEST',
      issues: [],
      serverSort: true,
      editable: true,
      showState: false,
      onRevert: () => undefined,
      multiSelect: false,
    });
    const def = defs.find((candidate) => candidate.colId === column.field);
    if (!def) throw new Error('컬럼이 없다');
    return def;
  };

  describe('richSelect — 검색 콤보(frontend/grid.md)', () => {
    const column: ColumnDef<Row> = {
      field: 'chnlCd',
      header: 'h',
      type: 'code',
      editable: true,
      editor: 'richSelect',
      options: [
        { value: 'WEB', text: '웹' },
        { value: 'APP', text: '앱' },
      ],
    };

    it('자체 편집기가 붙고 후보가 그대로 흘러간다', () => {
      const def = defOf(column);

      expect(def.cellEditor).toBe(SearchSelectCellEditor);
      // 셀 안에 가두면 목록이 셀의 overflow 에 잘린다 — 날짜 달력과 같은 자리다.
      expect(def.cellEditorPopup).toBe(true);
      expect((def.cellEditorParams as SearchSelectCellEditorParams).options)
        .toEqual(column.options);
    });

    /*
      <b>후보를 편집기가 다시 묻지 않는다</b>(frontend/grid.md). {@code grpCd} 인 컬럼은 판에 닿기
      전에 {@code options} 가 채워지므로(`DataGrid`), 여기 빈 배열이 오는 것은
      <i>아직 안 왔다</i> 이지 <i>없다</i> 가 아니다 — 그래도 편집기는 열려야 한다.
    */
    it('후보가 아직 없어도 편집기는 붙는다 — 공통코드는 나중에 온다', () => {
      const def = defOf({ ...column, options: undefined, grpCd: 'CHNL' });

      expect(def.cellEditor).toBe(SearchSelectCellEditor);
      expect((def.cellEditorParams as SearchSelectCellEditorParams).options).toEqual([]);
    });
  });

  describe('listModal — 배열 편집(frontend/grid.md)', () => {
    const column: ColumnDef<Row> = {
      field: 'tagList',
      header: 'h',
      type: 'list',
      renderer: 'tags',
      editable: true,
      editor: 'listModal',
      listModal: { key: 'sample.tag' },
      display: (item) => String((item as { tagNm: string }).tagNm),
    };

    it('팝업 키와 메뉴가 흘러간다 — 배열 모달도 자기 메뉴가 없다', () => {
      const params = defOf(column).cellEditorParams as ListModalCellEditorParams;

      expect(defOf(column).cellEditor).toBe(ListModalCellEditor);
      expect(params.popupKey).toBe('sample.tag');
      expect(params.menuCd).toBe('TEST');
      expect(params.readOnly).toBe(false);
    });

    /*
      <b>선언이 반쪽이면 열지 않는다</b> — `popupRef` 와 같은 규칙(playbook/INDEX.md). 고를 팝업이
      없는 창을 띄우면 <i>추가</i> 가 아무 일도 하지 않는 버튼이 되고, 판의 기본 편집기로
      떨어지면 적어도 <b>배열이 글자로 보여</b> 무엇이 잘못됐는지 읽힌다.
    */
    it('listModal 이 없으면 편집기를 달지 않는다', () => {
      const half: ColumnDef<Row> = { ...column, listModal: undefined };

      expect(defOf(half).cellEditor).not.toBe(ListModalCellEditor);
    });

    /*
      <b>읽기 전용이어도 열린다</b>(frontend/grid.md 와 같은 자리) — 배열은 셀에서 다 볼 수 없다.
      다만 고칠 수 없으므로 창이 그것을 알아야 한다: 모르면 확인 버튼이 남고, 눌러도
      아무 일이 없다.
    */
    it('편집이 닫힌 컬럼은 읽기 전용으로 연다', () => {
      const params = defOf({ ...column, editable: false })
        .cellEditorParams as ListModalCellEditorParams;

      expect(params.readOnly).toBe(true);
    });
  });

  describe('textModal — 긴 글의 넓은 쪽(frontend/grid.md)', () => {
    const column: ColumnDef<Row> = {
      field: 'rmk',
      header: 'h',
      type: 'text',
      editable: true,
      editor: 'textModal',
      maxLength: 500,
    };

    it('글자 수 상한이 흘러간다 — 그것이 largeText 와 갈리는 지점이다', () => {
      const def = defOf(column);

      expect(def.cellEditor).toBe(TextModalCellEditor);
      expect((def.cellEditorParams as TextModalCellEditorParams).maxLength).toBe(500);
    });

    /*
      상한을 빠뜨려도 <b>카운터가 살아 있어야 한다</b>. 무제한으로 두면 `showCount` 가
      센 수만 보이고 <i>얼마나 남았는지</i> 를 말하지 못해, 이 편집기의 존재 이유가
      선언 하나 빠뜨린 것으로 사라진다.
    */
    it('상한이 없으면 판의 긴 글 편집기와 같은 값으로 떨어진다', () => {
      const params = defOf({ ...column, maxLength: undefined })
        .cellEditorParams as TextModalCellEditorParams;

      expect(params.maxLength).toBe(2000);
    });
  });
});

/**
 * `tags` 셀 — <b>넘친 것이 사라지지 않는다</b>(playbook/INDEX.md).
 *
 * <p>전부 그리면 판이 셀을 한 줄로 자르므로 <b>열 개 붙은 행과 세 개 붙은 행이 같아
 * 보인다</b>. 그러면 사용자는 세 개인 줄 알고 저장하며, 화면은 그 오해를 만든 쪽이다.
 */
describe('tags 렌더러의 +N', () => {
  const column: ColumnDef<Row> = {
    field: 'tagList',
    header: 'h',
    type: 'list',
    renderer: 'tags',
    display: (item) => String((item as { tagNm: string }).tagNm),
  };

  const draw = (value: unknown) => {
    const defs = toColDefs<Row>({
      columns: [column],
      onEdit: () => undefined,
      onEditDenied: () => undefined,
      onInvalidEdit: () => undefined,
      menuCd: 'TEST',
      issues: [],
      serverSort: true,
      editable: false,
      showState: false,
      onRevert: () => undefined,
      multiSelect: false,
    });
    const def = defs.find((candidate) => candidate.colId === 'tagList');
    if (!def) throw new Error('컬럼이 없다');
    const renderer = def.cellRenderer as (
      params: ICellRendererParams<GridRow<Row>>,
    ) => ReactElement;
    render(renderer({ value } as ICellRendererParams<GridRow<Row>>));
  };

  const tags = (count: number) =>
    Array.from({ length: count }, (_item, index) => ({ tagNm: `t${index}` }));

  it('셋까지는 그대로 그린다', () => {
    draw(tags(3));

    expect(screen.getByText('t0')).toBeTruthy();
    expect(screen.getByText('t2')).toBeTruthy();
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it('넘치면 앞 셋과 +N 이다 — 개수가 화면에서 사라지지 않는다', () => {
    draw(tags(10));

    expect(screen.getByText('t2')).toBeTruthy();
    expect(screen.queryByText('t3')).toBeNull();
    expect(screen.getByText('+7')).toBeTruthy();
  });

  it('배열이 아니면 아무것도 그리지 않는다 — 값이 없는 칸은 빈 칸이다', () => {
    draw(null);

    expect(screen.queryByText(/^\+/)).toBeNull();
  });
});
