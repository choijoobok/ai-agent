package com.ordinary.backoffice.support.config.props;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 날짜 표시 형식 — 43 §6.4 · grid-column-contract.md §4.5. <b>정밀도 셋이 각자 문자열을 갖는다.</b>
 *
 * <p><b>기본은 ISO 다.</b> 조직에 따라 년월일 구분자가 {@code .} 이거나 {@code /} 인데,
 * 그것을 화면마다 고치게 두면 <b>같은 앱 안에서 날짜가 두 모양</b>으로 보인다 — 그리드의
 * 시각 컬럼과 조회조건의 달력이 같은 문자열을 봐야 한다.
 *
 * <p><b>시간대는 여기 없다.</b> 서버가 주는 것은 오프셋을 포함한 ISO-8601 이고(architecture.md §6-1)
 * 브라우저가 자기 시간대로 옮겨 그린다 — 설정으로 두면 <i>같은 화면을 서울과 하노이에서
 * 볼 때</i> 둘 중 하나가 틀린다.
 *
 * <p><b>정밀도 자체는 설정이 아니다.</b> 어느 컬럼이 년월인지는 <b>컬럼 선언</b>이 정한다
 * (grid-column-contract.md §4.5의 {@code precision}) — 설정으로 두면 년월 컬럼이 있는 화면과 없는 화면이 같은
 * 값을 다르게 읽는다.
 *
 * <p><b>형식 문자열을 서버가 쓰지 않는다.</b> 값을 그리는 것은 화면이며(grid-column-contract.md §5.4 — 값은
 * 바꾸지 않는다) 서버는 이 값을 <b>로그인 응답에 실어 나르기만</b> 한다. 그래서 여기에
 * {@code dayjs} 의 토큰이 온다 — 서버의 {@code DateTimeFormatter} 문법이 아니다.
 *
 * @param month 년월 — 기본 {@code YYYY-MM}
 * @param day 년월일 — 기본 {@code YYYY-MM-DD}. {@code date} 타입 컬럼의 기본 정밀도다
 * @param second 년월일시분초 — 기본 {@code YYYY-MM-DD HH:mm:ss}. {@code dateTime} 의 기본이다
 */
@ConfigurationProperties(prefix = "sys-config.ui.date-format")
@Validated
public record UiDateFormatProps(
        @NotBlank String month, @NotBlank String day, @NotBlank String second) {}
