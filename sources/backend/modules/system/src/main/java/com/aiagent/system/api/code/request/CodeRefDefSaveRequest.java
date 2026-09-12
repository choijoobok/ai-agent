// @feat FEAT-504
package com.aiagent.system.api.code.request;

import com.aiagent.domain.code.admin.CodeRefDefSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/** 정의 모달 일괄 저장의 봉투 — screen/admin/system/code/requirements.md. 부모 키는 {@link CodeSaveRequest} 와 같은 자리다. */
public record CodeRefDefSaveRequest(
        @NotBlank @Size(max = 30) String grpCd, @NotEmpty @Valid List<CodeRefDefSaveRow> rows) {}
