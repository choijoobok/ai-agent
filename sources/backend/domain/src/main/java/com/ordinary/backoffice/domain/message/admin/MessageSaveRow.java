package com.ordinary.backoffice.domain.message.admin;

import com.ordinary.backoffice.core.grid.RowState;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 저장 페이로드의 한 행 — 63 §3.2. <b>저장 단위는 마스터 하나다.</b>
 *
 * <p><b>{@code values} 는 그 키의 전량이다 — 델타가 아니다.</b> 화면이 지원 언어 전부를
 * 들고 있으므로 부분만 보낼 이유가 없고, <b>전량이면 서버가 상태를 추론하지 않는다</b>.
 *
 * <p><b>{@code USE_SCOPE} 필드가 없다.</b> 시드가 소유하므로(ADR-0023) 받을 경로 자체를 두지
 * 않는다 — 있으면 화면이 자기를 {@code BOTH} 라고 말할 수 있다.
 */
public record MessageSaveRow(
        @NotNull RowState rowState,
        @NotBlank @Size(max = 200) String msgKey,
        @Valid List<MessageValue> values) {

    public List<MessageValue> valuesOrEmpty() {
        return values == null ? List.of() : values;
    }
}
