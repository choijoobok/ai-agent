package com.ordinary.backoffice.api.menustat;

import com.ordinary.backoffice.api.authz.AuthzSession;
import com.ordinary.backoffice.api.menustat.request.MenuSelectRequest;
import com.ordinary.backoffice.api.trace.TraceId;
import com.ordinary.backoffice.core.error.BusinessException;
import com.ordinary.backoffice.core.error.CommonErrorCode;
import com.ordinary.backoffice.core.response.ApiResponse;
import com.ordinary.backoffice.domain.authz.ActionType;
import com.ordinary.backoffice.domain.authz.EffectiveAuthority;
import com.ordinary.backoffice.domain.menustat.FrequentMenus;
import com.ordinary.backoffice.domain.menustat.service.MenuStatService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 자주 쓰는 메뉴 — UX-16 · 42 §8.
 *
 * <p><b>{@code common} 계층이다</b>(security-design.md §4). 모든 메뉴에 해당하므로 특정 메뉴에 소속시킬 수
 * 없다 — security-design.md §4 의 판별 신호(<i>"매핑하려니 메뉴를 전부 나열하게 되는 API"</i>)에 정확히
 * 걸린다.
 *
 * <p><b>진입 경로마다 API 를 두지 않는다</b>(42 §8). 트리·검색·즐겨찾기·최근이 같은 문을
 * 지난다 — 경로별로 나누면 같은 UPSERT 가 다섯 곳에 복제되고, 새 경로가 생길 때마다 API 와
 * {@code SYS_MENU_API} 매핑 행이 함께 는다.
 */
@RestController
public class MenuStatController {

    private final MenuStatService stats;

    public MenuStatController(MenuStatService stats) {
        this.stats = stats;
    }

    /**
     * 메뉴를 골랐다 — 카운트를 올린다.
     *
     * <p><b>유효 권한에 없는 메뉴는 세지 않는다</b>(42 §8). 정상 경로로는 생기지 않지만
     * (목록에 나오지 않는다) 딥링크와 조작된 요청이 있다. 판정은 <b>이미 세션에 있는</b>
     * 유효 권한으로 하므로 쿼리가 늘지 않는다(security-design.md §4).
     *
     * <p><b>거부하지 않고 그냥 세지 않는다.</b> 이것은 부수 효과라 실패를 알릴 곳이 없고,
     * 화면은 어차피 열리지 않는다 — 여기서 403 을 내면 <b>진짜 실패 하나가 로그에 두 번</b>
     * 남는다.
     */
    @PostMapping("/api/common/menu/saveSelect")
    public ApiResponse<Void> select(
            @Valid @RequestBody MenuSelectRequest request,
            HttpServletRequest http,
            Principal principal) {

        if (authority(http).allows(request.menuCd(), ActionType.READ)) {
            stats.record(userId(principal), request.menuCd());
        }
        return ApiResponse.success(null, TraceId.current());
    }

    /**
     * 자주 쓰는 메뉴 상위 N개 — <b>센 기간과 함께</b>.
     *
     * <p><b>권한으로 거르지 않는다.</b> 거르는 자리는 화면이며, 화면이 가진 메뉴 트리가
     * 이미 유효 권한을 통과한 것이다(main-shell.md §4.4) — 여기서 한 번 더 거르면 같은 규칙이 두 곳에
     * 놓이고, 그 둘이 어긋나는 날 어느 쪽이 옳은지 알 수 없다.
     */
    @GetMapping("/api/common/menu/getFrequent")
    public ApiResponse<FrequentMenus> frequent(Principal principal) {
        return ApiResponse.success(stats.findMine(userId(principal)), TraceId.current());
    }

    private static EffectiveAuthority authority(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        EffectiveAuthority authority = session == null ? null : AuthzSession.read(session);
        if (authority == null) {
            throw new BusinessException(CommonErrorCode.UNAUTHENTICATED);
        }
        return authority;
    }

    private static String userId(Principal principal) {
        if (principal == null) {
            throw new BusinessException(CommonErrorCode.UNAUTHENTICATED);
        }
        return principal.getName();
    }
}
