package com.aiagent.domain.code.admin;

import com.aiagent.core.search.LikePattern;
import com.aiagent.core.search.Op;
import com.aiagent.core.search.QuerySpec;
import com.aiagent.core.search.SortDir;
import com.aiagent.domain.code.entity.QSysCode;
import com.aiagent.domain.code.entity.QSysCodeGroup;
import com.aiagent.domain.code.entity.QSysCodeGrpRef;
import com.aiagent.domain.message.entity.QSysMessage;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.core.types.dsl.StringExpression;
import com.querydsl.jpa.JPAExpressions;

/**
 * {@code CODE_MGMT} 의 화이트리스트 — screen/admin/system/code/requirements.md · backend/api.md. <b>스펙이 셋이다.</b>
 *
 * <p>그리드가 셋이므로(마스터 · 하단 · 정의 모달) 스펙도 셋이다. 하나로 합치면 필드 이름이
 * 겹치고({@code useYn} 이 그룹의 것인지 코드의 것인지) 정렬 가능 여부가 그리드마다 달라진다.
 *
 * <h2>하단 조건이 마스터를 거른다</h2>
 *
 * <i>"이 코드값이 어느 그룹에 있더라"</i> 가 실제로 자주 묻는 것인데, 마스터만 거르면 답할 수
 * 없다(screen/admin/system/code/requirements.md). 그래서 <b>같은 이름의 조건이 두 스펙에 있다</b> — 마스터에서는 <i>그런 코드를
 * 가진 그룹</i> 을 고르는 {@code EXISTS} 이고, 하단에서는 그냥 그 코드다. 화면은 조건 하나를
 * 두 요청에 그대로 실어 보내며, 그래서 <b>고른 뒤의 하단이 이미 걸려 있다.</b>
 *
 * <h2>코드명은 어느 언어든 걸린다</h2>
 *
 * 코드명의 원본은 {@code SYS_MESSAGE} 이고(sys/code.md) 조인 키는 {@code DTL_NM} 컬럼 그대로다
 * (sys/code.md — 조회 쪽이 문자열을 조립하지 않는다). <b>언어를 묻지 않는 것</b>은 screen/admin/system/code/requirements.md 이
 * 메시지 화면에서 한 판단과 같다 — 운영자는 <i>화면에 보이는 그 문구</i> 를 들고 오지 어느
 * 언어의 값인지를 들고 오지 않는다.
 *
 * <h2>참조값 조건이 없다</h2>
 *
 * 컬럼이 <b>그룹마다 다르므로</b> 폼도 그룹에 따라 바뀌어야 하고, 그러면 <i>"그룹을 고르기
 * 전에는 검색할 수 없는 조건"</i> 이 생긴다. 참조값은 <b>컬럼 필터</b>로 거른다(screen/admin/system/code/requirements.md) —
 * 하단이 전량({@code mode: 'all'})이라 그 범위가 곧 전부다.
 */
public final class CodeSpec {

    static final QSysCodeGroup G = QSysCodeGroup.sysCodeGroup;
    static final QSysCode C = QSysCode.sysCode;
    static final QSysCodeGrpRef R = QSysCodeGrpRef.sysCodeGrpRef;

    /** 파생 서브쿼리 전용 별칭 — 마스터 스펙은 {@link #C} 를 조인하지 않으므로 이름이 갈려야 한다. */
    private static final QSysCode SUB = new QSysCode("codeSub");

    private static final QSysMessage MSG = new QSysMessage("codeNmSub");

    /**
     * 마스터 — 코드 그룹.
     *
     * <p><b>기본 정렬이 {@code SORT_NO} 이고 tie-breaker 가 {@code GRP_CD} 다.</b> screen/admin/system/code/requirements.md 가
     * {@code GRP_CD} 를 두고 <i>"기본 정렬이며 tie-breaker 가 필요 없다"</i> 고 적은 것은
     * <b>PK 라 스스로 유일하다</b>는 뜻이고, {@code SORT_NO} 는 그 표가 <i>관리 화면 정렬</i>
     * 이라고 적은 컬럼이다 — 둘은 겹치지 않는다.
     */
    public static final QuerySpec GROUP_SPEC = QuerySpec.of("codeGroup")
            .from(G)
            .col("grpCd", G.grpCd).sortable()
            .col("grpNm", G.grpNm).sortable()
            .col("grpDesc", G.grpDesc)
            // `useYn` 이 없다 — 그룹에는 그 컬럼 자체가 없다(sys/code.md).
            .col("sysYn", G.sysYn).sortable()
            .col("sortNo", G.sortNo).sortable()
            .col("regDtm", G.regDtm).sortable()
            .col("modDtm", G.modDtm).sortable()
            .derived("dtlCd", CodeSpec::groupHasCode)
            .derived("codeNm", CodeSpec::groupHasCodeNamed)
            .defaultSort("sortNo", SortDir.asc)
            .pk(G.grpCd)
            .build();

