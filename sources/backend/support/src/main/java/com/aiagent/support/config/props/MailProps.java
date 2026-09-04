package com.aiagent.support.config.props;

import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 메일 발신자 — {@code documents/screen/_standalone/login/requirements.md} §8.
 *
 * <p><b>접속 정보는 여기 없다.</b> 호스트·포트·계정은 {@code spring.mail.*} 이며 Spring Boot
 * 의 자동설정이 그것으로 발송 빈을 만든다 — 같은 값을 두 곳에 두면 <i>어느 쪽이 실제로
 * 쓰이나</i> 를 매번 확인해야 한다. 여기 있는 것은 <b>Spring 이 갖지 않는 값</b> 둘뿐이다.
 *
 * <p><b>{@code sys-config.} 아래가 아니다.</b> 발신 주소는 메일 서버가 허용하는 것과 짝이라
 * 화면에서 바꾸면 <b>발송이 통째로 거부되는</b> 상태를 운영이 만들 수 있다. 배포 설정이며
 * 관리 화면에 나오지 않는다(43 §6.1).
 *
 * @param from 발신 주소. 메일 서버가 이 주소로의 발송을 허용해야 한다 — 대개 인증 계정과
 *     같거나 그 도메인이다.
 * @param fromName 받는 사람의 목록에 보이는 이름. 비우면 주소만 보인다.
 */
@ConfigurationProperties(prefix = "app.mail")
@Validated
public record MailProps(@NotNull String from, @NotNull String fromName) {}
