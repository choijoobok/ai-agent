package com.aiagent.api.userauth.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 트리 조회가 받는 것 — <b>사용자 하나뿐이다</b>.
 *
 * <p>{@code SearchRequest} 조차 아니다(62 §2.4 의 {@code RoleMenuTreeRequest} 와 같은 판단) —
 * 받을 것이 없는 자리에 봉투를 두면 <i>조건을 보내면 걸릴 것</i> 이라는 기대를 만든다.
 *
 * <p><b>페이징도 조건도 없는 이유</b>는 61 §4.4 에 있다. 계층이 잘리면 부모 없는 자식이
 * 보이고, 조건으로 거르면 <b>폴더의 파생 3-state 가 보이는 자식만으로 요약해 거짓을
 * 말한다</b> — 그 값은 저장 전 편집에 반응해야 하므로 자손 전부가 클라이언트에 있어야 한다.
 */
public record UserAuthTreeRequest(@NotBlank @Size(max = 30) String userId) {}
