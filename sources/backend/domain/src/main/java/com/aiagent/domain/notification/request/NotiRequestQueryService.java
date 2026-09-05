package com.aiagent.domain.notification.request;

import static com.aiagent.domain.notification.request.NotiRequestSpec.R;
import static com.aiagent.domain.notification.request.NotiRequestSpec.SPEC;
import static com.aiagent.domain.notification.request.NotiRequestSpec.U;

import com.aiagent.core.search.InChunks;
import com.aiagent.core.search.PageMode;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.search.Built;
import com.aiagent.domain.search.QueryDslBuilder;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.Expression;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code NOTI_REQUEST} 의 조회 — screen/notice/requirements.md.
 *
 * <h2>처리자 이름을 두 번째 조인으로 얻지 않는다</h2>
 *
 * <p>{@code SYS_USER} 를 한 번 더 {@code leftJoin} 하면 될 것 같지만 그러지 않는다 —
 * 요청자 조인은 {@code join}(FK 가 있다)이고 처리자 조인은 {@code leftJoin}(미처리면
 * {@code null})이라 <b>성격이 다른 조인 둘</b>이 한 쿼리에 섞인다. 그리고
 * {@code QuerySpec} 은 조인 하나에 별칭 하나를 가정한다.
 *
 * <p>대신 페이지의 {@code HANDLER_ID} 를 모아 <b>한 번 더 묻는다</b> —
 * {@code BatchScheduleQueryService} 가 이력을 행마다 묻지 않은 것과 같은 방식이다.
 * 대개 처리자는 몇 명뿐이라 이 왕복이 싸다.
 */
@Service
@Transactional(readOnly = true)
public class NotiRequestQueryService {

    private static final Expression<?>[] LIST = {
        R.reqId,
        R.creDtm,
        R.userId,
        U.userNm,
        U.useYn,
        R.reqTypeCd,
        R.reqContent,
        R.reqStatCd,
        R.handlerId,
        R.handleDtm,
        R.handleMemo
    };

    private final JPAQueryFactory query;
    private final QueryDslBuilder builder;

    public NotiRequestQueryService(JPAQueryFactory query, QueryDslBuilder builder) {
        this.query = query;
        this.builder = builder;
    }

    /**
     * 대기열 — 기본 정렬이 <b>요청일시 오름차순</b>이고 조회조건 기본값이
     * {@code RECEIVED} 하나다(screen/noti-request/requirements.md).
     */
    public PageResponse<NotiRequestRow> getList(SearchRequest<Void> request) {
        Built built = builder.build(request, SPEC, PageMode.offset);

        List<Tuple> found = built.apply(query.select(Projections.tuple(LIST))).fetch();
        Long total = built.count(query).fetchOne();

        Map<String, String> handlerNames = namesOf(
                found.stream().map(row -> row.get(R.handlerId)).filter(id -> id != null).toList());

        List<NotiRequestRow> rows = new ArrayList<>(found.size());
        for (Tuple row : found) {
            String handlerId = row.get(R.handlerId);
            rows.add(new NotiRequestRow(
                    row.get(R.reqId),
                    row.get(R.creDtm),
                    row.get(R.userId),
                    row.get(U.userNm),
                    row.get(U.useYn),
                    row.get(R.reqTypeCd),
                    row.get(R.reqContent),
                    row.get(R.reqStatCd),
                    handlerId,
                    handlerId == null ? null : handlerNames.get(handlerId),
                    row.get(R.handleDtm),
                    row.get(R.handleMemo)));
        }
        return built.respond(rows, total == null ? 0L : total);
    }

    /**
     * 처리자 ID → 이름.
     *
     * <p><b>없는 ID 는 그냥 빠진다.</b> {@code HANDLER_ID} 에는 FK 가 없으므로(sys/notification.md)
     * 이론상 끊어질 수 있고, 그때 화면은 ID 를 그대로 보인다 — 이름을 못 찾은 것이
     * 조회를 실패시킬 이유는 아니다.
     */
    private Map<String, String> namesOf(List<String> handlerIds) {
        if (handlerIds.isEmpty()) {
            return Map.of();
        }
        Map<String, String> names = new HashMap<>();
        for (List<String> chunk : InChunks.split(handlerIds.stream().distinct().toList())) {
            for (Tuple row : query.select(U.userId, U.userNm).from(U).where(U.userId.in(chunk)).fetch()) {
                names.put(row.get(U.userId), row.get(U.userNm));
            }
        }
        return names;
    }
}
