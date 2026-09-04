package com.aiagent.api.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.function.UnaryOperator;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

/**
 * 세션에 담긴 인증 주체를 <b>다시 쓰는</b> 유일한 자리.
 *
 * <p><b>주체는 로그인 시점의 사진이다.</b> 그 뒤에 바뀐 사실은 다시 넣어 주지 않으면
 * 세션이 끝날 때까지 옛 값이다 — 지금 그 대상은 <b>언어</b>({@code RequestLocale} 이 요청마다
 * DB 를 치지 않고 주체를 읽는다 — architecture.md §6-1.2)와 <b>이름</b>({@code auth/me} 가 주체에서
 * 읽는다 — main-shell.md §8) 둘이다.
 *
 * <p><b>{@code SecurityContextHolder} 만 바꾸면 이 요청에서만 산다.</b> 홀더는 요청 스레드의
 * 것이고 저장은 리포지터리가 한다 — 세션에 쓰지 않으면 <b>다음 요청이 옛 주체를 되살린다.</b>
 *
 * <p><b>권한(체인 #2~#5)은 여기서 다시 계산하지 않는다.</b> 계정 상태의 사진은 인가
 * 인터셉터가 자기 주기로 갱신하며(security-design.md §4), 이 자리가 그것까지 하면 <b>같은 판정이 두
 * 곳</b>에 생긴다.
 */
@Component
public class SessionPrincipal {

    private final SecurityContextRepository repository = new HttpSessionSecurityContextRepository();

    /** 언어를 갈아 끼운다 — main-shell.md §9.1. */
    public void changeLocale(
            String localeCd, HttpServletRequest request, HttpServletResponse response) {
        replace(details -> details.withLocale(localeCd), request, response);
    }

    /** 이름을 갈아 끼운다 — USER-05 · main-shell.md §8. 헤더가 읽는 값이 여기서 나온다. */
    public void changeUserNm(
            String userNm, HttpServletRequest request, HttpServletResponse response) {
        replace(details -> details.withUserNm(userNm), request, response);
    }

    /**
     * 주체가 우리 타입이 아니면 아무 일도 하지 않는다 — 그런 세션은 이 API 에 닿을 수
     * 없지만, 조용히 넘기는 편이 500 보다 낫다.
     */
    private void replace(
            UnaryOperator<BackofficeUserDetails> change,
            HttpServletRequest request,
            HttpServletResponse response) {

        Authentication current = SecurityContextHolder.getContext().getAuthentication();
        if (current == null || !(current.getPrincipal() instanceof BackofficeUserDetails details)) {
            return;
        }

        Authentication updated = UsernamePasswordAuthenticationToken.authenticated(
                change.apply(details), current.getCredentials(), current.getAuthorities());

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(updated);
        SecurityContextHolder.setContext(context);
        repository.saveContext(context, request, response);
    }
}
