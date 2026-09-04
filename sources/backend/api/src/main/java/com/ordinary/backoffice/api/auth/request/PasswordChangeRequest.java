package com.ordinary.backoffice.api.auth.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 비밀번호 변경 — AUTH-05 · main-shell.md §8.
 *
 * <p><b>최소 길이를 여기서 못 박지 않는다.</b> 정책은 {@code SYS_CONFIG} 의 값이며
 * ({@code AuthPasswordProps}) 애너테이션에 적으면 <b>같은 규칙이 두 곳</b>에 생겨 설정을
 * 바꿔도 한쪽이 옛 값으로 남는다 — {@link LocaleRequest} 가 지원 언어 목록을 서비스에
 * 맡긴 것과 같다. {@code @Size} 는 <b>DB 컬럼이 아니라 입력 상한</b>일 뿐이다.
 *
 * <p>확인용 재입력 칸은 여기 없다 — 두 값이 같은지는 <b>화면이 판정</b>한다. 서버까지
 * 보내면 왕복 한 번이 그 확인에 쓰이고, 서버는 어차피 새 비밀번호 하나만 필요하다.
 */
public record PasswordChangeRequest(
        @NotBlank @Size(max = 100) String currentPwd, @NotBlank @Size(max = 100) String newPwd) {}
