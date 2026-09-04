package com.aiagent.domain.code.repository;

import com.aiagent.domain.code.entity.SysCode;
import com.aiagent.domain.code.entity.SysCodeId;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SysCodeRepository extends JpaRepository<SysCode, SysCodeId> {

    /**
     * 그룹 삭제의 게이트가 읽는 값 — frontend/grid.md · screen/code/requirements.md.
     *
     * <p>화면은 하단의 행 수로 이미 판정하지만(조회 시점), <b>그 사이에 다른 사람이 코드를
     * 추가할 수 있다</b>. 저장 시점에 한 번 더 세는 것이 그 창을 좁히며, 그래도 남는 창은
     * FK 가 닫는다 — screen/code/requirements.md 가 <i>"동시성으로 뚫릴 수 있다"</i> 고 미리 적어 둔 그것이다.
     */
    long countByGrpCd(String grpCd);

    List<SysCode> findByGrpCd(String grpCd);

    /**
     * 콤보 후보 — {@code USE_YN='Y'} 만, 그룹별 {@code SORT_NO} 순이다(sys/code.md).
     *
     * <p>{@code DTL_CD} 를 정렬의 <b>둘째 키</b>로 둔다. {@code SORT_NO} 가 같은 행이 있으면
     * 나머지 순서를 DB 가 정하는데 그것은 <b>매 조회 같다는 보장이 없다</b> — 콤보의 항목이
     * 자리를 바꾸면 손이 자리를 기억하지 못한다.
     */
    default List<SysCode> findForCombo(Collection<String> grpCds) {
        return findByGrpCdInAndUseYnOrderByGrpCdAscSortNoAscDtlCdAsc(grpCds, true);
    }

    /**
     * <b>이름이 곧 쿼리다</b> — JPQL 을 손으로 적지 않는다. {@code USE_YN} 은 {@code CHAR(1)}
     * 이라({@code YnConverter}) 리터럴 {@code true} 로 비교하면 벤더마다 갈리는데, 파라미터로
     * 넘기면 컨버터가 {@code 'Y'} 로 바꿔 준다 — 그 컨버터의 Javadoc 이 경계한 자리다.
     *
     * <p>부르는 곳은 {@link #findForCombo} 하나다. 긴 이름을 서비스가 읽게 두면 <b>정렬과
     * 필터가 호출부의 지식</b>이 되어, 그 규칙을 고칠 때 부르는 곳을 전부 찾아야 한다.
     */
    List<SysCode> findByGrpCdInAndUseYnOrderByGrpCdAscSortNoAscDtlCdAsc(
            Collection<String> grpCds, Boolean useYn);
}
