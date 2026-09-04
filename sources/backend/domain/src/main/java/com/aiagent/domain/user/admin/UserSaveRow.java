package com.aiagent.domain.user.admin;

import com.aiagent.core.grid.RowState;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * 마스터 저장의 한 행 — screen/user/requirements.md · frontend/grid.md.
 *
 * <p><b>여기 없는 것이 screen/user/requirements.md 의 집행 지점이다.</b> 계정을 못 쓰게 하는 넷 중 <b>관리자가
 * 거는 둘</b>({@code USE_YN} · 사용 기간)만 담는다 — {@code LOCK_YN} · {@code DORMANT_YN} ·
 * {@code LOGIN_FAIL_CNT} 는 <b>시스템이 거는 것</b>이라 전용 API 가 자기 컬럼만 쓴다.
 *
 * <p>읽기 전용은 <b>화면에서만</b> 읽기 전용이고 요청 본문은 조작할 수 있다(sys/menu.md 원칙 P1).
 * 받을 경로를 두지 않는 것이 <i>"서로 덮지 않는다"</i>(sys/user-role.md 규칙 3)를 지키는 장치이며,
 * {@code RoleSaveRow} 가 파생 셋을 뺀 것과 <b>같은 모양</b>이다.
 *
 * <p><b>비밀번호도 없다.</b> 신규 행은 저장 시 <b>임시 비밀번호로 발급</b>되며
 * {@code PWD_INIT_YN='Y'} 로 들어간다(screen/user/requirements.md) — 편집 가능한 자리를 두면 <b>관리자가 아는
 * 비밀번호</b>가 생긴다(backend/security.md).
 *
 * <p>{@code userId} 는 신규 행에서만 뜻이 있고 수정에서는 <b>대상을 가리키는 값</b>이다 —
 * 자연키라 등록 후 고칠 수 없다(sys/user-role.md).
 */
public record UserSaveRow(
        @NotNull RowState rowState,
        @NotBlank @Size(max = 30) String userId,
        @Size(max = 100) String userNm,
        @Size(max = 255) String email,
        Boolean useYn,
        LocalDate validFromDt,
        LocalDate validToDt,
        @Size(max = 10) String localeCd) {

    /**
     * <b>{@code null} 이면 켜진 것으로 본다.</b> 화면의 {@code defaults} 가 언제나 값을 싣지만,
     * 화면 밖 경로에서 빠뜨린 것을 <i>끈 것</i> 으로 읽으면 <b>만들자마자 못 들어오는 계정</b>이
     * 생기고 그 계정은 로그인 이력에 {@code FAIL_DISABLED} 만 남긴다.
     */
    public boolean useYnOrTrue() {
        return !Boolean.FALSE.equals(useYn);
    }
}
