import type { CSSProperties } from 'react';
import type { GlobalToken } from 'antd';

/**
 * 얇은 스크롤바 — frontend/tabs.md.
 *
 * <p><b>판에는 스크롤바 컴포넌트가 없다.</b> antd 가 자기 화면에서 쓰는 것도 컴포넌트가
 * 아니라 <b>토큰으로 칠한 CSS 속성 두 개</b>다({@code date-picker/style/panel.js} 의 시간
 * 칸이 그렇다). 그래서 여기서도 같은 것을 쓴다 — 흉내가 아니라 <b>같은 방법</b>이다.
 *
 * <p><b>토큰에서 색을 받는 것이 요점이다.</b> 값을 박으면 다크 모드에서 밝은 막대가 남고,
 * frontend/tabs.md 이 <i>"화면의 절반만 따라온다"</i> 로 적은 그것이 스크롤바에서 다시 일어난다.
 *
 * <p><b>구형 크로미엄에서는 무시된다</b>(`scrollbar-color` 는 크롬 121 · 사파리 18.2 부터다).
 * 그때는 OS 기본 막대가 그대로 보이며 <b>동작은 같다</b> — 판도 이 선을 그대로 받아들이고
 * 있어, 여기만 `::-webkit-scrollbar` 로 더 가는 것은 이 프로젝트에 <b>CSS 파일 하나를
 * 새로 만드는 값</b>을 치러야 한다(frontend/packages.md — CSS-in-JS 라 전역 스타일시트가 없다).
 */
export function thinScrollbar(token: GlobalToken): CSSProperties {
  return {
    scrollbarWidth: 'thin',
    // 트랙은 비운다 — 칠하면 스크롤이 없는 화면에도 홈이 보인다.
    scrollbarColor: `${token.colorTextTertiary} transparent`,
  };
}
