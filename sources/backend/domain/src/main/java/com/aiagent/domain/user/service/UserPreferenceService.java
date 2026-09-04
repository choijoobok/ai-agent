package com.aiagent.domain.user.service;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.domain.user.entity.SysUser;
import com.aiagent.domain.user.repository.SysUserRepository;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.MessageProps;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사용자가 자기 것으로 바꾸는 설정 — frontend/tabs.md.
 *
 * <p><b>여기 있는 것은 언어 하나다.</b> frontend/tabs.md 의 나머지(테마·폰트·그리드 높이)는 전부
 * {@code localStorage} 이며 <b>기기·화면의 속성</b>이라 계정에 묶지 않는다(sys/user-role.md) —
 * PC 마다 해상도가 달라 다른 자리에서 로그인할 때마다 어긋난다.
 *
 * <p>{@link UserAccountService} 와 가른 이유는 그쪽이 <b>계정 상태 전이</b>(잠금·실패
 * 횟수·휴면)이기 때문이다. 언어는 상태가 아니라 취향이며, 부르는 주체도 다르다 — 저쪽은
 * 로그인 흐름이고 여기는 <b>사용자 자신</b>이다.
 */
@Service
public class UserPreferenceService {

    private final SysUserRepository users;
    private final ConfigLookup configs;

    public UserPreferenceService(SysUserRepository users, ConfigLookup configs) {
        this.users = users;
        this.configs = configs;
    }

    /**
     * @throws BusinessException 지원하지 않는 언어이거나 계정이 사라졌을 때
     */
    @Transactional
    public void changeLocale(String userId, String localeCd) {
        MessageProps props = configs.get(MessageProps.class);
        if (!props.supported().contains(localeCd)) {
            // 화면은 지원 언어만 보여주지만 최종 판정은 서버다(frontend/grid.md). 여기서 막지 않으면
            // 그 사용자는 다음 로그인부터 **번들이 없는 언어**를 받는다.
            throw new BusinessException(
                    UserErrorCode.LOCALE_UNSUPPORTED, "지원하지 않는 언어 — " + localeCd);
        }
        SysUser user = users.findById(userId)
                // 세션은 살아 있는데 계정이 사라졌다 — 세션을 믿지 않는다.
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHENTICATED));
        user.changeLocale(localeCd);
    }
}
