// @feat FEAT-502
package com.aiagent.system.domain.role;

import com.aiagent.core.search.QuerySpec;
import com.aiagent.core.search.SortDir;
import com.aiagent.domain.authz.entity.QSysRole;
import com.aiagent.domain.authz.entity.QSysUserRole;
import com.aiagent.domain.user.entity.QSysUser;

/**
 * {@code ROLE_MGMT} · {@code ROLE_AUTH_MGMT} 의 화이트리스트 — screen/admin/system/role/requirements.md · backend/api.md.
 *
 * <h2>스펙이 둘이고 <b>거의 같다</b></h2>
 *
 * 두 화면의 역할 목록이 같은 테이블을 같은 조건으로 본다. 그래도 <b>합치지 않는 것</b>은
 * screen/admin/system/role/requirements.md 가 왼쪽 목록을 <i>"읽기 전용 — 고르기만 한다"</i> 로 정했기 때문이다: 거기서는
 * <b>사용 여부가 조회조건이 아니다</b>(§2.3 의 표에 없다 — 비활성 역할도 고를 수 있어야
 * 하며, 그것이 <i>켜기 전에 권한을 구성하는</i> 정상 동선이다).
 *
 * <p>하나로 합치면 <b>한쪽에만 있는 조건</b>을 다른 쪽 화면이 보낼 수 있게 되고, 그러면
 * 화이트리스트가 <i>이 화면이 무엇을 물을 수 있는가</i> 를 말하지 못한다.
 *
 * <h2>기본 정렬이 {@code ROLE_NM, ROLE_ID} 다</h2>
 *
 * screen/admin/system/role/requirements.md 가 정한 것이다. <b>tie-breaker 없이는 동명 역할에서 순서가 비결정적</b>이며
 * (backend/persistence.md) 페이징이 그 위에서 돌면 같은 행이 두 장에 나오거나 아예 빠진다.
 *
 * <p><b>{@code SORT_NO} 로 정렬하지 않는다 — 컬럼이 없다</b>(sys/menu.md). 역할의 <i>자연스러운
 * 순서</i> 는 권한 범위 순인데 그것이 정확히 backend/security.md 가 금지한 오해다.
 *
 * <h2>파생 셋이 화이트리스트에 없다</h2>
 *
 * 보유 인원 · 유효 인원 · 권한 건수는 <b>쿼리 셋이 따로 세는 값</b>이라(screen/admin/system/role/requirements.md) 정렬도
 * 조건도 걸 자리가 없다. 화면도 그 컬럼들의 {@code sortable} 을 켜지 않는다 — 켜면 400 이다.
 */
public final class RoleSpec {

    static final QSysRole R = QSysRole.sysRole;
    static final QSysUserRole UR = QSysUserRole.sysUserRole;
    static final QSysUser U = QSysUser.sysUser;

    /**
     * {@code ROLE_MGMT} 의 마스터 — screen/admin/system/role/requirements.md.
     *
     * <p><b>사용 여부의 기본값이 <i>전체</i> 다</b>(화면이 정한다 — 여기는 후보만 연다).
     * 끈 역할을 감추면 <b>같은 것을 또 만드는</b> 사고가 나고, 그때 {@code ROLE_ID} 가 PK 라
     * 저장이 실패한다 — 운영자는 <i>"왜 저장이 안 되나"</i> 만 본다(screen/admin/system/role/requirements.md).
     */
    public static final QuerySpec ROLE_SPEC = QuerySpec.of("role")
            .from(R)
            .col("roleId", R.roleId).sortable()
            .col("roleNm", R.roleNm).sortable()
            .col("roleDesc", R.roleDesc)
            .col("useYn", R.useYn).sortable()
            .col("regDtm", R.regDtm).sortable()
            .col("modDtm", R.modDtm).sortable()
            .defaultSort("roleNm", SortDir.asc)
            .defaultSort("roleId", SortDir.asc)
            .pk(R.roleId)
            .build();

    /**
     * {@code ROLE_AUTH_MGMT} 의 왼쪽 목록 — screen/admin/system/role-auth/requirements.md. <b>역할명 하나뿐이다.</b>
     *
     * <p><b>사용 여부가 없다.</b> screen/admin/system/role/requirements.md 의 목록은 고르기만 하는 것이고, 비활성 역할의 권한을
     * 고치는 것은 <b>아무에게도 영향이 없어 가장 안전한 편집</b>이다 — 감출 이유가 없다.
     *
     * <p><b>부여 상태도 없다</b> — {@code SYS_ROLE_MENU_AUTH} 에 기간 컬럼이 없으므로
     * (sys/menu.md) <b>상태 자체가 없다</b>. screen/user/requirements.md 이 개인 예외에서 그것을 넣었다 뺐다 한 것과
     * 갈리는 자리다.
     */
    public static final QuerySpec ROLE_PICK_SPEC = QuerySpec.of("roleAuthRole")
            .from(R)
            .col("roleId", R.roleId).sortable()
            .col("roleNm", R.roleNm).sortable()
            .col("useYn", R.useYn).sortable()
            .defaultSort("roleNm", SortDir.asc)
            .defaultSort("roleId", SortDir.asc)
            .pk(R.roleId)
            .build();

    /**
     * 하단 — <b>이 역할을 가진 사람</b>(AUTHZ-13). 두 화면이 <b>같은 그리드</b>다(screen/admin/system/role/requirements.md).
     *
     * <p><b>{@code roleId} 가 조건에 없다.</b> 부모 키는 {@code params} 로 오며(backend/api.md)
     * 서비스가 이름으로 직접 읽는다 — 조건으로 열면 부모 제약이 <b>클라이언트가 보낸 값</b>이
     * 되고, 화면이 그것을 빠뜨린 요청 하나가 전 역할의 보유자를 한 판에 쏟는다.
     *
     * <p><b>부여 상태로 거르지 않는다</b>(screen/admin/system/role/requirements.md) — 만료된 부여도 <b>다시 유효해질 수
     * 있다</b>. 감추면 <i>"영향 없다고 해서 지웠는데 다음 달에 문제가 생겼다"</i> 가 된다.
     * 걸러 보고 싶으면 컬럼 필터다(frontend/grid.md).
     */
    public static final QuerySpec HOLDER_SPEC = QuerySpec.of("roleHolder")
            // 뿌리가 <b>사용자</b>다 — 한 역할에 한 사람의 부여는 하나뿐이라(PK 가 그 쌍이다)
            // 방향을 어느 쪽으로 잡아도 건수가 같고, 단일 키 쪽이 총 건수 쿼리를 단순하게 둔다.
            .from(U)
            .join(UR).on(UR.userId.eq(U.userId))
            .col("userId", U.userId).sortable()
            .col("userNm", U.userNm).sortable()
            .col("validFromDt", UR.validFromDt).sortable().nullable()
            .col("validToDt", UR.validToDt).sortable().nullable()
            .defaultSort("userNm", SortDir.asc)
            .defaultSort("userId", SortDir.asc)
            .pk(U.userId)
            .build();

    private RoleSpec() {}
}
