package com.aiagent.support.config.props;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 계정 상태 정책 — sys/code.md.
 *
 * @param dormantDays 미접속 며칠이면 휴면으로 전환하는가(USER-08). 판정은 배치가 굳힌 값으로 본다(sys/user-role.md).
 */
@ConfigurationProperties(prefix = "sys-config.auth.account")
@Validated
public record AuthAccountProps(

        @NotNull @Min(1) Integer dormantDays) {}
