package com.aiagent.api.notice.request;

import com.aiagent.domain.notification.notice.NoticeSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * 공지 일괄 저장의 봉투 — grid-standard.md §3.1 · 66 §4.7.
 *
 * <p><b>비어 있으면 400 이다.</b> 조용히 성공으로 돌려주면 <i>저장됐다</i> 는 토스트만 남는다.
 */
public record NoticeSaveRequest(@NotEmpty @Valid List<NoticeSaveRow> rows) {}
