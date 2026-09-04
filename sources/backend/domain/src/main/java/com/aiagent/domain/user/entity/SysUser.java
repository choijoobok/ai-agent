package com.aiagent.domain.user.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import com.aiagent.core.domain.YnConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 사용자 계정 — sys/user-role.md.
 *
 * <p><b>PK 는 자연키다</b>(sys/user-role.md). 로그인 ID 는 업무에서 부여되고 사실상 불변이며, 이력
 * 테이블이 이미 {@code USER_ID} 를 <b>값으로</b> 보관한다 — 대리키를 두면 이력에 숫자를
 * 남기고 조회할 때마다 조인해야 한다.
 *
 * <p><b>이름·이메일을 암호화하지 않는다</b>(sys/user-role.md). 사내 직원 명부이고, 참조키를 담으면
 * 이름 정렬·LIKE 검색이 불가능해져 사용자 목록의 가장 흔한 요구가 막힌다.
 *
 * <p><b>계정을 못 쓰게 만드는 것이 넷이고 축이 다르다</b>(sys/user-role.md) — {@code USE_YN}(관리자),
 * 기간 만료(예정된 것), {@code LOCK_YN}(시스템·일시적), {@code DORMANT_YN}(배치). 서로 덮지
 * 않는다. 그래서 아래 메서드들이 각각 하나만 건드린다.
 */
