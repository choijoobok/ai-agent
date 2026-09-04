package com.aiagent.api.user;

import com.aiagent.api.authz.AuthzInvalidator;
import com.aiagent.api.message.RequestLocale;
import com.aiagent.api.trace.TraceId;
import com.aiagent.api.user.request.UserIpSaveRequest;
import com.aiagent.api.user.request.UserRoleSaveRequest;
import com.aiagent.api.user.request.UserSessionKillRequest;
import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.core.response.ApiResponse;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.user.detail.EffectiveAuthParams;
import com.aiagent.domain.user.detail.EffectiveAuthRow;
import com.aiagent.domain.user.detail.RoleCandidate;
import com.aiagent.domain.user.detail.UserDetailQueryService;
import com.aiagent.domain.user.detail.UserDetailService;
import com.aiagent.domain.user.detail.UserGrantRow;
import com.aiagent.domain.user.detail.UserIdParams;
import com.aiagent.domain.user.detail.UserIpRow;
import com.aiagent.domain.user.detail.UserRoleRow;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.Set;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code USER_MGMT} 의 디테일 탭 다섯 — screen/user/requirements.md. <b>경로가 일곱이다.</b>
 *
 * <table>
 *   <tr><th>탭</th><th>경로</th><th>액션</th></tr>
 *   <tr><td>1 보유 역할</td><td>{@code getRoleList} · {@code saveRole}</td><td>{@code R} {@code S}</td></tr>
 *   <tr><td>2 개인 예외</td><td>{@code getUserMenuAuth}</td><td>{@code R}</td></tr>
 *   <tr><td>3 접속 IP</td><td>{@code getIpList} · {@code saveIp}</td><td>{@code R} {@code S}</td></tr>
 *   <tr><td>4 활성 세션</td><td>{@code getSessionList} · {@code killSession}</td><td>{@code R} {@code X}</td></tr>
 *   <tr><td>5 유효 권한</td><td>{@code getEffectiveAuthList}</td><td>{@code R}</td></tr>
 * </table>
 *
 * <h2>이 화면의 {@code EXECUTE} 가 여기서 처음 실물이 된다</h2>
 *
 * <p>{@code UserController} 가 <i>"{@code X} 에 대응하는 경로도 아직 없다 — 활성 세션
 * 탭이 서는 슬라이스가 가져온다"</i> 고 적어 둔 자리다. {@code killSession} 은 접두 규칙의
 * <i>그 외</i> 에 걸려 {@code EXECUTE} 가 되고(backend/api.md), 그 판정이 screen/user/requirements.md 의 기준과
 * 일치한다 — <b>우리 테이블의 컬럼을 쓰지 않는다.</b> 세션 스토어를 비울 뿐이며
 * {@code SYS_USER} 는 그대로다.
 *
 * <p>그래서 {@code saveUnlock} 과 갈린다. 저것은 {@code LOCK_YN} 을 쓰므로 이름이
 * {@code unlock} 이면 안 됐고, 이것은 쓰지 않으므로 {@code killSession} 이 맞다 —
 * <b>규칙을 넓히지 않고 경로를 규칙에 맞춘다.</b>
 *
 * <h2>탭 다섯이 한 컨트롤러다</h2>
 *
 * <p>{@code /api/service/user} 를 {@link UserController} 와 <b>나눠 쓴다</b>. 같은
 * 메뉴의 같은 화면이라 권한 판정이 하나이며, 마스터와 탭을 파일 둘로 나눈 것은 <b>읽는
 * 사람을 위해서</b>다 — 저기는 {@code SYS_USER} 한 테이블의 일이고 여기는 그 계정에
 * 매달린 것들의 일이다.
 *
 * <p><b>활성 세션만 도메인 서비스가 아니다</b>({@link UserSessionService}) — 원천이 DB 가
 * 아니라 세션 스토어라 {@code api} 의 것이며, 도메인이 그것을 알면 backend/packages.md 이 갈린다.
 */
@RestController
@RequestMapping("/api/service/user")
public class UserDetailController {

    private final UserDetailQueryService queries;
    private final UserDetailService detail;
    private final UserSessionService sessions;
    private final AuthzInvalidator invalidator;
    private final RequestLocale locale;

    public UserDetailController(
            UserDetailQueryService queries,
            UserDetailService detail,
            UserSessionService sessions,
            AuthzInvalidator invalidator,
            RequestLocale locale) {
        this.queries = queries;
        this.detail = detail;
        this.sessions = sessions;
        this.invalidator = invalidator;
        this.locale = locale;
    }

    // ── 탭 1 — 보유 역할 (USER-03) ──────────────────────────────────

