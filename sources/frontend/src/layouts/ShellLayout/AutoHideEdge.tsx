import { useState, type ReactNode } from 'react';
import { theme } from 'antd';

/**
 * 가장자리에서 미끄러져 나오는 띠 — frontend/tabs.md.
 *
 * <p><b>화면을 밀지 않고 그 위로 뜬다.</b> 미는 방식(높이를 접거나 너비를 줄이는 것)은
 * 아래·오른쪽 전체를 함께 움직여서, <b>보려던 것이 마우스를 대는 순간 밀려나고 떼면 다시
 * 돌아온다</b> — 자리를 아끼려고 켠 설정이 그 자리를 쓰는 화면을 흔드는 셈이 된다. 특히
 * 그리드는 높이가 바뀔 때마다 다시 계산한다(frontend/grid.md).
 *
 * <p><b>트리거 띠를 따로 둔다.</b> 감춘 패널 자체에 마우스를 댈 수는 없다 — 화면 밖에 있다.
 * 띠는 8px 이며, 이보다 얇으면 마우스를 가장자리로 <i>던지는</i> 동작에서 자주 놓치고,
 * 두꺼우면 화면 가장자리의 실제 조작(스크롤바 · 첫 컬럼)을 가로챈다.
 *
 * <p><b>포커스로도 열린다.</b> 감춰진 것도 DOM 에 있어 Tab 이 들어간다 — 열어 주지 않으면
 * 키보드 사용자는 <b>보이지 않는 곳에 포커스를 잃는다</b>.
 *
 * <p><b>위에서 나오는 것이 왼쪽에서 나오는 것보다 위다.</b> 붙박이 배치에서도 헤더는
 * 사이더 위를 가로지른다(frontend/tabs.md) — 둘이 함께 나왔을 때 순서가 뒤집히면 <b>사이더가 헤더의
 * 접기 버튼과 로고를 덮는다</b>. 실제로 그렇게 렌더됐다.
 */

interface Props {
  /** 어느 가장자리에서 나오는가. `top` 은 헤더, `left` 는 사이더다. */
  edge: 'top' | 'left';
  children: ReactNode;
}

/** 트리거 띠의 두께(px). */
const TRIGGER = 8;

export function AutoHideEdge({ edge, children }: Props) {
  const { token } = theme.useToken();
  const [shown, setShown] = useState(false);
  const fromTop = edge === 'top';
  const z = fromTop ? 30 : 20;

  // 가장자리에 붙인다. 나오는 축만 크기를 갖고 나머지 축은 양끝을 잡는다.
  const anchored = fromTop
    ? { top: 0, insetInline: 0 }
    : { left: 0, insetBlock: 0 };

  return (
    <>
      <div
        aria-hidden
        onMouseEnter={() => setShown(true)}
        style={{
          position: 'absolute',
          ...anchored,
          ...(fromTop ? { height: TRIGGER } : { width: TRIGGER }),
          // 패널보다 아래여야 한다 — 나온 뒤에는 패널이 띠를 덮는다.
          zIndex: z,
        }}
      />
      <div
        onMouseLeave={() => setShown(false)}
        onFocusCapture={() => setShown(true)}
        style={{
          position: 'absolute',
          ...anchored,
          transform: shown ? 'none' : `translate${fromTop ? 'Y' : 'X'}(-100%)`,
          transition: `transform ${token.motionDurationMid} ${token.motionEaseInOut}`,
          // 떠 있다는 것을 그림자로 말한다 — 없으면 화면에 박힌 것처럼 보여, 아래에 가려진
          // 내용이 있다는 사실이 드러나지 않는다.
          boxShadow: shown ? token.boxShadowSecondary : undefined,
          // 감춰져 있어도 **상자는 남는다** — 화면 밖이라 보이지 않을 뿐이라, 가장자리에
          // 걸치면 트리거 띠를 대신 먹어 아무리 마우스를 대도 열리지 않는다.
          pointerEvents: shown ? 'auto' : 'none',
          zIndex: z + 1,
        }}
      >
        {children}
      </div>
    </>
  );
}
