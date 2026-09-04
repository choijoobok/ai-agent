package com.ordinary.backoffice.domain.code.admin;

import static com.ordinary.backoffice.domain.code.admin.CodeSpec.C;
import static com.ordinary.backoffice.domain.code.admin.CodeSpec.CODE_SPEC;
import static com.ordinary.backoffice.domain.code.admin.CodeSpec.G;
import static com.ordinary.backoffice.domain.code.admin.CodeSpec.GROUP_SPEC;
import static com.ordinary.backoffice.domain.code.admin.CodeSpec.R;
import static com.ordinary.backoffice.domain.code.admin.CodeSpec.REF_DEF_SPEC;

import com.ordinary.backoffice.core.search.InChunks;
import com.ordinary.backoffice.core.search.PageMode;
import com.ordinary.backoffice.core.search.PageResponse;
import com.ordinary.backoffice.core.search.SearchRequest;
import com.ordinary.backoffice.domain.code.entity.QSysCodeRef;
import com.ordinary.backoffice.domain.code.entity.SysCode;
import com.ordinary.backoffice.domain.message.service.MessageService;
import com.ordinary.backoffice.domain.search.Built;
import com.ordinary.backoffice.domain.search.QueryDslBuilder;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.Expression;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code CODE_MGMT} 의 조회 — 63 §2.
 *
 * <h2>그리드 셋이 페이징 모드 둘을 쓴다</h2>
 *
 * 마스터만 {@code offset} 이고 하단과 정의 모달은 <b>{@code all}</b> 이다. 63 §2.8 이
 * 참조값을 <b>컬럼 필터</b>로 거르기로 하면서 <i>"하단은 한 그룹의 코드 목록이라 그 범위가
 * 곧 전부다"</i> 라고 적었는데, 페이징하면 그 문장이 거짓이 된다 — 컬럼 필터는 <b>현재
 * 페이지 안에서만</b> 걸리므로(grid-column-contract.md §4.1) 매트릭스의 빈 칸을 세는 일이 장마다 답이 달라진다.
 *
 * <h2>코드명은 조인이 아니라 메시지 캐시에서 온다</h2>
 *
 * 43 §7.3 의 폴백(요청 언어 → 기본 언어 → <b>키 문자열</b>)이 이미 {@link MessageService}
 * 하나에 있다. 여기서 아우터 조인을 한 벌 더 쓰면 <b>같은 폴백이 두 곳</b>이 되고, SQL 쪽은
 * 두 언어를 겹치는 판정을 벤더 문법으로 다시 써야 한다.
 *
 * <p><b>조건 쪽은 그럴 수 없어 서브쿼리다</b>({@code codeNm} — {@link CodeSpec}). 거기서는
 * <i>어느 언어든</i> 이 규칙이라 폴백이 등장하지 않는다 — 두 자리의 규칙이 다른 것이 아니라
 * <b>묻는 것이 다르다</b>: 화면에 낼 값 하나와 <i>이 문구를 가진 코드가 있는가</i> 다.
 */
@Service
@Transactional(readOnly = true)
public class CodeQueryService {

    private static final QSysCodeRef V = QSysCodeRef.sysCodeRef;

    private static final Expression<?>[] GROUP = {
        G.grpCd, G.grpNm, G.grpDesc, G.sortNo, G.sysYn, G.regId, G.regDtm, G.modId, G.modDtm
    };

    private static final Expression<?>[] CODE = {
        C.dtlCd, C.dtlDesc, C.useYn, C.sortNo, C.sysYn, C.regId, C.regDtm, C.modId, C.modDtm
    };

    private static final Expression<?>[] REF_DEF = {
        R.refCd, R.refNm, R.refDesc, R.regId, R.regDtm, R.modId, R.modDtm
    };

    private final JPAQueryFactory query;
    private final QueryDslBuilder builder;
    private final MessageService messages;

