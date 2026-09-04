package com.aiagent.domain.user.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * {@link SysUserPwdHist} 의 복합키 — sys/user-role.md.
 *
 * <p>record 가 아니라 클래스인 것은 {@code @IdClass} 의 요구 때문이다 — 인자 없는 생성자와
 * 필드 접근이 필요하다. {@link com.aiagent.domain.authz.entity.SysUserRoleId}
 * 와 같은 모양이다.
 */
@Getter
@NoArgsConstructor
@EqualsAndHashCode
public class SysUserPwdHistId implements Serializable {

    private static final long serialVersionUID = 1L;

    private String userId;
    private Integer chgSeq;
}
