package com.aiagent.support.config.props;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 다국어 메시지 — 43 §7 · §8 · 50 §3.2.
 *
 * <p><b>지원 언어 목록의 원본은 공통코드({@code LANG_CD} 그룹)여야 한다</b>(43 §7). 그 테이블은
 * 기준정보 슬라이스의 것이므로 지금은 이 설정이 그 자리를 대신한다 — <b>임시로 두는 것을
 * 여기 적어 두지 않으면, 공통코드가 생긴 날 목록이 두 곳에 남는다.</b>
 *
 * @param supported 화면에 낼 수 있는 언어. 공통코드가 생기면 이 값이 그 목록으로 옮겨 간다.
 *     <b>{@code List} 라 관리 화면 목록에 나오지 않는다</b> — 스칼라만 낸다(63 §4.2).
 * @param defaultLang 요청 언어의 값이 비었을 때 폴백할 언어 — 43 §7.3. 어느 언어에도 값이
 *     없으면 <b>키 문자열을 그대로</b> 보여준다. 빈 문자열이나 "—" 를 보여주면 누락이
 *     숨는다(원칙 P1).
 * @param browserFallbackLang 지원하지 않는 브라우저 언어일 때 고를 언어 — 50 §3.2 순위 2.
 *     <b>{@code defaultLang} 과 다른 것이다</b>: 저것은 <i>"번역이 비었다"</i> 의 폴백이고
 *     이것은 <i>"이 사람의 언어를 우리가 모른다"</i> 의 답이다. 일본어 브라우저는 한국어가
 *     아니라 영어를 받는다.
 * @param cacheTtlMinutes 백엔드 번들 캐시 수명(분) — 43 §8. <b>0 이면 매 조회가 DB 를
 *     친다</b>(개발용). 프론트가 보는 갱신 시점은 이것이 아니라 {@code SYS_CACHE_VERSION}
 *     이다 — 둘은 다른 축이다(43 §8.1).
 */
@ConfigurationProperties(prefix = "sys-config.message")
@Validated
public record MessageProps(
        @NotEmpty List<String> supported,
        @NotNull String defaultLang,
        @NotNull String browserFallbackLang,
        @NotNull @Min(0) Integer cacheTtlMinutes) {}
