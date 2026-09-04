import { useEffect, useState } from 'react';
import { create } from 'zustand';

/**
 * 화면 하나가 <b>다른 화면을 열면서 건네는 값</b> — UX-02 멀티탭의 넘겨주기.
 *
 * <p>62 §5.5 가 처음 요구했다. `API_CATALOG` 하단에서 행을 더블 클릭하면 `MENU_TREE` 를
 * <b>그 메뉴로</b> 여는데, 여는 쪽이 아는 것은 `MENU_CD` 하나이고 받는 쪽은 <b>아직 마운트되지
 * 않았다</b>. 64 §5.4 의 *요청 URI 더블 클릭 → API_CATALOG* 도 같은 모양이며, 62 §4.11 탭 3 의
 * *역할 더블 클릭 → ROLE_AUTH_MGMT* 이 뒤따른다.
 *
 * <h2>왜 URL 파라미터가 아닌가</h2>
 *
 * <b>탭이 라우트를 대신하기 때문</b>이다(frontend-stack.md §4·§5). 경로 하나가 탭 여러 개에 대응하므로
 * 주소에 값을 실으면 <b>같은 화면의 두 탭이 같은 주소</b>를 갖고, 뒤로가기가 탭 이동에
 * 배정돼 있어 그 값이 <b>탭 전환 때마다 되살아난다</b> — 한 번 넘긴 값이 계속 다시 적용된다.
 *
 * <h2>왜 한 번만 읽히는가</h2>
 *
 * 넘겨주기는 <b>사건</b>이지 상태가 아니다. 남겨 두면 그 화면을 다음에 열 때도 같은 곳으로
 * 튀고, 사용자는 <i>왜 여기로 왔는지</i> 를 알 수 없다 — {@link takeHandoff} 가 읽으면서
 * 지우는 것이 그래서다.
 */
interface HandoffState {
  /** {@code MENU_CD → 건네받은 값}. 화면당 하나면 충분하다 — 사건이라 쌓이지 않는다. */
  pending: Record<string, string>;
  put: (menuCd: string, value: string) => void;
  take: (menuCd: string) => string | null;
}

const useHandoffStore = create<HandoffState>((set, get) => ({
  pending: {},
  put: (menuCd, value) => set((state) => ({ pending: { ...state.pending, [menuCd]: value } })),
  take: (menuCd) => {
    const value = get().pending[menuCd];
    if (value === undefined) {
      return null;
    }
    set((state) => {
      const { [menuCd]: taken, ...rest } = state.pending;
      void taken;
      return { pending: rest };
    });
    return value;
  },
}));

/** 여는 쪽이 부른다 — <b>탭을 열기 직전</b>이다. 받는 쪽이 마운트되며 읽어 간다. */
export function handOff(menuCd: string, value: string): void {
  useHandoffStore.getState().put(menuCd, value);
}

/**
 * 받는 쪽이 <b>마운트할 때</b> 부른다 — 읽으면서 지운다.
 *
 * <p>훅이 아니라 함수인 것이 의도다. 훅이면 구독이 생겨 <i>값이 지워지는 것</i>까지 렌더에
 * 실려 오고, 화면은 그 두 번째 렌더에서 <b>넘겨받은 것이 없는 상태</b>를 다시 처리해야 한다.
 *
 * <p><b>이것만으로는 절반이다</b> — {@link onHandoff} 를 함께 읽는다.
 *
 * <p><b>렌더 중에 직접 부르지 않는다</b> — {@link useHandoff} 를 쓴다. 이 함수는 <b>한 번
 * 부르면 값이 사라지는</b> 소비이고, StrictMode 는 렌더를 두 번 돌린다(아래).
 */
export function takeHandoff(menuCd: string): string | null {
  return useHandoffStore.getState().take(menuCd);
}

/**
 * 마운트하며 <b>한 번만</b> 받아 온다 — 받는 화면이 쓰는 것은 이것이다.
 *
 * <h2>{@code useState(() => takeHandoff(...))} 는 StrictMode 에서 값을 잃는다</h2>
 *
 * <p>React 는 개발 모드에서 <b>컴포넌트 본문과 {@code useState} 초기화 함수를 두 번</b>
 * 돌린다. {@link takeHandoff} 는 <b>읽으면서 지우므로</b> 첫 호출이 값을 가져가고 그
 * 결과는 <b>버려지며</b>, 두 번째 호출은 {@code null} 을 받는다 — 그 {@code null} 이
 * 화면에 남는다.
 *
 * <p><b>증상이 조용하다.</b> 저장소에는 값이 없으니 <i>넘겨준 적이 없는 것</i>처럼 보이고,
 * 화면은 조건 없이 열린다 — 탭이 바뀌었으므로 사용자는 무언가 일어났다고 읽는데 목록은
 * 전체다. {@link onHandoff} 가 고친 <i>이미 열려 있는 탭</i> 문제와 <b>증상이 같고 원인이
 * 다르다</b>(2026-08-31 실물: 알림의 이동 버튼이 배치 ID 를 넘겼는데 조회조건이 비어 있었다).
 *
 * <p><b>{@code useRef} 가 그것을 막는다.</b> 두 번째 렌더도 <b>같은 ref 객체</b>를 보므로
 * 두 번째 호출이 아예 일어나지 않는다. {@code useState} 로는 안 되는 이유가 그 반대다 —
 * 초기화 함수는 두 번 <b>실행</b>되고 한 번의 결과만 남는다.
 */
