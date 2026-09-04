package com.aiagent.domain.code.admin;

import com.aiagent.core.grid.RowState;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 정의 모달 저장의 한 행 — screen/code/requirements.md.
 *
 * <p><b>모달 안에서 닫힌다.</b> 바깥 그리드의 미저장 편집과 섞이지 않으며, 닫으면 하단을
 * 재조회한다 — 컬럼 집합이 바뀌었을 수 있다.
 *
 * <p>{@code grpCd} 는 봉투가 갖는다 — {@link CodeSaveRow} 와 같은 이유다.
 */
public record CodeRefDefSaveRow(
        @NotNull RowState rowState,
        @NotBlank @Size(max = 30) String refCd,
        @Size(max = 100) String refNm,
        @Size(max = 500) String refDesc) {}
