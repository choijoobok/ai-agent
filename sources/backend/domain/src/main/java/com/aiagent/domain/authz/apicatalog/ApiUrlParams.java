package com.aiagent.domain.authz.apicatalog;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 하단 조회의 <b>부모 키</b> — api-conventions.md §3.1.1.
 *
 * <p><b>조건이 아니라 {@code params} 인 이유</b>는 이것이 <i>사용자가 좁힌 것</i> 이 아니라
 * <b>화면의 구조</b>이기 때문이다. 조건 목록에 두면 화이트리스트를 지나며 <b>선택적</b>이
 * 되고, 화면이 빠뜨린 요청 하나가 전 API 의 매핑을 한 판에 쏟는다 — {@code @NotBlank} 가
 * 그것을 400 으로 만든다.
 *
 * <p>{@code @Size} 가 {@code 200} 인 것은 {@code SYS_API.API_URL} 의 길이 그대로다(42 §5).
 */
public record ApiUrlParams(@NotBlank @Size(max = 200) String apiUrl) {}
