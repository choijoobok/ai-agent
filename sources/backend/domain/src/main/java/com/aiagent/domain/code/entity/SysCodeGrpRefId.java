package com.aiagent.domain.code.entity;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** {@link SysCodeGrpRef} 의 복합키 — 정의는 그룹의 것이다(43 §5.1). */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class SysCodeGrpRefId implements Serializable {

    private static final long serialVersionUID = 1L;

    private String grpCd;
    private String refCd;
}
