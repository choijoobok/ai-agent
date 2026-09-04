package com.ordinary.backoffice.api.searchcond.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 조회조건 저장 — UX-07 · search-form-contract.md §5.
 *
 * <p><b>{@code userId} 가 없다.</b> 대상은 언제나 세션의 주인이며, 두는 순간 <i>"누구
 * 것을 저장하는가"</i> 가 클라이언트가 보낸 값이 된다.
 *
 * <p><b>{@code condJson} 에 길이 상한을 두지 않는다.</b> 컬럼이 {@code NCLOB} 이고
 * (search-form-contract.md §5.5) 담기는 것이 <b>기본값을 뺀 칸만</b>이라(§5.2) 자연히 작다 — 상한을 두면
 * 조회조건이 스무 칸인 업무 화면에서 <b>이유를 알 수 없는 거절</b>이 된다.
 */
public record SearchCondSaveRequest(
        @NotBlank @Size(max = 30) String menuCd,
        @NotBlank @Size(max = 100) String condNm,
        @NotBlank String condJson,
        boolean dflt) {}
