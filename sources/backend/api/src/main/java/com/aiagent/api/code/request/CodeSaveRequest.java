package com.aiagent.api.code.request;

import com.aiagent.domain.code.admin.CodeSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 하단 일괄 저장의 봉투 — screen/code/requirements.md.
 *
 * <p><b>{@code grpCd} 가 봉투에 있다.</b> 이 그리드는 통째로 한 그룹의 것이므로 행마다 두면
 * <i>한 요청에 여러 그룹</i> 이 표현 가능해지고, 그러면 서버가 <b>화면에 없는 조합</b>을
 * 받는다 — 조회의 {@code params} 가 부모 키를 갖는 것과 같은 자리다(backend/api.md).
 */
public record CodeSaveRequest(
        @NotBlank @Size(max = 30) String grpCd, @NotEmpty @Valid List<CodeSaveRow> rows) {}
