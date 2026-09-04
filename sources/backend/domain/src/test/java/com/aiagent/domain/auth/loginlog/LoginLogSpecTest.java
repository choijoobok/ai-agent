package com.aiagent.domain.auth.loginlog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.aiagent.core.search.FieldSpec;
import com.aiagent.core.search.Op;
import com.aiagent.domain.auth.LoginResultCode;
import java.util.Arrays;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * {@code LOGIN_LOG} 화이트리스트 — 64 §4.3 · §4.6.
 *
 * <p><b>여기서 지키는 것은 묶음 셋이 코드 열다섯을 빠짐없이 덮는가</b> 다. 덮지 못하면
 * 새 코드가 <i>실패만</i> 에도 <i>종료만</i> 에도 걸리지 않아 그 조회를 하는 사람의
 * 목록에서 <b>말없이 빠진다</b> — 이력 화면에서 가장 나쁜 실패는 틀린 행이 아니라
 * <b>없는 행</b>이다.
 *
 * <p>{@link LoginLogSpec} 의 정적 초기화가 그것을 <b>기동 시</b> 검사하지만, 그때는 이미
 * 배포된 뒤다. 이 테스트가 그 검사를 <b>빌드로 앞당긴다</b>.
 */
class LoginLogSpecTest {

    @Test
    @DisplayName("묶음 셋이 결과 코드 전부를 덮는다 — enum 에 코드를 더하면 여기가 먼저 깨진다")
    void 묶음이_코드_전부를_덮는다() {
        FieldSpec group = LoginLogSpec.SPEC.field("rsltGroup");

        for (LoginResultCode code : LoginResultCode.values()) {
            String matched = Arrays.stream(new String[] {"SUCCESS", "FAILED", "CLOSED"})
                    .filter(name -> group.toPredicate(Op.eq, name).toString().contains(code.name()))
                    .findFirst()
                    .orElse(null);

            assertThat(matched)
                    .as("%s 가 어느 묶음에도 없다 — 64 §4.3 의 셋 중 하나를 정한다", code)
                    .isNotNull();
        }
    }

    @Test
    @DisplayName("성공과 실패가 겹치지 않는다 — 한 행이 두 묶음에 들면 교집합 규칙이 뜻을 잃는다")
    void 묶음은_서로_겹치지_않는다() {
        FieldSpec group = LoginLogSpec.SPEC.field("rsltGroup");
        String failed = group.toPredicate(Op.eq, "FAILED").toString();
        String closed = group.toPredicate(Op.eq, "CLOSED").toString();

        assertThat(failed).doesNotContain(LoginResultCode.SUCCESS.name());
        // 만료·밀려남은 실패가 아니라 정상 종료다 — 64 §4.3.
        assertThat(failed).doesNotContain(LoginResultCode.SESSION_TIMEOUT.name());
        assertThat(failed).doesNotContain(LoginResultCode.SESSION_EVICTED.name());
        assertThat(closed).doesNotContain(LoginResultCode.FAIL_CONCURRENT.name());
    }

    @Test
    @DisplayName("없는 묶음은 거절한다 — 조용히 전건을 내면 거른 줄 알고 결론을 낸다")
    void 없는_묶음은_거절() {
        FieldSpec group = LoginLogSpec.SPEC.field("rsltGroup");

        assertThatThrownBy(() -> group.toPredicate(Op.eq, "NOPE"))
                // 파생 번역기의 거절은 `FieldSpec` 이 400 으로 감싼다 — 64 §7-2.4.
                .isInstanceOf(com.aiagent.core.error.BusinessException.class)
                .hasMessageContaining("rsltGroup");
    }

    @Test
    @DisplayName("묶음은 = 만 받는다 — 여럿을 고르는 축은 결과 코드 쪽이다(64 §4.6)")
    void 묶음은_등호만_받는다() {
        FieldSpec group = LoginLogSpec.SPEC.field("rsltGroup");

        assertThatThrownBy(() -> group.toPredicate(Op.in, java.util.List.of("FAILED")))
                .isInstanceOf(com.aiagent.core.error.BusinessException.class);
    }

    @Test
    @DisplayName("정렬은 일시 하나만 열린다 — 커서의 기준점이다(64 §2.3)")
    void 정렬은_일시_하나다() {
        assertThat(LoginLogSpec.SPEC.field("creDtm").sortable()).isTrue();
        assertThat(LoginLogSpec.SPEC.field("userId").sortable()).isFalse();
        assertThat(LoginLogSpec.SPEC.field("loginRsltCd").sortable()).isFalse();
        assertThat(LoginLogSpec.SPEC.field("clientIp").sortable()).isFalse();
    }

    @Test
    @DisplayName("User-Agent 는 조건도 정렬도 아니다 — 500자에 인덱스가 없다(64 §4.5)")
    void userAgent_는_화이트리스트에_없다() {
        // 화이트리스트 밖은 `null` 이고 `QueryDslBuilder` 가 그것을 400 으로 바꾼다.
        assertThat(LoginLogSpec.SPEC.field("userAgent")).isNull();
        assertThat(LoginLogSpec.SPEC.field("creDtm")).isNotNull();
    }

    @Test
    @DisplayName("사용자 조인은 left 다 — inner 면 없는 계정의 시도가 목록에서 사라진다(45 §2.2)")
    void 사용자_조인은_left_다() {
        /*
          이 화면의 두 번째 용도가 침입 시도 탐지이고(64 §4.4) 그 재료가 **없는 ID 의 행**
          이다. `join` 으로 바뀌면 조회는 성공하는데 그 행만 조용히 빠지므로, 화면을 봐서는
          **줄어든 것을 알 수 없다** — 총 건수가 없는 커서형이라 더 그렇다(64 §2.3).
        */
        assertThat(LoginLogSpec.SPEC.joins()).hasSize(1);
        assertThat(LoginLogSpec.SPEC.joins().getFirst().left()).isTrue();
    }

    @Test
    @DisplayName("사용자명은 조건이며 부분 일치를 받는다 — 사람은 이름을 조각으로 기억한다")
    void 사용자명은_문자열_비교_넷을_받는다() {
        FieldSpec userNm = LoginLogSpec.SPEC.field("userNm");

        assertThat(userNm).isNotNull();
        // 조인 컬럼이라 타입이 String 이고, 연산자 허용은 그 타입에서 나온다(api-conventions.md §3.4).
        assertThat(Op.contains.accepts(userNm.javaType())).isTrue();
        assertThat(Op.startsWith.accepts(userNm.javaType())).isTrue();
        assertThat(Op.endsWith.accepts(userNm.javaType())).isTrue();
        assertThat(Op.eq.accepts(userNm.javaType())).isTrue();
        // 정렬은 열지 않는다 — 커서의 기준점은 일시 하나다(64 §2.3).
        assertThat(userNm.sortable()).isFalse();
        // nullable 이라야 `ne` 가 없는 계정의 행을 빼지 않는다(api-conventions.md §3.3).
        assertThat(userNm.nullable()).isTrue();
    }
}
