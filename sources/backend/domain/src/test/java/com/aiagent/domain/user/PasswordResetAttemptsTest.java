package com.aiagent.domain.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.aiagent.domain.user.entity.SysUserPwdReset;
import com.aiagent.domain.user.repository.SysUserPwdResetRepository;
import com.aiagent.domain.user.service.PasswordResetAttempts;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 틀린 횟수가 <b>거절의 롤백에서 살아남는가</b> — AUTH-07.
 *
 * <p>이 클래스가 재는 것 중 하나는 <b>애너테이션</b>이다. 보통은 그것을 검사하지 않지만
 * 여기서는 전파 속성이 곧 기능이며, 잃으면 <b>시도 한도가 조용히 무한이 된다</b> — 검사도
 * 단위 테스트도 통과하고 실물에서만 드러난다(2026-09-04 에 실제로 그랬다).
 */
@ExtendWith(MockitoExtension.class)
class PasswordResetAttemptsTest {

    private static final String USER = "kim";
    private static final Instant NOW = Instant.parse("2026-09-04T01:00:00Z");

    @Mock private SysUserPwdResetRepository resets;

    @Test
    @DisplayName("REQUIRES_NEW 다 — 바깥이 롤백돼도 이 커밋은 남아야 한다")
    void requiresNewTransaction() throws NoSuchMethodException {
        Transactional annotation = PasswordResetAttempts.class
                .getMethod("recordFailure", String.class)
                .getAnnotation(Transactional.class);

        assertThat(annotation).isNotNull();
        assertThat(annotation.propagation()).isEqualTo(Propagation.REQUIRES_NEW);
    }

    @Test
    @DisplayName("누적 횟수를 돌려준다 — 부르는 쪽이 한도와 비교한다")
    void returnsAccumulatedCount() {
        SysUserPwdReset token = token();
        token.recordFailure();
        when(resets.findById(USER)).thenReturn(Optional.of(token));

        assertThat(new PasswordResetAttempts(resets).recordFailure(USER)).isEqualTo(2);
    }

    @Test
    @DisplayName("행이 없으면 한도를 넘긴 것과 같다 — 셀 것이 없으면 더 시도할 수도 없다")
    void missingRowIsBeyondLimit() {
        when(resets.findById(USER)).thenReturn(Optional.empty());

        assertThat(new PasswordResetAttempts(resets).recordFailure(USER))
                .isEqualTo(Integer.MAX_VALUE);
    }

    private static SysUserPwdReset token() {
        return SysUserPwdReset.builder()
                .userId(USER)
                .tokenHash("enc:123456")
                .issueDtm(NOW)
                .expireDtm(NOW.plus(Duration.ofMinutes(10)))
                .build();
    }
}
