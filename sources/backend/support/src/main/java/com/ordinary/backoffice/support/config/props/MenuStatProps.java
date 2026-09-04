package com.ordinary.backoffice.support.config.props;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 자주 쓰는 메뉴 — UX-16 · 42 §8 · 43 §6.4.
 *
 * <p><b>{@code sys-config.} 아래다.</b> 둘 다 <b>운영 중에 조정할 값</b>이며(목록이 너무
 * 짧다·순위가 너무 느리게 바뀐다) 바꾼다고 기동 구조가 달라지지 않는다 — 그래서
 * {@code app.} 이 아니라 {@code SYS_CONFIG} 오버레이의 대상이다(43 §6.1).
 *
 * @param months 창의 길이(개월) — <b>이번 달 포함</b>이다. 1 이면 <b>월 1일에 목록이
 *     빈다</b>. 2 여도 월이 바뀔 때 절반이 한 번에 날아가 순위가 점프한다 — 3 이면 2/3 가
 *     남는다.
 * @param topN 목록에 내는 개수. 모달 한 화면에 들어가는 만큼이다.
 */
@ConfigurationProperties(prefix = "sys-config.ui.menu-stat")
@Validated
public record MenuStatProps(
        @NotNull @Min(1) @Max(24) Integer months, @NotNull @Min(1) @Max(50) Integer topN) {}
