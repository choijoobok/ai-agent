import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AutoHideEdge } from '@/layouts/ShellLayout/AutoHideEdge';

/**
 * 가장자리에서 나오는 띠 — frontend/tabs.md.
 *
 * <p>여기서 지키는 것 셋이다. ① <b>마우스로 열리고 닫힌다</b>, ② <b>감춰진 동안 마우스를
 * 가로채지 않는다</b>, ③ <b>헤더가 사이더보다 위다</b>.
 *
 * <p>②와 ③은 <b>화면에 아무 표시도 남기지 않는 종류</b>다. ②가 깨지면 화면 밖으로 나간
 * 패널의 상자가 트리거 띠를 대신 먹어 <i>아무리 마우스를 대도 열리지 않고</i>, ③이 깨지면
 * 둘이 함께 나왔을 때 사이더가 헤더의 접기 버튼을 덮는다. 둘 다 실제로 그렇게 렌더됐다.
 */
describe('자동 숨기기 띠', () => {
  const panel = (edge: 'top' | 'left') =>
    render(
      <AutoHideEdge edge={edge}>
        <div>패널</div>
      </AutoHideEdge>,
    );

  /** 트리거 띠는 `aria-hidden` 인 빈 div 다 — 읽어 줄 것이 없다. */
  const triggerOf = (container: HTMLElement) =>
    container.querySelector('[aria-hidden]') as HTMLElement;
  const panelOf = () => screen.getByText('패널').parentElement as HTMLElement;

  it('마우스가 가장자리에 오면 나오고, 패널을 떠나면 숨는다', () => {
    const { container } = panel('top');
    expect(panelOf().style.transform).toBe('translateY(-100%)');

    fireEvent.mouseEnter(triggerOf(container));
    expect(panelOf().style.transform).toBe('none');

    fireEvent.mouseLeave(panelOf());
    expect(panelOf().style.transform).toBe('translateY(-100%)');
  });

  it('왼쪽에서는 가로로 움직인다 — 축을 잘못 잡으면 화면 위에 그대로 남는다', () => {
    panel('left');
    expect(panelOf().style.transform).toBe('translateX(-100%)');
  });

  it('감춰진 동안 마우스를 가로채지 않는다 — 상자는 화면 밖에도 남는다', () => {
    const { container } = panel('top');
    expect(panelOf().style.pointerEvents).toBe('none');

    fireEvent.mouseEnter(triggerOf(container));
    expect(panelOf().style.pointerEvents).toBe('auto');
  });

  it('포커스가 들어와도 나온다 — 감춰진 것에도 Tab 은 들어간다', () => {
    panel('left');

    fireEvent.focus(screen.getByText('패널'), { bubbles: true });
    expect(panelOf().style.transform).toBe('none');
  });

  it('헤더가 사이더보다 위다 — 뒤집히면 사이더가 헤더의 버튼을 덮는다', () => {
    const top = render(
      <AutoHideEdge edge="top">
        <div>위</div>
      </AutoHideEdge>,
    );
    const left = render(
      <AutoHideEdge edge="left">
        <div>왼쪽</div>
      </AutoHideEdge>,
    );

    const zOf = (view: typeof top, text: string) =>
      Number((view.getByText(text).parentElement as HTMLElement).style.zIndex);

    expect(zOf(top, '위')).toBeGreaterThan(zOf(left, '왼쪽'));
  });
});
