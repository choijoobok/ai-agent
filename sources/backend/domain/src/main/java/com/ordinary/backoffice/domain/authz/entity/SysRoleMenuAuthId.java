package com.ordinary.backoffice.domain.authz.entity;

import com.ordinary.backoffice.domain.authz.ActionType;
import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** {@link SysRoleMenuAuth} 의 복합키 — 권한의 단위가 (주체 × 메뉴 × 액션) 이므로 셋 다 키다. */
@Getter
@NoArgsConstructor
@EqualsAndHashCode
public class SysRoleMenuAuthId implements Serializable {

    private static final long serialVersionUID = 1L;

    private String roleId;
    private String menuCd;
    private ActionType actionCd;
}
