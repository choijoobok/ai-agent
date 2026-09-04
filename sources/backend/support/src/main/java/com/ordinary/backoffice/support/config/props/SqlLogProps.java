package com.ordinary.backoffice.support.config.props;

import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * SQL 로깅 — system-logging.md §2 · §7.
 *
 * <p><b>{@code sys-config.} 아래가 아니다.</b> 켜고 끄는 것이 기동 시 {@code DataSource} 를
 * 감쌀지를 정하므로 런타임에 바꿔도 반영될 자리가 없다 — {@code SYS_CONFIG} 오버레이의
 * 대상이 아니라 <b>배포 설정</b>이다(43 §6.1).
 *
 * <p><b>운영 기본이 꺼짐이다</b>(system-logging.md §8). 포맷팅과 I/O 비용도 있지만 그보다 <b>파라미터가
 * 바인딩된 SQL 이 로그에 남기</b> 때문이다 — PII Vault 가 평문을 구조적으로 막아 두었어도
 * (system-logging.md §6) <b>PII 로 지정하지 않은 값이 조건절에 들어가는 경로</b>는 여전히 열려 있다.
 */
@ConfigurationProperties(prefix = "app.logging.sql")
@Validated
public record SqlLogProps(

        /** 켜면 {@code DataSource} 를 P6Spy 로 감싼다. <b>운영 기본 false</b>. */
        @NotNull Boolean enabled,

        /**
         * 호출 경로를 함께 찍는다 — system-logging.md §3. <b>운영 기본 false</b>.
         *
         * <p>{@code StackWalker} 는 첫 매칭에서 멈추므로 싸지만 공짜는 아니다. 그리고
         * <b>JPA 의 지연 flush 는 이 방법으로 잡히지 않는다</b>(system-logging.md §3.2) — 값을 바꾼
         * 코드는 커밋 시점의 스택에 없다.
         */
        @NotNull Boolean traceCaller,

        /**
         * 이 조각이 들어간 SQL 은 찍지 않는다 — system-logging.md §2.3.
         *
         * <p>세션 테이블처럼 <b>요청마다 도는데 볼 일이 없는</b> 것들이다. 걸러 내지 않으면
         * 진짜 보려던 쿼리가 그 사이에 묻힌다.
         */
        List<String> excludePatterns) {}
