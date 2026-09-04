package com.aiagent.domain.sample;

import static com.aiagent.domain.sample.SampleOrderServiceTest.order;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.grid.RowState;
import com.aiagent.domain.sample.entity.SmplOrderTag;
import com.aiagent.domain.sample.repository.SmplOrderTagRepository;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 태그의 <b>행 편집</b> — playbook/INDEX.md. ⑤의 저장이며 ①의 배열 교체와 어휘가 다르다.
 *
 * <p>여기서 세는 것은 <b>저장 뒤의 개수</b>다. 상한을 넘겨 만들 수 있으면 그 주문을
 * <b>①이 저장할 수 없게 된다</b> — 배열을 통째로 보내므로 자기가 만들지도 않은 개수에
 * 걸리며, 사용자에게는 <i>고친 것도 없는데 저장이 거부된다</i> 로 보인다. 그래서 두
 * 서비스가 {@link SampleRules#MAX_TAGS} 하나를 본다({@link SampleOrderServiceTest} 의 ①).
 *
 * <p><b>쓰기 전에 막는지도 함께 본다.</b> 거부되는 요청이 쓰기를 한 번 내고 돌아가면
 * 롤백해도 시퀀스는 뛴다.
 */
class SampleTagServiceTest {

    private final SmplOrderTagRepository tags = mock(SmplOrderTagRepository.class);
    private final SampleQueryService queries = mock(SampleQueryService.class);

    private final SampleTagService service = new SampleTagService(tags, queries);

    /** 태그 행 하나 — 상태와 순번과 순서만 갈린다. */
    private static SmplTagSaveRow tagRow(RowState state, Integer tagSeq, int sortNo) {
        return new SmplTagSaveRow(state, tagSeq, "태그" + sortNo, "GEN", sortNo);
    }

    private static List<SmplOrderTag> existing(int count) {
        List<SmplOrderTag> rows = new ArrayList<>();
        for (int index = 1; index <= count; index++) {
            rows.add(SmplOrderTag.of(1L, index, "태그" + index, "GEN", index));
        }
        return rows;
    }

    @Test
    @DisplayName("저장 뒤의 개수를 센다 — 상한을 넘겨 만들 수 없다")
    void rejectsOverLimitInRowEditing() {
        when(queries.require(1L)).thenReturn(order("SO-1", "RCV"));
        when(tags.findByOrdIdOrderBySortNoAscTagSeqAsc(1L))
                .thenReturn(existing(SampleRules.MAX_TAGS));

        assertThatThrownBy(() ->
                        service.saveTags(
                                1L, List.of(tagRow(RowState.C, null, SampleRules.MAX_TAGS + 1))))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("too many tags");

        verify(tags, never()).save(any());
    }

    /*
      <b>지나치게 막는 쪽의 실패다.</b> 지울 행은 결과에 없으므로 상한에 붙은 판에서도
      <i>하나 지우고 하나 넣는</i> 편집이 통과해야 한다 — frontend/grid.md 이 그리드 검증을
      <b>삭제 행을 뺀 결과</b>로 계산하라고 한 이유가 이것이다.
    */
    @Test
    @DisplayName("하나 지우고 하나 넣는 편집은 통과한다 — 결과가 상한이다")
    void allowsSwapAtLimit() {
        when(queries.require(1L)).thenReturn(order("SO-1", "RCV"));
        when(tags.findByOrdIdOrderBySortNoAscTagSeqAsc(1L))
                .thenReturn(existing(SampleRules.MAX_TAGS));

        service.saveTags(
                1L,
                List.of(
                        tagRow(RowState.D, 1, 1),
                        tagRow(RowState.C, null, SampleRules.MAX_TAGS + 1)));

        verify(tags).save(any());
    }
}
