package com.aiagent.api.trace;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import com.aiagent.support.config.ConfigLookup;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 추적 ID 를 MDC 에 올리고 <b>설정 스냅샷의 경계를 연다</b> — backend/packages.md 의 <b>최우선</b> 필터.
 *
 * <p><b>클라이언트가 발급한 값을 이어받는다.</b> 프론트가 {@code X-Request-Id} 헤더와
 * {@code _rid} 쿼리 양쪽에 같은 UUID 를 싣고(29 · frontend/packages.md), 서버는 그것을 그대로 쓴다 —
 * 서버가 새로 만들면 사용자가 들고 온 값과 로그의 값이 달라져 추적이 끊긴다.
 *
 * <p>헤더가 없으면(도구·헬스체크·직접 호출) 서버가 만든다. 없다고 비워 두면 그 요청만
 * 이력에서 이름 없이 남는다.
 *
 * <h2>일이 둘인 것이 의도다</h2>
 *
 * <p>sys/config.md 가 설정 스냅샷의 경계를 <b>MDC 가 이미 붙는 자리 셋</b>(요청 필터 ·
 * {@code @Async} 데코레이터 · 스케줄러 래퍼)으로 정하며 <i>"새 자리를 만들지 않는다"</i>
 * 고 적었다. 요청이 그 셋 중 하나이고 <b>여기가 그 자리</b>다.
 *
 * <p><b>필터를 하나 더 두지 않는 이유</b>는 순서 때문이다. 스냅샷은 <b>가장 바깥</b>에
 * 있어야 인증·인가·컨트롤러가 전부 같은 값을 본다 — 별도 필터로 두면 그 순서가
 * {@code @Order} 두 곳에 표현되고, 어긋나도 <b>조용하다</b>(누군가는 열리기 전에 읽는다).
 *
 * <p><b>여는 것 자체는 값싸다.</b> {@code SELECT * FROM SYS_CONFIG} 는 그 요청이 설정을
 * 실제로 읽을 때 처음 돈다 — 정적 리소스와 헬스체크는 그 쿼리를 치지 않는다.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdMdcFilter extends OncePerRequestFilter {

    /** {@code TRACE_ID} 컬럼이 {@code VARCHAR(64)} 다(sys/logs.md) — 넘치면 저장에서 깨진다. */
    private static final int MAX_LENGTH = 64;

    private final ConfigLookup configs;

    public RequestIdMdcFilter(ConfigLookup configs) {
        this.configs = configs;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String traceId = resolve(request.getHeader(TraceId.HEADER));
        MDC.put(TraceId.MDC_KEY, traceId);
        // 응답에도 되돌려준다 — 프론트가 봉투를 읽기 전(네트워크 오류·5xx)에도 값이 필요하다.
        response.setHeader(TraceId.HEADER, traceId);
        try {
            /*
              체크 예외를 던지는 체인을 람다에 담아야 해서 배열 한 칸을 쓴다.
              {@code inNewSnapshot} 이 {@code Supplier} 를 받는 것은 값을 돌려주는 작업
              (기동 검사)이 있기 때문이고, 여기는 그 값이 없다.
            */
            IOException[] io = new IOException[1];
            ServletException[] servlet = new ServletException[1];
            configs.inNewSnapshot(() -> {
                try {
                    chain.doFilter(request, response);
                } catch (IOException e) {
                    io[0] = e;
                } catch (ServletException e) {
                    servlet[0] = e;
                }
            });
            if (io[0] != null) {
                throw io[0];
            }
            if (servlet[0] != null) {
                throw servlet[0];
            }
        } finally {
            MDC.remove(TraceId.MDC_KEY);
        }
    }

    private static String resolve(String fromClient) {
        if (fromClient == null || fromClient.isBlank()) {
            return UUID.randomUUID().toString();
        }
        return fromClient.length() > MAX_LENGTH ? fromClient.substring(0, MAX_LENGTH) : fromClient;
    }
}
