package com.aiagent.api.message.request;

import com.aiagent.domain.message.admin.MessageSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * 일괄 저장의 봉투 — frontend/grid.md · screen/admin/system/code/requirements.md.
 *
 * <p><b>{@code rows} 한 키뿐이다.</b> 행 상태가 페이로드 안에 있으므로 등록/수정/삭제로
 * 나누지 않으며, 그래서 액션도 {@code SAVE} 하나다(backend/security.md).
 *
 * <p><b>비어 있으면 400 이다.</b> 저장할 것이 없는데 저장을 부르는 것은 화면의 버그이고,
 * 조용히 성공으로 돌려주면 <b>캐시 버전만 올라가</b> 전 사용자의 번들이 무효가 된다.
 */
public record MessageSaveRequest(@NotEmpty @Valid List<MessageSaveRow> rows) {}
