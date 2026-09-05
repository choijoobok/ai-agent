package com.aiagent.domain.notification.request;

import com.aiagent.core.search.QuerySpec;
import com.aiagent.core.search.SortDir;
import com.aiagent.domain.notification.entity.QSysNotiRequest;
import com.aiagent.domain.user.entity.QSysUser;

/**
 * {@code NOTI_REQUEST} 의 화이트리스트 — screen/noti-request/requirements.md · backend/api.md.
 *
 * <h2>기본 정렬이 <b>오름차순</b>이다 — 로그 3종과 반대다</h2>
 *
 * <p>64 의 이력은 <i>"방금 무슨 일이 있었나"</i> 를 묻지만 <b>처리함은 대기열</b>이고,
 * 대기열은 오래 기다린 것이 먼저다(screen/noti-request/requirements.md). 최신을 위에 두면 <b>가장 오래 방치된
 * 요청이 목록 맨 아래로 밀려 영원히 안 보인다</b>.
 *
 * <p>tie-breaker 는 PK 이며 backend/persistence.md 가 요구한다.
 *
 * <h2>조인이 사용자다 — 이름을 보여야 한다</h2>
 *
 * <p>{@code USER_ID} 만으로는 <i>누가 낸 요청인가</i> 를 판단할 수 없다. FK 가 걸려
 * 있으므로(sys/notification.md) {@code leftJoin} 이 아니라 {@code join} 이어도 행이 사라지지 않는다 —
 * {@code SYS_USER} 는 물리 삭제를 하지 않는다(USER-02 · screen/noti-request/requirements.md). {@code BatchHistorySpec}
 * 이 {@code leftJoin} 이어야 했던 것과 <b>갈리는 자리</b>다.
 *
 * <h2>{@code HANDLE_MEMO} 가 없다</h2>
 *
 * <p>{@code VARCHAR(2000)} 이라 실을 수는 있지만 <b>관리자가 그때 쓴 문장</b>이라 형식이
 * 없다. 조건으로 열면 {@code LIKE} 가 되고, 그 물음에 답하는 것은 {@code REQ_STAT_CD} 다 —
 * {@code BatchHistorySpec} 이 {@code RSLT_MSG} 를 뺀 것과 같은 근거다.
 */
public final class NotiRequestSpec {

    static final QSysNotiRequest R = QSysNotiRequest.sysNotiRequest;

    static final QSysUser U = QSysUser.sysUser;

    public static final QuerySpec SPEC = QuerySpec.of("notiRequest")
            .from(R)
            .join(U).on(U.userId.eq(R.userId))
            // 대기열의 정렬이자 조회조건의 기간 — 필수가 아니다(screen/noti-request/requirements.md).
            .col("creDtm", R.creDtm).sortable()
            .col("reqStatCd", R.reqStatCd)
            .col("reqTypeCd", R.reqTypeCd)
            .col("userId", R.userId)
            // 화면의 요청자 칸은 이름으로 찾는다 — ID 로 찾는 사람은 관리자뿐이다.
            .col("userNm", U.userNm)
            .col("reqId", R.reqId)
            .defaultSort("creDtm", SortDir.asc)
            .defaultSort("reqId", SortDir.asc)
            .pk(R.reqId)
            .build();

    private NotiRequestSpec() {}
}
