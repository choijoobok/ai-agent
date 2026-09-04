package com.aiagent.domain.favorite.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 즐겨찾기 메뉴 — UX-03 · 42 §7.
 *
 * <p><b>감사 4컬럼이 없다.</b> 주체 = 행위자이므로({@code REG_ID} 가 {@code USER_ID} 와
 * 늘 같은 값이 된다) {@code USER_ID + CRE_DTM} 이 곧 <i>"누가 언제"</i> 다 — 항상 같은
 * 값인 컬럼을 두면 그 컬럼 자체를 신뢰할 수 없게 된다(40 §4.2).
 *
 * <p><b>즐겨찾기가 권한을 주지 않는다</b>(42 §7). 목록에 남아 있어도 권한이 없으면 API 는
 * 403 이며, 등록 시점의 권한이 저장되는 것이 아니다. 권한을 잃으면 <b>표시만 멈춘다</b> —
 * 행은 남는다: 권한이 돌아오면 다시 나타나야 한다.
 */
@Entity
@Table(name = "SYS_USER_FAVORITE")
@IdClass(SysUserFavoriteId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysUserFavorite {

    @Id
    @Column(name = "USER_ID", length = 30, nullable = false)
    private String userId;

    @Id
    @Column(name = "MENU_CD", length = 30, nullable = false)
    private String menuCd;

    /** 사용자가 정한 순서. 재배치는 <b>목록 전체를 {@code 1..N} 으로 다시 쓴다</b>(42 §7). */
    @Column(name = "SORT_NO", nullable = false)
    private Integer sortNo;

    @Column(name = "CRE_DTM", nullable = false)
    private Instant creDtm;

    public static SysUserFavorite created(String userId, String menuCd, int sortNo, Instant now) {
        SysUserFavorite entity = new SysUserFavorite();
        entity.userId = userId;
        entity.menuCd = menuCd;
        entity.sortNo = sortNo;
        entity.creDtm = now;
        return entity;
    }

    public void moveTo(int sortNo) {
        this.sortNo = sortNo;
    }
}
