package com.aiagent.api.auth.check;

import com.aiagent.domain.authz.EffectiveAuthority;
import com.aiagent.domain.user.entity.SysUser;
import java.util.function.Supplier;

/**
 * 후처리 체인이 보는 것 — AUTH-14.
 *
 * <p><b>유효 권한을 지연 계산하는 것이 이 클래스의 존재 이유다.</b> 41 §4.4 는
 * <i>"권한 계산은 조인이 필요하므로 값싼 검사를 먼저 한다"</i> 고 했다. 체인에 통째로 넘기면
 * 휴면 계정처럼 앞에서 걸리는 사용자에게도 조인이 돈다.
 *
 * <p>계산된 값은 <b>로그인 성공 시 그대로 세션에 담긴다</b>(security-design.md §4 권한 캐싱) — 검사와 적재가
 * 같은 계산을 두 번 하지 않게 하는 것도 여기의 일이다. 그래서
 * {@code deny-empty-authority} 를 꺼도 이 값은 결국 한 번 계산된다.
 *
 * <p>요청 하나의 수명만 살므로 동기화하지 않는다.
 */
public final class LoginCandidate {

    private final SysUser user;
    private final Supplier<EffectiveAuthority> loader;
    private EffectiveAuthority authority;

    public LoginCandidate(SysUser user, Supplier<EffectiveAuthority> loader) {
        this.user = user;
        this.loader = loader;
    }

    public SysUser user() {
        return user;
    }

    /** 처음 부를 때 계산하고 이후로는 같은 값을 돌려준다. */
    public EffectiveAuthority authority() {
        if (authority == null) {
            authority = loader.get();
        }
        return authority;
    }
}
