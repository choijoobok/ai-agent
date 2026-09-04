package com.aiagent.api.role;

import com.aiagent.api.authz.AuthzInvalidator;
import com.aiagent.api.role.request.RoleSaveRequest;
import com.aiagent.api.trace.TraceId;
import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.core.response.ApiResponse;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.authz.role.RoleQueryService;
import com.aiagent.domain.authz.role.RoleService;
import com.aiagent.domain.authz.role.RoleRow;
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
 * {@code ROLE_MGMT} — screen/menu/requirements.md. <b>경로가 둘뿐이다.</b>
 *
 * <p>마스터의 조회와 저장 하나씩이고, <b>하단 pane 의 조회는 여기 없다</b> — 그것은
 * {@code roleAuth/getAffectedUsers} 이며 {@code ROLE_AUTH_MGMT} 와 <b>같은 경로</b>다
 * (screen/menu/requirements.md). screen/menu/requirements.md 가 하단을 <i>"§2.5 와 같은 그리드"</i> 로 정했으므로 경로도 같아야 하고,
 * {@code role/getUserList} 를 따로 두면 <b>같은 질문에 답이 둘</b>이 된다.
 *
 * <p>그 결과가 시드에 그대로 나타난다 — {@code SYS_MENU_API} 에 <b>{@code ROLE_MGMT} 행이
 * 하나 더</b> 붙는다(sys/menu.md — 매핑은 다대다다). 프론트의
 * {@code features/role/api/endpoints.ts} 가 그 경로를 함께 선언하는 것이 그 시드의 입력이다
 * (backend/api.md).
 *
 * <p><b>{@code EXPORT} 에는 경로가 없다.</b> sys/menu.md 의 액션 열이 {@code R S} 이며 엑셀
 * 다운로드 버튼(②)이 이 화면에 아예 없다 — screen/user/requirements.md 의 <i>"액션 미정의"</i> 가 <b>화면 단위로
 * 나타난 모습</b>이고, {@code ROLE_AUTH_MGMT} 에 이어 두 번째다.
 *
 * <p>액션은 <b>경로 접두가 정한다</b>(backend/api.md) — {@code get*} 는 {@code READ},
 * {@code save*} 는 {@code SAVE}. 선언에 또 적지 않는다.
 */
@RestController
@RequestMapping("/api/service/role")
public class RoleController {

    private final RoleQueryService queries;
    private final RoleService admin;
    private final AuthzInvalidator invalidator;

    public RoleController(
            RoleQueryService queries,
            RoleService admin,
            AuthzInvalidator invalidator) {
        this.queries = queries;
        this.admin = admin;
        this.invalidator = invalidator;
    }

    @Operation(
            summary = "역할 목록 조회",
            description = "역할을 페이지 단위로 반환한다. 보유 인원·유효 인원·권한 건수가 함께 실리며 삭제 게이트가 그것을 읽는다.")
    @PostMapping("/getList")
    public ApiResponse<PageResponse<RoleRow>> getList(
            @RequestBody @Valid SearchRequest<Void> request) {
        return ApiResponse.success(queries.getList(request), TraceId.current());
    }

    /**
     * 저장 — <b>세션 무효화가 뒤따른다</b>(backend/security.md).
     *
     * <p>{@code USE_YN} 을 뒤집으면 보유자 전원의 유효 권한이 바뀐다. 도메인이 <b>누가
     * 바뀌었는지</b> 를 돌려주고 여기서 그 사람들의 세션에 재계산 표시를 세운다 — 세션은
     * 도메인이 아는 것이 아니다(backend/packages.md).
     *
     * <p><b>순서가 규약이다.</b> 저장이 커밋된 <i>뒤에</i> 표시를 세운다. 먼저 세우면 롤백된
     * 변경에 대해 전원이 재계산하고, 그 계산은 <b>옛 값을 다시 읽어</b> 아무 일도 하지 않은
     * 것과 같아진다 — 무해하지만 <b>이유 없는 부하</b>이며 원인을 추적할 단서가 없다.
     */
    @Operation(
            summary = "역할 저장",
            description = "추가·수정·삭제 행을 한 트랜잭션으로 반영하고, 사용 여부가 바뀐 역할의 보유자 세션에 권한 재계산을 예약한다.")
    @PostMapping("/save")
    public ApiResponse<Void> save(
            @RequestBody @Valid RoleSaveRequest request,
            Principal principal,
            HttpSession session) {

        Set<String> affected = admin.save(request.rows());
        invalidator.markDirty(affected, session, userId(principal));
        return ApiResponse.success(null, TraceId.current());
    }

    private static String userId(Principal principal) {
        if (principal == null) {
            throw new BusinessException(CommonErrorCode.UNAUTHENTICATED);
        }
        return principal.getName();
    }
}
