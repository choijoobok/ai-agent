package com.aiagent.api.role;

import com.aiagent.api.authz.AuthzInvalidator;
import com.aiagent.api.message.RequestLocale;
import com.aiagent.api.role.request.RoleAuthSaveRequest;
import com.aiagent.api.role.request.RoleMenuTreeRequest;
import com.aiagent.api.trace.TraceId;
import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.core.response.ApiResponse;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.authz.role.RoleQueryService;
import com.aiagent.domain.authz.role.RoleAuthService;
import com.aiagent.domain.authz.role.RoleAuthTreeRow;
import com.aiagent.domain.authz.role.RoleHolderRow;
import com.aiagent.domain.authz.role.RoleIdParams;
import com.aiagent.domain.authz.role.RolePickRow;
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
 * {@code ROLE_AUTH_MGMT} — 62 §2. <b>경로가 넷이다.</b>
 *
 * <table>
 *   <tr><td>{@code getList}</td><td>왼쪽 역할 목록 — <b>읽기 전용</b>(생성은 {@code ROLE_MGMT})</td></tr>
 *   <tr><td>{@code getMenuTree}</td><td>메뉴 계층 + 이 역할의 체크 상태</td></tr>
 *   <tr><td>{@code save}</td><td><b>저장 대상은 트리뿐</b>이다 — 61 §4 와 갈리는 자리(§2.2)</td></tr>
 *   <tr><td>{@code getAffectedUsers}</td><td>영향 인원 — <b>{@code ROLE_MGMT} 도 이것을 부른다</b></td></tr>
 * </table>
 *
 * <p><b>넷째가 두 화면의 것이다.</b> 62 §3.4 가 {@code ROLE_MGMT} 의 하단을 <i>"§2.5 와 같은
 * 그리드"</i> 로 정했고 §3.7 이 <i>"경로도 같아야 한다"</i> 고 못박았다 — 제목만 다르고
 * (<i>보유 사용자</i> · <i>영향 인원</i>) 묻는 것은 하나다: <i>"이 역할을 가진 사람이
 * 누구인가"</i>.
 *
 * <p><b>{@code EXPORT} 가 없는 첫 화면이다</b>(52 §4.2 의 액션 열이 {@code R S}). 61 §4.4 는
 * <i>"액션 미정의"</i> 를 <b>셀 단위</b>로 말했는데 여기서는 <b>화면 단위</b>로 나타난다 —
 * ②의 자리가 통째로 빈다(grid-standard.md §2.1).
 *
 * <p><b>{@code getSaveImpact} 같은 경로가 없다.</b> 62 §2.5 의 저장 확인은 세 줄이고 그 셋째가
 * <i>공집합이 되어 차단될 사람</i> 인데, 그 계산의 입력은 <b>하단 그리드가 이미 갖고 있다</b>
 * — {@code hasPersonalGrant} · {@code hasOtherRole} 두 열이 그것이며(목업 §4 주석 6) 화면이
 * 그 자리에서 센다. 새 경로를 내면 <b>같은 질문에 답이 둘</b>이 된다.
 */
@RestController
@RequestMapping("/api/service/roleAuth")
public class RoleAuthController {

    private final RoleQueryService queries;
    private final RoleAuthService admin;
    private final AuthzInvalidator invalidator;
    private final RequestLocale locale;

    public RoleAuthController(
            RoleQueryService queries,
            RoleAuthService admin,
            AuthzInvalidator invalidator,
            RequestLocale locale) {
        this.queries = queries;
        this.admin = admin;
        this.invalidator = invalidator;
        this.locale = locale;
    }

    /**
     * 왼쪽 목록 — <b>비활성 역할도 나온다</b>(62 §2.2).
     *
     * <p>권한 구성은 <b>켜기 전에</b> 해 두는 것이 정상이고, 꺼진 역할의 권한을 고치는 것은
     * 아무에게도 영향이 없어 <b>가장 안전한 편집</b>이다 — 그래서 조회조건에 사용 여부가 없다
     * (§2.3).
     */
    @Operation(
            summary = "역할 목록 조회",
            description = "권한을 부여할 역할을 고르는 목록이다. 비활성 역할도 함께 반환하며 보유 인원이 실린다.")
    @PostMapping("/getList")
    public ApiResponse<PageResponse<RolePickRow>> getList(
            @RequestBody @Valid SearchRequest<Void> request) {
        return ApiResponse.success(queries.getRoleList(request), TraceId.current());
    }

