package com.aiagent.domain.code.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 참조 코드 <b>정의</b> — sys/code.md.
 *
 * <p><b>이 행 하나가 상세 코드 그리드의 컬럼 하나다</b>(screen/code/requirements.md). 정의 테이블이 생기기 전에는
 * 목록이 {@code SELECT DISTINCT REF_CD} 라 <b>상세 코드가 0건인 그룹은 속성을 정의할 수
 * 없었고, 마지막 코드를 지우면 정의가 조용히 사라졌다</b>.
 *
 * <p><b>{@code USE_YN} 이 없다.</b> 쓰지 않을 속성은 정의를 지운다 — 정의가 있으면 컬럼이
 * 나오고, 컬럼이 나오면 채우라는 뜻이다(sys/code.md). <i>"컬럼은 있는데 꺼져 있다"</i> 를 만들
 * 자리를 두지 않는다.
 *
 * <p><b>{@code REF_NM} 이 필수이고 폴백이 없다.</b> 같은 {@code REF_CD} 를 그룹마다 다르게
 * 부르는 것이 이 컬럼의 존재 이유이므로 전역 코드명이 대신할 수 없고, <i>"없으면 코드명"</i>
 * 으로 두면 명칭의 원천이 둘이 된다(sys/code.md).
 */
@Entity
@Table(name = "SYS_CODE_GRP_REF")
@IdClass(SysCodeGrpRefId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysCodeGrpRef extends BaseAuditEntity {

    /**
     * {@code REF_CD} 화이트리스트를 담는 공통코드 그룹 — sys/code.md.
     *
     * <p><b>소스가 이 문자열을 참조하므로 그 그룹은 {@code SYS_YN='Y'} 다.</b> 정의 테이블이
     * 화이트리스트를 대신하지 않는다 — 정의는 <i>이 그룹이 무엇을 쓰는가</i> 이고, 화이트
     * 리스트는 <i>애초에 무엇이 있는가</i> 다.
     */
    public static final String REF_CD_GROUP = "CODE_REF_KEY";

    @Id
    @Column(name = "GRP_CD", length = 30, nullable = false)
    private String grpCd;

    /** {@code CODE_REF_KEY} 공통코드의 화이트리스트 값 — 저장 서비스가 그 목록으로 판정한다. */
    @Id
    @Column(name = "REF_CD", length = 30, nullable = false)
    private String refCd;

    @Column(name = "REF_NM", length = 100, nullable = false)
    private String refNm;

    @Column(name = "REF_DESC", length = 500)
    private String refDesc;

    public static SysCodeGrpRef created(String grpCd, String refCd, String refNm, String refDesc) {
        SysCodeGrpRef entity = new SysCodeGrpRef();
        entity.grpCd = grpCd;
        entity.refCd = refCd;
        entity.apply(refNm, refDesc);
        return entity;
    }

    public void apply(String refNm, String refDesc) {
        this.refNm = refNm;
        this.refDesc = refDesc;
    }
}
