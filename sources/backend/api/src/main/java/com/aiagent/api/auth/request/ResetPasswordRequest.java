package com.aiagent.api.auth.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 재설정 ③ 완료 — {@code documents/screen/_standalone/login/requirements.md} §4-2.
 *
 * <p><b>②를 통과했다는 증표가 코드 그 자체다.</b> 서버에 <i>확인됨</i> 상태를 남기지 않기로
 * 했으므로(그 상태의 수명·무효화를 또 정하는 것은 토큰을 하나 더 만드는 일이다) 같은 코드를
 * 다시 싣고 서버가 다시 대조한다.
 *
 * <p><b>확인용 재입력 칸은 없다</b> — {@code PasswordChangeRequest} 와 같은 판단이다.
 * 최소 길이도 여기 없다: 정책은 {@code SYS_CONFIG} 의 값이며 애너테이션에 적으면 같은 규칙이
 * 두 곳에 생긴다.
 */
public record ResetPasswordRequest(
        @NotBlank @Size(max = 30) String loginId,
        @NotBlank @Size(max = 10) String resetCode,
        @NotBlank @Size(max = 100) String newPwd) {}
