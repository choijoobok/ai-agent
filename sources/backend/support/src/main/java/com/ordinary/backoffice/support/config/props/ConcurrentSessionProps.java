package com.ordinary.backoffice.support.config.props;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 동시 접속 제어 — security-design.md §4-1.
 *
 * <p><b>{@code sys-config.} 아래가 아니다.</b> 이 값들은 기동 시 필터 체인의 모양을 정하므로
 * 런타임에 바꿔도 반영될 자리가 없다 — {@code SYS_CONFIG} 오버레이(43 §6.1)의 대상이 아니라
 * <b>배포 설정</b>이다. 그래서 접두사가 {@code app.security} 이며 관리 화면에 나타나지 않는다.
 *
 * <p><b>IP 비교가 아니라 세션 개수다.</b> IP 비교는 사무실 NAT(전원이 같은 공인 IP)에서
 * 못 잡고 모바일 망(IP 수시 변동)에서 오탐한다. 개수 제한은 IP 를 보지 않으므로 둘 다 없다.
 */
@ConfigurationProperties(prefix = "app.security.concurrent-session")
@Validated
public record ConcurrentSessionProps(

        /** 끄면 세션 수를 세지 않는다 — 필터도 붙지 않는다. */
        @NotNull Boolean enabled,

        /** 동시 허용 세션 수. 기본 1. */
        @NotNull @Min(1) Integer maxSessions,

        /**
         * {@code false}(기본) — 신규 로그인이 이기고 <b>기존 세션이 강제 만료</b>된다.
         * {@code true} — 기존 세션이 남고 <b>신규 로그인이 거부</b>된다.
         *
         * <p><b>{@code true} 를 기본으로 두지 않는다</b>: 브라우저 비정상 종료로 남은 유령
         * 세션이 재로그인을 세션 타임아웃(최대 30분)까지 막는다(security-design.md §4-1).
         */
        @NotNull Boolean preventLogin) {}
