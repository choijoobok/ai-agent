import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MSG } from '@/shared/i18n/messageKeys';
import { TreeGrid } from '@/shared/tree/TreeGrid';
import type { TreeColumn, TreeSearch } from '@/shared/tree/types';

/**
 * 트리 그리드의 크롬 — screen/menu/requirements.md.
 *
 * <p>번들이 없는 테스트에서는 메시지 키가 그대로 글자로 나온다 — 헤더와 자리표를 그 키로 찾는다.
 *
 * <p><b>여기서 잴 수 없는 것이 하나 있다.</b> 계층 컬럼의 폭은 캔버스로 글자를 재서 나오는데
 * jsdom 에는 캔버스가 없다 — 그때 <b>고정 폭으로 떨어지는 것</b>이 선언이며, 그 폴백이 이
 * 테스트가 보는 값이다({@code HIERARCHY_FALLBACK}).
 */
describe('TreeGrid', () => {
  interface Row {
    cd: string;
    up: string | null;
    nm: string;
  }

  const rows: Row[] = [
    { cd: 'SYSTEM', up: null, nm: '시스템' },
    { cd: 'USER_MGMT', up: 'SYSTEM', nm: '사용자 관리' },
  ];

  function mount(extra: {
    titleSuffix?: string;
    search?: TreeSearch;
    hierarchyText?: (row: Row) => string;
    disabled?: boolean;
    collapsed?: boolean;
    collapsedAxis?: 'vertical' | 'horizontal';
    columns?: TreeColumn<Row>[];
    onRead?: () => void;
  }) {
    render(
      <TreeGrid<Row>
        title={MSG.USER_AUTH_TREE_TITLE}
        menuCd="USER_AUTH_MGMT"
        rows={rows}
        idOf={(row) => row.cd}
        parentOf={(row) => row.up}
        hierarchyHeader={MSG.USER_AUTH_COL_MENU}
        hierarchy={(row) => <span>{row.nm}</span>}
        columns={[]}
        onRead={() => undefined}
        {...extra}
      />,
    );
  }

  function search(over: Partial<TreeSearch> = {}): TreeSearch {
    return {
      placeholder: MSG.USER_AUTH_SEARCH_MENU,
      value: '',
      onChange: () => undefined,
      ...over,
    };
  }

  /** 아이콘의 이름이 앞에 붙는다 — 판이 그리는 것이라 부분 일치로 찾는다. */
  const readButton = () =>
    screen.getByRole<HTMLButtonElement>('button', { name: new RegExp(MSG.GRID_READ) });
  const searchBox = () => screen.getByPlaceholderText<HTMLInputElement>(MSG.USER_AUTH_SEARCH_MENU);
  /**
   * 제목의 스타일은 <b>한 겹 위</b>에 있다 — 판이 {@code <span><strong>제목</strong></span>}
   * 으로 그리므로 글자로 찾으면 {@code strong} 이 잡힌다(2026-08-31 실측).
   */
  const titleStyle = () => {
    const wrapper = screen.getByText(MSG.USER_AUTH_TREE_TITLE).parentElement;
    if (wrapper === null) throw new Error('제목을 감싼 요소가 없다');
    return wrapper.style;
  };

  it('제목 뒤에 지금 보고 있는 대상이 붙는다 — frontend/grid.md', () => {
    mount({ titleSuffix: '홍길동 / u10293' });
    expect(screen.queryByText('홍길동 / u10293')).not.toBeNull();
  });

  it('접미가 비면 아무것도 붙지 않는다 — (없음) 같은 자리표를 만들지 않는다', () => {
    mount({ titleSuffix: '' });
    expect(screen.getByText(MSG.USER_AUTH_TREE_TITLE).parentElement?.textContent).toBe(
      MSG.USER_AUTH_TREE_TITLE,
    );
  });

  /*
    <b>브레드크럼 슬롯이 아니라 여기다</b>(screen/menu/requirements.md). 이 테스트가 붙잡는 것은 자리 하나가
    아니라 <b>한글이 두 번 입력되던 원인</b>이다 — 슬롯은 셸이 그리므로 값이 한 커밋 늦게
    도착했고, 칸이 트리 안에 있으면 그 왕복이 없다. 슬롯은 여기 없으므로, 칸이 보이는 것이
    곧 <i>트리가 그렸다</i> 는 뜻이다.
  */
  it('검색 칸은 트리의 ① 에 서고 조회 버튼 앞이다 — screen/menu/requirements.md', () => {
    mount({ search: search() });

    const following =
      searchBox().compareDocumentPosition(readButton()) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(following).not.toBe(0);
  });

  it('한 번 입력하면 onChange 도 한 번이다', () => {
    const onChange = vi.fn();
    mount({ search: search({ onChange }) });

    fireEvent.change(searchBox(), { target: { value: '사용' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('사용');
  });

  /*
    <b>대상이 없으면 ①이 통째로 잠긴다</b>(frontend/grid.md). 조회만 잠그던 자리가 아니다 — 빈 트리를
    접는 버튼도, 찾을 이름이 없는 칸도 함께 잠겨야 <i>아무 일도 일어나지 않는 클릭</i>이
    남지 않는다.
  */
  it('disabled 면 ①의 조회와 검색 칸이 함께 잠긴다 — frontend/grid.md', () => {
    mount({ disabled: true, search: search() });

    expect(readButton().disabled).toBe(true);
    expect(searchBox().disabled).toBe(true);
  });

  it('대상이 있으면 잠기지 않는다', () => {
    mount({ search: search() });

    expect(readButton().disabled).toBe(false);
    expect(searchBox().disabled).toBe(false);
  });

  /*
    <b>접힌 것과 없는 것은 다르다</b>(frontend/grid.md) — 제목 줄은 남고 나머지는 사라진다. 한때
    트리가 자기가 접혔다는 것을 몰라 <b>좁은 띠 안에 잘린 표</b>가 남았다(2026-08-31 실물).
  */
  it('접히면 제목만 남는다 — 판도 푸터도 버튼도 없다', () => {
    mount({ collapsed: true, search: search() });

    expect(screen.queryByText(MSG.USER_AUTH_TREE_TITLE)).not.toBeNull();
    expect(screen.queryByText(MSG.USER_AUTH_COL_MENU)).toBeNull();
    expect(screen.queryByPlaceholderText(MSG.USER_AUTH_SEARCH_MENU)).toBeNull();
    expect(screen.queryByRole('button', { name: new RegExp(MSG.GRID_READ) })).toBeNull();
  });

  it('좌우로 접히면 제목이 세로쓰기다 — 48px 띠에서 가로 제목은 잘린다', () => {
    mount({ collapsed: true, collapsedAxis: 'horizontal' });

    expect(titleStyle().writingMode).toBe('vertical-rl');
    // 인라인 상자에서는 세로쓰기가 <b>무시된다</b> — 이 한 줄이 없으면 아무 일도 없다.
    expect(titleStyle().display).toBe('inline-block');
  });

  it('상하로 접히면 제목은 가로 그대로다 — 그 축에서는 줄이 남는다', () => {
    mount({ collapsed: true, collapsedAxis: 'vertical' });
    expect(titleStyle().writingMode).toBe('');
  });

  it('hierarchyText 를 선언하면 계층 컬럼이 고정 폭이 된다 — screen/menu/requirements.md', () => {
    mount({ hierarchyText: (row) => row.nm });
    // 캔버스가 없어 폴백 폭이다 — 남는 폭을 먹지 <b>않는</b> 것이 요점이다.
    expect(screen.getByText(MSG.USER_AUTH_COL_MENU).style.width).toBe('300px');
  });

  it('선언하지 않으면 옛 모양이다 — 남는 폭을 먹는다', () => {
    mount({});
    const cell = screen.getByText(MSG.USER_AUTH_COL_MENU);
    expect(cell.style.width).toBe('');
    expect(cell.style.flexGrow).toBe('1');
  });

  /*
    ── 편집 (2026-08-31 요청 · frontend/grid.md) ────────────────────────────────

    <b>콤보가 셀에 늘 서 있었다.</b> 판의 편집 가능 셀은 평소에 값만 보이고 더블 클릭에서
    편집기가 열리는데, 트리만 입력 화면처럼 보였다 — 이 아래 넷이 그 제스처를 붙잡는다.
  */

  /** 값 칸 하나 — 열리는 컬럼과 잠긴 컬럼을 한 트리에 세운다. */
  function editableColumns(): TreeColumn<Row>[] {
    return [
      {
        header: MSG.MENU_COL_MENU_URL,
        width: 200,
        editable: true,
        cell: (row) => <span>{row.nm} 값</span>,
        editor: (row, _node, done) => (
          <button type="button" onClick={done}>
            {row.nm} 편집기
          </button>
        ),
      },
      { header: MSG.MENU_COL_MENU_CD, width: 100, cell: (row) => <span>{row.nm} 잠김</span> },
    ];
  }

  const cellOf = (text: string) => {
    const cell = screen.getByText(text).parentElement;
    if (cell === null) throw new Error('셀이 없다');
    return cell;
  };

  it('더블 클릭하면 편집기가 열린다 — 평소에는 값만 보인다', () => {
    mount({ columns: editableColumns() });

    expect(screen.queryByText('시스템 편집기')).toBeNull();
    fireEvent.doubleClick(screen.getByText('시스템 값'));

    expect(screen.queryByText('시스템 편집기')).not.toBeNull();
    // <b>열린 셀은 하나다</b> — 형제 행의 같은 컬럼은 그대로 값이다.
    expect(screen.queryByText('사용자 관리 값')).not.toBeNull();
    expect(screen.queryByText('사용자 관리 편집기')).toBeNull();
  });

  it('editor 가 없는 컬럼은 더블 클릭이 아무 일도 하지 않는다', () => {
    mount({ columns: editableColumns() });
    fireEvent.doubleClick(screen.getByText('시스템 잠김'));
    expect(screen.queryByText('시스템 잠김')).not.toBeNull();
  });

  it('Escape 는 컴포넌트가 받는다 — 어느 편집기에서나 같은 뜻이다', () => {
    mount({ columns: editableColumns() });
    fireEvent.doubleClick(screen.getByText('시스템 값'));

    fireEvent.keyDown(screen.getByText('시스템 편집기'), { key: 'Escape' });
    expect(screen.queryByText('시스템 편집기')).toBeNull();
  });

  it('조회를 누르면 열린 편집기가 닫힌다 — 판이 통째로 갈린다', () => {
    const onRead = vi.fn();
    mount({ columns: editableColumns(), onRead });
    fireEvent.doubleClick(screen.getByText('시스템 값'));

    fireEvent.click(readButton());

    expect(onRead).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('시스템 편집기')).toBeNull();
  });

  /*
    <b>잠긴 칸을 칠한다</b> — 열리는 칸을 표시하는 대신 잠긴 칸을 칠하는 것이 이 프로젝트의
    규약이고(`.bo-cell-readonly` · frontend/grid.md), 트리만 반대로 두면 그 화면에서 배운 것이 옆
    화면에서 틀린다.
  */
  it('editable 을 선언하지 않은 컬럼은 읽기 전용 색조가 깔린다 — frontend/grid.md', () => {
    mount({ columns: editableColumns() });

    expect(cellOf('시스템 잠김').style.background).not.toBe('');
    expect(cellOf('시스템 값').style.background).toBe('');
  });
});
