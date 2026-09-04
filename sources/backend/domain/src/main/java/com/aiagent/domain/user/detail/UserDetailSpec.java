package com.aiagent.domain.user.detail;

import com.aiagent.core.search.QuerySpec;
import com.aiagent.core.search.SortDir;
import com.aiagent.domain.authz.entity.QSysRole;
import com.aiagent.domain.authz.entity.QSysUserRole;
import com.aiagent.domain.user.entity.QSysUserIpAllow;

/**
 * 디테일 탭의 화이트리스트 — screen/user/requirements.md · backend/api.md. <b>다섯 중 둘만 여기 있다.</b>
 *
 * <h2>스펙이 있는 탭과 없는 탭이 갈리는 기준</h2>
 *
 * <table>
 *   <tr><th>탭</th><th>스펙</th><th>왜</th></tr>
 *   <tr><td>보유 역할 · 접속 IP</td><td><b>있다</b></td>
 *       <td>테이블이 원본이고 <b>편집한다</b> — 컬럼이 곧 SQL 컬럼이라 정렬·필터가 서버의 일이다</td></tr>
 *   <tr><td>개인 예외 · 유효 권한</td><td><b>없다</b></td>
 *       <td>보여줄 컬럼의 <b>절반이 파생</b>이다({@code menuPath} · {@code effective} ·
 *           {@code grantState}) — SQL 이 모르는 값은 {@code ORDER BY} 대상이 될 수 없다</td></tr>
 * <tr><td>활성 세션</td><td><b>없다</b></td><td>원본이 DB 가 아니다 — 세션 스토어다(screen/user/requirements.md)</td></tr>
 * </table>
 *
 * <p>스펙이 없는 셋은 <b>전건을 낸다</b>({@code mode: 'all'} — backend/api.md). 그러면 정렬이
 * <b>화면의 일</b>이 되어 파생 컬럼도 정렬되고, 한 사람의 예외·세션·메뉴는 <b>모두 한 판에
 * 들어가는 크기</b>라 페이징이 값을 하지 않는다.
 *
 * <p><b>부모 키가 조건에 없다</b> — {@link UserIdParams} 로 오며 서비스가 이름으로 직접
 * 읽는다(backend/api.md). 조건으로 열면 부모 제약이 <b>클라이언트가 보낸 값</b>이 되고, 화면이
 * 그것을 빠뜨린 요청 하나가 전 계정의 부여를 한 판에 쏟는다.
 */
public final class UserDetailSpec {

    static final QSysUserRole UR = QSysUserRole.sysUserRole;
    static final QSysRole R = QSysRole.sysRole;
    static final QSysUserIpAllow IP = QSysUserIpAllow.sysUserIpAllow;

    /**
     * 탭 1 — 이 사람이 가진 역할(USER-03).
     *
     * <p><b>뿌리가 부여다.</b> 한 사람의 한 역할 부여는 하나뿐이므로(PK 가 그 쌍이다 —
     * sys/menu.md) 어느 쪽에서 조인해도 건수가 같고, 부여 쪽을 뿌리로 두면 <b>총 건수 쿼리가
     * 조인 없이</b> 끝난다.
     *
     * <p><b>{@code grantState} 가 없다</b> — 기간에서 파생하는 값이라(sys/menu.md) SQL 이 모른다.
     * {@code accountStat} 이 {@code UserSpec} 에서 파생 조건으로 들어간 것과 갈리는
     * 자리인데, 저기는 <b>조회조건</b> 이고 여기는 <b>컬럼</b>이다: 조건은 번역 함수를 둘 수
     * 있지만 {@code ORDER BY} 는 그럴 자리가 없다.
     *
     * <p>기본 정렬이 {@code ROLE_NM, ROLE_ID} 다 — {@code RoleSpec} 과 같은 규칙이며,
     * tie-breaker 없이는 동명 역할에서 순서가 비결정적이다(backend/persistence.md).
     */
    public static final QuerySpec USER_ROLE_SPEC = QuerySpec.of("userRole")
            .from(UR)
            .join(R).on(R.roleId.eq(UR.roleId))
            .col("roleId", UR.roleId).sortable()
            .col("roleNm", R.roleNm).sortable()
            .col("roleUseYn", R.useYn).sortable()
            .col("validFromDt", UR.validFromDt).sortable().nullable()
            .col("validToDt", UR.validToDt).sortable().nullable()
            .col("regDtm", UR.regDtm).sortable()
            .col("modDtm", UR.modDtm).sortable()
            .defaultSort("roleNm", SortDir.asc)
            .defaultSort("roleId", SortDir.asc)
            .pk(UR.roleId)
            .build();

    /**
     * 탭 3 — 접속 허용 대역(AUTH-08).
     *
     * <p><b>{@code IP_CIDR} 문자열 정렬이 대역 순서가 아니다</b> — {@code 10.} 이
     * {@code 9.} 보다 앞선다. 그래도 그것으로 정렬하는 것은 <b>주소를 정렬 가능한 형태로
     * 정규화하려면 컬럼을 하나 더 두어야</b> 하고(그리고 IPv6 까지 덮어야 하고), 한 계정의
     * 대역이 열 줄을 넘는 일이 없기 때문이다. 순서보다 <b>결정적인 것</b>이 중요하다.
     */
    public static final QuerySpec USER_IP_SPEC = QuerySpec.of("userIp")
            .from(IP)
            .col("ipCidr", IP.ipCidr).sortable()
            .col("useYn", IP.useYn).sortable()
            .col("validFromDt", IP.validFromDt).sortable().nullable()
            .col("validToDt", IP.validToDt).sortable().nullable()
            .col("regDtm", IP.regDtm).sortable()
            .col("modDtm", IP.modDtm).sortable()
            .defaultSort("ipCidr", SortDir.asc)
            .pk(IP.ipCidr)
            .build();

    private UserDetailSpec() {}
}