    /**
     * <b>페이징도 조건도 없다.</b>
     *
     * <p>계층이 잘리면 부모 없는 자식이 보이고(61 §4.4), 조건으로 거르면 <b>폴더의 파생
     * 3-state 가 보이는 자식만으로 요약해 거짓을 말한다</b> — 그 값은 저장 전 편집에 반응해야
     * 하므로 자손 전부가 클라이언트에 있어야 다시 계산된다({@code RoleQueryService}).
     *
     * <p>그래서 요청 본문이 {@code SearchRequest} 조차 아니다 — 받을 것이 없는 자리에 봉투를
     * 두면 <i>조건을 보내면 걸릴 것</i> 이라는 기대를 만든다(62 §4.12 와 같은 판단).
     */
    @Operation(
            summary = "역할 권한 트리 조회",
            description = "메뉴 계층 전건과 이 역할의 부여 상태를 반환한다. 메뉴마다 정의된 액션과 부여된 액션이 함께 실린다.")
    @PostMapping("/getMenuTree")
    public ApiResponse<PageResponse<RoleAuthTreeRow>> getMenuTree(
            @RequestBody @Valid RoleMenuTreeRequest request) {
        return ApiResponse.success(
                queries.getMenuTree(request.roleId(), locale.current()), TraceId.current());
    }

    /**
     * 저장 — <b>켜진 스위치 전부</b>를 받고 서버가 차이를 낸다({@code RoleAuthGrant}).
     *
     * <p>저장이 커밋된 뒤에 보유자 전원의 세션에 재계산 표시를 세운다(security-design.md §4). <b>역할 권한을
     * 고치는 것은 그 역할을 가진 모든 사용자의 유효 권한을 바꾸는 일</b>이며, 그것이 확인
     * 문구의 둘째·셋째 줄이 말하는 바다(62 §2.5).
     */
    @Operation(
            summary = "역할 권한 저장",
            description = "이 역할의 권한을 보낸 집합으로 맞추고, 보유자 세션에 권한 재계산을 예약한다.")
    @PostMapping("/save")
    public ApiResponse<Void> save(
            @RequestBody @Valid RoleAuthSaveRequest request,
            Principal principal,
            HttpSession session) {

        Set<String> affected = admin.save(request.roleId(), request.grants());
        invalidator.markDirty(affected, session, userId(principal));
        return ApiResponse.success(null, TraceId.current());
    }

    /**
     * 영향 인원 — <b>두 화면이 부른다</b>(62 §2.5 · §3.4 · §3.7).
     *
     * <p><b>만료된 부여도 낸다.</b> 지금은 영향이 없지만 <b>다시 유효해질 수 있으므로</b>
     * 감추면 <i>"영향 없다고 해서 지웠는데 다음 달에 문제가 생겼다"</i> 가 된다.
     *
     * <p><b>읽기 전용이며 저장 대상이 아니다</b> — 부여를 고치는 곳은 {@code USER_MGMT} 의
     * 보유 역할 탭이다(61 §3.8 탭 1). 그래서 짝이 되는 {@code save} 경로가 없다.
     */
    @Operation(
            summary = "역할 보유 사용자 조회",
            description = "이 역할을 가진 사용자를 페이지 단위로 반환한다. 부여 상태와 기간, 공집합 판정의 입력 둘이 함께 실린다.")
    @PostMapping("/getAffectedUsers")
    public ApiResponse<PageResponse<RoleHolderRow>> getAffectedUsers(
            @RequestBody @Valid SearchRequest<RoleIdParams> request) {
        return ApiResponse.success(queries.getAffectedUsers(request), TraceId.current());
    }

    private static String userId(Principal principal) {
        if (principal == null) {
            throw new BusinessException(CommonErrorCode.UNAUTHENTICATED);
        }
        return principal.getName();
    }
}
