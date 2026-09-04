package com.aiagent.domain.authz.role;

import com.aiagent.core.grid.RowState;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 마스터 저장의 한 행 — screen/menu/requirements.md · frontend/grid.md.
 *
 * <p><b>파생 셋이 없다</b>(보유 인원 · 유효 인원 · 권한 건수). 서버가 세는 값이라 받을 경로를
 * 두면 <b>화면이 게이트의 근거를 스스로 정하는</b> 셈이 된다 — 읽기 전용은 화면에서만 읽기
 * 전용이고 요청 본문은 조작할 수 있다(원칙 P1). {@code CodeGroupSaveRow} 가 {@code SYS_YN} 을
 * 뺀 것과 <b>같은 장치</b>다.
 *
 * <p>{@code roleId} 는 신규 행에서만 뜻이 있고 수정·삭제에서는 <b>대상을 가리키는 값</b>이다 —
 * PK 라 고칠 수 없다(sys/user-role.md). 고치려면 지우고 다시 만드는데, <b>쓰인 역할은 지울 수 없으므로</b>
 * (screen/menu/requirements.md) 실질적으로 한 번 정하면 끝이다.
 */
public record RoleSaveRow(
        @NotNull RowState rowState,
        @NotBlank @Size(max = 30) String roleId,
        @Size(max = 100) String roleNm,
        @Size(max = 500) String roleDesc,
        Boolean useYn) {

    /**
     * <b>{@code null} 이면 켜진 것으로 본다.</b> screen/menu/requirements.md 의 {@code defaults} 가
     * {@code useYn: 'Y'} 하나뿐이라 화면은 언제나 값을 싣지만, 화면 밖 경로에서 빠뜨린 것을
     * <i>끈 것</i> 으로 읽으면 <b>만들자마자 아무에게도 안 듣는 역할</b>이 생긴다.
     */
    public boolean useYnOrTrue() {
        return !Boolean.FALSE.equals(useYn);
    }
}
