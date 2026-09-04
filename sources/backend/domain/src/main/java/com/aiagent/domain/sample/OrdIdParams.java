package com.aiagent.domain.sample;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 디테일이 보는 주문 하나 — backend/api.md. {@code CodeGroupParams} 와 같은 자리다.
 *
 * <p><b>조회조건이 아니라 파라미터다.</b> 조건 목록에 담으면 사용자가 지울 수 있는 것이
 * 되고, 그러면 <i>이 주문의 품목</i> 을 묻는 pane 이 <b>전 주문의 품목</b>을 쏟는다 —
 * {@code @NotBlank} 가 그것을 400 으로 만든다.
 *
 * <p>문자열인 것은 {@code bigint} 어휘의 규약이다(frontend/packages.md).
 */
public record OrdIdParams(@NotBlank @Size(max = 20) String ordId) {}
