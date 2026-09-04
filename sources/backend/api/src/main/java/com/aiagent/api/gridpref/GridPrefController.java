package com.aiagent.api.gridpref;

import com.aiagent.api.gridpref.request.GridPrefResetRequest;
import com.aiagent.api.gridpref.request.GridPrefSaveRequest;
import com.aiagent.api.trace.TraceId;
import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.core.response.ApiResponse;
import com.aiagent.domain.gridpref.GridPref;
import com.aiagent.domain.gridpref.service.GridPrefService;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 그리드 개인화 — UX-06 · UX-13 · grid-standard.md §5.
 *
 * <p><b>{@code common} 계층이다</b>(security-design.md §4). {@code MENU_CD} 를 받지만 <b>그 메뉴의 권한을
 * 묻지 않는다</b> — 다루는 것은 <i>"나는 이 그리드를 이렇게 본다"</i> 라는 <b>사람의
 * 속성</b>이며 그 화면의 데이터가 아니다({@code SYS_USER_SEARCH_COND} 와 같은 판단이다).
 * {@code service} 로 두면 메뉴마다 액션을 하나씩 더 만들어야 하고 그 액션은 업무 권한과
 * 무관하다.
 *
 * <p><b>설정 창에는 저장 버튼이 있다</b>(grid-standard.md §5) — 설정 모달(main-shell.md §9.2)과 다르다. 컬럼을
 * 껐다 켜보며 맞추므로 <b>확정 시점이 필요하고</b>, 저장처가 DB 라 토글마다 부르면 요청이
 * 폭증한다.
 */
@RestController
public class GridPrefController {

    private final GridPrefService preferences;

    public GridPrefController(GridPrefService preferences) {
        this.preferences = preferences;
    }

    /**
     * 지금 화면의 시그니처로 묻는다 — 다르면 <b>없다</b>고 답한다(UX-13).
     *
     * <p>어긋난 행은 그 자리에서 지운다. 살려 두면 다음 저장 때까지 맞지 않는 설정이 DB 에
     * 남고 <b>다른 기기에서 다시 읽힌다</b>.
     */
    @GetMapping("/api/common/gridPref/getOne")
    public ApiResponse<GridPref> getOne(
            @RequestParam String menuCd,
            @RequestParam String gridId,
            @RequestParam String signature,
            Principal principal) {
        return ApiResponse.success(
                preferences.find(userId(principal), menuCd, gridId, signature), TraceId.current());
    }

    @PostMapping("/api/common/gridPref/save")
    public ApiResponse<Void> save(
            @Valid @RequestBody GridPrefSaveRequest request, Principal principal) {
        preferences.save(
                userId(principal),
                request.menuCd(),
                request.gridId(),
                request.prefJson(),
                request.signature());
        return ApiResponse.success(null, TraceId.current());
    }

    /** 초기화 — 화면은 선언의 기본값으로 돌아간다. 기본값을 저장하지 않는다. */
    @PostMapping("/api/common/gridPref/delete")
    public ApiResponse<Void> reset(
            @Valid @RequestBody GridPrefResetRequest request, Principal principal) {
        preferences.reset(userId(principal), request.menuCd(), request.gridId());
        return ApiResponse.success(null, TraceId.current());
    }

    private static String userId(Principal principal) {
        if (principal == null) {
            throw new BusinessException(CommonErrorCode.UNAUTHENTICATED);
        }
        return principal.getName();
    }
}
