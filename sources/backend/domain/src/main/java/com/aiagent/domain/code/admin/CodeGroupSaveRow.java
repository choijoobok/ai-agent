package com.aiagent.domain.code.admin;

import com.aiagent.core.grid.RowState;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 마스터 저장의 한 행 — screen/admin/system/code/requirements.md.
 *
 * <p><b>{@code sysYn} 필드가 없다.</b> <i>"소스가 이 그룹을 참조하는가"</i> 는 코드가 아는
 * 사실이라(sys/code.md) 받을 경로 자체를 두지 않는다 — 화면에서 입력 수단을 없애는 것만으로는
 * 부족하다: 읽기 전용은 화면에서만 읽기 전용이고 요청 본문은 조작할 수 있다(원칙 P1).
 * {@code DTL_NM} 을 저장 DTO 에서 뺀 것과 <b>같은 장치</b>다(sys/code.md).
 *
 * <p><b>{@code useYn} 도 없다</b>(2026-08-30 — sys/code.md). 여기는 <i>받을 경로를 막는</i> 것이
 * 아니라 <b>컬럼 자체가 없어진</b> 것이다 — 그룹은 콤보의 후보가 아니라 소스가 이름으로
 * 지목하는 것이라 끄는 것의 뜻이 정의되지 않는다. 코드 쪽({@link CodeSaveRow})에는 그대로다.
 *
 * <p>{@code grpCd} 는 신규 행에서만 뜻이 있고 수정·삭제에서는 <b>대상을 가리키는 값</b>이다 —
 * PK 라 고칠 수 없고, 고치려면 지우고 다시 만든다(screen/admin/system/code/requirements.md).
 */
public record CodeGroupSaveRow(
        @NotNull RowState rowState,
        @NotBlank @Size(max = 30) String grpCd,
        @Size(max = 100) String grpNm,
        @Size(max = 500) String grpDesc,
        Integer sortNo) {

    public int sortNoOrZero() {
        return sortNo == null ? 0 : sortNo;
    }
}
