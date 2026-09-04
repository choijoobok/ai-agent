import { useEffect, useState } from 'react';

export interface Loaded<T> {
  data?: T;
  /** 서버가 완성한 문구다 — 프론트가 조립하지 않는다(backend/packages.md · frontend/packages.md). */
  error?: string;
  loading: boolean;
}

/**
 * 탭이나 팝오버가 <b>처음 열릴 때</b> 한 번 읽는다 — frontend/tabs.md.
 *
 * <p>`active` 가 참이 되는 순간에만 돈다. 모달을 열자마자 전부 읽으면 대부분은 보지도 않을
 * 것을 매번 가져오게 된다 — 프로필의 로그인 이력·권한이 그렇고, 알림 모달의 시스템 정보가
 * 그렇다.
 *
 * <p><b>`features/profile` 에서 여기로 올렸다</b>(2026-08-29). 두 번째 화면이 쓰는 순간
 * `shared/` 로 올린다는 규칙 그대로다(frontend/packages.md) — 기능끼리 직접 import 하는 것은 ESLint 가 막는다.
 *
 * <p>`load` 는 **모듈 최상위 함수**여야 한다. 렌더마다 새로 만드는 화살표 함수를 넘기면
 * 참조가 매번 달라져 무한히 다시 읽는다 — 의존성에 넣어 둔 것이 그 실수를 드러낸다.
 */
export function useLoad<T>(active: boolean, load: () => Promise<T>): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ loading: active });

  // **렌더 중에 되돌린다.** 효과 안에서 `setState({loading:true})` 를 부르면 렌더가
  // 연쇄되고(`react-hooks/set-state-in-effect`), 무엇보다 **지난 탭의 결과가 한 프레임
  // 보인다** — 새 탭을 눌렀는데 옛 목록이 스치는 것이 그 증상이다.
  const [seed, setSeed] = useState({ active, load });
  if (seed.active !== active || seed.load !== load) {
    setSeed({ active, load });
    setState({ loading: active });
  }

  useEffect(() => {
    if (!active) return;
    // 늦게 온 응답이 새 상태를 덮지 않게 한다 — 탭을 빠르게 오가면 순서가 뒤집힌다.
    let alive = true;
    load().then(
      (data) => {
        if (alive) setState({ data, loading: false });
      },
      (error: unknown) => {
        if (alive) {
          setState({ error: error instanceof Error ? error.message : String(error), loading: false });
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [active, load]);

  return state;
}
