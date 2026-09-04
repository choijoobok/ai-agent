package com.aiagent.domain.sample;

import static com.aiagent.domain.sample.SampleRules.DEFAULT_TAG_TYPE;
import static com.aiagent.domain.sample.SampleRules.MAX_TAGS;
import static com.aiagent.domain.sample.SampleRules.requireUnlocked;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.grid.RowState;
import com.aiagent.domain.sample.entity.SmplOrder;
import com.aiagent.domain.sample.entity.SmplOrderTag;
import com.aiagent.domain.sample.repository.SmplOrderTagRepository;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 태그 탭의 저장 — 68 §7.4. <b>같은 테이블에 갈래가 둘이고, 다른 하나는 주문이 갖는다.</b>
 *
 * <p>①({@code SampleOrderService} 의 전량 교체)은 배열을 통째로 받고 여기는 행마다
 * {@code rowState} 를 본다. 이상해 보이는 것이 정직한 결과다 — <b>편집 어휘가 둘</b>이기
 * 때문이다:
 *
 * <table><caption></caption>
 *   <tr><td><b>배열 편집</b>(①)</td>
 *       <td>diff 를 뜰 수 없다. {@code SORT_NO} 가 값이라 항목 하나를 앞으로 끌면
 *           이름은 하나도 안 바뀌었는데 순서가 전부 바뀌고, 그때 diff 는
 *           <i>바뀐 것이 없다</i> 로 읽는다</td></tr>
 *   <tr><td><b>행 편집</b>(⑤)</td>
 *       <td>전량 교체를 할 수 없다. 손대지 않은 행까지 지웠다 넣으면
 *           <b>감사 컬럼이 전부 갱신</b>되어 <i>누가 언제 이 태그를 달았나</i> 를
 *           잃는다 — {@code SMPL_ORDER_TAG} 가 감사 컬럼을 갖는 이유가 사라진다</td></tr>
 * </table>
 *
 * <p><b>개수 상한은 {@link SampleRules} 가 갖는다</b> — 클래스가 갈린 뒤에도 두 갈래가 한
 * 값을 봐야 하기 때문이다({@code MAX_TAGS} 의 주석).
 */
@Service
public class SampleTagService {

    private final SmplOrderTagRepository tags;
    private final SampleQueryService queries;

    public SampleTagService(SmplOrderTagRepository tags, SampleQueryService queries) {
        this.tags = tags;
        this.queries = queries;
    }

