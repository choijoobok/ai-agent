package com.aiagent.domain.log;

import com.aiagent.core.search.LikePattern;
import com.aiagent.core.search.Op;
import com.aiagent.domain.authz.entity.QSysMenu;
import com.aiagent.domain.message.entity.QSysMessage;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.core.types.dsl.StringExpression;
import com.querydsl.core.types.dsl.StringPath;
import com.querydsl.jpa.JPAExpressions;

/**
 * <b>메뉴명으로 이력을 거른다</b> — screen/log/access/requirements.md 의 <i>메뉴명</i> 조건.
 *
 * <p>이력 테이블에는 {@code MENU_CD} 만 있고 <b>이름은 두 테이블 건너에</b> 있다:
 * {@code SYS_MENU.MENU_NM} 이 담은 것은 이름이 아니라 <b>메시지 키</b>이고(sys/code.md) 이름은
 * {@code SYS_MESSAGE} 의 값이다. 컬럼 하나로 표현할 수 없으므로 <b>파생 조건</b>이며
 * (backend/api.md) {@code CodeSpec.groupHasCodeNamed} 와 같은 모양이다.
 *
 * <h2>스펙 둘이 이것을 함께 쓴다</h2>
 *
 * <p>사용 이력({@code AccessLogSpec})과 에러 로그({@code ErrorLogSpec})의 조건이 <b>글자
 * 하나까지 같다</b> — 뿌리 테이블의 {@code MENU_CD} 만 다르다. 복사해 두면 <b>어느 한 쪽만
 * 고쳐지는 날</b>이 오고, 그때 같은 화면 규약의 두 칸이 다르게 동작한다({@link LogText} 를
 * {@code Access} 이름으로 두지 않은 것과 같은 판단이다).
 *
 * <h2>언어를 묻지 않는다</h2>
 *
 * <p>어느 언어의 값이든 걸린다 — screen/code/requirements.md 이 메시지 화면에서 한 판단과 같다. 운영자는
 * <i>화면에 보이는 그 이름</i> 을 들고 오지 <b>어느 언어의 값인지</b> 를 들고 오지 않으며,
 * 세션 언어로 좁히면 영어로 쓰는 사람이 한국어 이름으로 찾을 수 없다.
 *
 * <h2>{@code MENU_CD} 조건과 <b>다른 칸</b>이다</h2>
 *
 * <p>코드 칸은 뿌리 컬럼이라 인덱스가 없어도 값 비교 하나로 끝나지만, 여기는 행마다
 * {@code EXISTS} 가 돈다. <b>기간이 먼저 좁힌 뒤</b> 걸리는 조건이며 그것이 이 화면들에서
 * 기간이 필수인 이유와 같은 근거다(screen/log/access/requirements.md).
 */
public final class LogMenuName {

    /** 서브쿼리 전용 별칭 — 뿌리에 조인되지 않는 테이블이라 이름이 갈려야 한다. */
    private static final QSysMenu MENU = new QSysMenu("logMenu");

    private static final QSysMessage MENU_NM = new QSysMessage("logMenuNm");

    private LogMenuName() {}

    /**
     * @param menuCd 뿌리 이력 테이블의 {@code MENU_CD} — 상관 서브쿼리의 이음매다
     */
    public static BooleanExpression matches(StringPath menuCd, Op op, Object value) {
        return JPAExpressions.selectOne()
                .from(MENU)
                // MENU_NM 은 메뉴명이 아니라 메시지 키다 — menu.{MENU_CD}(sys/code.md).
                .join(MENU_NM).on(MENU_NM.msgKey.eq(MENU.menuNm))
                .where(MENU.menuCd.eq(menuCd), text(MENU_NM.msgVal, op, value))
                .exists();
    }

    /**
     * 문자열 비교 넷만 편다 — 화면의 연산자 후보(같음 · 시작 · 포함 · 끝)와 <b>같은 넷</b>이다.
     *
     * <p>없는 연산자를 조용히 받으면 <b>조건을 넣었는데 안 걸린다</b>. 대소문자를 가리지
     * 않는 것은 {@code FieldSpec.like} 와 같은 규칙이며(backend/api.md), 파생이라고 다른 규칙을
     * 쓰면 같은 폼의 두 칸이 다르게 동작한다.
     */
    private static BooleanExpression text(StringExpression path, Op op, Object value) {
        return switch (op) {
            case startsWith, contains, endsWith ->
                    path.likeIgnoreCase(LikePattern.of(op, value), LikePattern.ESCAPE);
            case eq -> path.eq(value == null ? "" : value.toString());
            default -> throw new IllegalArgumentException("메뉴명 조건은 문자열 비교만 받는다 — " + op);
        };
    }
}
