package com.aiagent.domain.authz.userauth;

import com.aiagent.core.search.LikePattern;
import com.aiagent.core.search.Op;
import com.aiagent.core.search.QuerySpec;
import com.aiagent.core.search.SortDir;
import com.aiagent.domain.user.entity.QSysUser;
import com.querydsl.core.types.dsl.BooleanExpression;

/**
 * {@code USER_AUTH_MGMT} 좌 pane 의 화이트리스트 — screen/user-auth/requirements.md · backend/api.md.
 *
 * <h2>조건이 하나다</h2>
 *
 * <p>screen/user-auth/requirements.md 의 표에 둘이 적혀 있지만 <b>서버로 나가는 것은 하나</b>다 — <i>메뉴명</i> 은
 * 트리 필터이고 트리는 <b>거르지 않는다</b>(강조하고 찾아간다 — screen/menu/requirements.md 과 같은 어휘).
 * 걸러 내려보내면 폴더의 파생 3-state 가 <b>보이는 자식만으로</b> 요약해 거짓을 말한다.
 *
 * <h2>그 하나가 파생이다 — ID 와 이름을 함께 본다</h2>
 *
 * <p>screen/user-auth/requirements.md 이 <i>{@code LIKE} (ID · 이름)</i> 로 적었다. 칸을 둘로 가르면 운영자가
 * <b>어느 칸에 넣을지</b> 를 먼저 정해야 하는데, 사람을 찾을 때 손에 있는 것은 <i>ID 이거나
 * 이름</i> 이고 <b>어느 쪽인지는 대개 상관없다</b> — {@code USER_MGMT}(screen/user-auth/requirements.md)와 갈리는
 * 자리이며, 그쪽은 <b>목록 자체가 일</b>이라 칸이 여덟이다.
 *
 * <p>{@code OR} 를 파생 함수가 갖는 이유는 화이트리스트가 <b>필드 하나 = 조건 하나</b> 로
 * 되어 있기 때문이다(backend/api.md) — {@code LoginLogSpec.rsltGroup} 이 코드 집합을 펴는 것과
 * 같은 자리이며, 여기서는 <b>컬럼 둘</b>을 편다.
 *
 * <h2>계정 상태가 조건에 없다</h2>
 *
 * <p>{@code USER_MGMT} 는 기본값을 두지 않지만(끈 계정을 찾으러 오는 화면이다)
 * 여기는 <b>거르지 않는다</b>. screen/menu/requirements.md 가 역할 목록에서 사용 여부를 뺀 것과 같은 논리다 —
 * <b>못 쓰는 계정의 권한을 고치는 것은 아무에게도 영향이 없어 가장 안전한 편집</b>이고,
 * 감추면 <i>계정을 살리기 전에 권한을 구성해 두는</i> 동선이 막힌다.
 *
 * <p>대신 <b>상태를 컬럼으로 낸다</b>({@link UserPickRow}) — 부여하는 자리에서 <i>이 계정이
 * 지금 살아 있는가</i> 가 보여야 한다.
 */
public final class UserAuthSpec {

    static final QSysUser U = QSysUser.sysUser;

    /**
     * 좌 pane — 사용자 하나를 고르는 목록이다.
     *
     * <p>기본 정렬이 {@code USER_NM, USER_ID} 다. tie-breaker 없이는 동명이인에서 순서가
     * 비결정적이고(backend/persistence.md) 페이징이 그 위에서 돌면 같은 행이 두 장에 나온다.
     */
    public static final QuerySpec USER_PICK_SPEC = QuerySpec.of("userAuthUser")
            .from(U)
            .col("userId", U.userId).sortable()
            .col("userNm", U.userNm).sortable()
            .col("useYn", U.useYn).sortable()
            .derived("user", UserAuthSpec::idOrName)
            .defaultSort("userNm", SortDir.asc)
            .defaultSort("userId", SortDir.asc)
            .pk(U.userId)
            .build();

    /**
     * ID <b>또는</b> 이름 — 문자열 비교 넷만 편다.
     *
     * <p>없는 연산자를 조용히 받으면 <b>조건을 넣었는데 안 걸린다</b>. 대소문자를 가리지
     * 않는 것은 {@code FieldSpec.like} 와 같은 규칙이며(backend/api.md), 파생이라고 다른 규칙을
     * 쓰면 같은 화면의 두 칸이 다르게 동작한다.
     *
     * <p><b>이름은 평문이라 이 검색이 성립한다</b>(sys/user-role.md). 참조키를 담았다면 {@code LIKE}
     * 를 걸 수 없어 이 칸이 ID 전용이 됐을 것이다.
     */
    private static BooleanExpression idOrName(Op op, Object value) {
        return switch (op) {
            case startsWith, contains, endsWith -> U.userId
                    .likeIgnoreCase(LikePattern.of(op, value), LikePattern.ESCAPE)
                    .or(U.userNm.likeIgnoreCase(LikePattern.of(op, value), LikePattern.ESCAPE));
            case eq -> {
                String text = value == null ? "" : value.toString();
                yield U.userId.eq(text).or(U.userNm.eq(text));
            }
            default -> throw new IllegalArgumentException("사용자 조건은 문자열 비교만 받는다 — " + op);
        };
    }

    private UserAuthSpec() {}
}
