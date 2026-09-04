package com.aiagent.domain.user.service;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.domain.user.MyProfile;
import com.aiagent.domain.user.PasswordRule;
import com.aiagent.domain.user.entity.SysUser;
import com.aiagent.domain.user.repository.SysUserRepository;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.AuthPasswordProps;
import com.aiagent.support.time.BusinessCalendar;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 내 프로필 — USER-05 · frontend/tabs.md 의 <b>내 정보</b> 탭.
 *
 * <p><b>대상은 언제나 세션의 주인이다.</b> {@code userId} 를 인자로 받되 그것은 컨트롤러가
 * {@code Principal} 에서 꺼낸 값이며 요청 본문에서 오지 않는다 — 본문에 두는 순간
 * <i>"누구 것을 바꾸는가"</i> 가 클라이언트가 보낸 값이 되고, 그것을 막는 판정을 이 아래
 * 모든 자리가 한 번씩 해야 한다({@link UserPreferenceService} 와 같은 이유다).
 *
 * <p>{@link PasswordChangeService} 와 가른 이유는 그쪽이 <b>이력을 쌓고 정책을 집행</b>하기
 * 때문이다. 여기는 두 컬럼을 고치는 일이고, 저쪽은 실패 갈래가 넷이다.
 */
@Service
@Transactional(readOnly = true)
public class UserProfileService {

    private final SysUserRepository users;
    private final ConfigLookup configs;
    private final BusinessCalendar calendar;

    public UserProfileService(
            SysUserRepository users, ConfigLookup configs, BusinessCalendar calendar) {
        this.users = users;
        this.configs = configs;
        this.calendar = calendar;
    }

    /**
     * 정책까지 함께 내린다 — frontend/tabs.md. 모달을 여는 데 왕복이 하나여야 한다.
     *
     * @throws BusinessException 세션은 살아 있는데 계정이 사라졌을 때
     */
    public MyProfile getMyProfile(String userId) {
        SysUser user = require(userId);
        AuthPasswordProps policy = configs.get(AuthPasswordProps.class);

        return new MyProfile(
                user.getUserId(),
                user.getUserNm(),
                user.getEmail(),
                user.getLocaleCd(),
                user.getValidFromDt(),
                user.getValidToDt(),
                user.getLastLoginDtm(),
                user.getPwdChgDtm(),
                Boolean.TRUE.equals(user.getPwdInitYn()),
                expiresInDays(user, policy.expireDays()),
                new PasswordRule(
                        policy.minLength(),
                        policy.requireCharsetKinds(),
                        policy.reuseBlockCount(),
                        policy.expireDays()));
    }

    /**
     * 이름과 메일 — frontend/tabs.md. <b>이 둘이 표면의 전부다</b>({@link SysUser#changeProfile}).
     *
     * @throws BusinessException 계정이 사라졌을 때
     */
    @Transactional
    public void saveMyProfile(String userId, String userNm, String email) {
        // 빈 문자열은 값이 아니다. NOT NULL 인 USER_NM 은 검증이 막지만, EMAIL 은 지울 수
        // 있어야 하며 그 표현은 NULL 이다 — "" 를 넣으면 인덱스에 빈 문자열이 쌓인다.
        require(userId).changeProfile(userNm.trim(), blankToNull(email));
    }

    private SysUser require(String userId) {
        return users.findById(userId)
                // 세션은 살아 있는데 계정이 사라졌다 — 세션을 믿지 않는다.
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHENTICATED));
    }

    private static String blankToNull(String email) {
        if (email == null) {
            return null;
        }
        String trimmed = email.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /**
     * 만료까지 남은 날 — 음수면 이미 지났다.
     *
     * <p><b>{@code null} 이 둘을 겸한다</b> — 주기 만료를 쓰지 않는 설정이거나, 한 번도
     * 바꾼 적이 없어 기준 시각이 없는 경우다. 둘 다 화면에 <i>보여줄 것이 없다</i> 로
     * 같으므로 갈라 두지 않는다.
     */
    private Integer expiresInDays(SysUser user, int expireDays) {
        if (expireDays <= 0 || user.getPwdChgDtm() == null) {
            return null;
        }
        Instant deadline = user.getPwdChgDtm().plus(Duration.ofDays(expireDays));
        return (int) Duration.between(calendar.now(), deadline).toDays();
    }
}
