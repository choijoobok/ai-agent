package com.aiagent.domain.code.entity;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** {@link SysCodeRef} 의 복합키 — 셋 다 키다. {@code REF_VAL} 은 여기 없다(sys/code.md). */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class SysCodeRefId implements Serializable {

    private static final long serialVersionUID = 1L;

    private String grpCd;
    private String dtlCd;
    private String refCd;
}
