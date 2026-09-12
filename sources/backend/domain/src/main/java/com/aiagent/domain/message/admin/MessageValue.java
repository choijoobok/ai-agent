package com.aiagent.domain.message.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 하단 그리드의 한 행이자 마스터 행의 {@code list} 항목 하나 — screen/admin/system/code/requirements.md · frontend/grid.md.
 *
 * <p><b>{@code msgVal} 이 {@code null} 이면 그 언어의 행을 지운다.</b> 빈 문자열이 아니다 —
 * 빈 문자열을 저장하면 sys/code.md 의 폴백이 죽고 <i>"이름이 없는 코드"</i> 가 조용히 생긴다.
 * 화면이 빈 칸을 {@code null} 로 보내는 것이 규약이며, 서버도 공백만 남은 값을 {@code null}
 * 로 접는다 — <b>Oracle 은 {@code ''} 가 곧 {@code NULL}</b> 이라(backend/persistence.md) 그러지 않으면 같은
 * 데이터가 벤더마다 다르게 걸린다.
 */
public record MessageValue(@NotBlank @Size(max = 10) String langCd, @Size(max = 2000) String msgVal) {

    public MessageValue {
        if (msgVal != null && msgVal.isBlank()) {
            msgVal = null;
        }
    }

    /**
     * <b>{@code isEmpty} 라고 부르지 않는다.</b> Jackson 이 {@code is} 접두를 프로퍼티로 읽어
     * 응답에 {@code "empty": false} 가 실린다 — 화면이 쓰지 않는 칸이 와이어에 남는다.
     */
    public boolean blank() {
        return msgVal == null;
    }
}
