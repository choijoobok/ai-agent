package com.ordinary.backoffice.domain.sample;

import java.time.Instant;

/**
 * 태그 탭의 한 행 &mdash; 68 &sect;7.2.
 *
 * <p><b>{@link SmplOrderTagRow} 와 같은 데이터의 다른 모양이다.</b> 이름을 물려받지 못한
 * 것이 우연이 아니라 이 화면의 주제다 &mdash; 저쪽은 &#9312;의 {@code list} 컬럼이 나르는
 * <b>항목</b>이라 {@code TAG_NM} 과 {@code TAG_TYPE_CD} 둘뿐이고, 이쪽은 <b>행</b>이라
 * 키와 순서와 감사 컬럼을 함께 싣는다. 48 &sect;4.1 이 <i>"배열은 화면의 어휘이고 저장은
 * 자식 테이블"</i> 로 닫은 그 결정이, 두 record 를 나란히 놓아야 눈에 보인다.
 *
 * <h2>{@code tagSeq} 와 {@code sortNo} 를 <b>둘 다</b> 싣는다</h2>
 *
 * <p>&#9312;에서는 같은 값이었다 &mdash; {@code listModal} 이 배열을 통째로 보내므로
 * 서버가 {@code index + 1} 을 둘에 함께 넣는다({@code SampleOrderService.replaceTags}).
 * 그 메서드의 주석이 <i>"갈리는 날이 오면"</i> 이라고 적어 둔 날이 이 화면이다: 행으로
 * 편집하면 <b>순번을 유지한 채 순서만</b> 바꿀 수 있고, 그때 둘이 갈린다.
 *
 * <p>그래서 화면이 <b>둘 다 그린다</b>. 하나만 그리면 그 갈림이 데이터에만 있고 화면에는
 * 없어, 다음 사람이 <i>왜 컬럼이 둘인가</i> 를 테이블에서 유추해야 한다.
 */
public record SmplTagRow(
        String ordId,
        Integer tagSeq,
        String tagNm,
        String tagTypeCd,
        Integer sortNo,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
