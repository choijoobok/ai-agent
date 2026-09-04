package com.aiagent.domain.user.service;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.domain.user.entity.SysUser;
import com.aiagent.domain.user.repository.SysUserRepository;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.AuthPasswordProps;
import com.aiagent.support.time.BusinessCalendar;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 본인 비밀번호 변경 — AUTH-05 · main-shell.md §8 의 <b>비밀번호 변경</b> 탭.
 *
 * <p><b>실패 갈래가 넷이고 서로 갈라 둔다</b>(security-design.md §4) — 현재 비밀번호 불일치 · 정책 미달 ·
 * 재사용 · 무변경. 합치면 사용자는 <i>무엇을 고쳐야 하는지</i> 를 모른다. 계정 열거 위험이
 * 없는 자리라 갈라도 된다: <b>이미 로그인한 본인</b>이며 계정의 존재는 이미 알려져 있다.
 *
 * <p><b>로그인 실패 횟수를 올리지 않는다.</b> 현재 비밀번호를 틀리는 것은 로그인 시도가
 * 아니며, 여기서 세면 <b>자기 비밀번호를 바꾸려다 계정이 잠긴다</b>.
 *
 * <p><b>제한 세션에서도 열려 있어야 한다.</b> 체인 #5 는 차단이 아니라 유도이므로
 * ({@code AuthorizationInterceptor.RESTRICTED_SESSION_ALLOWED}) 이 경로가 막히면 비밀번호가
 * 만료된 사용자는 아무것도 할 수 없는 막다른 세션에 갇힌다.
 */
@Service
public class PasswordChangeService {

    private final SysUserRepository users;
    private final PasswordHistory history;
    private final PasswordEncoder encoder;
    private final ConfigLookup configs;
    private final BusinessCalendar calendar;

    public PasswordChangeService(
            SysUserRepository users,
            PasswordHistory history,
            PasswordEncoder encoder,
            ConfigLookup configs,
            BusinessCalendar calendar) {
        this.users = users;
        this.history = history;
        this.encoder = encoder;
        this.configs = configs;
        this.calendar = calendar;
    }

    /**
     * 순서가 요건이다 — <b>현재 확인이 가장 먼저</b>다. 정책 검사를 앞에 두면 현재
     * 비밀번호를 모르는 사람도 <i>정책이 무엇인지</i> 를 응답으로 떠볼 수 있다.
     *
     * @throws BusinessException 네 갈래 중 하나 — {@link UserErrorCode}
     */
    @Transactional
    public void changePassword(String userId, String currentPwd, String newPwd) {
        SysUser user = users.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHENTICATED));

        if (!encoder.matches(currentPwd, user.getPwd())) {
            throw new BusinessException(UserErrorCode.PWD_MISMATCH);
        }
        if (encoder.matches(newPwd, user.getPwd())) {
            // 이력에는 아직 없다 — 현재 값은 이 변경으로 비로소 이력이 된다.
            throw new BusinessException(UserErrorCode.PWD_UNCHANGED);
        }

        AuthPasswordProps policy = configs.get(AuthPasswordProps.class);
        if (!PasswordRules.satisfies(
                newPwd, policy.minLength(), policy.requireCharsetKinds())) {
            throw new BusinessException(
                    UserErrorCode.PWD_WEAK,
                    "비밀번호 정책 미달 — 최소 %d자 · %d종"
                            .formatted(policy.minLength(), policy.requireCharsetKinds()));
        }
        if (history.isReused(userId, newPwd, policy.reuseBlockCount())) {
            throw new BusinessException(UserErrorCode.PWD_REUSED);
        }

        /*
          이력을 옮기는 것도 재사용 판정도 <b>{@link PasswordHistory} 하나</b>가 한다
          (2026-08-30). 관리자 발급(AUTH-07)이 같은 이력에 쌓여야 하기 때문이며, 한쪽만
          남기면 <b>발급받은 값을 그대로 다시 쓰는</b> 경로가 열린다.
        */
        history.archive(user, policy.reuseBlockCount());
        user.changePassword(encoder.encode(newPwd), calendar.now());
    }

}
