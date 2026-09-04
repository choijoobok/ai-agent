package com.ordinary.backoffice.domain.sample.repository;

import com.ordinary.backoffice.domain.sample.entity.SmplOrderTag;
import com.ordinary.backoffice.domain.sample.entity.SmplOrderTagId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** {@link SmplOrderTag} — 48 §4.1. 읽기는 언제나 주문 단위이고 순서는 {@code SORT_NO} 다. */
public interface SmplOrderTagRepository extends JpaRepository<SmplOrderTag, SmplOrderTagId> {

    List<SmplOrderTag> findByOrdIdInOrderByOrdIdAscSortNoAsc(List<Long> ordIds);

    /**
     * &#9316;의 태그 탭이 읽는 것 &mdash; 68 &sect;7.2.
     *
     * <p><b>정렬이 {@code SORT_NO} 뒤에 {@code TAG_SEQ} 다.</b> 위의 것과 갈리는 자리이며,
     * 행 편집이 <b>둘을 갈라 놓을 수 있기</b> 때문이다(48 &sect;4.1) &mdash; 사용자가 두 행에
     * 같은 순서를 주면 {@code SORT_NO} 만으로는 순서가 정해지지 않고, 그러면 <i>고치지도
     * 않았는데 조회할 때마다 태그가 뒤바뀐다</i>. 저장은 그것을 거부하지만(중복 검사)
     * 화면 밖 경로와 시드가 남아 있으므로 읽기가 스스로 결정적이어야 한다.
     */
    List<SmplOrderTag> findByOrdIdOrderBySortNoAscTagSeqAsc(Long ordId);

    void deleteByOrdId(Long ordId);
}