    /**
     * ⑤의 저장 — 행마다 {@code rowState} 를 본다.
     *
     * <h2>{@code TAG_SEQ} 와 {@code SORT_NO} 가 <b>여기서 갈린다</b></h2>
     *
     * <p>주문의 전량 교체가 <i>"갈리는 날이 오면 그 메서드가 그 자리다"</i> 라고 적어 둔 그
     * 날이다. 신규 행의 {@code TAG_SEQ} 는 <b>주문 안의 다음 번호</b>이고 {@code SORT_NO} 는
     * <b>사용자가 적은 값</b>이다 — 순번을 유지한 채 순서만 바꾸는 편집이 이 화면에서
     * 성립한다.
     *
     * <p><b>순서가 겹치면 거부한다.</b> 같은 {@code SORT_NO} 가 둘이면 읽는 순서가
     * 정해지지 않고, 사용자에게는 <i>고치지도 않았는데 조회할 때마다 태그가 뒤바뀐다</i> 로
     * 보인다 — 48 §4.1 이 이 컬럼을 둔 이유가 그 증상을 없애는 것이었다.
     */
    @Transactional
    public void saveTags(long ordId, List<SmplTagSaveRow> rows) {
        SmplOrder order = queries.require(ordId);
        requireUnlocked(order);

        // 한 번 읽고 그 목록으로 다 한다 — 행마다 findById 를 부르면 왕복이 행 수만큼이다.
        Map<Integer, SmplOrderTag> current = new LinkedHashMap<>();
        for (SmplOrderTag tag : tags.findByOrdIdOrderBySortNoAscTagSeqAsc(ordId)) {
            current.put(tag.getTagSeq(), tag);
        }
        int nextSeq = current.keySet().stream().mapToInt(Integer::intValue).max().orElse(0) + 1;

        /*
          전건을 먼저 본다. 섞으면 거부되는 요청이 쓰기를 한 번 내고 돌아가며, 순서 중복은
          마지막 행에서야 드러나므로 앞의 행들이 이미 들어가 있다.
        */
        Map<Integer, Integer> wanted = new LinkedHashMap<>();
        current.forEach((tagSeq, tag) -> wanted.put(tagSeq, tag.getSortNo()));
        int probe = nextSeq;
        for (SmplTagSaveRow row : rows) {
            if (row.rowState() == RowState.D) {
                wanted.remove(requireTag(current, row).getTagSeq());
                continue;
            }
            validateTag(row);
            wanted.put(
                    row.rowState() == RowState.C ? probe++ : requireTag(current, row).getTagSeq(),
                    row.sortNo());
        }
        /*
          개수를 먼저 본다 — wanted 가 저장 뒤의 모습이라(지울 것은 빠졌다) 여기서 센 수가
          곧 결과다. 순서 중복보다 앞에 두는 것은 상한을 넘은 판에서 사용자가 할 일이
          **행을 빼는 것**이라, 그 전에 순서를 고치라고 말하면 두 번 고치게 되기 때문이다.

          ①의 배열 교체와 같은 값을 본다(MAX_TAGS) — 여기서만 넘길 수 있으면 그 주문을
          ①이 저장할 수 없게 된다.
        */
        if (wanted.size() > MAX_TAGS) {
            throw new BusinessException(
                    SampleErrorCode.TAG_TOO_MANY, "too many tags: " + wanted.size());
        }
        Set<Integer> seenSort = new HashSet<>();
        for (Integer sortNo : wanted.values()) {
            if (!seenSort.add(sortNo)) {
                throw new BusinessException(
                        SampleErrorCode.TAG_SORT_DUPLICATED, "duplicated sortNo: " + sortNo);
            }
        }

        for (SmplTagSaveRow row : rows) {
            String tagTypeCd = row.tagTypeCd() == null ? DEFAULT_TAG_TYPE : row.tagTypeCd();
            switch (row.rowState()) {
                case C -> {
                    tags.save(SmplOrderTag.of(
                            ordId, nextSeq, row.tagNm().trim(), tagTypeCd, row.sortNo()));
                    nextSeq += 1;
                }
                case U -> requireTag(current, row).modify(row.tagNm().trim(), tagTypeCd, row.sortNo());
                case D -> tags.delete(requireTag(current, row));
            }
        }
    }

    /**
     * 태그 한 행의 검증 — <b>화면이 이미 막았어도 다시 본다</b>(grid-edit-validation.md §3.4).
     *
     * <p>{@code SORT_NO} 가 필수인 것은 {@code NOT NULL} 이라서가 아니라 <b>값이기</b>
     * 때문이다(48 §4.1) — 비워 두면 그 태그의 자리가 정해지지 않는다.
     */
    private static void validateTag(SmplTagSaveRow row) {
        if (row.tagNm() == null || row.tagNm().isBlank()) {
            throw new BusinessException(SampleErrorCode.TAG_REQUIRED, "tag name is required");
        }
        if (row.sortNo() == null) {
            throw new BusinessException(SampleErrorCode.TAG_REQUIRED, "sortNo is required");
        }
    }

    /**
     * 고치거나 지울 대상 &mdash; <b>이미 읽어 둔 목록에서</b> 찾는다.
     *
     * <p>{@code findById} 를 부르지 않는 것은 왕복 때문만이 아니다: 요청이 가리키는 태그가
     * <b>이 주문의 것인지</b>를 목록이 곧 답한다 &mdash; 키로 찾으면 {@code ordId} 를 함께
     * 넣는 것을 잊는 날 <b>남의 주문 태그를 고치는 요청</b>이 성립한다.
     */
    private static SmplOrderTag requireTag(Map<Integer, SmplOrderTag> current, SmplTagSaveRow row) {
        SmplOrderTag found = row.tagSeq() == null ? null : current.get(row.tagSeq());
        if (found == null) {
            throw new BusinessException(SampleErrorCode.NOT_FOUND, "no such tag: " + row.tagSeq());
        }
        return found;
    }
}