    /**
     * 하단 — 한 그룹의 코드.
     *
     * <p><b>{@code grpCd} 가 조건에 없다.</b> 부모 키는 {@code params} 로 오며(backend/api.md) 서비스가
     * 이름으로 직접 읽는다 — 조건으로 열면 <b>부모 제약이 클라이언트가 보낸 값</b>이 되고,
     * 화면이 그것을 빠뜨린 요청 하나가 전 그룹의 코드를 한 판에 쏟는다.
     */
    public static final QuerySpec CODE_SPEC = QuerySpec.of("code")
            .from(C)
            .col("dtlCd", C.dtlCd).sortable()
            .col("dtlDesc", C.dtlDesc)
            .col("useYn", C.useYn).sortable()
            .col("sysYn", C.sysYn).sortable()
            .col("sortNo", C.sortNo).sortable()
            .col("regDtm", C.regDtm).sortable()
            .col("modDtm", C.modDtm).sortable()
            .derived("codeNm", CodeSpec::codeNamed)
            .defaultSort("sortNo", SortDir.asc)
            .pk(C.dtlCd)
            .build();

    /** 정의 모달 — 컬럼 집합의 원본이다(screen/admin/system/code/requirements.md). */
    public static final QuerySpec REF_DEF_SPEC = QuerySpec.of("codeRefDef")
            .from(R)
            .col("refCd", R.refCd).sortable()
            .col("refNm", R.refNm).sortable()
            .col("refDesc", R.refDesc)
            .col("regDtm", R.regDtm).sortable()
            .col("modDtm", R.modDtm).sortable()
            .defaultSort("refCd", SortDir.asc)
            .pk(R.refCd)
            .build();

    // ── 파생 ─────────────────────────────────────────────────────────

    /** <i>"이 코드값을 가진 그룹"</i> — 마스터를 하단 조건으로 거른다(screen/admin/system/code/requirements.md). */
    private static BooleanExpression groupHasCode(Op op, Object value) {
        return JPAExpressions.selectOne()
                .from(SUB)
                .where(SUB.grpCd.eq(G.grpCd), text(SUB.dtlCd, op, value, "코드 코드"))
                .exists();
    }

    /** <i>"이 이름의 코드를 가진 그룹"</i> — 이름은 {@code SYS_MESSAGE} 에 있다(sys/code.md). */
    private static BooleanExpression groupHasCodeNamed(Op op, Object value) {
        return JPAExpressions.selectOne()
                .from(SUB)
                .join(MSG).on(MSG.msgKey.eq(SUB.dtlNm))
                .where(SUB.grpCd.eq(G.grpCd), text(MSG.msgVal, op, value, "코드명"))
                .exists();
    }

    /** 하단의 코드명 조건 — 마스터의 그것에서 그룹 제약만 빠진 모양이다. */
    private static BooleanExpression codeNamed(Op op, Object value) {
        return JPAExpressions.selectOne()
                .from(MSG)
                .where(MSG.msgKey.eq(C.dtlNm), text(MSG.msgVal, op, value, "코드명"))
                .exists();
    }

    /**
     * 문자열 비교 넷만 편다 — 없는 연산자를 조용히 받으면 <b>조건을 넣었는데 안 걸린다</b>.
     *
     * <p>대소문자를 가리지 않는 것은 {@code FieldSpec.like} 와 같은 규칙이다(backend/api.md) —
     * 파생이라고 다른 규칙을 쓰면 같은 화면의 두 칸이 다르게 동작한다.
     */
    private static BooleanExpression text(StringExpression path, Op op, Object value, String what) {
        return switch (op) {
            case startsWith, contains, endsWith ->
                    path.likeIgnoreCase(LikePattern.of(op, value), LikePattern.ESCAPE);
            case eq -> path.eq(value == null ? "" : value.toString());
            default -> throw new IllegalArgumentException(what + " 조건은 문자열 비교만 받는다 — " + op);
        };
    }

    private CodeSpec() {}
}
