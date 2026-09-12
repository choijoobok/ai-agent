// @feat FEAT-503
package com.aiagent.system.domain.apicatalog;

import com.aiagent.core.search.Op;
import com.aiagent.core.search.QuerySpec;
import com.aiagent.core.search.SortDir;
import com.aiagent.domain.authz.entity.QSysApi;
import com.aiagent.domain.authz.entity.QSysMenu;
import com.aiagent.domain.authz.entity.QSysMenuApi;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.JPAExpressions;

/**
 * {@code API_CATALOG} 의 화이트리스트 — screen/api-catalog/requirements.md · backend/api.md. <b>스펙이 둘이다.</b>
 *
 * <p>마스터(API 목록)와 하단(이 API 를 쓰는 메뉴)이 각각 자기 것을 갖는다.
 *
 * <h2>매핑 상태가 서버 조건인 것이 이 스펙의 이유다</h2>
 *
 * 컬럼 필터로 두면 <b>현재 페이지 안에서만</b> 걸린다(frontend/grid.md). 이 화면에서 가장 자주 하는
 * 일이 <i>미매핑만 골라 보는 것</i> 이고 그 답은 <b>전량</b>에 대한 것이라야 하며, screen/api-catalog/requirements.md 이
 * 엑셀을 두는 이유로 적은 <i>"결함 목록이 그대로 파일이 된다"</i> 도 이 조건 없이는 성립하지
 * 않는다.
 *
 * <h2>정렬 가능한 것이 넷뿐이다</h2>
 *
 * {@code API_URL} 이 PK 라 tie-breaker 가 스스로 유일하고(screen/api-catalog/requirements.md), <b>매핑 메뉴 수는 파생</b>
 * 이라 목록에 없다 — 두 번째 쿼리가 세는 값이므로 {@code ORDER BY} 에 넣을 컬럼이 없다.
 * 화면은 그 칸의 정렬을 끈다(frontend/grid.md).
 */
public final class ApiCatalogSpec {

    static final QSysApi A = QSysApi.sysApi;
    static final QSysMenuApi MA = QSysMenuApi.sysMenuApi;
    static final QSysMenu M = QSysMenu.sysMenu;

    /** 파생 서브쿼리 전용 별칭 — 마스터 스펙은 매핑을 조인하지 않으므로 이름이 갈려야 한다. */
    private static final QSysMenuApi SUB = new QSysMenuApi("menuApiSub");

    /**
     * 마스터 — API 마스터 목록.
     *
     * <p><b>기본 정렬이 {@code API_URL} 이고 그것이 PK 다.</b> screen/api-catalog/requirements.md 이 <i>"기본 정렬이며
     * tie-breaker 가 필요 없다"</i> 고 적은 그대로이며, 빌더가 붙이는 tie-breaker 가 기본
     * 정렬과 같은 컬럼이 되는 유일한 스펙이다(중복 {@code ORDER BY} 는 무해하다).
     */
    public static final QuerySpec API_SPEC = QuerySpec.of("apiCatalog")
            .from(A)
            .col("apiUrl", A.apiUrl).sortable()
            .col("apiNm", A.apiNm).sortable()
            .col("apiDesc", A.apiDesc)
            .col("actionCd", A.actionCd).sortable()
            // 감사 4컬럼이 아니라 `최종 시드 반영` 이다 — screen/api-catalog/requirements.md. `MOD_DTM` 이 없는 것은 전건
            // 삭제 후 전건 삽입에 UPDATE 가 없어 언제나 NULL 이기 때문이다(seed.md).
            .col("regDtm", A.regDtm).sortable()
            .derived("mapped", ApiCatalogSpec::mapped)
            .defaultSort("apiUrl", SortDir.asc)
            .pk(A.apiUrl)
            .build();

    /**
     * 하단 — 이 API 를 쓰는 메뉴.
     *
     * <p><b>{@code apiUrl} 이 조건에 없다.</b> 부모 키는 {@code params} 로 오며(backend/api.md)
     * 서비스가 이름으로 직접 읽는다 — 조건으로 열면 부모 제약이 <b>클라이언트가 보낸 값</b>이
     * 되고, 화면이 그것을 빠뜨린 요청 하나가 전 API 의 매핑을 한 판에 쏟는다.
     *
     * <p><b>조회조건 폼이 없는 그리드다</b>(screen/api-catalog/requirements.md — 하단의 버튼은 조회 하나다). 그래도 스펙이
     * 있어야 하는 것은 빌더가 {@code FROM}·{@code JOIN}·{@code ORDER BY} 를 여기서 붙이기
     * 때문이다(backend/search-spec.md) — 조인이 스펙과 서비스 두 곳에 있으면 어긋났을 때 <b>묵시적 크로스
     * 조인</b>으로 결과가 조용히 틀린다.
     *
     * <p><b>{@code .sortable()} 을 걸어 두되 이 모드에서는 쓰이지 않는다.</b> 전량({@code all})
     * 이라 정렬은 클라이언트가 즉시 하며 빌더가 요청의 정렬을 아예 읽지 않는다(backend/api.md) —
     * 페이징이 생기는 날 여는 것이 아니라 <b>지금 사실인 것을 적어 두는 것</b>이다.
     *
     * <p><b>메뉴명이 없다</b> — 원본이 {@code SYS_MESSAGE} 이고(sys/code.md) 화면에 나가는 것은
     * 이름이 아니라 <b>전체 경로</b>라 컬럼 하나로 표현되지 않는다(screen/api-catalog/requirements.md). 서비스가 조립한다.
     */
    public static final QuerySpec MENU_SPEC = QuerySpec.of("apiCatalogMenu")
            .from(MA)
            .join(M).on(M.menuCd.eq(MA.menuCd))
            .col("menuCd", MA.menuCd).sortable()
            .col("useYn", M.useYn).sortable()
            .defaultSort("menuCd", SortDir.asc)
            .pk(MA.menuCd)
            .build();

    // ── 파생 ─────────────────────────────────────────────────────────

    /**
     * <b>매핑 상태</b> — screen/api-catalog/requirements.md 이 <i>진단의 입구</i> 라고 부른 조건이다.
     *
     * <p>값은 {@code 'Y'}(매핑됨) 또는 {@code 'N'}(미매핑)이다. {@code ynFlag} 어휘를 그대로
     * 쓰는 것은 화면의 다른 스위치들과 <b>같은 글자</b>여야 조회조건이 한 어휘로 읽히기
     * 때문이며, 여기 있는 것이 컬럼이 아니라 <b>존재 여부</b>라는 것만 다르다.
     */
    private static BooleanExpression mapped(Op op, Object value) {
        if (op != Op.eq) {
            throw new IllegalArgumentException("매핑 상태 조건은 = 만 받는다 — " + op);
        }
        BooleanExpression exists = JPAExpressions.selectOne()
                .from(SUB)
                .where(SUB.apiUrl.eq(A.apiUrl))
                .exists();
        return yes(value) ? exists : exists.not();
    }

    /** {@code YnConverter} 와 같은 글자를 읽는다 — 화면이 보내는 것은 {@code 'Y'}/{@code 'N'} 이다. */
    private static boolean yes(Object value) {
        return value != null && "Y".equalsIgnoreCase(value.toString());
    }

    private ApiCatalogSpec() {}
}
