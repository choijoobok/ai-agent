package com.aiagent.api.auth.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 재설정 ② 검증 — {@code documents/screen/_standalone/login/requirements.md} §4-2.
 *
 * <p><b>필드 이름이 {@code resetCode} 인 것이 요건이다.</b> {@code app.http-log.mask-parameters}
 * 가 이 이름을 부분 일치로 가린다 — 가리지 않으면 10분간 계정 하나를 여는 값이 사용 이력에
 * 평문으로 남고, 그 경로는 메일함을 지나지 않는다(architecture.md §6.4).
 */
public record ResetVerifyRequest(
        @NotBlank @Size(max = 30) String loginId,
        @NotBlank @Size(max = 10) String resetCode) {}
