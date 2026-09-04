package com.ordinary.backoffice.domain.gridpref.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * {@link SysUserGridPref} 의 복합키 — grid-standard.md §5.
 *
 * <p>record 가 아니라 클래스인 것은 {@code @IdClass} 의 요구 때문이다.
 */
@Getter
@NoArgsConstructor
@EqualsAndHashCode
public class SysUserGridPrefId implements Serializable {

    private static final long serialVersionUID = 1L;

    private String userId;
    private String menuCd;
    private String gridId;
}
