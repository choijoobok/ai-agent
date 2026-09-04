package com.aiagent.domain.log.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.search.FieldSpec;
import com.aiagent.core.search.Op;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * {@code ACCESS_LOG} 화이트리스트 — 64 §3.3.
 *
 * <p><b>여기서 지키는 것은 조인 한 글자와 이름 조건의 연산자</b> 다(2026-09-01 — 사용자명 ·
 * 메뉴명 칸이 생겼다). 둘 다 <b>틀려도 조회가 성공한다</b>: {@code join} 이면 행이 조용히
 * 빠지고, 받지 않는 연산자를 흘려보내면 <b>거르지 않은 목록을 거른 것으로</b> 읽는다 —
 * 총 건수가 없는 커서형이라(64 §2.3) 화면을 봐서는 알 수 없다.
 */
class AccessLogSpecTest {

    @Test
    @DisplayName("사용자 조인은 left 다 — inner 면 미인증 요청과 지워진 계정의 행이 사라진다")
    void 사용자_조인은_left_다() {
        /*
          이 화면은 <b>일어난 요청 전부</b>를 내는 화면이고(64 §3.2.2) 미인증 요청은
          `USER_ID` 가 `NULL` 이다 — `join` 으로 바꾸면 로그인·하트비트가 통째로 빠지며,
          ADR-0010 이 감사 이력을 이 테이블로 대체한 전제가 그 자리에서 무너진다.
        */
        assertThat(AccessLogSpec.SPEC.joins()).hasSize(1);
        assertThat(AccessLogSpec.SPEC.joins().getFirst().left()).isTrue();
    }

    @Test
    @DisplayName("이름 둘은 문자열 비교 넷을 받는다 — 사람은 이름을 조각으로 기억한다")
    void 이름_둘은_문자열_비교_넷을_받는다() {
        FieldSpec userNm = AccessLogSpec.SPEC.field("userNm");
        FieldSpec menuNm = AccessLogSpec.SPEC.field("menuNm");

        for (Op op : List.of(Op.eq, Op.startsWith, Op.contains, Op.endsWith)) {
            // 조인 컬럼이라 연산자 허용이 자바 타입에서 나온다 — api-conventions.md §3.4.
            assertThat(op.accepts(userNm.javaType())).isTrue();
            // 파생이라 번역 함수가 직접 판정한다 — 이름은 두 테이블 건너에 있다.
            assertThat(menuNm.toPredicate(op, "사용 이력").toString()).contains("exists");
        }
        // 정렬은 열지 않는다 — 커서의 기준점은 일시 하나다(64 §2.3).
        assertThat(userNm.sortable()).isFalse();
        // nullable 이라야 `ne` 가 이름 없는 행을 빼지 않는다(api-conventions.md §3.3).
        assertThat(userNm.nullable()).isTrue();
    }

    @Test
    @DisplayName("메뉴명은 in 을 받지 않는다 — 흘려보내면 거르지 않은 목록을 거른 것으로 읽는다")
    void 메뉴명은_in_을_받지_않는다() {
        assertThatThrownBy(() -> AccessLogSpec.SPEC.field("menuNm").toPredicate(Op.in, List.of("A")))
                // 파생 번역기의 거절은 `FieldSpec` 이 400 으로 감싼다 — 64 §7-2.4.
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("menuNm");
    }
}
