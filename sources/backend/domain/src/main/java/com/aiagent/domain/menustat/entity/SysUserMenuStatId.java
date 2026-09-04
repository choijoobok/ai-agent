package com.aiagent.domain.menustat.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * {@link SysUserMenuStat} 의 복합키 — sys/menu.md.
 *
 * <p>{@code STAT_YM} 이 키에 있는 것이 <b>월 버킷</b> 그 자체다 — 같은 행을 한 달 내내
 * 갱신하므로 카운트만 오르고 행은 늘지 않는다.
 */
@Getter
@NoArgsConstructor
@EqualsAndHashCode
public class SysUserMenuStatId implements Serializable {

    private static final long serialVersionUID = 1L;

    private String userId;
    private String menuCd;
    private String statYm;
}
