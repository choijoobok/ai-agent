package com.aiagent.domain.authz.role;

/**
 * {@code ROLE_AUTH_MGMT} 왼쪽 목록의 한 행 — screen/menu/requirements.md. <b>읽기 전용이다.</b>
 *
 * <p>생성·비활성화·삭제는 {@code ROLE_MGMT}의 일이므로 <b>고르기만 하는 목록</b>이며,
 * 그래서 삭제 컬럼도 행 추가 버튼도 없다(frontend/grid.md).
 *
 * <p><b>{@link RoleRow} 를 재사용하지 않는다.</b> 저기 있는 파생 셋 중 둘(유효 인원 · 권한
 * 건수)은 <b>삭제 게이트의 근거</b>인데(screen/menu/requirements.md) 이 화면에는 삭제가 없다 — 쓰지 않는 값을
 * 위해 쿼리를 두 벌 더 도는 것이 되고, 화면에는 <i>왜 있는지 모를 컬럼</i> 이 생긴다.
 *
 * @param useYn <b>비활성 역할도 목록에 낸다</b>(screen/menu/requirements.md 목업 주석 3). 권한 구성은 <b>켜기
 *     전에</b> 해 두는 것이 정상이고, 꺼진 역할의 권한을 고치는 것은 아무에게도 영향이 없어
 *     <b>가장 안전한 편집</b>이다
 * @param holderCount 보유 인원 — 여기서는 게이트가 아니라 <b>저장 확인이 말할 수를 미리
 *     보여주는 것</b>이다(§2.5 의 둘째 줄). 고르기 전에 규모를 알 수 있어야 한다
 */
public record RolePickRow(String roleId, String roleNm, Boolean useYn, long holderCount) {}