    public CodeQueryService(
            JPAQueryFactory query, QueryDslBuilder builder, MessageService messages) {
        this.query = query;
        this.builder = builder;
        this.messages = messages;
    }

    // ── 마스터 ───────────────────────────────────────────────────────

    /**
     * 코드 그룹 — 쿼리가 둘이다.
     *
     * <p>둘째가 <b>코드 수</b>이며 그것이 삭제 게이트의 근거다(grid-standard.md §6.2 · 63 §2.5). 첫 쿼리에
     * 스칼라 서브쿼리로 얹지 않는 이유는 <b>행마다 한 번씩 도는 것</b>이 되기 때문이고,
     * 조인해 {@code GROUP BY} 하면 <b>페이징 단위가 그룹이 아니게</b> 될 위험을 매번 다시
     * 확인해야 한다 — 63 §3 이 같은 자리에서 쿼리를 둘로 가른 것과 같은 판단이다.
     */
    public PageResponse<CodeGroupRow> getGroupList(SearchRequest<Void> request) {
        Built built = builder.build(request, GROUP_SPEC, PageMode.offset);

        List<Tuple> groups = built.apply(query.select(Projections.tuple(GROUP))).fetch();
        Long total = built.count(query).fetchOne();

        Map<String, Long> counts = codeCounts(groups.stream().map(row -> row.get(G.grpCd)).toList());

        List<CodeGroupRow> rows = new ArrayList<>(groups.size());
        for (Tuple group : groups) {
            String grpCd = group.get(G.grpCd);
            rows.add(new CodeGroupRow(
                    grpCd,
                    group.get(G.grpNm),
                    group.get(G.grpDesc),
                    group.get(G.sortNo),
                    counts.getOrDefault(grpCd, 0L),
                    group.get(G.sysYn),
                    group.get(G.regId),
                    group.get(G.regDtm),
                    group.get(G.modId),
                    group.get(G.modDtm)));
        }
        return built.respond(rows, total == null ? 0L : total);
    }

    /** {@code IN} 을 쪼갠다 — 페이지 하나가 최대 1000개이고 그것이 오라클의 한계다(db-portability.md §4.6). */
    private Map<String, Long> codeCounts(List<String> grpCds) {
        if (grpCds.isEmpty()) {
            return Map.of();
        }
        Map<String, Long> counts = new HashMap<>();
        for (List<String> chunk : InChunks.split(grpCds)) {
            for (Tuple row : query.select(C.grpCd, C.count())
                    .from(C)
                    .where(C.grpCd.in(chunk))
                    .groupBy(C.grpCd)
                    .fetch()) {
                counts.put(row.get(C.grpCd), row.get(C.count()));
            }
        }
        return counts;
    }

    // ── 하단 ─────────────────────────────────────────────────────────

    /**
     * 한 그룹의 코드 — <b>참조값 맵을 함께 낸다</b>(63 §2.4).
     *
     * <p><b>정의 목록은 여기서 내지 않는다.</b> 화면이 그것을 <i>병렬로</i> 따로 부르며(§2.4)
     * 둘 다 도착한 뒤에 그린다 — 컬럼 없이 행을 그리면 값이 갈 자리가 없고, 행 없이 컬럼만
     * 그리면 빈 그리드가 한 번 깜빡인다. 응답 하나에 합치면 <b>모달이 부르는 것과 같은
     * 목록이 두 경로</b>로 생긴다.
     *
     * @param lang 세션 언어 — 컨트롤러가 준다. 도메인은 요청을 모른다(architecture.md §1)
     */
    public PageResponse<CodeRow> getList(SearchRequest<CodeGroupParams> request, String lang) {
        String grpCd = request.params().grpCd();
        Built built = builder.build(request, CODE_SPEC, PageMode.all);

        List<Tuple> codes = built.apply(query.select(Projections.tuple(CODE)))
                .where(C.grpCd.eq(grpCd))
                .fetch();

        Map<String, Map<String, String>> refs = refValues(grpCd);

        List<CodeRow> rows = new ArrayList<>(codes.size());
        for (Tuple code : codes) {
            String dtlCd = code.get(C.dtlCd);
            rows.add(new CodeRow(
                    dtlCd,
                    // 없으면 키 문자열이다 — 아직 안 채웠다는 사실이 셀에서 드러난다(63 §2.3).
                    messages.text(SysCode.messageKey(grpCd, dtlCd), lang),
                    code.get(C.dtlDesc),
                    code.get(C.useYn),
                    code.get(C.sortNo),
                    code.get(C.sysYn),
                    refs.getOrDefault(dtlCd, Map.of()),
                    code.get(C.regId),
                    code.get(C.regDtm),
                    code.get(C.modId),
                    code.get(C.modDtm)));
        }
        // `all` 모드는 총 건수를 응답이 스스로 센다 — 여기 넘기는 값은 쓰이지 않는다.
        return built.respond(rows, rows.size());
    }

