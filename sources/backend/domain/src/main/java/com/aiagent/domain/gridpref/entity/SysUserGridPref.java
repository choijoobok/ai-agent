package com.aiagent.domain.gridpref.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

/**
 * 그리드 개인화 — UX-06 · UX-13 · frontend/grid.md.
 *
 * <p><b>화면 하나에 그리드가 둘일 수 있다</b>(screen/admin/system/code/requirements.md). {@code MENU_CD} 까지만 키로 두면
 * 위아래 그리드의 설정이 서로를 덮는다 — 그래서 {@code GRID_ID} 가 키에 있다.
 *
 * <p><b>{@code SIGNATURE} 가 UX-13 이다.</b> 화면의 컬럼 목록이 바뀌면 저장된 설정을
 * 폐기한다 — 없어진 컬럼을 숨김으로 들고 있거나 새 컬럼이 순서 없이 끼는 상태를 만들지
 * 않는다. <b>판정은 서버 한 곳</b>이며(frontend/grid.md) 화면은 지금의 시그니처를 들고 물을 뿐이다.
 *
 * <p><b>{@code PREF_JSON} 을 서버가 열어 보지 않는다.</b> 무엇이 유효한 컬럼인지 아는 것은
 * 화면 선언이고, 서버가 검증하려면 선언을 서버에도 한 벌 두어야 한다 — 그것이 미러링이다
 * ({@code SYS_USER_SEARCH_COND} 와 같은 판단이다).
 *
 * <p><b>컬럼 너비는 여기 없다</b>(frontend/grid.md) — {@code localStorage} 다. 27인치에서 맞춘 폭이
 * 노트북에서는 틀리므로 <b>기기의 속성</b>이다(sys/user-role.md).
 */
@Entity
@Table(name = "SYS_USER_GRID_PREF")
@IdClass(SysUserGridPrefId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysUserGridPref extends BaseAuditEntity {

    @Id
    @Column(name = "USER_ID", length = 30, nullable = false)
    private String userId;

    @Id
    @Column(name = "MENU_CD", length = 30, nullable = false)
    private String menuCd;

    @Id
    @Column(name = "GRID_ID", length = 30, nullable = false)
    private String gridId;

    @Nationalized
    @JdbcTypeCode(SqlTypes.LONG32NVARCHAR)
    @Column(name = "PREF_JSON", nullable = false)
    private String prefJson;

    @Column(name = "SIGNATURE", length = 64, nullable = false)
    private String signature;

    public static SysUserGridPref created(
            String userId, String menuCd, String gridId, String prefJson, String signature) {
        SysUserGridPref entity = new SysUserGridPref();
        entity.userId = userId;
        entity.menuCd = menuCd;
        entity.gridId = gridId;
        entity.prefJson = prefJson;
        entity.signature = signature;
        return entity;
    }

    /** 다시 저장하면 덮어쓴다 — 개인 설정에 이력을 두지 않는다. */
    public void replace(String prefJson, String signature) {
        this.prefJson = prefJson;
        this.signature = signature;
    }
}