@Entity
@Table(name = "SYS_USER")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysUser extends BaseAuditEntity {

    @Id
    @Column(name = "USER_ID", length = 30, nullable = false)
    private String userId;

    @Column(name = "USER_NM", length = 100, nullable = false)
    private String userNm;

    @Column(name = "EMAIL", length = 255)
    private String email;

    /** BCrypt 해시. {@code DelegatingPasswordEncoder} 접두({@code {bcrypt}})를 포함한다 — backend/security.md. */
    @Column(name = "PWD", length = 100, nullable = false)
    private String pwd;

    /** 체인 #2 {@code isEnabled()}. <b>관리자만</b> 내리고 관리자만 올린다. */
    @Convert(converter = YnConverter.class)
    @Column(name = "USE_YN", length = 1, nullable = false)
    private Boolean useYn;

    /** 사용 기간 시작. 체인 #3. 업무 시간대 기준·<b>양끝 포함</b> — sys/INDEX.md. */
    @Column(name = "VALID_FROM_DT")
    private LocalDate validFromDt;

    @Column(name = "VALID_TO_DT")
    private LocalDate validToDt;

    /** 체인 #4. <b>원시 데이터</b>이며 플래그는 {@link #isLocked} 가 파생시킨다. */
    @Convert(converter = YnConverter.class)
    @Column(name = "LOCK_YN", length = 1, nullable = false)
    private Boolean lockYn;

    @Column(name = "LOCK_DTM")
    private Instant lockDtm;

    @Column(name = "LOGIN_FAIL_CNT", nullable = false)
    private Integer loginFailCnt;

    /** 마지막 변경 시각. 체인 #5 계산 근거. */
    @Column(name = "PWD_CHG_DTM")
    private Instant pwdChgDtm;

    /** 현재 저장된 값이 발급된 임시 비밀번호다. 체인 #5 의 <b>독립 조건</b> — backend/security.md. */
    @Convert(converter = YnConverter.class)
    @Column(name = "PWD_INIT_YN", length = 1, nullable = false)
    private Boolean pwdInitYn;

    @Column(name = "LAST_LOGIN_DTM")
    private Instant lastLoginDtm;

    /** 휴면. {@code UserDetails} 플래그에 대응이 없어 로그인 후처리가 판정한다 — sys/user-role.md. */
    @Convert(converter = YnConverter.class)
    @Column(name = "DORMANT_YN", length = 1, nullable = false)
    private Boolean dormantYn;

    @Column(name = "LOCALE_CD", length = 10, nullable = false)
    private String localeCd;

    @Builder
    private SysUser(
            String userId,
            String userNm,
            String email,
            String pwd,
            LocalDate validFromDt,
            LocalDate validToDt,
            String localeCd) {
        this.userId = userId;
        this.userNm = userNm;
        this.email = email;
        this.pwd = pwd;
        this.validFromDt = validFromDt;
        this.validToDt = validToDt;
        this.localeCd = localeCd;
        this.useYn = true;
        this.lockYn = false;
        this.loginFailCnt = 0;
        this.pwdInitYn = false;
        this.dormantYn = false;
    }

    /**
     * 사용자가 자기 언어를 바꾼다 — UX-09 · frontend/tabs.md.
     *
     * <p><b>이 컬럼만 서버에 있는 이유</b>는 서버가 알아야 하기 때문이다. 메일·알림을 어느
     * 언어로 보낼지 정하는 것은 서버이고 {@code localStorage} 는 서버가 볼 수 없다(sys/user-role.md).
     *
     * <p><b>지원 언어인지는 여기서 보지 않는다.</b> 목록의 원본이 설정(장차 공통코드)이라
     * 엔티티가 그것을 알면 도메인이 설정을 읽게 된다 — 판정은 서비스가 한다.
     */
    public void changeLocale(String localeCd) {
        this.localeCd = localeCd;
    }

    /**
     * 본인이 고칠 수 있는 것 둘 — USER-05 · frontend/tabs.md.
     *
     * <p><b>여기 없는 것이 결정이다.</b> {@code USER_ID} 는 자연키라 바꿀 수 없고(sys/user-role.md),
     * 사용 기간·잠금·휴면은 <b>관리자의 축</b>이며(sys/user-role.md), 언어는 설정 모달의 것이다
     * (frontend/tabs.md). 본인 화면이 건드릴 수 있는 표면을 이 메서드가 정의한다 — 넓히면 그
     * 순간 <i>"자기 계정으로 자기 권한을 늘리는"</i> 경로가 열린다.
     */
    public void changeProfile(String userNm, String email) {
        this.userNm = userNm;
        this.email = email;
    }

    /**
     * 비밀번호 변경 — AUTH-05.
     *
     * <p><b>{@code PWD_INIT_YN} 을 함께 내리는 것이 핵심이다.</b> 임시 비밀번호로 들어온
     * 사람이 바꾸고 나면 그것은 더 이상 임시가 아니며, 내리지 않으면 체인 #5 가 계속
     * 강제 변경으로 보내 <b>같은 화면에 갇힌다</b>(backend/security.md).
     *
     * <p>해시는 밖에서 만들어 온다 — 엔티티가 {@code PasswordEncoder} 를 알면 도메인이
     * 인코딩 전략에 묶인다.
     */
    public void changePassword(String encodedPwd, Instant now) {
        this.pwd = encodedPwd;
        this.pwdChgDtm = now;
        this.pwdInitYn = false;
    }

    // ── 관리자가 하는 것 (screen/user/requirements.md) ────────────────────────────────

    /**
     * 관리자가 셀에서 고치는 것 — screen/user/requirements.md 의 <b>관리자 축</b>이 이 메서드의 표면이다.
     *
     * <p>계정을 못 쓰게 하는 넷 중 <b>둘만</b> 있다({@code USE_YN} · 사용 기간). 나머지 둘은
     * 시스템이 걸고 <b>전용 메서드가 자기 컬럼만</b> 쓴다({@link #unlock} · {@link
     * #releaseDormant}) — sys/user-role.md 규칙 3(서로 덮지 않는다)을 <b>메서드 경계가 집행</b>한다.
     *
     * <p>{@code USER_ID} 는 자연키라 여기 없고(sys/user-role.md), {@code PWD} 도 없다 — 관리자는 값을
     * 정하지 않는다(backend/security.md · AUTH-07).
     */
    public void changeByAdmin(
            String userNm, String email, boolean useYn, LocalDate validFromDt, LocalDate validToDt,
            String localeCd) {
        this.userNm = userNm;
        this.email = email;
        this.useYn = useYn;
        this.validFromDt = validFromDt;
        this.validToDt = validToDt;
        this.localeCd = localeCd;
    }

    /**
     * 잠금 해제 — AUTH-04. <b>두 컬럼만 쓴다.</b>
     *
     * <p>{@code LOGIN_FAIL_CNT} 를 함께 0 으로 두지 않으면 <b>다음 한 번의 실패로 곧바로 다시
     * 잠긴다</b> — 임계값에 이미 닿아 있기 때문이다(backend/security.md 잠금 전이표).
     *
     * <p><b>{@code USE_YN} · {@code DORMANT_YN} 을 보지 않는다.</b> 잠금을 풀어도 여전히
     * 미사용일 수 있고 그것이 정상이다 — 화면의 상태 컬럼은 그때 <i>미사용</i> 을 낸다.
     */
    public void unlock() {
        this.lockYn = false;
        this.lockDtm = null;
        this.loginFailCnt = 0;
    }

    /**
     * 휴면 해제 — screen/user/requirements.md. <b>메일이 안 되는 환경을 위한 관리자 경로</b>다.
     *
     * <p>정상 경로는 본인의 비밀번호 재설정이며 그것이 곧 본인 재인증이다(sys/user-role.md · screen/_standalone/README.md).
     *
     * <p><b>잠금은 같이 풀리지 않는다.</b> screen/_standalone/README.md 이 자기 재설정에서 같은 판단을 했다 —
     * 함께 풀면 <i>실패 5회 → 해제 → 다시 5회</i> 가 무한 반복되고, 무엇보다 <b>축이 다르다</b>.
     */
    public void releaseDormant() {
        this.dormantYn = false;
    }

    /**
     * 관리자 발급 임시 비밀번호 — AUTH-07 · backend/security.md 체인 #5.
     *
     * <p>{@link #changePassword} 와 <b>{@code PWD_INIT_YN} 이 반대</b>다. 본인 변경은 그것을
     * 내리고 여기는 <b>세운다</b> — 세워 두어야 다음 로그인이 강제 변경으로 가고,
     * {@code tempValidHours} 가 지나면 로그인 자체가 막힌다({@link #isTemporaryPasswordExpired}).
     *
     * <p><b>잠금도 휴면도 건드리지 않는다</b>(screen/user/requirements.md). 발송만으로 잠금이 풀리면
     * <i>실패 5회 → 초기화 → 다시 5회</i> 가 무한 반복된다.
     */
    public void resetPasswordByAdmin(String encodedPwd, Instant now) {
        this.pwd = encodedPwd;
        this.pwdChgDtm = now;
        this.pwdInitYn = true;
    }

    // ── 접근 제어 체인이 읽는 것 (backend/security.md) ─────────────────────────────────

    /** 체인 #3. <b>양끝을 포함</b>하며 NULL 은 제한 없음이다. */
    public boolean isWithinValidPeriod(LocalDate businessToday) {
        if (validFromDt != null && businessToday.isBefore(validFromDt)) {
            return false;
        }
        return validToDt == null || !businessToday.isAfter(validToDt);
    }

    /**
     * 체인 #4. <b>컬럼이 아니라 계산 결과다</b> — 자동 해제를 배치로 하면 지연이 생겨
     * "30분 지났는데 아직 잠김" 이 된다(backend/security.md).
     *
     * @param lockReleaseMinutes 0 이면 시간 경과로 풀리지 않는다 — 관리자 해제만
     */
    public boolean isLocked(Instant now, int lockReleaseMinutes) {
        if (!Boolean.TRUE.equals(lockYn)) {
            return false;
        }
        if (lockReleaseMinutes <= 0 || lockDtm == null) {
            return true;
        }
        return lockDtm.plus(Duration.ofMinutes(lockReleaseMinutes)).isAfter(now);
    }

    /**
     * 체인 #5. <b>두 조건의 OR 이다</b> — 임시 비밀번호에 정상 유효기간(90일)을 주면 안
     * 되므로 {@code PWD_INIT_YN} 이 독립 조건이다(backend/security.md).
     *
     * @param expireDays 0 이면 주기 만료를 쓰지 않는다
     */
    public boolean mustChangePassword(Instant now, int expireDays) {
        if (Boolean.TRUE.equals(pwdInitYn)) {
            return true;
        }
        if (expireDays <= 0 || pwdChgDtm == null) {
            return false;
        }
        return pwdChgDtm.plus(Duration.ofDays(expireDays)).isBefore(now);
    }

    /** 관리자 발급 임시 비밀번호가 방치된 채 만료됐는가 — {@code FAIL_TEMP_EXPIRED}(backend/security.md). */
    public boolean isTemporaryPasswordExpired(Instant now, int tempValidHours) {
        return Boolean.TRUE.equals(pwdInitYn)
                && pwdChgDtm != null
                && pwdChgDtm.plus(Duration.ofHours(tempValidHours)).isBefore(now);
    }

    // ── 전이 (backend/security.md 잠금 전이 표) ────────────────────────────────────────

    /**
     * 비밀번호 불일치. 임계값에 닿으면 잠근다.
     *
     * @param failLimit 0 이면 <b>잠금 기능이 꺼진 것</b>이다 — 횟수만 센다
     */
    public void recordLoginFailure(Instant now, int failLimit) {
        this.loginFailCnt = this.loginFailCnt + 1;
        if (failLimit > 0 && this.loginFailCnt >= failLimit) {
            this.lockYn = true;
            this.lockDtm = now;
        }
    }

    /** 로그인 성공. 경과분 잠금을 함께 정리한다 — 다른 셋({@code USE_YN} 등)은 건드리지 않는다. */
    public void recordLoginSuccess(Instant now) {
        this.loginFailCnt = 0;
        this.lockYn = false;
        this.lockDtm = null;
        this.lastLoginDtm = now;
    }
}
