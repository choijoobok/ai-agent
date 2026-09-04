package com.aiagent.support.config.props;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 로그인 정책 — sys/code.md.
 *
 * <p><b>원시 타입을 쓰지 않는다.</b> {@code int} 는 yml 이 비면 조용히 {@code 0} 이 되고
 * {@code boolean} 은 {@code false} 가 된다 — 래퍼 + {@code @NotNull} 이라야 누락이 전부
 * 기동에서 걸린다(sys/code.md). <b>초기화식(기본값)도 두지 않는다</b> — 기본값의 자리는
 * {@code application.yml} 하나다.
 *
 * <p><b>설명은 {@code @param} 에 쓴다</b> — screen/code/requirements.md. 컴포넌트 위의 주석은 Javadoc 이 아니라
 * 그냥 주석이라 {@code spring-configuration-metadata.json} 에 실리지 않고, 그러면 관리
 * 화면의 <b>설명 컬럼이 조용히 빈다</b>.
 *
 * @param failLimit 연속 실패 허용 횟수. <b>0 이면 잠금 기능을 끈다</b>(개발용). 권장 5~10.
 * @param lockReleaseMinutes 잠금 자동 해제까지의 분. <b>0 이면 관리자 해제만</b> 허용한다.
 * @param denyEmptyAuthority 유효 권한이 공집합이면 로그인을 차단한다(AUTHZ-10 · backend/security.md).
 *     끄면 UX-11 권한 없음 화면이 랜딩이 된다.
 */
@ConfigurationProperties(prefix = "sys-config.auth.login")
@Validated
public record AuthLoginProps(
        @NotNull @Min(0) Integer failLimit,
        @NotNull @Min(0) Integer lockReleaseMinutes,
        @NotNull Boolean denyEmptyAuthority) {}
