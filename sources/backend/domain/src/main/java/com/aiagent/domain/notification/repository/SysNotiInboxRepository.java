package com.aiagent.domain.notification.repository;

import com.aiagent.domain.notification.NotiType;
import com.aiagent.domain.notification.entity.SysNotiInbox;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 인앱 알림함 — 47 §7.
 *
 * <p>부르는 곳이 둘이다 — <b>파기 배치</b>(LOG-07)와 <b>알림 모달</b>의 <i>내 알림</i>
 * 탭(main-shell.md §7). 성격이 정반대이며 그것이 인덱스 셋의 이유다: 배치는 전 사용자를 기간으로
 * 훑고({@code IX_..._03}), 모달은 <b>한 사람의 것만</b> 최근순으로 읽는다({@code _01}) —
 * 배지는 그 사람의 미읽음을 센다({@code _02}).
 */
public interface SysNotiInboxRepository extends JpaRepository<SysNotiInbox, Long> {

    /**
     * 파기 대상의 <b>번호만</b> 한 청크 — LOG-07 · 32 §4-4 · 66 §6.3.
     *
     * <p><b>{@code READ_YN} 을 보지 않는다.</b> 47 §10 이 닫은 결정이며, 읽은 것만 지우면
     * <b>안 읽은 알림이 영원히 쌓이고</b> 그것이 정확히 지우고 싶은 행이다(아무도 안 보는
     * 알림). 조건이 기간 하나뿐인 것이 이 쿼리의 요점이다.
     *
     * <p>엔티티가 아니라 번호를 읽는 이유는 이력 3종과 같다 — 지울 것을 통째로 메모리에
     * 올릴 이유가 없다. 인덱스는 {@code IX_SYS_NOTI_INBOX_03(CRE_DTM)} 이며, 나머지 둘은
     * 선두가 {@code USER_ID} 라 <b>전 사용자를 훑는 이 질문에 쓸 수 없다</b>.
     */
    @Query("select n.notiId from SysNotiInbox n where n.creDtm < :cutoff")
    List<Long> findIdsCreatedBefore(@Param("cutoff") Instant cutoff, Pageable chunk);

    /**
     * <i>내 알림</i> 탭 — 최근 것이 위다.
     *
     * <p><b>tie-breaker 가 PK 다</b>(db-portability.md §4.5). {@code CRE_DTM} 만으로 정렬하면 만료 예고
     * 배치가 한 번에 넣은 수백 건이 <b>같은 시각</b>이라 순서가 요청마다 흔들리고, 상한에
     * 걸린 목록이면 <b>어느 것이 잘리는지도 흔들린다</b>.
     *
     * <p>인덱스는 {@code IX_SYS_NOTI_INBOX_01(USER_ID, CRE_DTM)} 이다.
     */
    List<SysNotiInbox> findByUserIdOrderByCreDtmDescNotiIdDesc(String userId, Pageable page);

    /** 전건 수 — 목록이 상한에 걸려 잘렸는지 화면이 이것으로 안다. */
    long countByUserId(String userId);

    /**
     * 미읽음 수 — <b>헤더 벨의 배지</b>다(main-shell.md §7.1).
     *
     * <p><b>목록 상한과 무관하게 전건을 센다.</b> 상한이 배지를 깎으면 <i>배지는 3인데
     * 목록엔 2</i> 가 생기고, 그때 사용자는 놓친 알림을 찾을 방법이 없다.
     */
    long countByUserIdAndReadYn(String userId, Boolean readYn);

    /**
     * 내 것 하나 — <b>{@code userId} 가 조건에 있는 것이 요점</b>이다.
     *
     * <p>{@code findById} 로 집고 나서 주인을 비교하면 <i>비교를 잊는 경로</i> 가 생긴다.
     * 알림은 사람마다 행이 다르므로(47 §7) 남의 번호를 넣으면 <b>없는 것</b>이어야 한다.
     */
    Optional<SysNotiInbox> findByNotiIdAndUserId(Long notiId, String userId);

    /** <i>모두 읽음</i> 이 집는 것 — 안 읽은 것만이다(main-shell.md §7.2). */
    List<SysNotiInbox> findByUserIdAndReadYn(String userId, Boolean readYn);

    /**
     * 최근에 <b>이 종류를 이미 받은</b> 사람 — 만료 예고 배치의 중복 방지(66 §6.2).
     *
     * <p><b>배치가 하루 두 번 돌 수 있다</b>(즉시 실행 · 65 §3.7). 그리고 예고 창은 며칠
     * 짜리라 창이 열려 있는 동안 <b>매일 같은 사람에게</b> 같은 말을 하게 된다 — 그것은
     * 알림이 아니라 소음이고, 소음이 되는 순간 사람은 배지를 보지 않는다.
     *
     * <p><b>되돌아보는 창을 예고 기간과 같게</b> 잡으면 한 창에 한 번이 된다. 배치가 하루
     * 걸렀어도 다음 날 잡히므로 <i>정확히 D-7 에만 보낸다</i> 보다 낫다 — 그 방식은
     * <b>거른 날의 사람을 영영 놓친다</b>.
     *
     * <p>인덱스는 {@code IX_SYS_NOTI_INBOX_03(CRE_DTM)} 이다 — 전 사용자를 기간으로 훑는
     * 질문이라 {@code USER_ID} 가 선두인 나머지 둘은 쓸 수 없다(파기 배치와 같은 자리).
     */
    @Query("select distinct n.userId from SysNotiInbox n"
            + " where n.notiTypeCd = :type and n.creDtm >= :since")
    List<String> findUserIdsNotifiedSince(
            @Param("type") NotiType type, @Param("since") Instant since);
}
