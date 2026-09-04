import { get, post } from '@/shared/api';
import { MENU_STAT_ENDPOINTS } from '@/shared/menustat/api/endpoints';

/** 서버가 내는 한 줄 — <b>이름이 없다</b>. 이름의 원본은 메뉴 트리다(sys/code.md). */
export interface FrequentMenu {
  menuCd: string;
  useCnt: number;
}

/**
 * 목록과 <b>그것을 센 기간</b>.
 *
 * <p>기간이 함께 오는 이유는 목록만으로는 <i>"무엇을 기준으로 자주인가"</i> 를 알 수 없기
 * 때문이다. 창은 서버 설정이라 화면이 짐작하면 어긋난다 — <b>센 쪽이 말한다</b>.
 */
export interface FrequentMenus {
  /** 창의 시작 달 `yyyyMM`. 이 달의 1일부터 센 것이다. */
  fromYm: string;
  menus: FrequentMenu[];
}

/**
 * 메뉴를 골랐다고 알린다 — <b>부수 효과다</b>(sys/menu.md).
 *
 * <p><b>응답을 기다리지 않는다.</b> 실패가 화면 진입을 막으면 기능의 무게가 목적보다
 * 커진다 — 그래서 부르는 쪽도 `void` 로 던지고 잊는다.
 */
export function recordMenuSelect(menuCd: string): Promise<void> {
  return post<void>(MENU_STAT_ENDPOINTS.saveSelect, { menuCd });
}

export function getFrequentMenus(): Promise<FrequentMenus> {
  return get<FrequentMenus>(MENU_STAT_ENDPOINTS.getFrequent);
}
