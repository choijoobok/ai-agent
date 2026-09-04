package com.aiagent.api.favorite;

import com.aiagent.api.favorite.request.FavoriteMenuRequest;
import com.aiagent.api.trace.TraceId;
import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.core.response.ApiResponse;
import com.aiagent.domain.favorite.FavoriteMenu;
import com.aiagent.domain.favorite.service.FavoriteService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 즐겨찾기 메뉴 — UX-03 · 42 §7. 사이더 트리와 탭의 우클릭 메뉴가 부른다(main-shell.md §4.7).
 *
 * <p><b>{@code common} 계층이다</b>(security-design.md §4). {@code MENU_CD} 를 받지만 <b>그 메뉴의 권한을
 * 묻지 않는다</b> — 담는 것은 <i>"나는 이 메뉴를 자주 쓴다"</i> 라는 <b>사람의 속성</b>이지
 * 그 메뉴의 데이터가 아니다. 저장된 조회조건({@code SearchCondController})과 같은 자리다.
 *
 * <p><b>즐겨찾기가 권한을 주지 않는다</b>(42 §7). 목록에 남아 있어도 그 메뉴의 API 는
 * 여전히 403 이며, 권한을 잃으면 <b>표시만 멈춘다</b> — 거르는 것은 화면이 가진 메뉴
 * 트리다(main-shell.md §4.4).
 *
 * <p><b>셋 다 목록을 돌려준다.</b> 화면이 다시 조회하지 않아도 되고, <i>요청에 없던
 * 변화</i>(다른 탭에서 넣은 것)가 그 자리에서 보인다.
 *
 * <p><b>순서 재배치는 아직 없다.</b> 42 §7 이 형태를 정해 두었지만 순서를 바꾸는 화면이
 * 없다 — 부르는 곳 없는 엔드포인트를 먼저 열면 <b>없는 기능이 API 로 먼저 생긴다.</b>
 * 지금 {@code SORT_NO} 는 넣은 순서이며, 끌어 옮기는 화면이 오는 날 함께 만든다.
 */
@RestController
public class FavoriteController {

    private final FavoriteService favorites;

    public FavoriteController(FavoriteService favorites) {
        this.favorites = favorites;
    }

    /**
     * 내 즐겨찾기.
     *
     * <p><b>{@code GET} 에 파라미터가 없다.</b> 대상은 언제나 세션의 주인이며, 조회조건
     * 봉투(api-conventions.md §3.1)를 쓰지 않는 것은 이것이 동적 조회가 아니기 때문이다(api-conventions.md §3.0).
     */
    @GetMapping("/api/common/favorite/getList")
    public ApiResponse<List<FavoriteMenu>> getList(Principal principal) {
        return ApiResponse.success(favorites.findMine(userId(principal)), TraceId.current());
    }

    /** 등록 — 이미 있으면 아무 일도 하지 않는다(결과가 같다). */
    @PostMapping("/api/common/favorite/save")
    public ApiResponse<List<FavoriteMenu>> add(
            @Valid @RequestBody FavoriteMenuRequest request, Principal principal) {

        String userId = userId(principal);
        favorites.add(userId, request.menuCd());
        return ApiResponse.success(favorites.findMine(userId), TraceId.current());
    }

    /** 제거 — 없는 것을 지워도 성공이다. */
    @PostMapping("/api/common/favorite/delete")
    public ApiResponse<List<FavoriteMenu>> remove(
            @Valid @RequestBody FavoriteMenuRequest request, Principal principal) {

        String userId = userId(principal);
        favorites.remove(userId, request.menuCd());
        return ApiResponse.success(favorites.findMine(userId), TraceId.current());
    }

    private static String userId(Principal principal) {
        if (principal == null) {
            throw new BusinessException(CommonErrorCode.UNAUTHENTICATED);
        }
        return principal.getName();
    }
}
