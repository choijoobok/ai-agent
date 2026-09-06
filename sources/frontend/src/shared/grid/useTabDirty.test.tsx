import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TabIdentityProvider } from '@/layouts/ShellLayout/tabContext';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridController } from '@/shared/grid/useGridController';
import type { ColumnDef } from '@/shared/grid/types';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTabStore } from '@/shared/stores/tabStore';

vi.mock('@/shared/api/request', () => ({
  post: vi.fn(),
  get: vi.fn(),
  request: vi.fn(),
}));

/**
 * 그리드의 미저장이 <b>셸에 닿는가</b> — frontend/tabs.md.
 *
 * <p>셸은 {@code dirtyKeys} 를 여섯 자리에서 본다(탭 닫기 · 다른 탭 닫기 · 모두 닫기 ·
 * 상한 희생 · 로그아웃 · 로고 새로고침) 그리고 탭바가 <b>·</b> 를 그린다. 그런데
 * <b>{@code setDirty} 를 부르는 곳이 하나도 없어 그 여섯이 한 번도 열리지 않았다</b> —
 * 셀을 고쳐 둔 탭이 <b>아무것도 묻지 않고 닫혔다</b>.
 *
 * <p>이 파일이 그 사슬을 잠근다. <b>{@code useGridController} 의 배선 한 줄을 지우면
 * 여기가 빨강이 된다.</b>
 */
describe('그리드의 미저장이 탭에 닿는다 — frontend/tabs.md', () => {
  interface Row {
    id: string;
    name: string;
  }

  const columns: ColumnDef<Row>[] = [
    { field: 'id', header: 'id', type: 'text', width: 120 },
    { field: 'name', header: '이름', type: 'text', width: 120, editable: true },
  ];

  const TAB = 'TEST#1';

  beforeEach(() => {
    useAuthStore.setState({ permissions: ['TEST:READ', 'TEST:SAVE'] });
    useTabStore.setState({ dirtyKeys: [], dirtySources: {} });
  });

  /**
   * 그리드 하나를 세우고 <b>컨트롤러를 밖으로 꺼내 준다</b>. 편집은 테스트가 일으킨다 —
   * {@code DataGrid} 를 세우면 ag-grid 가 끼어들고, 이 파일이 보는 것은 그 아래다.
   */
  function Grid({ hand }: { hand: (controller: GridController<Row>) => void }) {
    const controller = useGridController<Row>({
      menuCd: 'TEST',
      columns,
      api: { save: { url: '/service/x/save' } },
      addRow: { defaults: () => ({ name: '' }) },
    });
    hand(controller);
    return null;
  }

  /** 탭 안에(또는 탭 밖에) 그리드를 세운다. */
  function mount(tabKey: string | null) {
    let controller: GridController<Row> | null = null;
    const grid = <Grid hand={(one) => (controller = one)} />;
    const view = render(
      tabKey === null ? (
        grid
      ) : (
        <TabIdentityProvider value={{ tabKey, menuCd: 'TEST' }}>{grid}</TabIdentityProvider>
      ),
    );
    // 행을 하나 더하면 그 그리드는 미저장이다 — `hasChanges` 가 C 행을 센다.
    // `act` 로 감싸야 그 뒤의 효과(미저장 알림)까지 흘러간다.
    return {
      view,
      soil: () => act(() => controller?.addRow()),
    };
  }

  it('행을 더하면 그 탭이 미저장으로 선다 — 닫기·로그아웃이 이것을 본다', () => {
    const grid = mount(TAB);

    grid.soil();

    expect(useTabStore.getState().dirtyKeys).toContain(TAB);
  });

  it('언마운트하면 지워진다 — 없는 그리드가 주장을 남기면 그 탭은 영영 묻는다', () => {
    const grid = mount(TAB);
    grid.soil();
    expect(useTabStore.getState().dirtyKeys).toContain(TAB);

    act(() => grid.view.unmount());

    expect(useTabStore.getState().dirtyKeys).toEqual([]);
  });

  it('탭 밖(로그인 화면)에서는 아무 일도 하지 않는다', () => {
    const grid = mount(null);

    grid.soil();

    expect(useTabStore.getState().dirtyKeys).toEqual([]);
  });

  /**
   * <b>한 탭에 그리드가 여럿이다</b>(사용자 상세는 여섯). 주장하는 쪽을 세지 않으면 한
   * 그리드가 깨끗해지는 순간 다른 그리드의 미저장이 <b>조용히 지워진다</b>.
   */
  it('한 그리드가 사라져도 다른 그리드의 미저장은 남는다', () => {
    const first = mount(TAB);
    const second = mount(TAB);
    first.soil();
    second.soil();
    expect(useTabStore.getState().dirtyKeys).toEqual([TAB]);

    act(() => first.view.unmount());

    expect(useTabStore.getState().dirtyKeys).toEqual([TAB]);
  });
});
