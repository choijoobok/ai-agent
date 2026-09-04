package com.aiagent.domain.user.service;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.message.MsgFormat;
import com.aiagent.core.message.MsgKey;
import com.aiagent.domain.message.service.MessageService;
import com.aiagent.domain.user.entity.SysUser;
import com.aiagent.domain.user.entity.SysUserPwdReset;
import com.aiagent.domain.user.repository.SysUserPwdResetRepository;
import com.aiagent.domain.user.repository.SysUserRepository;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.AuthPasswordProps;
import com.aiagent.support.time.BusinessCalendar;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 분실 비밀번호 자기 재설정 — AUTH-07 · {@code documents/screen/_standalone/login/requirements.md} §6-3.
 *
 * <h2>응답이 언제나 같다 — 그것이 이 클래스 모양의 대부분을 정한다</h2>
 *
 * <p>{@link #issue} 는 <b>던지지 않는다</b>. 계정이 없어도, 메일 주소가 비어 있어도, 쿨다운
 * 중이어도 조용히 빈 값을 돌려주고 부르는 쪽은 같은 응답을 낸다 — 갈리는 순간 <b>로그인
 * 화면을 지나지 않고도 계정 목록을 만들 수 있다</b>(요건서 §6-3).
 *
 * <p>그래서 <b>쿨다운도 서버가 말하지 않는다</b>. 남은 초를 응답에 담으면 <i>존재하는
 * 계정에만 쿨다운이 걸린다</i> 는 사실이 열거 단서가 된다 — 타이머는 화면이 그린다.
 *
 * <h2>잠금은 ③에서만 풀린다</h2>
 *
 * <p>{@link #issue} 는 {@code LOCK_YN} 을 건드리지 않는다. 발송만으로 풀리면
 * <i>실패 5회 → 요청 → 리셋 → 다시 5회</i> 가 무한히 반복되고, 그러면 잠금이 아무것도 막지
 * 못한다({@code SysUser.resetPasswordByAdmin} 이 같은 판단을 한다).
 *
 * <h2>비밀번호 규칙은 {@link PasswordChangeService} 와 하나다</h2>
 *
 * <p>{@link PasswordRules} · {@link PasswordHistory} 를 같이 쓴다 — 화면이 셋이지만 규칙은
 * 하나다. 여기에만 있는 검사를 더하면 <b>같은 값이 한 화면에서는 되고 다른 화면에서는
 * 안 되는</b> 상태가 만들어진다.
 */
@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    /**
     * 인증번호는 <b>6자리</b>이며 앞자리 0 을 그대로 쓴다.
     *
     * <p><b>설정 키를 두지 않는다.</b> 100만 조합을 쓸 만하게 만드는 것은 자릿수가 아니라
     * 만료(10분)와 시도 한도(5회)이며 그 둘은 이미 설정이다({@code AuthPasswordProps.Reset}).
     * 자릿수를 열어 두면 4자리로 줄인 배포가 생기고, 그 배포에서는 5회 안에 맞을 확률이
     * 눈에 띄게 오른다.
     */
    private static final String CODE_FORMAT = "%06d";

    private static final int CODE_BOUND = 1_000_000;

    private static final SecureRandom RANDOM = new SecureRandom();

    private final SysUserRepository users;
    private final SysUserPwdResetRepository resets;
    private final PasswordHistory history;
    private final PasswordResetAttempts attempts;
    private final PasswordEncoder encoder;
    private final MessageService messages;
    private final ConfigLookup configs;
    private final BusinessCalendar calendar;

    public PasswordResetService(
            SysUserRepository users,
            SysUserPwdResetRepository resets,
            PasswordHistory history,
            PasswordResetAttempts attempts,
            PasswordEncoder encoder,
            MessageService messages,
            ConfigLookup configs,
            BusinessCalendar calendar) {
        this.users = users;
        this.resets = resets;
        this.history = history;
        this.attempts = attempts;
        this.encoder = encoder;
        this.messages = messages;
        this.configs = configs;
        this.calendar = calendar;
    }

    /**
     * ① 요청 — 토큰을 발급하고 <b>보낼 메일을 조립해 돌려준다</b>.
     *
     * <p><b>발송은 여기서 하지 않는다.</b> 이 메서드가 트랜잭션이고 SMTP 왕복을 그 안에 두면
     * 메일 서버가 응답하지 않는 동안 <b>DB 커넥션이 붙잡힌다</b> — 인증 없이 누구나 부를 수
     * 있는 경로라 그것이 곧 고갈 경로가 된다. 발송은 커밋 뒤 부르는 쪽이 한다.
     *
     * <p><b>발송이 실패해도 토큰은 남는다</b>(요건서 §6-3). 지우면 재발송 쿨다운이
     * 무의미해지고, 메일이 늦게 도착하는 흔한 경우에 이미 유효한 코드가 사라진다.
     *
     * @return 보낼 것이 있으면 그것. <b>비어 있는 이유를 말하지 않는다</b> — 계정이 없는
     *     것과 쿨다운 중인 것이 부르는 쪽에서 구분되지 않아야 한다
     */
    @Transactional
    public Optional<ResetMail> issue(String loginId) {
        AuthPasswordProps.Reset policy = configs.get(AuthPasswordProps.class).reset();
        Instant now = calendar.now();

        SysUser user = users.findById(loginId).orElse(null);
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            // 로그는 남긴다 — 문의가 왔을 때 "메일 주소가 없다" 를 확인할 유일한 자리다.
            log.info("password reset requested for an unusable account loginId={}", loginId);
            return Optional.empty();
        }

        SysUserPwdReset token = resets.findById(loginId).orElse(null);
        if (token != null && token.isWithinCooldown(now, policy.requestCooldownSeconds())) {
            log.debug("password reset re-requested within cooldown loginId={}", loginId);
            return Optional.empty();
        }

        String code = generateCode();
        Instant expireDtm = now.plus(Duration.ofMinutes(policy.tokenValidMinutes()));
        if (token == null) {
            resets.save(SysUserPwdReset.builder()
                    .userId(user.getUserId())
                    .tokenHash(encoder.encode(code))
                    .issueDtm(now)
                    .expireDtm(expireDtm)
                    .build());
        } else {
            token.reissue(encoder.encode(code), now, expireDtm);
        }

        return Optional.of(compose(user, code, policy.tokenValidMinutes()));
    }

    /**
     * ② 검증 — 틀린 횟수를 세는 것 말고는 <b>아무것도 바꾸지 않는다</b>.
     *
     * <p>여기서 <i>확인됨</i> 상태를 서버에 남기지 않는 것이 요점이다. 남기면 그 상태의
     * 수명과 무효화를 또 정해야 하고, 그것은 토큰을 하나 더 만드는 일이다 — ③이 같은 코드를
     * 다시 내면 그 전부가 필요 없다.
     */
    @Transactional
    public void verify(String loginId, String resetCode) {
        consume(loginId, resetCode);
    }

    /**
     * ③ 완료 — <b>한 트랜잭션</b>이다(요건서 §6-2).
     *
     * <p>비밀번호 · 이력 · 잠금 해제 · 토큰 사용 표시가 함께 커밋되거나 함께 없던 일이 된다.
     * 나누면 <i>비밀번호는 바뀌었는데 계정은 잠긴 채</i> 가 실재하게 되고, 그 사용자는
     * 맞는 비밀번호로 로그인하다 잠김 안내를 본다.
     *
     * <p><b>{@code DORMANT_YN} 은 여기서 풀리지 않는다.</b> 휴면 해제는 로그인 후처리 체인이
     * 판정하는 별개의 축이며(41 §4.2), 재설정을 마친 사용자는 다음 로그인에서 그 경로를
     * 정상적으로 지난다.
     */
    @Transactional
    public void complete(String loginId, String resetCode, String newPwd) {
        SysUserPwdReset token = consume(loginId, resetCode);

        SysUser user = users.findById(loginId)
                // 토큰이 있으면 계정도 있다(FK). 여기 오는 것은 같은 순간의 계정 삭제뿐이다.
                .orElseThrow(() -> new BusinessException(PasswordResetErrorCode.CODE_EXPIRED));

        AuthPasswordProps policy = configs.get(AuthPasswordProps.class);
        if (encoder.matches(newPwd, user.getPwd())) {
            throw new BusinessException(UserErrorCode.PWD_UNCHANGED);
        }
        if (!PasswordRules.satisfies(newPwd, policy.minLength(), policy.requireCharsetKinds())) {
            throw new BusinessException(
                    UserErrorCode.PWD_WEAK,
                    "password policy not satisfied — min %d chars, %d charset kinds"
                            .formatted(policy.minLength(), policy.requireCharsetKinds()));
        }
        if (history.isReused(loginId, newPwd, policy.reuseBlockCount())) {
            throw new BusinessException(UserErrorCode.PWD_REUSED);
        }

        history.archive(user, policy.reuseBlockCount());
        user.changePassword(encoder.encode(newPwd), calendar.now());
        // 잠금은 여기서만 풀린다(요건서 §6-3). unlock() 이 LOGIN_FAIL_CNT 도 0 으로 되돌리며,
        // 그러지 않으면 다음 한 번의 실패로 곧바로 다시 잠긴다.
        user.unlock();
        token.markUsed();
    }

    // ── 내부 ────────────────────────────────────────────────────────────

    /**
     * 토큰을 꺼내 대조한다 — ②와 ③이 <b>같은 판정</b>을 쓴다.
     *
     * <p>갈라 두면 ②를 통과한 코드가 ③에서 거부되는 조합이 언젠가 생기고, 그때 사용자는
     * <b>맞는 코드를 들고 막힌다</b>.
     *
     * <p><b>틀리면 세고, 한도에 닿으면 그 자체로 만료다.</b> 행을 지우지 않는 것은
     * {@code ISSUE_DTM} 이 남아 있어야 재요청이 쿨다운을 지나기 때문이다.
     */
    private SysUserPwdReset consume(String loginId, String resetCode) {
        AuthPasswordProps.Reset policy = configs.get(AuthPasswordProps.class).reset();
        Instant now = calendar.now();

        SysUserPwdReset token = resets.findById(loginId)
                .orElseThrow(() -> new BusinessException(PasswordResetErrorCode.CODE_EXPIRED));

        if (!token.isUsable(now, policy.tryLimit())) {
            throw new BusinessException(PasswordResetErrorCode.CODE_EXPIRED);
        }
        if (!encoder.matches(resetCode, token.getTokenHash())) {
            /*
              **세는 일을 여기서 직접 하면 안 된다** — 바로 아래에서 던지고, 던지면 롤백이라
              올린 숫자가 함께 지워진다. 그 실패는 조용하다: 검사도 테스트도 통과하고
              실물에서만 5회 한도가 무한이 된다(PasswordResetAttempts 의 그 문단).
            */
            int tried = attempts.recordFailure(loginId);
            /*
              한도에 닿은 순간을 갈라 말한다 — 화면이 ①로 되돌려야 하는 자리이기 때문이다
              (요건서 §6-5). 여기서도 *남은 횟수* 는 말하지 않는다: 사용자는 방금 틀렸다는
              것과 다시 받아야 한다는 것 둘만 알면 된다.
            */
            throw new BusinessException(
                    tried >= policy.tryLimit()
                            ? PasswordResetErrorCode.CODE_EXPIRED
                            : PasswordResetErrorCode.CODE_INVALID);
        }
        return token;
    }

    /**
     * 보낼 메일 — <b>수신자의 언어</b>로 짓는다({@code SYS_USER.LOCALE_CD}).
     *
     * <p>요청의 {@code Accept-Language} 가 아닌 것이 요점이다. 요청을 보낸 브라우저와 메일을
     * 읽는 사람이 같다는 보장이 없고, 무엇보다 <b>사용자가 고른 언어</b>가 그 계정의 것이다
     * (41 §4.3 이 {@code LOCALE_CD} 를 서버에 둔 이유가 정확히 이것이다).
     */
    private ResetMail compose(SysUser user, String code, int validMinutes) {
        String lang = user.getLocaleCd();
        return new ResetMail(
                user.getEmail(),
                messages.text(MsgKey.MAIL_PWD_RESET_SUBJECT, lang),
                MsgFormat.format(
                        messages.text(MsgKey.MAIL_PWD_RESET_BODY, lang),
                        Map.of("code", code, "minutes", validMinutes, "userNm", user.getUserNm())));
    }

    /**
     * 앞자리가 0 인 코드도 나온다 — <b>포맷으로 자릿수를 지킨다</b>.
     *
     * <p>숫자를 그냥 문자열로 바꾸면 {@code 012345} 가 {@code 12345} 가 되어 5자리가 되고,
     * 그러면 조합 수가 열 배 준다. 그 손실은 앞자리가 0 인 십분의 일에서만 일어나므로
     * 눈으로 보는 확인에서 잘 드러나지 않는다.
     */
    private static String generateCode() {
        return CODE_FORMAT.formatted(RANDOM.nextInt(CODE_BOUND));
    }

    /** 발송에 필요한 것 전부 — 부르는 쪽은 업무를 몰라도 이것만 넘기면 된다. */
    public record ResetMail(String to, String subject, String body) {}
}
