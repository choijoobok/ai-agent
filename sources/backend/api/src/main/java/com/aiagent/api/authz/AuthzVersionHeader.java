package com.aiagent.api.authz;

import com.aiagent.domain.authz.EffectiveAuthority;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 유효 권한이 바뀌었음을 알리는 <b>유일한 채널</b>.
 *
 * <pre>
 * X-Authz-Version: &lt;유효 권한 집합의 해시&gt;
 * </pre>
 *
 * <p><b>서버 쪽 판정은 이미 항상 최신이다.</b> 권한이 바뀌면 세션에 {@code authzDirty} 가
 * 서고 인가 인터셉터가 다음 요청에서 재계산한다 — 이 헤더가 메우는 것은 <b>프론트의 메뉴
 * 트리</b> 하나다. 보이는데 누르면 403 인 상태를 없애기 위한 것이다.
 *
 * <p><b>푸시 채널(SSE·WebSocket)을 두지 않는다.</b> 부품이 하나 늘고, 그 채널이 <b>조용히
 * 끊기면 낡은 트리가 살아 있는 것처럼</b> 보인다. 응답 헤더는 요청이 있을 때만 오지만
 * <i>"즉시"</i> 의 정확한 뜻이 <b>다음 요청</b>이면 충분하다 — 사용자가 아무 요청도 하지
 * 않는 동안은 화면을 쓰지 않는 중이고, 무언가 하려는 순간 그 요청이 헤더를 물고 온다.
 */
public final class AuthzVersionHeader {

    public static final String NAME = "X-Authz-Version";

    private AuthzVersionHeader() {}

    /**
     * 붙이는 자리가 둘이다 — 로그인 응답({@code /api/public/**} 이라 인터셉터를 지나지 않는다)과
     * 인가 인터셉터.
     *
     * <p><b>로그인 응답에도 붙이는 것이 필요하다.</b> 없으면 프론트가 비교할 기준값을 갖지
     * 못한 채 셸을 그리게 되고, 첫 {@code /api/common/**} 호출이 나갈 때까지 <b>무엇과 비교할지
     * 모른다</b> — 그 사이의 첫 헤더를 "바뀌었다" 로 오해하면 로그인 직후 헛 재조회가 돈다.
     */
    public static void stamp(HttpServletResponse response, EffectiveAuthority authority) {
        response.setHeader(NAME, authority.version());
    }
}
