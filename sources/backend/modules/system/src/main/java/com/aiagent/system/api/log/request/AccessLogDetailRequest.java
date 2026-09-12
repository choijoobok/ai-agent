// @feat FEAT-507
package com.aiagent.system.api.log.request;

import jakarta.validation.constraints.NotNull;

/**
 * 전문 하나를 여는 요청 — screen/admin/system/log/access/requirements.md.
 *
 * <p><b>{@link com.aiagent.core.search.SearchRequest} 가 아니다.</b> PK 하나로
 * 한 행을 집는 고정형이며(backend/api.md), 동적 봉투를 태우면 <b>전문 조회가 임의 조건의 조회</b>가
 * 되어 {@code nclob} 을 목록에서 뺀 이유가 무너진다.
 *
 * <p><b>경로 변수가 아니라 body 다</b> — {@code service} 계층은 고정 경로이며 식별자·조건은
 * body 로 온다(backend/packages.md).
 */
public record AccessLogDetailRequest(@NotNull Long accessLogSeq) {}
