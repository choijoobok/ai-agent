package com.ordinary.backoffice.domain.authz.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * {@link SysUserRole} 의 복합키.
 *
 * <p><b>{@code VALID_FROM_DT} 를 키에 넣지 않는다</b>(42 §3.1). 넣으면 같은 역할을 기간을
 * 달리해 여러 번 부여할 수 있지만 <b>기간이 겹치는 행을 막을 방법이 없고</b>, <i>"지금 유효한
 * 부여가 무엇인가"</i> 가 조회마다 집계가 된다. 재부여는 같은 행의 기간을 갱신한다 — 한
 * 사람에게 같은 역할을 시간대별로 여러 번 주는 요구는 드물다.
 */
@Getter
@NoArgsConstructor
@EqualsAndHashCode
public class SysUserRoleId implements Serializable {

    private static final long serialVersionUID = 1L;

    private String userId;
    private String roleId;
}
