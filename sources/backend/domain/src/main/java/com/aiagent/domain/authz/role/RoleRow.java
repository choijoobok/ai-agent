package com.aiagent.domain.authz.role;

import java.time.Instant;

/**
 * 마스터 그리드의 한 행 — screen/menu/requirements.md. <b>기본정보 탭이 컬럼이 됐다</b>(frontend/grid.md).
 *
 * <p>sys/menu.md 이 <i>"위 표는 62 착수 시 함께 정리한다"</i> 며 남긴 자리를 이 레코드가 닫는다.
 * 편집 폼을 두지 않기로 했으므로(frontend/grid.md) 역할명·설명·사용 여부가 전부 셀이다.
 *
 * <p><b>{@code SORT_NO} 가 없다</b>(sys/menu.md · screen/menu/requirements.md). 소비처가 이 그리드 하나였는데 그리드는
 * 헤더 정렬을 이미 갖는다 — 남는 것은 숫자를 손으로 매기는 일뿐이었고, <b>컬럼이 있으면
 * 우선순위로 읽힌다</b>. 합집합에 우선순위는 없다(backend/security.md).
 *
 * @param holderCount {@code SYS_USER_ROLE} <b>전체</b> 행 수 — screen/role/requirements.md. 삭제 게이트가 보는
 *     것이 이것이며 <b>기간을 보지 않는다</b>: 만료된 부여도 행이고 FK 는 날짜를 보지 않는다
 * @param activeHolderCount 그중 오늘 유효한 부여(sys/menu.md). <b>게이트가 보지 않는 수</b>이며
 * 운영자가 궁금한 쪽이다 — 하나로 접으면 <i>"0명인데 왜 못 지우나"</i> 가 된다(screen/role/requirements.md)
 * @param authCount {@code SYS_ROLE_MENU_AUTH} 행 수 — screen/role/requirements.md. <b>디테일이 없는 자식</b>의
 * 건수이며(편집은 screen/role/requirements.md 의 화면이다) 그래서 이 컬럼이 게이트의 다른 한쪽을 대신한다.
 * frontend/grid.md 가 <i>"디테일이 전부 도착한 뒤 판정"</i> 이라고만 적은 자리에 이 경로가 붙었다
 */
public record RoleRow(
        String roleId,
        String roleNm,
        String roleDesc,
        Boolean useYn,
        long holderCount,
        long activeHolderCount,
        long authCount,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
