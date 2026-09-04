package com.ordinary.backoffice.domain.user.detail;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 디테일 탭 다섯이 공유하는 <b>부모 키</b> — 61 §3.9 · api-conventions.md §3.1.1.
 *
 * <p>{@code RoleIdParams} 와 같은 이유로 조건이 아니라 {@code params} 다: 이것은 <i>사용자가
 * 좁힌 것</i> 이 아니라 <b>화면의 구조</b>다. 조건 목록에 두면 화이트리스트를 지나며
 * <b>선택적</b>이 되고, 화면이 빠뜨린 요청 하나가 전 계정의 역할 부여를 한 판에 쏟는다 —
 * {@code @NotBlank} 가 그것을 400 으로 만든다.
 *
 * <p><b>다섯이 하나를 쓴다.</b> 탭마다 레코드를 두면 같은 제약이 다섯 벌이 되고, 그중
 * 하나에 {@code @NotBlank} 를 빠뜨렸을 때 <b>그 탭만</b> 전건을 쏟는다.
 */
public record UserIdParams(@NotBlank @Size(max = 30) String userId) {}
