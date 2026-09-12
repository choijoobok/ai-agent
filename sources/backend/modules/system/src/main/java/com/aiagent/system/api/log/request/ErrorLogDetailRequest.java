// @feat FEAT-507
package com.aiagent.system.api.log.request;

import jakarta.validation.constraints.NotNull;

/**
 * 상세 모달을 여는 요청 — screen/admin/system/log/error/requirements.md.
 *
 * <p>{@link AccessLogDetailRequest} 와 같은 모양이고 같은 이유다 — PK 하나로 한 행을 집는
 * 고정형이며(backend/api.md) 식별자는 경로 변수가 아니라 body 로 온다(backend/packages.md).
 *
 * <p><b>{@code traceId} 를 받지 않는다.</b> 전문이 그 값으로 오지만(사용 이력에서 —
 * sys/logs.md) 그것은 <b>서버가 이 행에서 읽을 값</b>이다. 클라이언트가 보내게 하면 <i>이 행의
 * 전문</i> 이 아니라 <b>보낸 사람이 고른 전문</b>을 열게 된다.
 */
public record ErrorLogDetailRequest(@NotNull Long exceptionLogSeq) {}
