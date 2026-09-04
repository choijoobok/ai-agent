package com.ordinary.backoffice.domain.favorite.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * {@link SysUserFavorite} 의 복합키 — 42 §7.
 *
 * <p>record 가 아니라 클래스인 것은 {@code @IdClass} 의 요구다 — 인자 없는 생성자와 필드
 * 접근이 필요하다.
 */
@Getter
@NoArgsConstructor
@EqualsAndHashCode
public class SysUserFavoriteId implements Serializable {

    private static final long serialVersionUID = 1L;

    private String userId;
    private String menuCd;
}
