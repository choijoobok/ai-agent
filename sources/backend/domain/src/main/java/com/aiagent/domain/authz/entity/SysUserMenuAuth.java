package com.aiagent.domain.authz.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import com.aiagent.domain.authz.ActionType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 개인 예외 권한 — sys/menu.md · backend/security.md · AUTHZ-07.
 *
 * <p><b>허용(GRANT)만 있다.</b> 차단(DENY)을 두면 우선순위 규칙이 필요해지고 <i>"왜 권한이
 * 없는지"</i> 를 추적할 수 없게 된다. 특정 사용자만 빼야 하면 역할을 분리한다.
 *
 * <p><b>{@link SysUserRole} 과 모양이 다른 것은 의도다.</b> 개인 예외는 기간 <b>필수</b> +
 * 사유 <b>필수</b>이고 역할 부여는 기간 선택 + 사유 없음이다 — <b>개인 예외에는 마찰이
 * 있어야 하고</b> 역할 부여는 일상 운영이다.
 *
 * <p>한 경로의 리프 10개를 한 사람에게 통째로 줘야 하는 상황이면 그것은 개인 예외가 아니라
 * <b>역할</b>이다. 마찰을 없애려고 폴더 단위로 확장하면 개인 예외가 <b>제2의 역할 체계</b>가
 * 되고 "이 사용자가 왜 이 권한을 갖는가" 추적이 불가능해진다.
 *
 * <p><b>만료 판정은 조회 시 계산이다.</b> 배치(AUTHZ-08)가 이 행을 "비활성화" 하지 않는다 —
 * 계정 잠금 자동 해제와 같은 구조이며, 배치가 실제로 하는 일은 이력 기록과 만료 예정
 * 통보뿐이다. 그래서 <b>배치가 실패해도 권한 판정은 정확하다</b>.
 */
@Entity
@Table(name = "SYS_USER_MENU_AUTH")
@IdClass(SysUserMenuAuthId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysUserMenuAuth extends BaseAuditEntity {

    @Id
    @Column(name = "USER_ID", length = 30, nullable = false)
    private String userId;

    @Id
    @Column(name = "MENU_CD", length = 30, nullable = false)
    private String menuCd;

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "ACTION_CD", length = 20, nullable = false)
    private ActionType actionCd;

    /** 역할 부여와 달리 NOT NULL 이다 — 일시적·개별적이라는 것이 정의이므로 무기한 예외가 없다. */
    @Column(name = "VALID_FROM_DT", nullable = false)
    private LocalDate validFromDt;

    @Column(name = "VALID_TO_DT", nullable = false)
    private LocalDate validToDt;

    /** 감사 대응. 부여 <b>작업</b> 단위로 한 번 입력받아 선택 행 전체에 복사한다(backend/security.md). */
    @Column(name = "GRANT_RSN", length = 500, nullable = false)
    private String grantRsn;

    /**
     * 새 부여 — screen/admin/system/user/requirements.md 에서 <b>꺼진 칸을 켠 것</b>이다.
     *
     * <p>검증은 밖에서 한다({@code UserAuthService}). 엔티티가 {@code SYS_MENU} 와
     * {@code SYS_API} 를 알아야 <i>줄 수 있는 조합인가</i> 를 판정할 수 있는데, 그것은
     * 엔티티가 아니라 서비스의 일이다.
     */
    public static SysUserMenuAuth created(
            String userId,
            String menuCd,
            ActionType actionCd,
            LocalDate validFromDt,
            LocalDate validToDt,
            String grantRsn) {

        SysUserMenuAuth grant = new SysUserMenuAuth();
        grant.userId = userId;
        grant.menuCd = menuCd;
        grant.actionCd = actionCd;
        grant.validFromDt = validFromDt;
        grant.validToDt = validToDt;
        grant.grantRsn = grantRsn;
        return grant;
    }

    /**
     * 기간과 사유를 갱신한다 — <b>재부여도 회수도 이것</b>이다(screen/admin/system/user/requirements.md).
     *
     * <p>PK 가 {@code (USER_ID, MENU_CD, ACTION_CD)} 라 <b>한 조합에 행은 하나뿐</b>이며,
     * 같은 조합을 기간을 달리해 두 번 줄 수 없다. 그래서 <i>재부여</i> 는 새 행이 아니라
     * 이 메서드이고, <b>즉시 회수</b>({@code VALID_TO_DT = 어제})도 이 메서드다.
     *
     * <p><b>행을 지우지 않는 이유는 사유가 사라지기 때문</b>이다 — 변경 이력 테이블을 두지
     * 않았으므로(sys/logs.md) <i>"누구에게 왜 무엇을 언제까지 줬는가"</i> 를 남기는 것이 이
     * 행뿐이다.
     *
     * <p>덮어써진 이전 기간과 사유는 <b>요청 전문 로그</b>에 있다(screen/admin/system/user/requirements.md) — 작년의
     * {@code save} 요청에 작년의 기간과 사유가 들어 있다.
     */
    public void change(LocalDate validFromDt, LocalDate validToDt, String grantRsn) {
        this.validFromDt = validFromDt;
        this.validToDt = validToDt;
        this.grantRsn = grantRsn;
    }
}
