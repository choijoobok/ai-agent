package com.aiagent.domain.sample.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Nationalized;

/**
 * 샘플 주문 태그 — playbook/INDEX.md. <b>{@code list} 컬럼의 저장 형태다.</b>
 *
 * <p>frontend/grid.md 이 <i>"`list` 를 서버가 어떻게 저장하나 — 자식 테이블 행들인지 직렬화 문자열
 * 인지"</i> 를 미결로 남겼고 playbook/INDEX.md 이 <b>자식 테이블</b>로 닫았다. 근거가 셋이다:
 * 직렬화 문자열은 {@code JSON} 타입을 부르거나(22 가 4벤더 분기를 떠안는다) 구분자가
 * 값에 드는 날 조용히 깨지고, <i>이 태그가 붙은 주문</i> 이 {@code LIKE '%…%'} 가 되어
 * <b>{@code 개발} 이 {@code 개발자} 에 걸린다</b>.
 *
 * <h2>{@code SORT_NO} 가 컬럼인 것이 자식 테이블의 값이다</h2>
 *
 * <p>배열의 순서는 직렬화 문자열이면 공짜로 얻는다. 행으로 펴는 순간 그것을 잃으므로
 * 컬럼으로 되사는 것이며, 없으면 <b>저장하고 다시 읽을 때마다 태그 순서가 바뀐다</b> —
 * 사용자에게는 <i>고치지도 않았는데 값이 달라졌다</i> 로 보인다.
 *
 * <h2>{@code TAG_TYPE_CD} 는 <b>항목이 스칼라가 아닌 쪽</b>의 실물이다</h2>
 *
 * <p>frontend/grid.md 이 {@code list} 항목을 객체로 열어 두었다. 문자열 배열만 다루면 그 문이 열려
 * 있다는 사실에 실물이 없다.
 */
@Entity
@Table(name = "SMPL_ORDER_TAG")
@IdClass(SmplOrderTagId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SmplOrderTag extends BaseAuditEntity {

    @Id
    @Column(name = "ORD_ID")
    private Long ordId;

    @Id
    @Column(name = "TAG_SEQ")
    private Integer tagSeq;

    @Nationalized
    @Column(name = "TAG_NM", length = 50, nullable = false)
    private String tagNm;

    @Column(name = "TAG_TYPE_CD", length = 20, nullable = false)
    private String tagTypeCd;

    @Column(name = "SORT_NO", nullable = false)
    private int sortNo;

    /**
     * 행 편집이 고치는 셋 &mdash; 68 &sect;7.4.
     *
     * <p><b>{@code TAG_SEQ} 는 없다.</b> 복합 PK 의 절반이라 고치면 <i>같은 행을 고친
     * 것</i>이 아니라 <b>다른 행</b>이며, 그 요청은 지우고 새로 만드는 것으로 표현된다
     * (54 &sect;5.1 의 {@code pk} 컬럼과 같은 규칙).
     *
     * <p><b>{@code SORT_NO} 는 있다.</b> &#9312;에서 그 둘이 같은 값이었던 것은 배열
     * 편집의 결과일 뿐이고(그쪽은 순서가 곧 색인이다), 행 편집에서는 <b>순번을 유지한 채
     * 순서만</b> 바꾸는 것이 자연스러운 동작이다.
     */
    public void modify(String tagNm, String tagTypeCd, int sortNo) {
        this.tagNm = tagNm;
        this.tagTypeCd = tagTypeCd;
        this.sortNo = sortNo;
    }

    public static SmplOrderTag of(Long ordId, int tagSeq, String tagNm, String tagTypeCd, int sortNo) {
        SmplOrderTag tag = new SmplOrderTag();
        tag.ordId = ordId;
        tag.tagSeq = tagSeq;
        tag.tagNm = tagNm;
        tag.tagTypeCd = tagTypeCd;
        tag.sortNo = sortNo;
        return tag;
    }
}
