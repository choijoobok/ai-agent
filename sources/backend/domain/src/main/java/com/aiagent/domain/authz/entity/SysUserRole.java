package com.aiagent.domain.authz.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 역할 부여 — 42 §3.1.
 *
 * <p><b>기간이 있고 NULL 은 무제한이다.</b> 파견·계약직·직무대리·한시 TF 는 실제로 기간이
 * 있고, 인사 발령을 미리 입력해 두는 것도 여기다. NULL 을 허용하는 것이 핵심인데 —
 * 필수로 하면 정규 직원의 부여에 종료일을 억지로 넣게 되고 {@code 9999-12-31} 을 채우는
 * 관행이 생긴다. <b>그 값은 "무기한" 을 뜻하지만 아무 제약도 그것을 보증하지 않는다.</b>
 *
 * <p><b>회수는 삭제가 아니라 {@code VALID_TO_DT} 다.</b> 즉시 회수는 어제 날짜다(오늘은
 * 포함되므로 오늘로 두면 오늘까지 유효하다). 행을 지우는 것보다 나은 이유는 <b>누가 언제까지
 * 무슨 역할을 가졌는지가 남기</b> 때문이며, ADR-0010 이 변경 이력 테이블을 두지 않기로
 * 했으므로 이 컬럼이 그 기록을 대신한다.
 *
 * <p>두지 않는 것 셋 — <b>주 역할 플래그</b>(합집합이라 대표 역할이 판정에 쓰이지 않고,
 * 컬럼을 두면 그것이 우선순위로 오해된다), <b>{@code USE_YN}</b>(기간이 예정된 종료를,
 * {@code VALID_TO_DT} 가 즉시 중단을 맡으므로 플래그를 더하면 축이 셋이 된다),
 * <b>부여 사유</b>(계약직에게 계약 기간만큼 역할을 주는 것은 정상 운영이며, 모든 부여에
 * 사유를 강제하면 아무도 쓰지 않는다).
 *
 * <p><b>역할이 비활성화되어도 이 행은 남긴다.</b> 다시 켜면 원래 부여가 살아나야 한다.
 */
@Entity
@Table(name = "SYS_USER_ROLE")
@IdClass(SysUserRoleId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysUserRole extends BaseAuditEntity {

    @Id
    @Column(name = "USER_ID", length = 30, nullable = false)
    private String userId;

    @Id
    @Column(name = "ROLE_ID", length = 30, nullable = false)
    private String roleId;

    /** 업무 시간대 기준·<b>양끝 포함</b> — 40 §4.3. */
    @Column(name = "VALID_FROM_DT")
    private LocalDate validFromDt;

    @Column(name = "VALID_TO_DT")
    private LocalDate validToDt;

    /**
     * 새 부여 — 61 §3.8 탭 1 에서 <b>행을 더한 것</b>이다.
     *
     * <p>기간이 <b>선택</b>이며 {@code null} 이 무기한이다 — {@code SysUserMenuAuth.created}
     * 와 갈리는 자리이고, 그 차이가 42 §3.1 이 정한 두 테이블의 성격 전부다.
     *
     * <p>역할이 <b>있는지</b>는 밖에서 본다({@code UserDetailService}). 엔티티가
     * {@code SYS_ROLE} 을 알아야 판정할 수 있는 것은 엔티티의 일이 아니다 —
     * {@code SysUserMenuAuth} 가 같은 자리에 적어 둔 것과 같다.
     */
    public static SysUserRole granted(
            String userId, String roleId, LocalDate validFromDt, LocalDate validToDt) {

        SysUserRole grant = new SysUserRole();
        grant.userId = userId;
        grant.roleId = roleId;
        grant.validFromDt = validFromDt;
        grant.validToDt = validToDt;
        return grant;
    }

    /**
     * 기간을 갱신한다 — <b>재부여도 회수도 이것</b>이다(42 §3.1).
     *
     * <p>PK 가 {@code (USER_ID, ROLE_ID)} 라 <b>한 쌍에 행은 하나뿐</b>이며, 같은 역할을
     * 기간을 달리해 두 번 줄 수 없다. 즉시 회수는 {@code validToDt = 어제} 이고 행은 남는다 —
     * <b>누가 언제까지 무슨 역할을 가졌는지</b> 를 남기는 것이 이 컬럼이기 때문이다
     * (ADR-0010 이 변경 이력 테이블을 두지 않기로 했다).
     */
    public void change(LocalDate validFromDt, LocalDate validToDt) {
        this.validFromDt = validFromDt;
        this.validToDt = validToDt;
    }
}
