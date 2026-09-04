package com.ordinary.backoffice.api.user.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 내 정보 저장 — USER-05 · main-shell.md §8.
 *
 * <p><b>{@code userId} 가 없는 것이 이 record 의 요점이다.</b> 대상은 언제나 세션의
 * 주인이며, 두는 순간 <i>"누구 것을 바꾸는가"</i> 가 클라이언트가 보낸 값이 되고 그것을
 * 막는 판정이 아래 모든 자리에 필요해진다({@link LocaleRequest} 와 같은 이유다).
 *
 * <p>길이는 {@code SYS_USER} 의 컬럼과 같다 — 넘치면 DB 가 자르거나 500 이 되며, 둘 다
 * 사용자에게는 <i>저장이 안 된다</i> 로만 보인다.
 *
 * <p><b>{@code email} 은 비울 수 있다.</b> 없는 사람이 있고, 지우는 것도 정상 입력이다 —
 * 빈 문자열은 서비스가 {@code null} 로 바꾼다. {@code @Email} 은 값이 있을 때만 본다.
 */
public record ProfileRequest(
        @NotBlank @Size(max = 100) String userNm, @Email @Size(max = 255) String email) {}
