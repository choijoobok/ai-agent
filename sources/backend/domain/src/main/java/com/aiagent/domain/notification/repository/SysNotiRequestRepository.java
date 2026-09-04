package com.aiagent.domain.notification.repository;

import com.aiagent.domain.notification.ReqStatus;
import com.aiagent.domain.notification.ReqType;
import com.aiagent.domain.notification.entity.SysNotiRequest;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 요청함 — 47 §8. 조회는 {@code QuerySpec} 을 지난다(api-conventions.md §4.1).
 *
 * <p><b>보존 기간이 아직 없다</b>(66 §8 미결). 요청은 개인이 낸 것이라 로그와 성격이
 * 다르고, 짧게 잡으면 <i>"작년에 낸 요청"</i> 의 답이 사라진다.
 */
public interface SysNotiRequestRepository extends JpaRepository<SysNotiRequest, Long> {

    /**
     * 처리 대상을 <b>한 번에</b> 집는다 — 66 §5.7.
     *
     * <p>행마다 {@code findById} 를 부르지 않는 이유는 N+1 이 아니라 <b>판정 때문</b>이다:
     * 선택에 이미 처리된 것이 섞이면 <b>전부 막아야</b> 하므로(부분 실행하지 않는다)
     * 전건을 먼저 손에 쥐어야 한다.
     */
    List<SysNotiRequest> findAllByReqIdIn(List<Long> reqIds);

    /**
     * <i>내 요청</i> 탭 — <b>최신이 위</b>다.
     *
     * <p>{@code NOTI_REQUEST} 메뉴의 오름차순과 <b>반대</b>이며 그것이 의도다(66 §5.2.1):
     * 저쪽은 <b>대기열</b>이라 오래 기다린 것이 먼저지만, 여기는 <b>내 이력</b>이라
     * 방금 낸 것이 위여야 한다 — 내가 낸 요청이 어떻게 됐는지가 물음이다.
     *
     * <p>tie-breaker 는 PK 다(db-portability.md §4.5).
     */
    List<SysNotiRequest> findByUserIdOrderByCreDtmDescReqIdDesc(String userId, Pageable page);

    /** 전건 수 — 목록이 상한에 걸려 잘렸는지 화면이 이것으로 안다. */
    long countByUserId(String userId);

    /**
     * 같은 유형이 <b>답을 기다리는 중</b>인가 — 여벌 요청을 막는다.
     *
     * <p>인덱스는 {@code IX_SYS_NOTI_REQUEST_02(USER_ID, CRE_DTM)} 의 선두를 쓴다. 한
     * 사람의 요청은 많아야 수십 건이라 나머지 조건은 그 위에서 걸린다.
     */
    boolean existsByUserIdAndReqTypeCdAndReqStatCd(
            String userId, ReqType reqTypeCd, ReqStatus reqStatCd);
}
