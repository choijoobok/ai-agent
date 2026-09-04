package com.ordinary.backoffice.domain.user.service;

import com.ordinary.backoffice.domain.user.entity.SysUserPwdReset;
import com.ordinary.backoffice.domain.user.repository.SysUserPwdResetRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 틀린 횟수를 <b>거절하면서도 남긴다</b> — AUTH-07 · login 요건서 §6-1.
 *
 * <h2>이 클래스가 없으면 시도 한도가 아무것도 막지 않는다</h2>
 *
 * <p>거절은 예외이고 예외는 롤백이다. 세는 일을 거절하는 트랜잭션 안에서 하면 <b>올린
 * 숫자가 그 롤백에 함께 지워진다</b> — 검사는 통과하고, 테스트도 통과하고(엔티티는
 * 메모리에서 올라가 있다), <b>실물에서만 5회 한도가 무한이 된다</b>. 실제로 그렇게 났고
 * (2026-09-04) 브라우저에서 여섯 번을 틀려도 계속 <i>인증번호가 올바르지 않습니다</i> 가
 * 나왔다.
 *
 * <p>그래서 {@link Propagation#REQUIRES_NEW} 다. 바깥이 롤백되어도 이 트랜잭션은 이미
 * 커밋됐다.
 *
 * <p><b>{@code LoginService} 가 같은 함정을 다른 모양으로 피한다</b> —
 * {@code recordLoginFailure} 를 <b>트랜잭션이 없는</b> 흐름에서 부르고 그 뒤에 던진다.
 * 여기서 그 모양을 그대로 쓸 수 없는 것은 ③ 완료가 <b>한 트랜잭션이어야 하기</b> 때문이다
 * (요건서 §6-2) — 그 안에서도 세어야 하므로 <i>바깥이 없을 때</i> 가 아니라 <b>바깥과
 * 무관하게</b> 커밋해야 한다.
 *
 * <p><b>별도 빈인 것도 그래서다.</b> 자기 자신을 부르면 프록시를 지나지 않아 애너테이션이
 * 아무 일도 하지 않는다 — 그 실패는 조용하다.
 */
@Component
public class PasswordResetAttempts {

    private final SysUserPwdResetRepository resets;

    public PasswordResetAttempts(SysUserPwdResetRepository resets) {
        this.resets = resets;
    }

    /**
     * @return 이 실패까지 포함한 누적 시도 횟수. 행이 사라졌으면 {@link Integer#MAX_VALUE} 다 —
     *     셀 것이 없으면 <b>더 시도할 수도 없는</b> 것이므로 한도를 넘긴 것과 같게 다룬다
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int recordFailure(String userId) {
        SysUserPwdReset token = resets.findById(userId).orElse(null);
        if (token == null) {
            return Integer.MAX_VALUE;
        }
        token.recordFailure();
        return token.getTryCnt();
    }
}