    @Operation(
            summary = "보유 역할 조회",
            description = "한 사용자의 역할 부여를 기간과 함께 반환한다. 만료된 부여와 꺼진 역할의 부여도 포함하며 역할 자체의 사용 여부가 함께 실린다.")
    @PostMapping("/getRoleList")
    public ApiResponse<PageResponse<UserRoleRow>> getRoleList(
            @RequestBody @Valid SearchRequest<UserIdParams> request) {
        return ApiResponse.success(queries.getRoleList(request), TraceId.current());
    }

    /**
     * 역할 부여 저장 — <b>세션 무효화가 뒤따르며 대상이 한 사람</b>이다.
     *
     * <p>{@code UserAuthController#save} 와 같은 규약이다: 저장이 커밋된 <b>뒤에</b> 표시를
     * 세운다 — 먼저 세우면 롤백된 변경에 대해 재계산이 돌고, 그 계산은 옛 값을 다시 읽어
     * <b>이유 없는 부하</b>가 된다.
     *
     * <p><b>자기 역할을 회수하는 것은 허용</b>이다(screen/user/requirements.md). 유효 권한이 공집합이 되면
     * <b>다음 로그인부터</b> 차단되며 현재 세션은 살아 있어 되돌릴 수 있다 — 사용 여부
     * {@code 'N'} 이 <i>그 자리에서</i> 밀어내는 것과 갈리는 자리다.
     */
    @Operation(
            summary = "보유 역할 저장",
            description = "추가·수정·삭제 행을 한 트랜잭션으로 반영하고, 그 사용자의 세션에 권한 재계산을 예약한다.")
    @PostMapping("/saveRole")
    public ApiResponse<Void> saveRole(
            @RequestBody @Valid UserRoleSaveRequest request,
            Principal principal,
            HttpSession session) {

        Set<String> changed = detail.saveRoles(request.userId(), request.rows());
        invalidator.markDirty(changed, session, userId(principal));
        return ApiResponse.success(null, TraceId.current());
    }

    /**
     * 역할 후보 — <b>이 화면이 자기 경로를 갖는다</b>({@link RoleCandidate}).
     *
     * <p>{@code ROLE_MGMT} 의 목록을 부르면 그 요청이 <b>역할 관리의 {@code READ}</b> 를
     * 요구하게 되고(backend/api.md — 매핑이 경로를 따라간다), 그러면 사용자 관리만 가진 사람이
     * 역할을 부여할 수 없다.
     *
     * <p><b>조회조건도 이것을 쓴다</b>(screen/user/requirements.md). 마스터의 <i>역할</i> 칸은 후보가 공통코드가
     * 아니라 비어 있었고, 그 자리를 이 경로가 채운다.
     */
    @Operation(
            summary = "역할 후보 조회",
            description = "부여할 수 있는 역할 전건을 이름 순으로 반환한다. 꺼진 역할도 포함하며 사용 여부가 함께 실린다.")
    @PostMapping("/getRoleCandidates")
    public ApiResponse<PageResponse<RoleCandidate>> getRoleCandidates() {
        return ApiResponse.success(queries.getRoleCandidates(), TraceId.current());
    }

    // ── 탭 2 — 개인 예외 (AUTHZ-07 조회) ────────────────────────────

    /**
     * 개인 예외 조회 — <b>{@code USER_AUTH_MGMT} 와 경로를 공유하지 않는다</b>(screen/user/requirements.md).
     *
     * <p>반환 형태가 다르기 때문이다: 저쪽은 트리 체크 상태를 함께 내야 해 <b>메뉴 전건</b>이
     * 실리고, 여기는 <b>부여된 행만</b> 나오는 납작한 목록이다. backend/security.md 의 <i>"화면마다 허용
     * 범위가 달라야 한다면 그것은 분리해야 할 두 API"</i> 와 방향이 같다.
     *
     * <p><b>여기에 저장이 없는 것은 권한 때문</b>이다. 사용자 관리 권한이 있다고 예외 권한
     * 부여 권한이 따라오면 안 되며, 권한은 {@code (MENU_CD, ACTION_CD)} 쌍이므로 <b>메뉴가
     * 갈려야 갈린다</b>(screen/user/requirements.md).
     */
    @Operation(
            summary = "개인 예외 조회",
            description = "한 사용자의 개인 예외를 메뉴 경로·기간·사유와 함께 반환한다. 조회 전용이며 부여는 개인 예외 권한 화면의 일이다.")
    @PostMapping("/getUserMenuAuth")
    public ApiResponse<PageResponse<UserGrantRow>> getUserMenuAuth(
            @RequestBody @Valid SearchRequest<UserIdParams> request) {
        return ApiResponse.success(
                queries.getUserMenuAuth(request, locale.current()), TraceId.current());
    }

    // ── 탭 3 — 접속 IP (AUTH-08) ────────────────────────────────────

    @Operation(
            summary = "접속 허용 IP 조회",
            description = "한 사용자의 허용 대역을 반환한다. 꺼진 행도 포함하며, 행이 하나도 없으면 그 계정에는 제한이 없다.")
    @PostMapping("/getIpList")
    public ApiResponse<PageResponse<UserIpRow>> getIpList(
            @RequestBody @Valid SearchRequest<UserIdParams> request) {
        return ApiResponse.success(queries.getIpList(request), TraceId.current());
    }

