package com.aiagent.domain.authz;

import java.util.List;

/**
 * 좌측 메뉴 트리의 한 마디 — AUTHZ-04 · security-design.md §4.
 *
 * <p><b>트리는 권한에서 파생된다.</b> 표시 여부를 담은 컬럼은 없다 — 42 §11 이
 * {@code DISP_YN} 을 제거하면서 <i>"감추려면 권한을 주지 않는다"</i> 로 정리했다. 그래서 이
 * 구조에 {@code visible} 같은 필드가 없는 것이 정상이며, 여기 있는 마디는 전부 보이는 것이다.
 *
 * <p><b>{@code menuNm} 은 이름이 아니라 메시지 키다</b>({@code menu.{MENU_CD}}). 번역은
 * 프론트가 메시지 번들로 한다(50 §5) — 서버가 번역해 내리면 언어별 캐시가 서버에 생기고,
 * 메뉴 검색(main-shell.md §4.2)이 클라이언트 필터로 성립하지 않는다.
 *
 * <p><b>{@code menuUrl} 이 {@code null} 이면 구조 노드다.</b> URL 과 자식은 배타이므로
 * (security-design.md §4) {@code menuUrl == null} 과 {@code !children.isEmpty()} 가 <b>같은 사실</b>이며,
 * 프론트는 둘 중 무엇을 봐도 된다 — 클릭 대상 여부의 판정이 하나로 끝난다.
 */
public record MenuNode(
        String menuCd, String menuNm, String menuUrl, String iconCd, List<MenuNode> children) {}
