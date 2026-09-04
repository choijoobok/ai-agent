package com.aiagent.domain.sample.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * {@link SmplOrderItem} 의 복합키 — 주문 안에서의 순번이다.
 *
 * <p><b>대리키를 두지 않는다.</b> 품목 행은 주문 밖에서 홀로 참조되지 않으므로 자기
 * 식별자가 필요 없고, 복합 PK 가 있어야 4벤더 CI 가 그것을 검증한다(playbook/INDEX.md).
 */
@Getter
@NoArgsConstructor
@EqualsAndHashCode
public class SmplOrderItemId implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long ordId;
    private Integer itemSeq;
}
