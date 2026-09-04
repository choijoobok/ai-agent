package com.aiagent.domain.user.service;

import com.aiagent.domain.user.entity.SysUser;
import com.aiagent.domain.user.entity.SysUserPwdHist;
import com.aiagent.domain.user.repository.SysUserPwdHistRepository;
import org.springframework.data.domain.Limit;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * {@code SYS_USER_PWD_HIST} 를 다루는 규칙 하나 — 41 §5.
 *
 * <p><b>비밀번호가 바뀌는 경로가 둘이 되면서 떼어 냈다</b>(2026-08-30). 본인 변경
 * ({@link PasswordChangeService} — AUTH-05)과 <b>관리자 발급</b>({@code UserService} —
 * AUTH-07)이 같은 이력에 같은 방식으로 쌓여야 한다: 한쪽이 이력을 남기지 않으면
 * <b>발급받은 값을 그대로 다시 쓰는</b> 경로가 열리고, 재사용 금지가 우회된다.
 *
 * <p>{@link PasswordRules} 가 <i>형태</i> 규칙을 세 경로에서 공유하려고 순수 함수로 떨어져
 * 있는 것과 <b>같은 이유</b>다 — 다만 여기는 레포지토리를 쓰므로 빈이다.
 */
@Component
public class PasswordHistory {

    private final SysUserPwdHistRepository histories;
    private final PasswordEncoder encoder;

    public PasswordHistory(SysUserPwdHistRepository histories, PasswordEncoder encoder) {
        this.histories = histories;
        this.encoder = encoder;
    }

    /**
     * 최근 N건과 대조한다 — 41 §5.
     *
     * <p><b>해시라 SQL 로 비교할 수 없다.</b> BCrypt 는 솔트가 행마다 달라 같은 평문이라도
     * 다른 문자열이 되므로, 후보를 읽어 와 {@code matches} 를 N 번 부르는 것이 유일한
     * 방법이다 — 그것이 보관 건수를 정책으로 묶어 둔 이유이기도 하다.
     */
    public boolean isReused(String userId, String rawPwd, int reuseBlockCount) {
        if (reuseBlockCount <= 0) {
            return false;
        }
        return histories
                .findByUserIdOrderByChgSeqDesc(userId, Limit.of(reuseBlockCount))
                .stream()
                .anyMatch(past -> encoder.matches(rawPwd, past.getPwd()));
    }

    /**
     * <b>지금 값</b>을 이력으로 옮기고 넘치는 것을 지운다.
     *
     * <p>새 값이 아니라 옛 값을 넣는 것이 맞다 — 이력은 <i>"이 계정이 무엇을 썼었는가"</i>
     * 이며, 새 값은 {@code SYS_USER.PWD} 가 갖는다. 둘 다 넣으면 같은 해시가 두 곳에 있고
     * 재사용 판정이 <b>방금 정한 비밀번호</b>를 거절한다.
     *
     * <p><b>부르는 쪽이 값을 바꾸기 전에 부른다.</b> 뒤에 부르면 옮겨지는 것이 새 값이다.
     */
    public void archive(SysUser user, int reuseBlockCount) {
        int seq = histories.findLastSeq(user.getUserId()) + 1;
        histories.save(SysUserPwdHist.builder()
                .userId(user.getUserId())
                .chgSeq(seq)
                .pwd(user.getPwd())
                .build());

        if (reuseBlockCount > 0) {
            // 방금 넣은 것을 포함해 N 건만 남긴다. 0 이면 비교하지 않으므로 지우지도
            // 않는다 — 그 설정에서 이력은 감사 기록으로만 남는다.
            histories.deleteUpTo(user.getUserId(), seq - reuseBlockCount);
        }
    }
}
