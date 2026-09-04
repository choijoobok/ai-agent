package com.aiagent.domain.user.entity;

import com.aiagent.core.domain.YnConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 분실 비밀번호 재설정 토큰 — AUTH-07 · {@code documents/screen/_standalone/login/requirements.md} §6-3.
 *
 * <p><b>사용자당 한 행이다.</b> 발급 이력이 아니라 <i>지금 유효한 토큰 하나</i> 를 담으므로
 * 재요청은 같은 행을 갈아 끼운다 — 그래서 시퀀스도 청소 배치도 없다.
 *
 * <p><b>감사 컬럼이 없다.</b> 기계가 쓰고 기계가 지우는 행이라 <i>"누가"</i> 가 존재하지
 * 않는다({@code BaseAuditEntity} 의 판단 그대로). 발급한 주체는 언제나 본인이며 그 사실은
 * {@code USER_ID} 가 이미 말한다.
 *
 * <p><b>상태를 여기서 판정한다.</b> 만료·사용·시도 한도는 세 컬럼의 조합이고, 그 조합을
 * 서비스가 조립하면 세 곳에서 조금씩 다른 판정이 생긴다 — {@link #isUsable} 하나가 그것을
 * 닫는다.
 */
@Entity
@Table(name = "SYS_USER_PWD_RESET")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysUserPwdReset {

    @Id
    @Column(name = "USER_ID", length = 30, nullable = false)
    private String userId;

    /** BCrypt 해시. 평문 6자리는 어디에도 남지 않는다 — 메일이 유일한 전달 경로다. */
    @Column(name = "TOKEN_HASH", length = 100, nullable = false)
    private String tokenHash;

    /** 재발송 쿨다운의 기준. 만료 시각에서 역산하면 정책을 바꾼 뒤 옛 행이 틀어진다. */
    @Column(name = "ISSUE_DTM", nullable = false)
    private Instant issueDtm;

    /**
     * 발급 시점의 정책으로 굳힌 만료 시각.
     *
     * <p>계산이 아니라 값인 것이 요건이다 — 운영이 10분을 30분으로 바꿔도 <b>이미 나간
     * 메일이 말한 시각</b>이 정답이다.
     */
    @Column(name = "EXPIRE_DTM", nullable = false)
    private Instant expireDtm;

    @Column(name = "TRY_CNT", nullable = false)
    private Integer tryCnt;

    /** 쓴 토큰을 지우지 않고 표시한다 — 지우면 <i>"쓴 적 없음"</i> 과 구분되지 않는다. */
    @Convert(converter = YnConverter.class)
    @Column(name = "USED_YN", length = 1, nullable = false)
    private Boolean usedYn;

    @Builder
    private SysUserPwdReset(String userId, String tokenHash, Instant issueDtm, Instant expireDtm) {
        this.userId = userId;
        this.tokenHash = tokenHash;
        this.issueDtm = issueDtm;
        this.expireDtm = expireDtm;
        this.tryCnt = 0;
        this.usedYn = false;
    }

    /**
     * 재발급 — <b>같은 행을 갈아 끼운다</b>. 시도 횟수와 사용 표시가 함께 초기화된다.
     *
     * <p>새 행을 만들지 않는 것이 표의 모양(사용자당 한 행)이고, 초기화하지 않으면
     * <b>방금 받은 코드가 옛 실패 횟수를 물려받아</b> 한두 번 만에 막힌다.
     */
    public void reissue(String tokenHash, Instant issueDtm, Instant expireDtm) {
        this.tokenHash = tokenHash;
        this.issueDtm = issueDtm;
        this.expireDtm = expireDtm;
        this.tryCnt = 0;
        this.usedYn = false;
    }

    /**
     * 쓸 수 있는 토큰인가 — <b>세 조건의 AND</b>. 어느 하나라도 어긋나면 같은 실패다.
     *
     * @param tryLimit 시도 허용 횟수 — {@code AuthPasswordProps.Reset.tryLimit}
     */
    public boolean isUsable(Instant now, int tryLimit) {
        return !Boolean.TRUE.equals(usedYn)
                && expireDtm.isAfter(now)
                && tryCnt < tryLimit;
    }

    /** 재발송을 아직 받아 주지 않는 구간인가 — 요건서 §6-1 의 쿨다운. */
    public boolean isWithinCooldown(Instant now, int cooldownSeconds) {
        return cooldownSeconds > 0
                && issueDtm.plus(Duration.ofSeconds(cooldownSeconds)).isAfter(now);
    }

    /** 코드가 틀렸다. 한도에 닿는 순간 {@link #isUsable} 이 거짓이 되며 화면은 ①로 돌아간다. */
    public void recordFailure() {
        this.tryCnt = this.tryCnt + 1;
    }

    /**
     * 비밀번호를 실제로 바꾼 뒤 표시한다.
     *
     * <p><b>지우지 않는다.</b> {@code ISSUE_DTM} 이 남아 있어야 다음 요청이 쿨다운을 지나며,
     * 지우면 <i>바꾸자마자 다시 요청</i> 이 제한 없이 성립한다.
     */
    public void markUsed() {
        this.usedYn = true;
    }
}
