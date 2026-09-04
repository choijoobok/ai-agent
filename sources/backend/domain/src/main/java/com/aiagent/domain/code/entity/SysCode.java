package com.aiagent.domain.code.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import com.aiagent.core.domain.YnConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 코드 — sys/code.md · screen/code/requirements.md.
 *
 * <p><b>{@code DTL_NM} 은 코드명이 아니라 그 코드의 메시지 키</b>({@code code.{GRP_CD}.{DTL_CD}})
 * 이며 사람이 정하지 않는다. 값이 PK 에서 도출되는데도 컬럼으로 두는 이유는 조회 쪽이
 * 문자열을 조립하지 않고 <b>컬럼을 그대로 조인 키로 쓰기</b> 위해서다 — 조립이 저장 시점
 * 한 곳에만 있으면 규칙이 바뀌어도 고칠 곳이 하나다(sys/code.md).
 *
 * <p><b>부가 속성 컬럼({@code ETC1}·{@code ETC2} …)이 없다.</b> MASTER-10 이 부가 속성을
 * {@link SysCodeRef} 로 확정했으므로 함께 두면 같은 목적의 메커니즘이 둘이 되고
 * <i>"어디에 넣어야 하나"</i> 가 매번 판단 대상이 된다(sys/code.md).
 */
@Entity
@Table(name = "SYS_CODE")
@IdClass(SysCodeId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysCode extends BaseAuditEntity {

    /** 메시지 키의 접두 — 소스가 정한 고정 문자열이고 그 뒤는 데이터다(sys/code.md). */
    private static final String KEY_PREFIX = "code.";

    @Id
    @Column(name = "GRP_CD", length = 30, nullable = false)
    private String grpCd;

    @Id
    @Column(name = "DTL_CD", length = 30, nullable = false)
    private String dtlCd;

    /** {@link #messageKey}. 저장 DTO 에 없으므로 화면이 보낸 값이 여기 닿을 경로가 없다. */
    @Column(name = "DTL_NM", length = 200, nullable = false)
    private String dtlNm;

    @Column(name = "DTL_DESC", length = 500)
    private String dtlDesc;

    @Convert(converter = YnConverter.class)
    @Column(name = "SYS_YN", length = 1, nullable = false)
    private Boolean sysYn;

    @Convert(converter = YnConverter.class)
    @Column(name = "USE_YN", length = 1, nullable = false)
    private Boolean useYn;

    /** <b>콤보 정렬</b>이다 — 관리 화면용이 아니다(screen/code/requirements.md). */
    @Column(name = "SORT_NO", nullable = false)
    private Integer sortNo;

    /**
     * 코드값 둘에서 메시지 키를 조립한다 — <b>대문자를 소문자로 바꾸지 않는다</b>(sys/code.md).
     *
     * <p>역변환이 결정적이어야 조회가 이 키로 코드 테이블을 되짚을 수 있고, {@code grep} 로
     * 찾을 수 있어야 한다. 대문자 마디가 <i>"여기부터는 DB 에서 온 값"</i> 이라는 신호다.
     */
    public static String messageKey(String grpCd, String dtlCd) {
        return KEY_PREFIX + grpCd + "." + dtlCd;
    }

    public static SysCode created(
            String grpCd, String dtlCd, String dtlDesc, Boolean useYn, Integer sortNo) {
        SysCode entity = new SysCode();
        entity.grpCd = grpCd;
        entity.dtlCd = dtlCd;
        entity.dtlNm = messageKey(grpCd, dtlCd);
        entity.sysYn = false;
        entity.apply(dtlDesc, useYn, sortNo);
        return entity;
    }

    /**
     * 고칠 수 있는 셋. <b>{@code DTL_NM} 이 없다</b> — PK 가 바뀌지 않으므로 바뀔 일이 없다.
     *
     * <p>{@code SYS_YN='Y'} 인 행에서 {@code USE_YN} 이 잠기는 것은 <b>저장 서비스의 판정</b>
     * 이다(sys/code.md). 여기서 막지 않는 것은 그 판정이 <i>이전 값과의 비교</i> 라 엔티티 혼자
     * 답할 수 없기 때문이며, 화면은 스위치 자체를 잠근다(screen/code/requirements.md).
     */
    public void apply(String dtlDesc, Boolean useYn, Integer sortNo) {
        this.dtlDesc = dtlDesc;
        this.useYn = useYn;
        this.sortNo = sortNo;
    }
}