export function useHandoff(menuCd: string): string | null {
  /*
    <b>렌더에서는 들여다보기만 한다.</b> 초기화 함수가 순수하므로 두 번 돌아도 같은 값이며,
    그 값이 마운트 동안 고정된다 — 구독하지 않으므로 지워지는 것이 렌더로 돌아오지도 않는다.
  */
  const [value] = useState(() => useHandoffStore.getState().pending[menuCd] ?? null);

  /*
    <b>지우는 것은 효과가 한다.</b> 사건이라 남겨 두면 그 화면을 다음에 열 때도 같은 곳으로
    튀는데(위), <b>지우는 시점을 렌더에서 떼면</b> StrictMode 가 렌더를 두 번 돌려도 값이
    사라지지 않는다. 효과는 두 번 돌지만 지우기는 <b>여러 번 해도 같다</b>.
  */
  useEffect(() => {
    if (value !== null) {
      useHandoffStore.getState().take(menuCd);
    }
  }, [menuCd, value]);

  return value;
}

/*
  ── 두 경로가 하는 일이 다르다 ────────────────────────────────────────────
  마운트 경로(useHandoff)는 <b>조회조건만 채운다</b>. 구독 경로(onHandoff)는 <b>채우고
  조회까지</b> 한다(받는 화면이 그렇게 구현한다) — 이미 그려져 있는 목록을 그대로 두면
  넘겨준 값이 아무 일도 안 한 것처럼 보이기 때문이다.

  마운트 경로에서는 <b>사람이 조회를 한 번 누른다.</b> 그것을 맞추려면 받는 화면 넷이
  각자 "넘겨받았으면 마운트하며 조회" 를 갖게 되는데, 그 화면들의 첫 조회 시점은 지금
  제각각이라(기간 기본값·권한 확인) 한 줄로 정리되지 않는다 — 65 §3.9 가 요구한 것은
  "그 배치로 열린다" 이고 조건이 채워진 것으로 그 절반은 지켜진다.
*/

/**
 * 받는 쪽이 <b>이미 열려 있을 때</b>를 위한 구독 — 반환값은 구독 해제 함수다.
 *
 * <p><b>{@link takeHandoff} 하나로는 모자란다.</b> main-shell.md §4.7.1 대로 같은 메뉴를 다시 열면
 * <b>새 탭이 아니라 이미 있는 탭이 활성화</b>되는데, 비활성 탭도 마운트된 채이므로
 * (ADR-0005) 받는 화면은 <b>다시 마운트되지 않는다</b> — 마운트 시점에만 읽으면 그 넘겨주기는
 * 저장소에 남은 채 아무 일도 일어나지 않는다.
 *
 * <p>실제로 그렇게 틀렸었다(2026-08-30 실물): 메뉴 트리를 열어 둔 채 API 카탈로그에서 행을
 * 더블 클릭하면 <b>탭만 바뀌고 트리는 그대로</b>였다. 탭이 바뀌었으므로 사용자는 무언가
 * 일어났다고 읽는데 화면은 아무 데도 가 있지 않은, 가장 헷갈리는 실패다.
 *
 * <p><b>효과 안에서 {@code setState} 를 하지 않는다.</b> 값을 넘기는 것은 구독 콜백이며
 * 그것은 렌더가 아니라 <b>사건</b>이다 — 효과가 하는 일은 구독을 걸고 푸는 것뿐이다.
 */
export function onHandoff(menuCd: string, apply: (value: string) => void): () => void {
  return useHandoffStore.subscribe((state, previous) => {
    const value = state.pending[menuCd];
    if (value === undefined || value === previous.pending[menuCd]) {
      return;
    }
    // 읽었으니 지운다 — 사건이라 남겨 두면 다음에 이 화면을 열 때도 같은 곳으로 튄다.
    useHandoffStore.getState().take(menuCd);
    apply(value);
  });
}
