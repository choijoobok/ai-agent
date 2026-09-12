package com.aiagent.domain.message.admin;

import com.aiagent.core.search.LikePattern;
import com.aiagent.core.search.Op;
import com.aiagent.core.search.QuerySpec;
import com.aiagent.core.search.SortDir;
import com.aiagent.domain.message.entity.QSysMessage;
import com.aiagent.domain.message.entity.QSysMessageKey;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.JPAExpressions;

/**
 * {@code MESSAGE_MGMT} 의 화이트리스트 — screen/admin/system/message/requirements.md · backend/api.md.
 *
 * <p><b>조건 넷 중 둘이 파생이다.</b> 이 화면이 실제로 묻는 것은 <i>"이 문구가 어느 키인가"</i>
 * 와 <i>"이 언어가 안 채워진 키"</i> 인데, 둘 다 <b>값 테이블에 대한 질문</b>이고 마스터는
 * 키 테이블이다. 컬럼 하나로 표현할 수 없으므로 서브쿼리를 서버가 갖는다(backend/api.md).
 *
 * <p><b>{@code params} 가 아닌 이유</b>(backend/api.md) — 둘 다 <b>값 하나가 들어가고 조각 하나가
 * 나온다</b>. 형제 칸을 읽지 않으므로 파생으로 족하다.
 */
public final class MessageSpec {

    static final QSysMessageKey K = QSysMessageKey.sysMessageKey;
    static final QSysMessage M = QSysMessage.sysMessage;

    /** 파생 서브쿼리 전용 별칭 — 같은 테이블을 조인 없이 두 번 쓰므로 이름이 갈려야 한다. */
    private static final QSysMessage SUB = new QSysMessage("msgSub");

    public static final QuerySpec SPEC = QuerySpec.of("message")
            .from(K)
            .col("msgKey", K.msgKey).sortable()
            .col("useScope", K.useScope).sortable()
            .col("msgDesc", K.msgDesc)
            .col("regDtm", K.regDtm).sortable()
            .col("modDtm", K.modDtm).sortable()
            .derived("msgVal", MessageSpec::anyLanguageValue)
            .derived("untranslated", MessageSpec::untranslated)
            .defaultSort("msgKey", SortDir.asc)
            .pk(K.msgKey)
            .build();

    /**
     * <b>어느 언어든 걸린다</b> — screen/admin/system/message/requirements.md.
     *
     * <p>운영자는 <i>"화면에 보이는 이 문구"</i> 를 들고 오지 키를 들고 오지 않는다. 어느
     * 언어의 값인지도 모르므로 언어를 묻지 않는다 — <b>이 조건이 이 화면의 핵심</b>이다.
     */
    private static BooleanExpression anyLanguageValue(Op op, Object value) {
        BooleanExpression match = switch (op) {
            // 대소문자를 가리지 않는다 — FieldSpec.like 와 같은 규칙이다(backend/api.md).
            case startsWith, contains, endsWith ->
                    SUB.msgVal.likeIgnoreCase(LikePattern.of(op, value), LikePattern.ESCAPE);
            case eq -> SUB.msgVal.eq(text(value));
            default -> throw new IllegalArgumentException(
                    "메시지 값 조건은 문자열 비교만 받는다 — " + op);
        };
        return JPAExpressions.selectOne()
                .from(SUB)
                .where(SUB.msgKey.eq(K.msgKey), match)
                .exists();
    }

    /**
     * 미번역 탐지(MASTER-06) — <b>서버 조건이다</b>(screen/admin/system/message/requirements.md).
     *
     * <p>컬럼 필터로 두지 않는다. <i>"en 이 안 채워진 키"</i> 는 <b>전량을 물어야 하는 질문</b>
     * 인데 컬럼 필터는 현재 페이지 안에서만 걸린다(frontend/grid.md).
     *
     * <p><b>값이 {@code NULL} 인 행도 미번역이다.</b> 행의 유무가 아니라 값의 유무가 기준이며,
     * 그 둘을 가르지 않는 것이 {@code MSG_VAL} 을 nullable 로 둔 이유다(sys/code.md).
     */
    private static BooleanExpression untranslated(Op op, Object value) {
        if (op != Op.eq) {
            throw new IllegalArgumentException("미번역 언어 조건은 = 만 받는다 — " + op);
        }
        return JPAExpressions.selectOne()
                .from(SUB)
                .where(SUB.msgKey.eq(K.msgKey), SUB.langCd.eq(text(value)), SUB.msgVal.isNotNull())
                .notExists();
    }

    private static String text(Object value) {
        return value == null ? "" : value.toString();
    }

    private MessageSpec() {}
}
