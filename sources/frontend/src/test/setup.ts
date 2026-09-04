/**
 * jsdom 이 갖고 있지 않은 브라우저 API 를 채운다.
 *
 * <p>antd 는 반응형 브레이크포인트를 `matchMedia` 로 읽고 AG Grid 는 `ResizeObserver` 로
 * 크기를 본다. 없으면 <b>컴포넌트를 렌더하는 테스트가 전부 그 자리에서 죽는다</b> — 검사
 * 대상이 아니라 환경의 문제이며, 화면 코드에 `typeof window.matchMedia === 'function'`
 * 같은 분기를 두는 것이 그 대가다.
 *
 * <p><b>여기서 흉내 내는 것은 최소다.</b> 다크 모드 판정(`useResolvedDark`)이 실제로 이
 * 값을 읽으므로, 그것을 검사하는 테스트가 생기면 <b>그 테스트가 자기 답을 직접 심는다</b>.
 */
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}

    unobserve() {}

    disconnect() {}
  };
}
