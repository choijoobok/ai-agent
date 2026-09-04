package com.ordinary.backoffice.domain.message.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** {@link SysMessage} 의 복합키 — 행 지향이라 언어가 키의 일부다(43 §7.2). */
@Getter
@NoArgsConstructor
@EqualsAndHashCode
public class SysMessageId implements Serializable {

    private static final long serialVersionUID = 1L;

    private String msgKey;
    private String langCd;
}
