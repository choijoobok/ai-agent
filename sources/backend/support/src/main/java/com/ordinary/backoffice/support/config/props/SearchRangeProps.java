package com.ordinary.backoffice.support.config.props;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 조회 기간의 <b>시스템 층</b> — 43 §6.4 · 64 §2.2.
 *
 * <p>조건 없이 열면 첫 조회가 보존 기간 전량을 향한다. 그래서 기간 칸을 비워 둘 수 없게
 * 하고 상한을 건다 — <b>상한 초과는 조용히 자르지 않고 400 이다</b>(64 §3.7): 잘라 주면
 * 사용자는 <i>"31일치를 봤다"</i> 고 믿은 채 92일치 결론을 낸다.
 *
 * <p><b>층이 둘이고 아래가 위를 덮는다.</b> 화면 기본값은 그리드 선언이 갖는다 — 사용
 * 이력만 1 · 31 이며(64 §3.3) 그 근거는 <i>행마다 {@code nclob} 이 달려 있고 보존이 90일로
 * 가장 짧다</i> 이다. grid-standard.md §2.3 의 페이지 사이즈 3층과 같은 방향이되 <b>개인 설정 층이
 * 없다</b> — 조회 기간은 부하의 상한이지 취향이 아니다.
 *
 * <p><b>키 이름이 문서와 한 마디 다르다.</b> 43 §6.4 · 64 §2.2 는
 * {@code range-days.default} · {@code range-days.max} 로 적었는데 <b>{@code default} 는
 * 자바 예약어</b>라 레코드 컴포넌트가 될 수 없다. 한쪽만 줄이면 짝이 어긋나 보이므로 둘 다
 * {@code -days} 를 달았다 — 화면(CONFIG_MGMT)에 나타나는 것도 이 이름이다.
 *
 * @param defaultDays 화면이 처음 열릴 때 채워지는 기간(일). 화면이 덮을 수 있다.
 * @param maxDays 허용하는 최대 기간(일). 화면이 <b>더 좁게</b> 덮을 수 있고 넓히지는 못한다.
 */
@ConfigurationProperties(prefix = "sys-config.ui.search.range-days")
@Validated
public record SearchRangeProps(
        @NotNull @Min(1) Integer defaultDays, @NotNull @Min(1) Integer maxDays) {}
