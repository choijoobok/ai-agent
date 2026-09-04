import { App } from 'antd';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataGrid } from '@/shared/grid/DataGrid';
import { useGridController } from '@/shared/grid/useGridController';
import type { ColumnDef, GridControl } from '@/shared/grid/types';
import { useAuthStore } from '@/shared/stores/authStore';
import { useMessageStore } from '@/shared/i18n/messageStore';

vi.mock('@/shared/api/request', () => ({
  post: vi.fn(),
  get: vi.fn(),
  request: vi.fn(),
}));

/**
 * ①의 <b>토글 컨트롤</b> — playbook/INDEX.md · frontend/grid.md.
 *
 * <p><b>스스로 재조회하지 않는 것이 이 컨트롤의 계약이다.</b> 셀렉트와 같은 규칙이고 같은
 * 이유다: 컨트롤이 컨트롤러를 직접 부르면 <b>토글 하나가 미저장 편집을 말없이 버린다</b>
 * (frontend/grid.md 의 재조회 규약은 컨트롤러의 것이다).
 *
 * <p>그래서 여기서 세는 것은 <i>스위치가 보이는가</i> 가 아니라 <b>{@code onChange} 가
 * 불리고 그 밖에는 아무 일도 없는가</b> 다 — 그 밖의 일이 생기면 그것이 곧 사고다.
 */
describe('그리드 ①의 토글 — playbook/INDEX.md', () => {
  interface Row {
    id: string;
  }

  const columns: ColumnDef<Row>[] = [{ field: 'id', header: 'x', type: 'text', width: 120 }];
  const TOGGLE_LABEL = '자동 새로고침';

  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ permissions: [] });
    useMessageStore.setState({ status: 'ready', messages: { 'btn.autoRefresh': TOGGLE_LABEL } });
  });

  function Harness(props: { value: boolean; onChange: (next: boolean) => void }) {
    const controller = useGridController<Row>({ menuCd: 'TEST', columns });
    const controls: GridControl[] = [
      {
        key: 'autoRefresh',
        slot: 'beforeRead',
        type: 'toggle',
        label: 'btn.autoRefresh',
        value: props.value,
        onChange: props.onChange,
      },
    ];
    return (
      <App>
        <DataGrid<Row>
          title="t"
          menuCd="TEST"
          controller={controller}
          controls={controls}
          settings={false}
          height={200}
        />
      </App>
    );
  }

  it('라벨과 스위치가 함께 선다 — 스위치만 있으면 무엇을 켜는지 알 수 없다', () => {
    render(<Harness value={false} onChange={() => undefined} />);

    expect(screen.getByText(TOGGLE_LABEL)).toBeTruthy();
    expect(screen.getByRole('switch')).toBeTruthy();
  });

  it('지금 값이 스위치에 그려져 있다 — 셀렉트가 툴팁을 쓰지 않는 것과 같은 이유', () => {
    render(<Harness value onChange={() => undefined} />);

    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  /*
    <b>화면이 상태를 갖는다.</b> 컨트롤은 값을 <i>받아서 그리고</i> 바뀌면 <i>알릴</i> 뿐이며,
    스스로 켜지지 않는다 — 켜지면 화면의 상태와 컨트롤의 표시가 갈리고, 그 어긋남은
    <b>다음 조회에서</b> 드러난다(보내는 조건은 화면의 상태이므로).
  */
  it('누르면 onChange 만 불린다 — 스스로 켜지지도 재조회하지도 않는다', () => {
    const onChange = vi.fn();
    render(<Harness value={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledWith(true);
    // 화면이 값을 되돌려 주기 전까지는 꺼진 채다.
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });
});
