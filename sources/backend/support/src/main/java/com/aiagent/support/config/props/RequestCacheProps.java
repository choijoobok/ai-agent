package com.aiagent.support.config.props;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 요청 body 캐싱 — architecture.md §6.2. 사용 이력·에러 로그가 <b>전문을 보려면 먼저 감싸야 한다</b>.
 *
 * <p><b>{@code sys-config.} 아래가 아니다.</b> 이 값은 기동 시 필터의 모양을 정하고, 무엇보다
 * <b>한 요청의 한복판에서 바뀌면 안 된다</b> — 전문을 반쯤 담다가 상한이 줄면 그 요청만
 * 다른 규칙으로 잘린다. {@code app.} 아래의 배포 설정이며 관리 화면에 나오지 않는다(43 §6.1).
 *
 * @param enabled 끄면 전문을 담지 않는다. 사용 이력 행은 그대로 남고 {@code PARAMETERS} 만
 *     빈다 — <b>이력 자체를 끄는 스위치가 아니다</b>(그런 스위치는 두지 않는다: ADR-0010 이
 *     감사 이력을 이 로깅으로 대체했으므로 끄면 감사가 사라진다).
 * @param maxBytes 캐시 상한. <b>문자가 아니라 UTF-8 바이트로 잰다</b> — 문자로 재면 전부
 *     한글일 때 3배가 샌다(architecture.md §6.2 의 실측: 1,048,576자 = 1,359,272바이트). 절단은 문자
 *     중간이 아니라 <b>바이트 경계</b>에서 한다.
 */
@ConfigurationProperties(prefix = "app.request-cache")
@Validated
public record RequestCacheProps(@NotNull Boolean enabled, @NotNull @Min(1) Integer maxBytes) {}
