package com.aiagent.domain.searchcond.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import com.aiagent.core.domain.YnConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 저장된 조회조건 — UX-07 · search-form-contract.md §5.
 *
 * <p><b>담는 것은 와이어가 아니라 폼 값이다</b>(search-form-contract.md §5.1). 봉투({@code conditions}·
 * {@code params})는 <b>파생물</b>이며 {@code to}·{@code paramKey}·{@code scale} 은 화면
 * 선언에 있다 — 함께 저장하면 미러링이고, 선언을 고쳤을 때 <b>저장된 쪽이 낡은 형태를
 * 되살린다</b>. 폼 값만 담으면 사라진 필드는 <b>그 키만 버리면</b> 된다.
 *
 * <p><b>기본값과 같은 칸은 아예 들어오지 않는다</b>(search-form-contract.md §5.2). 그래서 <i>최근 7일</i> 로
 * 저장한 조건은 열 때마다 최근 7일이며, 절대값으로 굳지 않는다 — 그것이 저장된 조건의
 * 가장 흔한 배신이다.
 *
 * <p><b>{@code MENU_CD} 가 PK 에 있다.</b> 조건은 화면에 매인다 — 화면이 다르면 필드가
 * 다르므로 같은 이름이라도 다른 물건이다.
 *
 * <p><b>공유하지 않는다</b>(search-form-contract.md §5.4). 공유하면 <i>"남의 조건을 내가 고칠 수 있나"</i> 가
 * 따라오고 그것은 소유권·권한이라 화면 하나가 아니라 관리 기능이 된다.
 */
@Entity
@Table(name = "SYS_USER_SEARCH_COND")
@IdClass(SysUserSearchCondId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysUserSearchCond extends BaseAuditEntity {

    @Id
    @Column(name = "USER_ID", length = 30, nullable = false)
    private String userId;

    @Id
    @Column(name = "MENU_CD", length = 30, nullable = false)
    private String menuCd;

    /**
     * 사용자가 붙인 이름 — <b>메시지 키가 아니다</b>. 사람마다 다른 값이라 번역 대상이
     * 될 수 없다(43 §7 의 경계에서 데이터 쪽이다).
     */
    @Id
    @Column(name = "COND_NM", length = 100, nullable = false)
    private String condNm;

    /**
     * 값 맵의 JSON — search-form-contract.md §5.1.
     *
     * <p><b>서버가 열어 보지 않는다.</b> 무엇이 유효한 필드인지 아는 것은 화면 선언이고,
     * 서버가 검증하려면 <b>선언을 서버에도 한 벌 두어야</b> 한다 — 그것이 미러링이다.
     * 낡은 키는 복원할 때 화면이 조용히 버린다(search-form-contract.md §5.3).
     *
     * <p>{@code @Lob} 이 아니라 이 조합인 것은 db-portability.md §3.1 의 실측 때문이다 — {@code @Lob} 은
     * PostgreSQL 에서 {@code oid}, MySQL 에서 {@code tinytext}(255바이트)가 된다.
     */
    @Nationalized
    @JdbcTypeCode(SqlTypes.LONG32NVARCHAR)
    @Column(name = "COND_JSON", nullable = false)
    private String condJson;

    /**
     * 화면 진입 시 폼을 채우는 하나 — search-form-contract.md §5.4.
     *
     * <p><b>DB 가 하나임을 강제하지 않는다.</b> 부분 유니크 인덱스는 벤더마다 문법이
     * 다르다(db-portability.md §4) — 저장할 때 서비스가 이전 것을 내린다.
     */
    @Convert(converter = YnConverter.class)
    @Column(name = "DFLT_YN", length = 1, nullable = false)
    private Boolean dfltYn;

    /** 드롭다운 순서. <b>이름 순이 아니다</b> — 자주 쓰는 것을 먼저 만드는 것이 보통이다. */
    @Column(name = "SORT_NO", nullable = false)
    private Integer sortNo;

    public static SysUserSearchCond created(
            String userId, String menuCd, String condNm, String condJson, boolean dflt, int sortNo) {
        SysUserSearchCond entity = new SysUserSearchCond();
        entity.userId = userId;
        entity.menuCd = menuCd;
        entity.condNm = condNm;
        entity.condJson = condJson;
        entity.dfltYn = dflt;
        entity.sortNo = sortNo;
        return entity;
    }

    /** 같은 이름으로 다시 저장하면 <b>덮어쓴다</b> — 이름이 곧 자리다(search-form-contract.md §5.4). */
    public void replace(String condJson, boolean dflt) {
        this.condJson = condJson;
        this.dfltYn = dflt;
    }

    /** 다른 조건이 기본이 되면 이 행은 내려온다 — 하나만이다. */
    public void clearDefault() {
        this.dfltYn = false;
    }
}
