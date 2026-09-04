package com.aiagent.domain.authz.role;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 하단·트리 조회의 <b>부모 키</b> — api-conventions.md §3.1.1.
 *
 * <p><b>조건이 아니라 {@code params} 인 이유</b>는 이것이 <i>사용자가 좁힌 것</i> 이 아니라
 * <b>화면의 구조</b>이기 때문이다. 조건 목록에 두면 화이트리스트를 지나며 <b>선택적</b>이
 * 되고, 화면이 빠뜨린 요청 하나가 전 역할의 보유자를 한 판에 쏟는다 — {@code @NotBlank} 가
 * 그것을 400 으로 만든다.
 *
 * <p><b>두 화면이 같은 레코드를 쓴다.</b> 62 §3.4 가 하단을 <i>"§2.5 와 같은 그리드"</i> 로
 * 정했고 §3.7 이 <i>"경로도 같아야 한다"</i> 고 했으므로, 요청의 모양도 하나여야 한다 —
 * 같은 질문에 답이 둘이 되지 않게 하는 것이 그 결정의 목적이다.
 */
public record RoleIdParams(@NotBlank @Size(max = 30) String roleId) {}
