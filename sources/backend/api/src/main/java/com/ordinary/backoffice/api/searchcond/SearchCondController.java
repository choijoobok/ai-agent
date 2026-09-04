package com.ordinary.backoffice.api.searchcond;

import com.ordinary.backoffice.api.searchcond.request.SearchCondDeleteRequest;
import com.ordinary.backoffice.api.searchcond.request.SearchCondSaveRequest;
import com.ordinary.backoffice.api.trace.TraceId;
import com.ordinary.backoffice.core.error.BusinessException;
import com.ordinary.backoffice.core.error.CommonErrorCode;
import com.ordinary.backoffice.core.response.ApiResponse;
import com.ordinary.backoffice.domain.searchcond.SavedSearchCond;
import com.ordinary.backoffice.domain.searchcond.service.SearchCondService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 저장된 조회조건 — UX-07 · search-form-contract.md §5. 조회조건 영역 오른쪽 위의 설정 버튼이 부른다.
 *
 * <p><b>{@code common} 계층이다</b>(security-design.md §4). {@code MENU_CD} 를 받지만 <b>그 메뉴의 권한을
 * 묻지 않는다</b> — 여기서 다루는 것은 <i>"나는 이 화면을 이렇게 조회한다"</i> 라는
 * <b>사람의 속성</b>이며(main-shell.md §5.1) 그 화면의 데이터가 아니다. 메뉴 권한을 잃은 사용자의
 * 저장된 조건이 남아 있는 것은 <b>정상</b>이다: 권한이 돌아오면 그대로 쓰인다.
 *
 * <p>그래서 {@code service} 로 두지 않았다. 두면 <b>메뉴마다 액션을 하나씩 더</b> 만들어야
 * 하고(메뉴 서른이면 서른), 그 액션은 <i>업무 권한</i> 과 아무 관계가 없다.
 *
 * <p><b>목록이 내용까지 함께 낸다.</b> 항목 하나를 고를 때 다시 부르지 않게 하려는 것이고,
 * 그래도 되는 이유는 조건 하나가 기본값을 뺀 칸만 담아 작기 때문이다(search-form-contract.md §5.2).
 */
@RestController
public class SearchCondController {

    private final SearchCondService conditions;

    public SearchCondController(SearchCondService conditions) {
        this.conditions = conditions;
    }

    /**
     * 화면 하나의 저장 목록.
     *
     * <p><b>{@code GET} 에 쿼리 파라미터다.</b> 조회조건 봉투(api-conventions.md §3.1)를 쓰지 않는 이유는
     * 이것이 <b>동적 조회가 아니기</b> 때문이다 — 묻는 것이 메뉴 코드 하나로 고정이며,
     * 봉투를 씌우면 화이트리스트도 정렬도 페이징도 없는 빈 껍데기가 된다(api-conventions.md §3.0).
     */
    @GetMapping("/api/common/searchCond/getList")
    public ApiResponse<List<SavedSearchCond>> getList(
            @RequestParam String menuCd, Principal principal) {
        return ApiResponse.success(
                conditions.findMine(userId(principal), menuCd), TraceId.current());
    }

    /**
     * 저장 — 같은 이름이면 덮어쓴다.
     *
     * <p>저장 뒤 목록을 그대로 돌려준다. 화면이 다시 조회하지 않아도 되고, <b>기본 조건이
     * 옮겨간 결과</b>(이전 것이 내려온 것)가 그 자리에서 보인다 — 그것은 요청에 없던 변화라
     * 화면이 스스로 계산하면 서버와 어긋날 수 있다.
     */
    @PostMapping("/api/common/searchCond/save")
    public ApiResponse<List<SavedSearchCond>> save(
            @Valid @RequestBody SearchCondSaveRequest request, Principal principal) {

        String userId = userId(principal);
        conditions.save(
                userId, request.menuCd(), request.condNm(), request.condJson(), request.dflt());

        return ApiResponse.success(conditions.findMine(userId, request.menuCd()), TraceId.current());
    }

    /** 삭제 — 남은 목록을 돌려준다. 없는 이름을 지워도 성공이다(결과가 같다). */
    @PostMapping("/api/common/searchCond/delete")
    public ApiResponse<List<SavedSearchCond>> delete(
            @Valid @RequestBody SearchCondDeleteRequest request, Principal principal) {

        String userId = userId(principal);
        conditions.delete(userId, request.menuCd(), request.condNm());

        return ApiResponse.success(conditions.findMine(userId, request.menuCd()), TraceId.current());
    }

    private static String userId(Principal principal) {
        if (principal == null) {
            throw new BusinessException(CommonErrorCode.UNAUTHENTICATED);
        }
        return principal.getName();
    }
}
