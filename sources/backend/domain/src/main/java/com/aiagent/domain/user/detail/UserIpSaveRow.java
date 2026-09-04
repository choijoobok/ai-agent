package com.aiagent.domain.user.detail;

import com.aiagent.core.grid.RowState;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * 접속 IP 저장의 한 행 — 61 §3.8 탭 3.
 *
 * <p><b>{@code D} 가 있는 유일한 탭</b>이다. 61 §3.8 의 표가 <i>추가 · 삭제</i> 로 적었고,
 * 그것이 맞다 — 여기서 지우는 것은 <b>부여의 기록</b>이 아니라 <i>사무실이 어디인가</i> 라는
 * <b>지금의 사실</b>이다. 이사한 사무실의 대역을 남겨 둘 이유가 없고, 잠시 막는 것은
 * {@code USE_YN} 이 맡는다.
 *
 * <p>{@code U} 로 바꿀 수 있는 것은 <b>{@code useYn} 과 기간</b>이다 — {@code ipCidr} 은
 * PK 이며 다른 대역은 다른 사실이다(41 §7). 기간이 <b>같은 사실의 수정</b>인 것은 파견이
 * 연장되면 대역은 그대로이고 끝나는 날만 바뀌기 때문이다.
 */
public record UserIpSaveRow(
        @NotNull RowState rowState,
        @NotBlank @Size(max = 45) String ipCidr,
        Boolean useYn,
        /** <b>양끝 포함</b>이며 {@code null} 이 제한 없음이다(40 §4.3). */
        LocalDate validFromDt,
        LocalDate validToDt) {

    /** 화면이 비워 보내도 켜진 것으로 읽는다 — 끄려고 <b>추가</b>하는 일은 없다. */
    public boolean useYnOrTrue() {
        return useYn == null || useYn;
    }
}
