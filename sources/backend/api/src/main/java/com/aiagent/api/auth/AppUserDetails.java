package com.aiagent.api.auth;

import com.aiagent.domain.user.entity.SysUser;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * 세션에 담기는 인증 주체 — backend/security.md 구현 유의점 4.
 *
 * <p><b>최소 필드만 갖고 {@code serialVersionUID} 를 고정한다.</b> 세션이 외부 스토어에
 * 있으므로 무중단 배포 중 옛 세션이 새 코드로 역직렬화된다 — 필드를 늘리면 그때 깨진다.
 * 엔티티를 그대로 담지 않는 이유도 같다.
 *
 * <p>4개 플래그가 {@code SYS_USER} 컬럼과 직결된다(sys/user-role.md). 그래서 로그인 시점의 체인
 * #2~#5 는 {@code AccountStatusUserDetailsChecker} 가 자동 검사하며 우리가 구현하지 않는다.
 * <b>대응이 없는 검사(휴면·허용 IP·유효 권한 공집합)는 여기가 아니라 로그인 후처리다</b>
 * (sys/user-role.md).
 */
public class AppUserDetails implements UserDetails, Serializable {

    @Serial private static final long serialVersionUID = 1L;

    private final String userId;
    private final String userNm;
    private final String localeCd;
    private final String password;
    private final boolean enabled;
    private final boolean accountNonExpired;
    private final boolean accountNonLocked;
    private final boolean credentialsNonExpired;

    private AppUserDetails(
            String userId,
            String userNm,
            String localeCd,
            String password,
            boolean enabled,
            boolean accountNonExpired,
            boolean accountNonLocked,
            boolean credentialsNonExpired) {
        this.userId = userId;
        this.userNm = userNm;
        this.localeCd = localeCd;
        this.password = password;
        this.enabled = enabled;
        this.accountNonExpired = accountNonExpired;
        this.accountNonLocked = accountNonLocked;
        this.credentialsNonExpired = credentialsNonExpired;
    }

    static AppUserDetails of(
            SysUser user,
            Instant now,
            java.time.LocalDate businessToday,
            int lockReleaseMinutes,
            int passwordExpireDays) {
        return new AppUserDetails(
                user.getUserId(),
                user.getUserNm(),
                user.getLocaleCd(),
                user.getPwd(),
                Boolean.TRUE.equals(user.getUseYn()),
                user.isWithinValidPeriod(businessToday),
                !user.isLocked(now, lockReleaseMinutes),
                !user.mustChangePassword(now, passwordExpireDays));
    }

    /**
     * 언어만 갈아 끼운 사본 — frontend/tabs.md 의 언어 변경이 세션 주체를 바꿔야 한다.
     *
     * <p><b>DB 만 고치면 서버 에러 문구가 옛 언어로 나간다.</b> {@code RequestLocale} 이
     * 읽는 것은 이 주체이지 DB 가 아니며(요청마다 조회하지 않는 것이 그 설계다), 그러면
     * <i>화면은 새 언어인데 실패 문구만 옛 언어</i> 가 된다 — 메시지 슬라이스가 잡은 것과
     * <b>같은 종류의 어긋남</b>이 반대 방향에서 다시 생긴다.
     *
     * <p>필드를 늘리는 것이 아니라 <b>같은 모양의 새 인스턴스</b>이므로 직렬화 호환은 그대로다.
     */
    public AppUserDetails withLocale(String newLocaleCd) {
        return new AppUserDetails(
                userId,
                userNm,
                newLocaleCd,
                password,
                enabled,
                accountNonExpired,
                accountNonLocked,
                credentialsNonExpired);
    }

    /**
     * 이름만 갈아 끼운 사본 — USER-05 · frontend/tabs.md 의 내 정보 저장이 세션 주체를 바꿔야 한다.
     *
     * <p><b>{@code auth/me} 가 읽는 것이 이 주체다.</b> DB 만 고치면 새로고침 전까지 헤더가
     * 옛 이름을 보이고, 새로고침해도 <b>세션이 살아 있는 동안은 계속 옛 이름</b>이다 —
     * {@link #withLocale} 이 잡은 것과 같은 어긋남이다.
     */
    public AppUserDetails withUserNm(String newUserNm) {
        return new AppUserDetails(
                userId,
                newUserNm,
                localeCd,
                password,
                enabled,
                accountNonExpired,
                accountNonLocked,
                credentialsNonExpired);
    }

    public String userId() {
        return userId;
    }

    public String userNm() {
        return userNm;
    }

    public String localeCd() {
        return localeCd;
    }

    /**
     * <b>비어 있는 것이 지금의 사실이다.</b> 유효 권한은 (메뉴, 액션) 집합이며 역할·메뉴
     * 테이블(42)이 아직 없다. 인가 슬라이스가 세션에 적재한다(backend/security.md 권한 캐싱).
     *
     * <p>{@code hasRole} 류로 판정하지 않는 것도 결정이다 — 판정은 인가 인터셉터 한 곳이다.
     */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of();
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return userId;
    }

    @Override
    public boolean isAccountNonExpired() {
        return accountNonExpired;
    }

    @Override
    public boolean isAccountNonLocked() {
        return accountNonLocked;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return credentialsNonExpired;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }
}
