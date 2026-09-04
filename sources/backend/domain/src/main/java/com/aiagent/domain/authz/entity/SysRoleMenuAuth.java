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
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 역할 권한 — 42 §6.
 *
 * <p><b>행의 존재가 곧 허용이다.</b> 거부를 표현하는 컬럼을 두지 않는다 — 개인 예외가
 * 허용만 하기 때문이며, {@code DENY_YN} 같은 컬럼을 두면 합집합 규칙이 즉시 무너진다.
 *
 * <p><b>같은 이유로 {@code USE_YN} 도 없다.</b> 부여 행에 N 을 허용하면 그것이 "거부" 인지
 * "미부여" 인지 정해야 하고, 합집합 위에서 그 구분은 {@code DENY_YN} 과 동일한 우선순위
 * 문제가 된다. 부여를 멈추는 수단은 <b>행 삭제</b> 또는 <b>역할 자체의 {@code USE_YN}</b>
 * 둘뿐이다.
 *
 * <p><b>{@code READ} 는 나머지 셋의 전제다.</b> 다른 액션이 하나라도 있으면 같은 메뉴의
 * {@code READ} 행이 있어야 한다 — 없으면 화면에 들어갈 수 없어 그 권한을 쓸 방법이 없다.
 * 같은 테이블의 다른 행에 의존하므로 DB 제약으로 표현할 수 없고, 저장 서비스와 시드 검증
 * 테스트가 지킨다(원칙 P1).
 *
 * <p><b>고아가 되어도 지우지 않는다</b>(ADR-0022). API 가 사라져 (메뉴, 액션) 이 미정의가
 * 되면 이 행은 고아지만 <b>인가에는 무해하다</b> — 부를 API 가 없으므로 그 권한으로 할 수
 * 있는 일이 없다. {@link SysApi} 와 방향이 반대인 것은 <b>소유자가 다르기 때문</b>이다:
 * 코드가 소유한 것은 코드를 따라가고, 사람이 소유한 것은 사람을 기다린다.
 */
@Entity
@Table(name = "SYS_ROLE_MENU_AUTH")
@IdClass(SysRoleMenuAuthId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysRoleMenuAuth extends BaseAuditEntity {

    @Id
    @Column(name = "ROLE_ID", length = 30, nullable = false)
    private String roleId;

    /** {@code MENU_URL IS NULL} 인 메뉴가 들어오면 저장 서비스가 거부한다(원칙 P1). */
    @Id
    @Column(name = "MENU_CD", length = 30, nullable = false)
    private String menuCd;

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "ACTION_CD", length = 20, nullable = false)
    private ActionType actionCd;

    /**
     * 부여 하나 — 62 §2.6 의 저장이 만든다.
     *
     * <p><b>받는 것이 키 셋뿐이다.</b> 이 테이블에는 키 밖의 컬럼이 감사 4개밖에 없고
     * (42 §6) 그것은 {@code BaseAuditEntity} 가 채운다 — <b>행의 존재가 곧 허용</b>이라
     * 값으로 표현할 것이 없다.
     */
    public static SysRoleMenuAuth created(String roleId, String menuCd, ActionType actionCd) {
        SysRoleMenuAuth grant = new SysRoleMenuAuth();
        grant.roleId = roleId;
        grant.menuCd = menuCd;
        grant.actionCd = actionCd;
        return grant;
    }
}
