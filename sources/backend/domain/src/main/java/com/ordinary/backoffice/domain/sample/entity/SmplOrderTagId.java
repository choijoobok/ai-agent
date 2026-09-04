package com.ordinary.backoffice.domain.sample.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * {@link SmplOrderTag} 의 복합키 — 주문 안에서의 순번이다.
 *
 * <p>{@link SmplOrderItemId} 과 같은 모양이며, 같은 이유로 대리키를 두지 않는다: 태그 행은
 * 주문 밖에서 홀로 참조되지 않는다.
 */
@Getter
@NoArgsConstructor
@EqualsAndHashCode
public class SmplOrderTagId implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long ordId;
    private Integer tagSeq;
}
