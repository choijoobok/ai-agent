package com.ordinary.backoffice.domain.sample;

import com.ordinary.backoffice.core.grid.RowState;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 태그 탭 저장의 한 행 &mdash; 68 &sect;7.4.
 *
 * <p><b>{@code ordId} 가 없다.</b> 대상 주문은 행이 아니라 요청이 나른다
 * ({@code SampleTagSaveRequest.ordId}) &mdash; {@link SmplOrderItemSaveRow} 와 같은 이유이며,
 * 행마다 받으면 한 요청에 여러 주문의 태그가 섞인다.
 *
 * <h2>&#9312;의 저장과 <b>갈래가 다르다</b></h2>
 *
 * <p>&#9312;은 배열을 통째로 보내고 서버가 <b>전량 교체</b>한다. 여기는 행마다
 * {@code rowState} 를 실어 <b>C&middot;U&middot;D 를 각각</b> 반영한다. 같은 테이블에
 * 저장 갈래가 둘인 것이 이상해 보이지만, 그것이 <b>편집 어휘가 둘</b>이라는 사실의
 * 정직한 결과다 &mdash; 배열 편집은 diff 를 뜰 수 없고({@code SORT_NO} 가 값이라
 * 항목 하나를 끌면 순서가 전부 바뀐다) 행 편집은 전량 교체를 할 수 없다(감사 컬럼이
 * 손대지 않은 행까지 갱신된다).
 *
 * <p>{@code tagSeq} 는 신규 행에서 {@code null} 이다 &mdash; 주문 안의 다음 번호를
 * 서버가 정한다.
 */
public record SmplTagSaveRow(
        @NotNull RowState rowState,
        Integer tagSeq,
        @Size(max = 50) String tagNm,
        @Size(max = 20) String tagTypeCd,
        Integer sortNo) {}
