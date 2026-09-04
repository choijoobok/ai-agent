package com.aiagent.support.config.props;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 저장된 조회조건의 개수 상한 — UX-07 · 43 §6.4 · search-form-contract.md §5.4.
 *
 * <p><b>사용자·화면당이다.</b> 사용자당이면 화면을 많이 쓰는 사람이 먼저 막히고, 그 사람이
 * <b>어느 화면의 조건을 지워야 하는지 알 수 없다</b>(43 §6.4).
 *
 * <p><b>상한이 있는 이유는 목록이 드롭다운이기 때문이다.</b> 저장은 값싸고 지우는 것은
 * 잊히므로, 없으면 목록이 조용히 자라 <b>고르는 것이 만드는 것보다 비싸진다.</b>
 *
 * <p>{@code ui.search.*} 아래인 것은 43 §6.4 가 정한 자리다 — 처음에 {@code ui.log.*} 로
 * 지었다가 {@code maxRange} 가 검색 폼 전체의 계약이 되면서 옮겼고, 이 키가 그 이름을
 * 함께 쓴다.
 *
 * @param maxCount 사용자·화면당 저장할 수 있는 조회조건의 수.
 */
@ConfigurationProperties(prefix = "sys-config.ui.search.saved-cond")
@Validated
public record SavedCondProps(@NotNull @Min(1) Integer maxCount) {}
