package com.aiagent.domain.user.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** {@link SysUserIpAllow} 의 복합키 — sys/user-role.md. */
@Getter
@NoArgsConstructor
@EqualsAndHashCode
public class SysUserIpAllowId implements Serializable {

    private static final long serialVersionUID = 1L;

    private String userId;
    private String ipCidr;
}
