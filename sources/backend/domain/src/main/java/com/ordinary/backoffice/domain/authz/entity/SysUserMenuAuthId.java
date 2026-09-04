package com.ordinary.backoffice.domain.authz.entity;

import com.ordinary.backoffice.domain.authz.ActionType;
import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** {@link SysUserMenuAuth} 의 복합키 — 주체만 다를 뿐 {@link SysRoleMenuAuthId} 와 같은 모양이다. */
@Getter
@NoArgsConstructor
@EqualsAndHashCode
public class SysUserMenuAuthId implements Serializable {

    private static final long serialVersionUID = 1L;

    private String userId;
    private String menuCd;
    private ActionType actionCd;
}
