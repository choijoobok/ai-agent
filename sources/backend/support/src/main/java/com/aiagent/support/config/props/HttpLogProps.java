package com.aiagent.support.config.props;

import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 요청 전문 마스킹 — architecture.md §6.4. <b>없으면 로그가 최대 취약점이 된다.</b>
 *
 * <p>전문을 통째로 저장하는 것이 ADR-0010 의 선택이었고, 그 선택의 대가가 이 클래스다 —
 * 비밀번호도 세션 쿠키도 <b>평문으로 90일간</b> 남을 수 있다.
 *
 * <p><b>{@code sys-config.} 아래가 아니다.</b> 런타임에 줄일 수 있게 두면 <i>"잠깐만 열어
 * 보자"</i> 가 화면에서 가능해지고, 그 순간부터의 이력이 평문을 담는다 — 되돌려도 이미
 * 저장된 것은 남는다. 배포 설정이며 관리 화면에 나오지 않는다(43 §6.1).
 *
 * <p><b>PII 컬럼은 여기 없다.</b> {@code SYS_PII_DEF} 등록 컬럼을 자동으로 더하는 것이
 * 규약이지만(27 §9) 그 테이블이 Phase 12 로 미뤄졌다 — 더하는 자리는
 * {@code RequestPayloadSerializer} 이며 목록 하나를 합치면 된다.
 *
 * @param enabled 끄면 마스킹 없이 저장한다. <b>개발 전용</b>이며 운영에서 끄는 것은
 *     이 클래스의 존재 이유를 지우는 것이다.
 * @param maskParameters 값을 가릴 <b>파라미터·body 키</b>. 대소문자를 가리지 않고 <b>부분
 *     일치</b>다 — {@code newPassword}·{@code accessToken} 처럼 접두·접미가 붙는 것이 보통이다.
 * @param maskHeaders 값을 가릴 <b>헤더</b>. 이쪽은 <b>완전 일치</b>다 — 헤더 이름은 표준이라
 *     변형이 없고, 부분 일치로 두면 {@code X-Cookie-Consent} 같은 무해한 헤더까지 가린다.
 */
@ConfigurationProperties(prefix = "app.http-log")
@Validated
public record HttpLogProps(
        @NotNull Boolean enabled,
        @NotNull List<String> maskParameters,
        @NotNull List<String> maskHeaders) {}
