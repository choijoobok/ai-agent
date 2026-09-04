package com.aiagent.domain.code.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 참조 <b>값</b> — 43 §5.3 · §5.4. <b>매트릭스의 셀</b>이다.
 *
 * <p>부모가 둘이다 — 행({@link SysCode})과 열({@link SysCodeGrpRef}). 그래서 <b>정의 없는
 * 참조값이 구조적으로 생길 수 없다</b>(43 §2).
 *
 * <p><b>없는 값은 행이 없는 것이다</b>(43 §5.4). {@code USE_YN} 도 {@code NULL} 도 빈 문자열도
 * 두지 않으며, 화면이 셀을 비우고 저장하면 서비스가 그 행을 <b>지운다</b> — 남기면 <i>"없음"</i>
 * 의 표현이 둘이 되고, 읽는 쪽이 매번 두 가지를 함께 판정해야 한다.
 *
 * <p>대가는 <b>끈 값을 기억하지 못하는 것</b>이다. 감사 4컬럼도 행과 함께 사라진다 —
 * 참조값은 코드값 하나이므로 다시 넣는 비용이 낮고, 코드 자체를 끄는 길({@code USE_YN='N'})
 * 은 그대로 있다.
 */
@Entity
@Table(name = "SYS_CODE_REF")
@IdClass(SysCodeRefId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysCodeRef extends BaseAuditEntity {

    @Id
    @Column(name = "GRP_CD", length = 30, nullable = false)
    private String grpCd;

    @Id
    @Column(name = "DTL_CD", length = 30, nullable = false)
    private String dtlCd;

    @Id
    @Column(name = "REF_CD", length = 30, nullable = false)
    private String refCd;

    /** <b>PK 가 아니다</b> — 넣으면 같은 속성에 {@code Y}/{@code N} 이 공존한다(10 MASTER-10). */
    @Column(name = "REF_VAL", length = 200, nullable = false)
    private String refVal;

    public static SysCodeRef of(String grpCd, String dtlCd, String refCd, String refVal) {
        SysCodeRef entity = new SysCodeRef();
        entity.grpCd = grpCd;
        entity.dtlCd = dtlCd;
        entity.refCd = refCd;
        entity.changeValue(refVal);
        return entity;
    }

    /**
     * <b>부르는 쪽이 {@code null} 을 넘기지 않는다.</b> 값을 비우는 것은 수정이 아니라
     * <b>행 삭제</b>이며 그 판단은 저장 서비스가 한다 — 여기서 받아 주면 {@code REF_VAL IS
     * NULL} 인 행이 남아 <i>"값 없음"</i> 이 두 모양을 갖는다(43 §5.4).
     */
    public void changeValue(String refVal) {
        this.refVal = Objects.requireNonNull(refVal, "refVal");
    }
}
