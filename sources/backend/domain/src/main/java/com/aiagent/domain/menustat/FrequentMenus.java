package com.aiagent.domain.menustat;

import java.util.List;

/**
 * 자주 쓰는 메뉴 목록과 <b>그것을 센 기간</b> — UX-16 · 42 §8.
 *
 * <p><b>기간이 함께 가는 이유</b>는 목록만으로는 <i>"무엇을 기준으로 자주인가"</i> 를 알 수
 * 없기 때문이다. 창은 설정값(`months`)이라 배포마다 다를 수 있고, 화면이 그것을 짐작하면
 * 서버와 어긋난다 — <b>센 쪽이 말한다.</b>
 *
 * @param fromYm 창의 시작 달 {@code yyyyMM}. <b>이 달의 1일부터</b> 센 것이다
 * @param menus 합계 내림차순. 상한은 설정값이다
 */
public record FrequentMenus(String fromYm, List<FrequentMenu> menus) {}
