package com.aiagent.domain.code.entity;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** {@link SysCode} 의 복합키 — 코드는 그룹 안에서만 유일하다(sys/code.md). */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class SysCodeId implements Serializable {

    private static final long serialVersionUID = 1L;

    private String grpCd;
    private String dtlCd;
}
