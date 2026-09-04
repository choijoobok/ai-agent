package com.ordinary.backoffice.domain.authz.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** {@link SysMenuApi} 의 복합키 — 같은 API 가 여러 메뉴에 속할 수 있으므로 둘 다 키다. */
@Getter
@NoArgsConstructor
@EqualsAndHashCode
public class SysMenuApiId implements Serializable {

    private static final long serialVersionUID = 1L;

    private String menuCd;
    private String apiUrl;
}
