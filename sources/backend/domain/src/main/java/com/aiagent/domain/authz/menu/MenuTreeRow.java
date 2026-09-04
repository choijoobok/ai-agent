package com.aiagent.domain.authz.menu;

import java.time.Instant;

/**
 * 트리 그리드의 한 행 — 62 §4.2. <b>기본정보 탭이 컬럼이 됐다</b>(grid-standard.md §1.1).
 *
 * <p><b>{@code SORT_NO} 가 없다.</b> 트리의 <b>모양이 곧 그 값</b>이며(42 §4), 응답의 행
 * 순서가 <b>전위 순회</b>라 인덱스가 그것을 이미 나른다 — 컬럼으로 실으면 42 §4 가 저장
 * DTO 에서 빼 버린 필드를 응답이 되살리는 셈이고, 화면이 그것을 보내는 경로가 열린다.
 *
 * <p><b>{@code upMenuCd} 는 있다.</b> 이것 없이는 화면이 트리를 조립할 수 없다 — 저장
 * DTO 에 없는 것과 조회 응답에 있는 것은 다른 축이다(읽기는 구조를 알아야 그린다).
 *
 * @param menuNm <b>메뉴명이지 메시지 키가 아니다</b>. {@code SYS_MENU.MENU_NM} 에 들어 있는
 *     것은 {@code menu.{MENU_CD}} 이고(42 §4), 서버가 세션 언어로 풀어 내려준다 — 43 §7.3 의
 *     폴백이 {@code MessageService} 하나에 있으므로 조인을 한 벌 더 만들지 않는다.
 *     <p>값이 키 문자열 그대로 보이면 <b>아직 이름을 안 채운 것</b>이며 그것이 진단이다.
 *     고치는 곳은 {@code MESSAGE_MGMT} 하나다
 * @param apiCount 매핑 API 수 — {@code 0} 이면 <b>미매핑</b>이다(42 §5). 삭제 게이트의 근거
 *     넷 중 하나이기도 하다(62 §4.8)
 * @param accessibleUserCount AUTHZ-13. <b>리프만 값이 있다</b> — 구조 노드는 권한 대상이
 *     아니라 세는 것이 정의되지 않는다(security-design.md §4)
 * @param srcCd 누가 만들었나 — {@code SEED} · {@code USER} · <b>{@code ORPHAN}</b>(ADR-0028).
 *     마지막이 <b>선언에서 사라진 메뉴</b>이며 트리가 배지를 붙인다(62 §4.8). 지우지 않고
 *     표시만 하는 것은 그 행에 사람의 것이 딸려 있기 때문이다 — 역할 권한 · 개인 예외
 * @param roleCount 매핑 역할 수 — 삭제 게이트의 근거이며 <b>{@code USE_YN='N'} 인 역할도
 *     센다</b>(62 §4.11 탭 3). 게이트가 막는 것은 <b>행의 존재</b>이지 역할의 상태가 아니다
 */
public record MenuTreeRow(
        String menuCd,
        String upMenuCd,
        String menuNm,
        String menuUrl,
        String iconCd,
        Boolean useYn,
        String srcCd,
        long apiCount,
        long accessibleUserCount,
        long roleCount,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
