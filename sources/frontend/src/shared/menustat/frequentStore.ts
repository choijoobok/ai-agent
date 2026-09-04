import { create } from 'zustand';
import {
  getFrequentMenus,
  recordMenuSelect,
  type FrequentMenu,
} from '@/shared/menustat/api/menuStatApi';

/**
 * 자주 쓰는 메뉴 — UX-16 · 42 §8.
 *
 * <p><b>원본이 DB 다.</b> 즐겨찾기와 같은 자리이고 최근 사용(`localStorage`)과 갈린다 —
 * 즐겨찾기는 사용자가 선언한 것, 이것은 서버가 센 것, 최근은 이 기기의 것이다.
 *
 * <p><b>세는 것과 읽는 것이 따로다.</b> 셀 때마다 목록을 되받으면 메뉴를 열 때마다
 * 왕복이 두 배가 되는데, 그 목록은 <b>진입 모달을 열기 전까지 아무도 보지 않는다</b>.
 */
interface FrequentState {
  /** 많이 쓴 순서. <b>건수를 함께 갖는다</b> — 목록에 그것을 보여 준다. */
  menus: FrequentMenu[];
  /**
   * 센 기간의 시작 달 {@code yyyyMM} — 목록이 비어 있으면 {@code null}.
   *
   * <p><b>화면이 계산하지 않는다.</b> 창은 서버 설정이라 여기서 짐작하면 <i>"3개월"</i> 을
   * 두 곳에 적는 것이 되고, 설정을 바꾼 날 한쪽만 따라온다.
   */
  fromYm: string | null;
  /** 모달을 열 때 읽는다 — 방금 연 메뉴가 순위에 반영돼 있어야 한다. */
  load: () => Promise<void>;
  /**
   * 메뉴를 골랐다 — <b>던지고 잊는다</b>.
   *
   * <p>실패해도 조용하다. 카운트는 부수 효과이며, 이것 때문에 화면이 안 열리거나
   * 빨간 토스트가 뜨면 <b>기능의 무게가 목적보다 커진다</b>(42 §8).
   */
  count: (menuCd: string) => void;
  clear: () => void;
}

export const useFrequentStore = create<FrequentState>()((set) => ({
  menus: [],
  fromYm: null,

  load: async () => {
    try {
      const found = await getFrequentMenus();
      set({ menus: found.menus, fromYm: found.fromYm });
    } catch {
      // 조용히 빈 채로 간다 — 셸은 이 목록 없이도 제 일을 한다.
    }
  },

  count: (menuCd) => {
    void recordMenuSelect(menuCd).catch(() => undefined);
  },

  // 로그아웃이 지운다 — 다음 사람이 앞사람의 순위를 보면 안 된다.
  clear: () => set({ menus: [], fromYm: null }),
}));
