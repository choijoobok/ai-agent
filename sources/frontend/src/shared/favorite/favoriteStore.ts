import { create } from 'zustand';
import { addFavorite, getFavorites, removeFavorite } from '@/shared/favorite/api/favoriteApi';

/**
 * 즐겨찾기 메뉴 — UX-03 · 42 §7.
 *
 * <p><b>원본이 DB 다.</b> 최근 사용 메뉴({@link recentMenus})와 짝이지만 저장 위치가
 * 갈린다 — 즐겨찾기는 사용자가 <b>명시적으로 선언</b>한 것이라 자리를 바꿔도 따라와야
 * 하고, 최근은 파생·휘발이라 `localStorage` 다(42 §7 · 41 §4.3).
 *
 * <p><b>메모리다.</b> `persist` 를 쓰지 않는 이유는 원본이 서버이기 때문이다 — 캐시를
 * 디스크에 두면 로그인한 순간 <b>남의 기기에 남은 옛 목록</b>이 잠깐 보인다.
 *
 * <p><b>실패하면 조용히 그대로 둔다.</b> 즐겨찾기는 편의 기능이고, 화면에 들어올 때마다
 * 뜨는 빨간 토스트는 고칠 수 없는 경고다(`useGridPref` 와 같은 태도다). 다만 <b>추가·제거는
 * 사용자가 방금 누른 것</b>이라 다르다 — 그쪽은 실패하면 목록이 되돌아가고, 되돌아간
 * 것 자체가 답이다.
 */
interface FavoriteState {
  /** 순서대로의 메뉴 코드. <b>이름은 없다</b> — 이름의 원본은 메뉴 트리다(43 §4.4). */
  menuCds: string[];
  load: () => Promise<void>;
  /** 있으면 빼고 없으면 넣는다 — 우클릭 메뉴가 무엇을 보여줄지 이미 알고 있다. */
  toggle: (menuCd: string) => Promise<void>;
  /**
   * <b>빼기만 한다</b> — 진입 모달의 휴지통이 부른다.
   *
   * <p>{@link toggle} 로도 같은 결과가 나오지만 그것은 <i>지금 상태</i> 에 달려 있다.
   * 휴지통이 <b>넣는 일을 할 수 있으면</b> 안 된다 — 목록이 잠깐 어긋난 순간에 누른
   * 사용자가 지우려다 넣게 된다.
   */
  remove: (menuCd: string) => Promise<void>;
  clear: () => void;
}

export const useFavoriteStore = create<FavoriteState>()((set, getState) => ({
  menuCds: [],

  load: async () => {
    try {
      set({ menuCds: (await getFavorites()).map((row) => row.menuCd) });
    } catch {
      // 조용히 빈 채로 간다 — 셸은 즐겨찾기 없이도 제 일을 한다.
    }
  },

  toggle: async (menuCd) => {
    const has = getState().menuCds.includes(menuCd);
    const next = has ? await removeFavorite(menuCd) : await addFavorite(menuCd);
    set({ menuCds: next.map((row) => row.menuCd) });
  },

  remove: async (menuCd) => {
    set({ menuCds: (await removeFavorite(menuCd)).map((row) => row.menuCd) });
  },

  // 로그아웃이 지운다 — 다음 사람이 앞사람의 목록을 보면 안 된다.
  clear: () => set({ menuCds: [] }),
}));
