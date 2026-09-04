package com.ordinary.backoffice.domain.user.service;

import com.ordinary.backoffice.domain.user.entity.SysUser;
import com.ordinary.backoffice.domain.user.repository.SysUserRepository;
import com.ordinary.backoffice.support.config.ConfigLookup;
import com.ordinary.backoffice.support.config.props.AuthLoginProps;
import com.ordinary.backoffice.support.time.BusinessCalendar;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 계정 상태 전이 — security-design.md §4 잠금 전이 표. 전이 하나가 메서드 하나다. */
@Service
@Transactional(readOnly = true)
public class UserAccountService {

    private final SysUserRepository userRepository;
    private final ConfigLookup configs;
    private final BusinessCalendar calendar;

    public UserAccountService(
            SysUserRepository userRepository, ConfigLookup configs, BusinessCalendar calendar) {
        this.userRepository = userRepository;
        this.configs = configs;
        this.calendar = calendar;
    }

    public Optional<SysUser> find(String userId) {
        return userRepository.findById(userId);
    }

    /**
     * 비밀번호 불일치. 임계값에 닿으면 잠근다.
     *
     * <p>없는 ID 로는 부를 일이 없다 — 계정이 있어야 비밀번호를 틀릴 수 있다. 그래도
     * 조용히 넘긴다: 조회와 전이 사이에 계정이 지워질 수 있고, 그 경합으로 로그인 응답이
     * 500 이 되면 <b>계정 존재 여부를 알려주는 단서</b>가 된다.
     */
    @Transactional
    public void recordLoginFailure(String userId) {
        userRepository
                .findById(userId)
                .ifPresent(user -> user.recordLoginFailure(
                        calendar.now(), configs.get(AuthLoginProps.class).failLimit()));
    }

    /** 로그인 성공. 실패 횟수와 경과분 잠금만 정리하고 나머지 셋은 건드리지 않는다(41 §4.2 규칙 3). */
    @Transactional
    public void recordLoginSuccess(String userId) {
        userRepository.findById(userId).ifPresent(user -> user.recordLoginSuccess(calendar.now()));
    }
}
