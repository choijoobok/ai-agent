package com.aiagent.domain.user;

import com.aiagent.domain.user.entity.SysUser;
import java.lang.reflect.Field;
import java.time.Instant;

/**
 * 계정 행을 테스트에서 조립한다.
 *
 * <p><b>빌더로 못 채우는 필드가 있다</b> — {@code PWD_CHG_DTM} · {@code PWD_INIT_YN} 은
 * 로그인 흐름과 비밀번호 변경만 쓰는 값이라 생성자에 없다(sys/user-role.md 의 "축이 다르다"). 그
 * 규약을 테스트 편의로 깨는 대신 리플렉션으로 넣는다 —
 * {@link com.aiagent.domain.authz.SysMenuFixture} 와 같은 방식이다.
 */
public final class SysUserFixture {

    private SysUserFixture() {}

    /** 평범한 계정. 해시는 <b>인코더를 태우지 않은</b> 값이라 테스트가 직접 정한다. */
    public static SysUser user(String userId, String encodedPwd) {
        return SysUser.builder()
                .userId(userId)
                .userNm(userId)
                .email(userId + "@example.com")
                .pwd(encodedPwd)
                .localeCd("ko")
                .build();
    }

    /** 마지막 변경 시각 — 만료까지 남은 날 계산의 기준이다. */
    public static SysUser withPwdChangedAt(SysUser user, Instant when) {
        set(user, "pwdChgDtm", when);
        return user;
    }

    /** 관리자 발급 임시 비밀번호 상태 — 체인 #5 의 독립 조건(backend/security.md). */
    public static SysUser asTemporary(SysUser user) {
        set(user, "pwdInitYn", Boolean.TRUE);
        return user;
    }

    private static void set(SysUser user, String field, Object value) {
        try {
            Field target = SysUser.class.getDeclaredField(field);
            target.setAccessible(true);
            target.set(user, value);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
