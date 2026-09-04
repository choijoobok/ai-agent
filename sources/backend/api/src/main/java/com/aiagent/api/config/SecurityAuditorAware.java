package com.aiagent.api.config;

import java.util.Optional;
import org.springframework.data.domain.AuditorAware;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * 감사 컬럼의 "누가" — {@code BaseAuditEntity} 의 {@code REG_ID}·{@code MOD_ID}.
 *
 * <p>인증 주체를 아는 것은 api 모듈뿐이므로 여기 둔다. 바인딩은 domain 의
 * {@code JpaAuditingConfig} 가 하며 타입으로 찾는다(backend/packages.md).
 *
 * <p><b>비어 있을 수 있다</b> — Liquibase 시드·배치·부팅 경로에는 주체가 없다. 그때
 * 컬럼은 NULL 로 남으며, 없는 사람 이름을 지어내지 않는다.
 *
 * <p><b>익명 토큰을 걸러야 한다.</b> 인증 전 요청에도 {@code AnonymousAuthenticationToken}
 * 이 들어 있고 {@code isAuthenticated()} 가 참이며 이름이 {@code "anonymousUser"} 다.
 * 거르지 않으면 <b>로그인 실패로 실패 횟수를 올릴 때 {@code MOD_ID} 에 그 문자열이 박힌다</b> —
 * 실제로 그렇게 저장된 것을 보고 고쳤다. 사람 이름이 들어갈 자리에 프레임워크의 자리표시자가
 * 남으면 감사 컬럼 전체를 믿을 수 없게 된다(sys/INDEX.md).
 */
@Component
public class SecurityAuditorAware implements AuditorAware<String> {

    @Override
    public Optional<String> getCurrentAuditor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return Optional.empty();
        }
        return Optional.ofNullable(authentication.getName());
    }
}
