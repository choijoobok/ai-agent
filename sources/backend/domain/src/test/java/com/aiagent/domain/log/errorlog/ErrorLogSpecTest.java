package com.aiagent.domain.log.errorlog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.search.FieldSpec;
import com.aiagent.core.search.Op;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * {@code ERROR_LOG} 화이트리스트 — screen/log/error/requirements.md.
 *
 * <p><b>여기서 지키는 것은 묶음 둘이 서로를 침범하지 않는가</b> 다. {@code 4xx 만} 에 500 이
 * 섞이면 <i>"고쳐야 할 것"</i> 을 세는 조회가 틀리고, {@code 5xx 만} 에 403 이 섞이면
 * <b>정상 동작이 장애로 집계된다</b>(권한 없는 사람이 눌렀을 뿐이다 — screen/log/error/requirements.md).
 *
 * <p>경계가 사람의 손을 타지 않는 것이 이 조건을 파생으로 둔 이유다. {@code HTTP_STAT} 을
 * 범위로 열면 {@code 400~499} 를 사람이 입력하고 <b>경계를 틀린다</b>.
 */
class ErrorLogSpecTest {

    private static FieldSpec group() {
        return ErrorLogSpec.SPEC.field("statusGroup");
    }

    @Test
    @DisplayName("5xx 만 은 아래를 열지 않는다 — 403 이 섞이면 정상 동작이 장애로 집계된다")
    void 서버오류_묶음은_500_아래를_받지_않는다() {
        String server = group().toPredicate(Op.eq, "5XX").toString();

        assertThat(server).contains("500");
        assertThat(server).doesNotContain("400");
    }

    @Test
    @DisplayName("4xx 만 은 위아래를 둘 다 닫는다 — 한쪽만 닫으면 500 이 딸려 온다")
    void 클라이언트오류_묶음은_양쪽이_닫혀_있다() {
        String client = group().toPredicate(Op.eq, "4XX").toString();

        assertThat(client).contains("400");
        // 위쪽 경계가 없으면 500 이 들어온다 — `goe(400)` 하나로 두면 그렇게 된다.
        assertThat(client).contains("500");
    }

    @Test
    @DisplayName("없는 묶음은 거절한다 — 조용히 전건을 내면 거른 줄 알고 결론을 낸다")
    void 없는_묶음은_거절() {
        assertThatThrownBy(() -> group().toPredicate(Op.eq, "3XX"))
                // 파생 번역기의 거절은 `FieldSpec` 이 400 으로 감싼다 — screen/log/access/requirements.md.
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("statusGroup");
    }

    @Test
    @DisplayName("묶음은 = 만 받는다 — 둘 다 고르는 것은 곧 전체이고 그것은 조건을 빼는 것이다")
    void 묶음은_등호만_받는다() {
        assertThatThrownBy(() -> group().toPredicate(Op.in, List.of("4XX", "5XX")))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("정렬은 일시 하나만 열린다 — 커서의 기준점이다(screen/log/error/requirements.md)")
    void 정렬은_일시_하나다() {
        assertThat(ErrorLogSpec.SPEC.field("creDtm").sortable()).isTrue();
        assertThat(ErrorLogSpec.SPEC.field("errCd").sortable()).isFalse();
        assertThat(ErrorLogSpec.SPEC.field("userId").sortable()).isFalse();
        assertThat(ErrorLogSpec.SPEC.field("requestUri").sortable()).isFalse();
    }

    @Test
    @DisplayName("스택과 메시지는 조건이 아니다 — 하나는 nclob 이고 하나는 사용자 언어다")
    void 스택과_메시지는_화이트리스트에_없다() {
        // 화이트리스트 밖은 `null` 이고 `QueryDslBuilder` 가 그것을 400 으로 바꾼다.
        assertThat(ErrorLogSpec.SPEC.field("rootCauseStack")).isNull();
        /*
          `errMsg` 는 실을 수는 있지만(VARCHAR) 조건으로 열지 않는다 — 사용자 언어로 남으므로
          같은 사건이 언어마다 다른 문자열이다. 그 물음에 답하는 것은 `errCd` 다(screen/log/error/requirements.md).
        */
        assertThat(ErrorLogSpec.SPEC.field("errMsg")).isNull();
        assertThat(ErrorLogSpec.SPEC.field("errCd")).isNotNull();
    }

    @Test
    @DisplayName("사용자 조인은 left 다 — inner 면 지워진 계정의 오류가 목록에서 사라진다(sys/logs.md)")
    void 사용자_조인은_left_다() {
        /*
          사용자가 `traceId` 를 들고 오는 화면이다(screen/log/error/requirements.md). 그 한 행이 조인 때문에 없으면
          운영자는 **로그 유실**로 읽고, 0건 문구는 *"그 요청은 오류가 아니었다"* 라고
          말한다 — 둘 다 틀린 답이다.
        */
        assertThat(ErrorLogSpec.SPEC.joins()).hasSize(1);
        assertThat(ErrorLogSpec.SPEC.joins().getFirst().left()).isTrue();
    }

    @Test
    @DisplayName("메뉴명은 문자열 비교 넷만 받는다 — 없는 연산자를 받으면 조건이 조용히 빠진다")
    void 메뉴명은_문자열_비교_넷만_받는다() {
        FieldSpec menuNm = ErrorLogSpec.SPEC.field("menuNm");

        // 넷 다 EXISTS 서브쿼리를 만든다 — 이름은 SYS_MENU → SYS_MESSAGE 두 테이블 건너다.
        for (Op op : List.of(Op.eq, Op.startsWith, Op.contains, Op.endsWith)) {
            assertThat(menuNm.toPredicate(op, "사용 이력").toString()).contains("exists");
        }
        /*
          `in`·`ne` 는 파생 번역기가 거절하고 `FieldSpec` 이 400 으로 감싼다(screen/log/access/requirements.md).
          흘려보내면 <b>거르지 않은 목록을 거른 것으로</b> 읽는다.
        */
        assertThatThrownBy(() -> menuNm.toPredicate(Op.in, List.of("사용 이력")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("menuNm");
    }

    @Test
    @DisplayName("메뉴명 조건은 언어를 묻지 않는다 — 운영자는 화면에 보이는 그 이름을 들고 온다")
    void 메뉴명은_언어를_묻지_않는다() {
        // screen/admin/system/code/requirements.md 이 메시지 화면에서 한 판단과 같다 — LANG_CD 로 좁히면 그 조건이 여기 보인다.
        assertThat(ErrorLogSpec.SPEC.field("menuNm").toPredicate(Op.contains, "이력").toString())
                .doesNotContain("langCd");
    }
}
