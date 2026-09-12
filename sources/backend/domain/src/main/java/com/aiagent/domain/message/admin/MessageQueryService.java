package com.aiagent.domain.message.admin;

import static com.aiagent.domain.message.admin.MessageSpec.K;
import static com.aiagent.domain.message.admin.MessageSpec.M;
import static com.aiagent.domain.message.admin.MessageSpec.SPEC;

import com.aiagent.core.search.InChunks;
import com.aiagent.core.search.PageMode;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.message.MessageScope;
import com.aiagent.domain.search.Built;
import com.aiagent.domain.search.QueryDslBuilder;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.MessageProps;
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
 * {@code MESSAGE_MGMT} 의 조회 — screen/admin/system/message/requirements.md.
 *
 * <p><b>쿼리가 둘이고 그것이 설계다.</b> 마스터 페이지를 먼저 확정한 뒤 <b>그 키들의 값만</b>
 * 읽는다. 한 번에 조인해 뽑으면 언어 수만큼 행이 불어나 <b>페이징 단위가 키가 아니라 (키 ×
 * 언어)</b> 가 되고, 20건을 요청한 사용자가 키 10개를 받는다.
 *
 * <p>값 조회는 <b>키 목록에 대한 고정형</b>이다(backend/api.md) — 동적 봉투를 태울 이유가 없고,
 * 태우면 부모 키 제약이 클라이언트가 보낸 조건이 된다.
 */
@Service
@Transactional(readOnly = true)
public class MessageQueryService {

    /**
     * 마스터 컬럼만 — {@code values} 는 두 번째 쿼리가 채운다.
     *
     * <p>{@code useScope} 를 그대로 뽑고 {@code bundled} 는 여기서 계산하지 않는다.
     * {@code Projections} 안에서 조건식을 쓰면 그 규칙이 SQL 로 내려가 {@link
     * MessageScope#bundled()} 와 갈린다.
     */
    private static final Expression<?>[] MASTER = {
        K.msgKey, K.useScope, K.msgDesc, K.regId, K.regDtm, K.modId, K.modDtm
    };

    private final JPAQueryFactory query;
    private final QueryDslBuilder builder;
    private final ConfigLookup configs;

    public MessageQueryService(
            JPAQueryFactory query, QueryDslBuilder builder, ConfigLookup configs) {
        this.query = query;
        this.builder = builder;
        this.configs = configs;
    }

    public PageResponse<MessageKeyRow> getList(SearchRequest<Void> request) {
        Built built = builder.build(request, SPEC, PageMode.offset);

        List<Tuple> masters = built.apply(query.select(Projections.tuple(MASTER))).fetch();
        long total = totalOf(built);

        List<String> msgKeys = masters.stream().map(row -> row.get(K.msgKey)).toList();
        Map<String, Map<String, String>> valuesByKey = valuesOf(msgKeys);
        List<String> langs = configs.get(MessageProps.class).supported();

        List<MessageKeyRow> rows = new ArrayList<>(masters.size());
        for (Tuple master : masters) {
            String msgKey = master.get(K.msgKey);
            Map<String, String> values = valuesByKey.getOrDefault(msgKey, Map.of());
            MessageScope scope = master.get(K.useScope);
            rows.add(new MessageKeyRow(
                    msgKey,
                    scope,
                    scope != null && scope.bundled(),
                    master.get(K.msgDesc),
                    master.get(K.regId),
                    master.get(K.regDtm),
                    master.get(K.modId),
                    master.get(K.modDtm),
                    langs.stream().map(lang -> new MessageValue(lang, values.get(lang))).toList()));
        }
        return built.respond(rows, total);
    }

    /**
     * 마스터 페이지의 키들에 대한 값.
     *
     * <p><b>{@code IN} 을 쪼갠다</b>(backend/persistence.md). 페이지 하나 분량이라 지금은 최대 1000개인데
     * 그것이 <b>오라클의 한계와 같은 값</b>이다 — 상한을 한 칸만 올려도 깨지고, 그 실패는
     * <b>오라클로 배포한 뒤에야</b> 나타난다.
     *
     * <p>여기는 <b>반복 질의</b>로 나눈다. 조건절 안의 {@code IN}(사용자 검색 조건)과 달리
     * 이 질의는 그 자체가 목적이므로, 조각마다 부르고 <b>결과를 한 맵에 모으면</b> 된다 —
     * 순서가 결과에 관여하지 않는다(키로 찾아 쓴다).
     */
    private Map<String, Map<String, String>> valuesOf(List<String> msgKeys) {
        if (msgKeys.isEmpty()) {
            return Map.of();
        }
        Map<String, Map<String, String>> result = new HashMap<>();
        for (List<String> chunk : InChunks.split(msgKeys)) {
            for (Tuple row : query.select(M.msgKey, M.langCd, M.msgVal)
                    .from(M)
                    .where(M.msgKey.in(chunk))
                    .fetch()) {
                result.computeIfAbsent(row.get(M.msgKey), key -> new HashMap<>())
                        .put(row.get(M.langCd), row.get(M.msgVal));
            }
        }
        return result;
    }

    private long totalOf(Built built) {
        Long total = built.count(query).fetchOne();
        return total == null ? 0L : total;
    }
}