    /**
     * 허용 대역 저장 — <b>세션을 건드리지 않는다</b>.
     *
     * <p>{@code saveRole} 과 갈리는 자리다. 허용 IP 는 <b>인가가 아니라 인증의 검사</b>이며
     * (sys/user-role.md — 로그인 후처리 핸들러 체인) 세션에 캐시되는 유효 권한과 아무 관계가 없다 —
     * 다음 <b>로그인</b>에서 읽히지 다음 <b>요청</b>에서 읽히지 않는다.
     */
    @Operation(
            summary = "접속 허용 IP 저장",
            description = "추가·수정·삭제 행을 한 트랜잭션으로 반영한다. 형식이 IP 또는 CIDR 이어야 하며 전부 지우면 제한 없음이 된다.")
    @PostMapping("/saveIp")
    public ApiResponse<Void> saveIp(@RequestBody @Valid UserIpSaveRequest request) {
        detail.saveIps(request.userId(), request.rows());
        return ApiResponse.success(null, TraceId.current());
    }

    // ── 탭 4 — 활성 세션 (AUTH-10) ──────────────────────────────────

    @Operation(
            summary = "활성 세션 조회",
            description = "한 사용자의 살아 있는 세션을 최근 접근이 늦은 것부터 반환한다. 이 요청의 세션에는 표시가 붙는다.")
    @PostMapping("/getSessionList")
    public ApiResponse<PageResponse<UserSessionRow>> getSessionList(
            @RequestBody @Valid SearchRequest<UserIdParams> request, HttpSession session) {

        return ApiResponse.success(
                PageResponse.all(sessions.list(request.params().userId(), session.getId())),
                TraceId.current());
    }

    /**
     * 강제 로그아웃 — <b>이 화면의 유일한 {@code EXECUTE}</b>(sys/menu.md 의 {@code X}).
     *
     * <p><b>자기 계정은 막는다</b>(screen/user/requirements.md). 그 자리에서 화면 밖으로 밀려나기 때문이며,
     * 되돌릴 사람이 그 사람 자신이다 — 화면도 버튼을 비활성으로 두고 사유를 붙이지만,
     * 요청 본문은 조작할 수 있으므로 서버가 다시 본다(sys/menu.md 원칙 P1).
     *
     * <p><b>끊어도 {@code SYS_USER} 는 바뀌지 않는다</b> — 다시 로그인할 수 있다. 막으려면
     * {@code USE_YN='N'} 이고 그것은 <b>다른 축</b>이다(sys/user-role.md).
     */
    @Operation(
            summary = "세션 강제 종료",
            description = "고른 세션을 스토어에서 지운다. 자기 계정의 세션은 거부하며 이미 끊긴 세션은 건너뛴다. 계정 자체는 바뀌지 않는다.")
    @PostMapping("/killSession")
    public ApiResponse<Integer> killSession(
            @RequestBody @Valid UserSessionKillRequest request, Principal principal) {

        if (request.userId().equals(userId(principal))) {
            throw new BusinessException(
                    UserSessionErrorCode.SELF, "자기 세션은 끊을 수 없다 — " + request.userId());
        }
        return ApiResponse.success(
                sessions.kill(request.userId(), request.targets()), TraceId.current());
    }

    // ── 탭 5 — 유효 권한 (screen/user/requirements.md) ────────────────────────────────

    /**
     * <i>"이 사용자가 왜 이 메뉴를 못 보나"</i> — sys/menu.md 의 미결을 닫는 경로.
     *
     * <p><b>읽기만 한다.</b> 관리자 세션을 바꾸지 않으며 어떤 캐시도 건드리지 않는다 —
     * backend/security.md 가 AUTHZ-09(권한 시뮬레이션)를 되살릴 때의 조건으로 건 것이고, <b>미리보기가
     * 권한 상승 경로가 되면 안 된다</b>.
     */
    @Operation(
            summary = "유효 권한 조회",
            description = "역할과 개인 예외를 출처별로 편 목록을 반환한다. 메뉴 게이트와 지금 실제로 효력이 있는지가 행마다 실리며, 전체 메뉴 모드에서는 부여가 없는 메뉴도 나온다.")
    @PostMapping("/getEffectiveAuthList")
    public ApiResponse<PageResponse<EffectiveAuthRow>> getEffectiveAuthList(
            @RequestBody @Valid SearchRequest<EffectiveAuthParams> request) {
        return ApiResponse.success(
                queries.getEffectiveAuthList(request, locale.current()), TraceId.current());
    }

    private static String userId(Principal principal) {
        if (principal == null) {
            throw new BusinessException(CommonErrorCode.UNAUTHENTICATED);
        }
        return principal.getName();
    }
}
