package com.aiagent.domain.user.detail;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.RowTx;
import com.aiagent.domain.authz.entity.SysUserRole;
import com.aiagent.domain.authz.repository.SysRoleRepository;
import com.aiagent.domain.authz.repository.SysUserRoleRepository;
import com.aiagent.domain.user.entity.SysUserIpAllow;
import com.aiagent.domain.user.repository.SysUserIpAllowRepository;
import com.aiagent.domain.user.repository.SysUserRepository;
import java.net.InetAddress;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 디테일 탭의 저장 — <b>편집이 있는 탭은 둘뿐이다</b>(screen/admin/system/user/requirements.md 탭 1 · 탭 3).
 *
 * <p>개인 예외는 조회 전용이고(screen/admin/system/user/requirements.md — 사용자 관리 권한이 예외 부여 권한을 끌고 오면 안
 * 된다), 유효 권한은 계산 결과이며, 활성 세션은 우리 테이블이 아니다.
 *
 * <h2>두 저장이 같은 뼈대를 쓴다</h2>
 *
 * <p>{@code UserAuthService#save} 가 세운 순서를 따른다 — <b>행 하나씩 형태를 보고 →
 * 반영하고 → 마지막에 쓴다</b>. 검증이 쓰기보다 앞이어야 하는 이유도 같다: 트랜잭션 안이라
 * 뒤에 둬도 롤백되지만 <b>거부되는 요청이 {@code INSERT} 를 한 번 내고</b> 돌아간다.
 *
 * <h2>세션 무효화를 여기서 하지 않는다</h2>
 *
 * <p>역할 부여가 바뀌면 그 사람의 유효 권한이 바뀌므로 세션에 재계산 표시를 세워야 하지만
 * (backend/security.md) {@code AuthzInvalidator} 는 {@code api} 의 것이다 — 도메인이 세션을 알면 backend/packages.md 이
 * 갈린다. {@code UserAuthController} 가 이미 같은 자리에서 그렇게 한다.
 */
@Service
public class UserDetailService {

    /** 네 마디를 강제한다 — 값의 범위는 {@code ofLiteral} 이 본다(0~255). */
    private static final Pattern IPV4 = Pattern.compile("[0-9]{1,3}([.][0-9]{1,3}){3}");

    private final SysUserRepository users;
    private final SysRoleRepository roles;
    private final SysUserRoleRepository grants;
    private final SysUserIpAllowRepository ipAllows;

    public UserDetailService(
            SysUserRepository users,
            SysRoleRepository roles,
            SysUserRoleRepository grants,
            SysUserIpAllowRepository ipAllows) {
        this.users = users;
        this.roles = roles;
        this.grants = grants;
        this.ipAllows = ipAllows;
    }

    // ── 탭 1 — 보유 역할 (USER-03) ───────────────────────────────────

    /**
     * 역할 부여 일괄 저장 — frontend/grid.md. <b>한 트랜잭션이다</b>(UX-14).
     *
     * <p><b>{@code roleId} 는 {@code U} 에서 바뀌지 않는다</b> — PK 의 절반이다(sys/menu.md).
     * 다른 역할을 주려면 이 행을 정리하고 새로 만든다.
     *
     * <p><b>역할의 {@code USE_YN} 을 보지 않는다.</b> 꺼진 역할도 부여할 수 있으며 판정에서
     * 걸릴 뿐이다(sys/menu.md 의 AND) — <i>켜기 전에 부여를 구성해 두는</i> 동선이 정상이고,
     * {@code UserAuthService} 가 꺼진 메뉴에 예외를 허용한 것과 같은 판단이다.
     *
     * @return 유효 권한이 바뀐 사람 — 부른 쪽이 세션 무효화에 쓴다. 아무것도 바뀌지 않았으면
     *     <b>비어 있다</b>: 이름만 고친 저장에서 재계산을 예약할 이유가 없다
     */
    @Transactional
    public Set<String> saveRoles(String userId, List<UserRoleSaveRow> rows) {
        requireUser(userId);

        Map<String, SysUserRole> current = new HashMap<>();
        for (SysUserRole row : grants.findByUserIdOrderByRoleIdAsc(userId)) {
            current.put(row.getRoleId(), row);
        }

        Set<String> seen = new HashSet<>();
        List<SysUserRole> added = new ArrayList<>();
        List<SysUserRole> removed = new ArrayList<>();

        RowTx.oneTxForAll(rows, row -> {
            String roleId = row.roleId();
            /*
              같은 요청 안의 중복은 화면이 만들 수 없지만(PK 가 하나라 목록에 행이 하나다)
              화면 밖 경로가 남는다 — 두 번째의 존재 확인이 첫 번째의 flush 를 만나지 못해
              조용히 덮인다.
            */
            if (!seen.add(roleId)) {
                throw new BusinessException(
                        UserDetailErrorCode.ROLE_DUPLICATE,
                        "같은 요청에 같은 역할이 둘이다 — " + roleId,
                        List.of(new BusinessException.FieldError(
                                "roleId", "같은 역할이 두 번 왔습니다", roleId)));
            }
            switch (row.rowState()) {
                case C -> {
                    requireRole(roleId);
                    validatePeriod(row);
                    if (current.containsKey(roleId)) {
                        throw new BusinessException(
                                UserDetailErrorCode.ROLE_DUPLICATE,
                                "이미 가진 역할이다 — " + roleId,
                                List.of(new BusinessException.FieldError(
                                        "roleId", "이미 가진 역할입니다", roleId)));
                    }
                    added.add(SysUserRole.granted(
                            userId, roleId, row.validFromDt(), row.validToDt()));
                }
                case U -> {
                    validatePeriod(row);
                    require(current.get(roleId), roleId).change(row.validFromDt(), row.validToDt());
                }
                /*
                  <b>{@code D} 에는 역할 존재 검사를 걸지 않는다</b>. 역할이 사라지면 FK 가
                  이 행도 함께 지우므로 정상 경로로는 고아가 생기지 않지만, 그렇더라도
                  <b>정리를 막을 이유가 없다</b> — {@code UserAuthService} 가 고아 예외에
                  대해 내린 것과 같은 판단이다.
                */
                case D -> removed.add(require(current.get(roleId), roleId));
            }
        });
        if (!added.isEmpty()) {
            grants.saveAll(added);
        }
        if (!removed.isEmpty()) {
            grants.deleteAll(removed);
        }
        return rows.isEmpty() ? Set.of() : Set.of(userId);
    }

    /** <b>양끝 포함</b>이라 같은 날은 통과다 — sys/INDEX.md. {@code null} 은 제한 없음이다. */
    private static void validatePeriod(UserRoleSaveRow row) {
        validatePeriod(row.validFromDt(), row.validToDt(), "부여");
    }

    /**
     * 기간이 뒤집혔는가 — <b>양끝 포함이라 같은 날은 통과</b>다(sys/INDEX.md).
     *
     * <p>역할 부여와 허용 IP 가 <b>같은 판정</b>을 쓴다. 오류 코드도 하나다 — 사용자가 읽는
     * 말이 <i>기간이 뒤집혔다</i> 로 같고, 무엇의 기간인지는 <b>그 화면이 이미 말하고
     * 있다</b>(어느 탭에서 저장을 눌렀는지가 곧 그것이다).
     *
     * @param what 로그에만 남는다 — 서버 로그에서 어느 저장이었는지를 가른다
     */
    private static void validatePeriod(LocalDate from, LocalDate to, String what) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new BusinessException(
                    UserDetailErrorCode.PERIOD_REVERSED,
                    what + " 기간이 뒤집혔다 — " + from + " ~ " + to,
                    List.of(new BusinessException.FieldError(
                            "validToDt", "종료일이 시작일보다 빠릅니다", to.toString())));
        }
    }

    private static SysUserRole require(SysUserRole found, String roleId) {
        if (found == null) {
            throw new BusinessException(
                    UserDetailErrorCode.ROLE_MISSING,
                    "고치려는 역할 부여가 없다 — " + roleId,
                    List.of(new BusinessException.FieldError(
                            "roleId", "고치려는 역할 부여가 없습니다", roleId)));
        }
        return found;
    }

    private void requireRole(String roleId) {
        if (!roles.existsById(roleId)) {
            throw new BusinessException(
                    UserDetailErrorCode.ROLE_NOT_FOUND,
                    "없는 역할이다 — " + roleId,
                    List.of(new BusinessException.FieldError("roleId", "없는 역할입니다", roleId)));
        }
    }

    // ── 탭 3 — 접속 IP (AUTH-08) ────────────────────────────────────

    /**
     * 허용 대역 일괄 저장 — screen/admin/system/user/requirements.md 탭 3.
     *
     * <p><b>{@code D} 가 있는 유일한 탭</b>이다. 여기서 지우는 것은 <i>부여의 기록</i> 이
     * 아니라 <i>사무실이 어디인가</i> 라는 <b>지금의 사실</b>이라, 이사한 대역을 남겨 둘
     * 이유가 없다 — 잠시 막는 것은 {@code USE_YN} 이 맡는다.
     *
     * <p><b>전부 지워도 막지 않는다.</b> 행이 없으면 제한 없음이며(sys/user-role.md) 그것이 정상 상태다 —
     * 마지막 한 줄을 지우지 못하게 하면 <b>한 번 켠 제한을 영영 못 끄게</b> 된다.
     */
    @Transactional
    public void saveIps(String userId, List<UserIpSaveRow> rows) {
        requireUser(userId);

        Map<String, SysUserIpAllow> current = new HashMap<>();
        for (SysUserIpAllow row : ipAllows.findByUserIdOrderByIpCidrAsc(userId)) {
            current.put(row.getIpCidr(), row);
        }

        Set<String> seen = new HashSet<>();
        List<SysUserIpAllow> added = new ArrayList<>();
        List<SysUserIpAllow> removed = new ArrayList<>();

        RowTx.oneTxForAll(rows, row -> {
            String cidr = row.ipCidr().trim();
            if (!seen.add(cidr)) {
                throw new BusinessException(
                        UserDetailErrorCode.IP_DUPLICATE,
                        "같은 요청에 같은 대역이 둘이다 — " + cidr,
                        List.of(new BusinessException.FieldError(
                                "ipCidr", "같은 대역이 두 번 왔습니다", cidr)));
            }
            switch (row.rowState()) {
                case C -> {
                    requireWellFormed(cidr);
                    validatePeriod(row.validFromDt(), row.validToDt(), "허용");
                    if (current.containsKey(cidr)) {
                        throw new BusinessException(
                                UserDetailErrorCode.IP_DUPLICATE,
                                "이미 등록된 대역이다 — " + cidr,
                                List.of(new BusinessException.FieldError(
                                        "ipCidr", "이미 등록된 대역입니다", cidr)));
                    }
                    added.add(SysUserIpAllow.created(
                            userId, cidr, row.useYnOrTrue(), row.validFromDt(), row.validToDt()));
                }
                /*
                  고칠 수 있는 것은 <b>사용 여부와 기간</b>이다 — IP_CIDR 은 PK 라 바뀌지
                  않는다. 기간이 <b>같은 사실의 수정</b>인 것은 파견이 연장되면 대역은
                  그대로이고 끝나는 날만 바뀌기 때문이다(2026-08-31).
                */
                case U -> {
                    validatePeriod(row.validFromDt(), row.validToDt(), "허용");
                    requireIp(current.get(cidr), cidr)
                            .change(row.useYnOrTrue(), row.validFromDt(), row.validToDt());
                }
                /*
                  형태를 보지 않는다. 형식 검사가 뒤에 바뀌면 <b>예전에 들어간 값이 지울 수
                  없는 행</b>이 된다 — 검증은 들어오는 것에 걸고 나가는 것에는 걸지 않는다.
                */
                case D -> removed.add(requireIp(current.get(cidr), cidr));
            }
        });
        if (!added.isEmpty()) {
            ipAllows.saveAll(added);
        }
        if (!removed.isEmpty()) {
            ipAllows.deleteAll(removed);
        }
    }

    private static SysUserIpAllow requireIp(SysUserIpAllow found, String cidr) {
        if (found == null) {
            throw new BusinessException(
                    UserDetailErrorCode.IP_MISSING,
                    "고치려는 허용 대역이 없다 — " + cidr,
                    List.of(new BusinessException.FieldError(
                            "ipCidr", "고치려는 허용 대역이 없습니다", cidr)));
        }
        return found;
    }

    private void requireUser(String userId) {
        if (!users.existsById(userId)) {
            throw new BusinessException(UserDetailErrorCode.USER_NOT_FOUND, "없는 계정이다 — " + userId);
        }
    }

    private static void requireWellFormed(String cidr) {
        if (!isIpOrCidr(cidr)) {
            throw new BusinessException(
                    UserDetailErrorCode.IP_MALFORMED,
                    "IP 주소도 CIDR 도 아니다 — " + cidr,
                    List.of(new BusinessException.FieldError(
                            "ipCidr", "IP 주소도 CIDR 도 아닙니다", cidr)));
        }
    }

    /**
     * 단일 IP 또는 CIDR 인가 — sys/user-role.md 이 DDL 에 두지 않은 검사다.
     *
     * <p><b>{@code InetAddress.getByName} 을 쓰지 않는다.</b> 그것은 리터럴이 아니면
     * <b>DNS 를 조회</b>하므로, 오타 하나가 저장 요청을 이름 해석 타임아웃만큼 붙잡는다 —
     * 게다가 그 이름이 실제로 풀리면 <b>호스트명이 허용 대역으로 저장된다</b>.
     * {@code ofLiteral}(JDK 22)은 리터럴만 받고 아니면 그 자리에서 거절한다.
     *
     * <p>접두 길이의 상한을 <b>주소 계열에서 얻는다</b> — IPv4 는 32, IPv6 는 128 이다.
     * 상수 하나로 두면 {@code 1.2.3.4/64} 가 통과한다.
     *
     * <p><b>IPv4 는 네 마디를 요구한다</b>(2026-08-31 실물). {@code ofLiteral} 은 옛 표기
     * {@code d.d.d} · {@code d.d} · {@code d} 를 그대로 받아 <b>{@code 192.168.0} 을
     * {@code 192.168.0.0} 으로 읽는다</b> — 주소 하나를 덜 쓴 오타가 <i>다른 주소</i> 로
     * 조용히 저장되고, 허용 목록에서 그것은 <b>엉뚱한 대역을 연 것</b>이다.
     */
    static boolean isIpOrCidr(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        int slash = value.indexOf('/');
        String address = slash < 0 ? value : value.substring(0, slash);
        if (!address.contains(":") && !IPV4.matcher(address).matches()) {
            return false;
        }
        InetAddress parsed;
        try {
            parsed = InetAddress.ofLiteral(address);
        } catch (IllegalArgumentException notLiteral) {
            return false;
        }
        if (slash < 0) {
            return true;
        }
        String prefix = value.substring(slash + 1);
        // 빈 문자열·부호·공백을 전부 막는다. parseInt 는 "+8" 과 " 8" 을 다르게 다룬다.
        if (prefix.isEmpty() || !prefix.chars().allMatch(Character::isDigit)) {
            return false;
        }
        try {
            int bits = Integer.parseInt(prefix);
            return bits >= 0 && bits <= parsed.getAddress().length * 8;
        } catch (NumberFormatException tooLong) {
            return false;
        }
    }
}