    /**
     * 그 그룹의 참조값 전량 → {@code DTL_CD → (REF_CD → REF_VAL)}.
     *
     * <p><b>값이 없는 칸은 키가 아예 없다</b>(43 §5.4) — 화면이 정의 목록과 아우터 조인해
     * 빈 셀을 그린다. 여기서 {@code null} 로 채워 보내면 <i>"없음"</i> 이 두 모양을 갖는다.
     */
    private Map<String, Map<String, String>> refValues(String grpCd) {
        Map<String, Map<String, String>> byCode = new HashMap<>();
        for (Tuple row : query.select(V.dtlCd, V.refCd, V.refVal)
                .from(V)
                .where(V.grpCd.eq(grpCd))
                .fetch()) {
            byCode.computeIfAbsent(row.get(V.dtlCd), key -> new LinkedHashMap<>())
                    .put(row.get(V.refCd), row.get(V.refVal));
        }
        return byCode;
    }

    // ── 정의 모달 ────────────────────────────────────────────────────

    /**
     * 참조 코드 정의 — <b>화면이 두 자리에서 부른다</b>(63 §2.4).
     *
     * <p>모달의 조회 버튼이 부르고, 하단 조회가 <b>함께</b> 부른다. 같은 응답을 쓰므로 정의가
     * 늘거나 줄면 컬럼 집합과 모달 목록이 <b>같은 순간에</b> 같아진다.
     */
    public PageResponse<CodeRefDefRow> getRefDefList(SearchRequest<CodeGroupParams> request) {
        String grpCd = request.params().grpCd();
        Built built = builder.build(request, REF_DEF_SPEC, PageMode.all);

        List<Tuple> defs = built.apply(query.select(Projections.tuple(REF_DEF)))
                .where(R.grpCd.eq(grpCd))
                .fetch();

        Map<String, Long> counts = refValueCounts(grpCd);

        List<CodeRefDefRow> rows = new ArrayList<>(defs.size());
        for (Tuple def : defs) {
            String refCd = def.get(R.refCd);
            rows.add(new CodeRefDefRow(
                    refCd,
                    def.get(R.refNm),
                    def.get(R.refDesc),
                    counts.getOrDefault(refCd, 0L),
                    def.get(R.regId),
                    def.get(R.regDtm),
                    def.get(R.modId),
                    def.get(R.modDtm)));
        }
        return built.respond(rows, rows.size());
    }

    /** 정의를 지울 때 <i>"입력된 참조값 N건이 함께 삭제됩니다"</i> 가 말하는 수 — 63 §2.5. */
    private Map<String, Long> refValueCounts(String grpCd) {
        Map<String, Long> counts = new HashMap<>();
        for (Tuple row : query.select(V.refCd, V.count())
                .from(V)
                .where(V.grpCd.eq(grpCd))
                .groupBy(V.refCd)
                .fetch()) {
            counts.put(row.get(V.refCd), row.get(V.count()));
        }
        return counts;
    }
}
