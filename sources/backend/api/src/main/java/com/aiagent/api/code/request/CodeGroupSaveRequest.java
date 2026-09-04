package com.aiagent.api.code.request;

import com.aiagent.domain.code.admin.CodeGroupSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * 마스터 일괄 저장의 봉투 — frontend/grid.md · screen/code/requirements.md.
 *
 * <p><b>비어 있으면 400 이다.</b> 저장할 것이 없는데 저장을 부르는 것은 화면의 버그이고,
 * 조용히 성공으로 돌려주면 <b>캐시 버전만 올라가</b> 전 사용자의 코드 캐시가 무효가 된다.
 */
public record CodeGroupSaveRequest(@NotEmpty @Valid List<CodeGroupSaveRow> rows) {}
