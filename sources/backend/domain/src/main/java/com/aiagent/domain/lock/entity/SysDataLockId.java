package com.aiagent.domain.lock.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** {@link SysDataLock} 의 복합키 — 네임스페이스와 자원 식별자 둘이 함께 키다(backend/persistence.md). */
@Getter
@NoArgsConstructor
@EqualsAndHashCode
public class SysDataLockId implements Serializable {

    private static final long serialVersionUID = 1L;

    private String lockType;
    private String lockKey;
}
