package com.aiagent.api.auth.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 재설정 ① 요청 — {@code documents/screen/_standalone/login/requirements.md} §4-2.
 *
 * <p><b>메일 주소를 받지 않는다.</b> 서버가 {@code SYS_USER.EMAIL} 에서 찾는다 — 받으면
 * ID 와 메일이 어긋날 때 무엇을 보여줄지가 <i>"응답은 언제나 같다"</i> 와 충돌한다.
 *
 * <p>{@code Size} 는 {@code SYS_USER.USER_ID} 의 컬럼 길이다. 없는 ID 도 같은 응답을 받으므로
 * 길이 초과만은 400 으로 갈리지만, 30자를 넘는 값은 <b>어떤 계정도 될 수 없어</b> 열거에
 * 쓸 수 없다.
 */
public record ResetCodeRequest(@NotBlank @Size(max = 30) String loginId) {}
