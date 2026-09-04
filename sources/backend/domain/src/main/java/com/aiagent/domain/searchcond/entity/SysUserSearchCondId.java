package com.aiagent.domain.searchcond.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * {@link SysUserSearchCond} 의 복합키 — search-form-contract.md §5.5.
 *
 * <p>셋인 것이 곧 요건이다 — <i>화면 안에서 이름 중복 불가</i>(search-form-contract.md §5.4)가
 * {@code (USER_ID, MENU_CD, COND_NM)} 이다.
 *
 * <p>record 가 아니라 클래스인 것은 {@code @IdClass} 의 요구 때문이다 — 인자 없는 생성자와
 * 필드 접근이 필요하다.
 */
@Getter
@NoArgsConstructor
@EqualsAndHashCode
public class SysUserSearchCondId implements Serializable {

    private static final long serialVersionUID = 1L;

    private String userId;
    private String menuCd;
    private String condNm;
}
