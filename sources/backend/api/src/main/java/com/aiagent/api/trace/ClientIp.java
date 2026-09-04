package com.aiagent.api.trace;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 접속 IP 추출의 <b>한 자리</b> — backend/security.md.
 *
 * <p>부르는 곳이 셋이고 손에 든 것이 저마다 다르다(로그인 서비스 · 세션 만료 콜백 ·
 * 사용 이력 인터셉터). 규칙이 갈리면 <b>같은 접속 한 번이 두 가지 IP 로 기록된다</b>.
 *
 * <p><b>{@code X-Forwarded-For} 를 직접 읽지 않는다.</b> 그 헤더는 클라이언트가 아무 값이나
 * 넣을 수 있어, 손으로 첫 값을 쓰면 아무나 이력의 IP 를 <b>위조</b>할 수 있다. 이력은
 * <i>누가 어디서 들어왔나</i> 에 답하려고 남기는 것이라, 위조되면 남길 이유가 없어진다.
 *
 * <p><b>판이 이미 그 일을 안전하게 한다.</b> {@code server.forward-headers-strategy: native}
 * 를 켜면 톰캣의 {@code RemoteIpValve} 가 <b>바로 앞 홉이 신뢰하는 프록시일 때만</b> 헤더를
 * 반영해 {@code getRemoteAddr()} 를 바꿔 준다. 그래서 여기서는 그 하나만 본다 — 설정을 켜지
 * 않고 프록시 뒤에 두면 프록시의 IP 가 남으며, 그것은 거짓이 아니라 <i>덜 쓸모 있는 사실</i>
 * 이고 위조된 클라이언트 IP 보다 낫다.
 */
public final class ClientIp {

    /** {@code CLIENT_IP} 는 {@code VARCHAR(45)} 다 — IPv6 최대 표기 길이(sys/logs.md). */
    public static final int MAX_LENGTH = 45;

    private ClientIp() {}

    public static String of(HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        if (ip == null) {
            return null;
        }
        return ip.length() > MAX_LENGTH ? ip.substring(0, MAX_LENGTH) : ip;
    }
}
