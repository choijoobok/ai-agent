package com.aiagent.support.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

/**
 * 저장하려는 값이 바인딩을 통과하는가 — 63 §4.5 · ADR-0026 §3.
 *
 * <p><b>여기서 지키는 것은 <i>거부했는가</i> 가 아니라 <i>어느 칸이라고 말했는가</i> 다.</b>
 * 거부만 하고 키를 못 짚으면 화면은 문구를 모달로만 낼 수 있고, 일괄 저장은 화면에 안 보이는
 * 행까지 나가므로 <b>사용자가 어느 줄을 고쳐야 하는지 알 수 없다</b>(grid-edit-validation.md §3.4).
 *
 * <p>실제로 그렇게 틀렸었다(2026-08-30) — {@code Binder} 가 언제나 {@code BindException} 으로
 * 싸는데 사슬을 한 번만 돌며 둘을 함께 보면 <b>바깥이 늘 먼저 걸려</b> 키가 클래스 접두사
 * ({@code auth.password})가 되고, 문구는 <i>"Binding validation errors on …"</i> 이 나갔다.
 */
class ConfigValidatorTest {

    private ConfigValidator validator;

    @BeforeEach
    void setUp() {
        MockEnvironment environment = new MockEnvironment();
        /*
          전 클래스를 바인딩하므로 yml 이 채워져 있어야 한다 — 기동 상태를 흉내 낸다.

          <b>props 클래스를 새로 만들면 여기도 함께 는다.</b> 이 목록은 application.yml 의
          sys-config.* 를 손으로 미러링한 것이고, 빠뜨리면 @NotNull 이 걸려 이 파일의
          테스트가 <b>전부</b> 떨어진다 — 새 키와 아무 상관 없는 것들까지 빨개지므로
          원인이 눈에 띄지 않는다(2026-08-30: ui.search.range-days.* 를 더하며 6건이 죽었다.
          2026-08-31: retention.* 를 더하며 또 6건이 죽었다 — 주석이 예고한 그대로였다.
          같은 날 retention.noti-inbox-days 하나를 더하며 <b>세 번째로</b> 같은 일이 났다 —
          키 하나에 6건이므로 이 목록은 <b>필드가 늘 때마다</b> 함께 늘어야 한다.
          2026-08-31: ui.noti.list-size 는 <b>이 주석을 먼저 읽고</b> 함께 더했다 — 네 번째는
          없다. 같은 날 noti.* 둘도 그렇게 더했다. ui.date-format.* 셋도 그렇게 더했다).

          목록을 없애고 실제 yml 을 읽지 않는 이유는 그러면 <b>이 테스트가 배포 설정에
          묶이기</b> 때문이다 — 검증하려는 것은 바인딩 실패가 어느 키를 짚는가이지 우리
          기본값이 무엇인가가 아니다.
        */
        environment.setProperty("sys-config.auth.login.fail-limit", "5");
        environment.setProperty("sys-config.auth.login.lock-release-minutes", "30");
        environment.setProperty("sys-config.auth.login.deny-empty-authority", "true");
        environment.setProperty("sys-config.auth.password.min-length", "9");
        environment.setProperty("sys-config.auth.password.require-charset-kinds", "3");
        environment.setProperty("sys-config.auth.password.reuse-block-count", "3");
        environment.setProperty("sys-config.auth.password.expire-days", "90");
        environment.setProperty("sys-config.auth.password.expire-notice-days", "7");
        environment.setProperty("sys-config.auth.password.temp-valid-hours", "24");
        environment.setProperty("sys-config.auth.password.admin-reset-enabled", "true");
        environment.setProperty("sys-config.auth.password.reset.token-valid-minutes", "10");
        environment.setProperty("sys-config.auth.password.reset.try-limit", "5");
        environment.setProperty("sys-config.auth.password.reset.request-cooldown-seconds", "60");
        environment.setProperty("sys-config.auth.account.dormant-days", "90");
        environment.setProperty("sys-config.ui.excel.max-rows", "50000");
        environment.setProperty("sys-config.ui.excel.max-upload-rows", "5000");
        environment.setProperty("sys-config.ui.date-format.month", "YYYY-MM");
        environment.setProperty("sys-config.ui.date-format.day", "YYYY-MM-DD");
        environment.setProperty("sys-config.ui.date-format.second", "YYYY-MM-DD HH:mm:ss");
        environment.setProperty("sys-config.ui.search.range-days.default-days", "7");
        environment.setProperty("sys-config.ui.search.range-days.max-days", "92");
        environment.setProperty("sys-config.ui.search.saved-cond.max-count", "20");
        environment.setProperty("sys-config.ui.noti.list-size", "50");
        environment.setProperty("sys-config.ui.menu-stat.months", "3");
        environment.setProperty("sys-config.ui.menu-stat.top-n", "20");
        environment.setProperty("sys-config.message.supported", "ko,en");
        environment.setProperty("sys-config.message.default-lang", "ko");
        environment.setProperty("sys-config.message.browser-fallback-lang", "en");
        environment.setProperty("sys-config.message.cache-ttl-minutes", "30");
        environment.setProperty("sys-config.noti.batch-fail-role", "ADMIN");
        environment.setProperty("sys-config.noti.authz-expire-notice-days", "7");
        environment.setProperty("sys-config.retention.access-log-days", "90");
        environment.setProperty("sys-config.retention.exception-log-days", "180");
        environment.setProperty("sys-config.retention.login-log-days", "365");
        environment.setProperty("sys-config.retention.batch-history-days", "365");
        environment.setProperty("sys-config.retention.noti-inbox-days", "90");
        environment.setProperty("sys-config.retention.chunk-size", "1000");

        LocalValidatorFactoryBean beanValidator = new LocalValidatorFactoryBean();
        beanValidator.afterPropertiesSet();

        validator = new ConfigValidator(
                new ConfigCatalog(environment), new ConfigBinder(environment, beanValidator));
    }

    @Test
    @DisplayName("오버라이드가 없으면 통과한다 — yml 만으로 바인딩이 서야 기준이 성립한다")
    void 빈_오버라이드는_통과() {
        assertThat(validator.validate(Map.of())).isEmpty();
    }

    @Test
    @DisplayName("정상 값도 통과한다 — 0 이 끔 인 키를 막지 않는다(43 §6.3)")
    void 정상값은_통과() {
        assertThat(validator.validate(Map.of("auth.login.fail-limit", "0"))).isEmpty();
    }

    @Test
    @DisplayName("@Min 위반은 그 키를 짚는다 — 클래스 접두사가 아니라 CFG_KEY 다")
    void 검증_실패가_키를_짚는다() {
        var violations = validator.validate(Map.of("auth.password.min-length", "2"));

        assertThat(violations).hasSize(1);
        assertThat(violations.getFirst().key()).isEqualTo("auth.password.min-length");
        // 내부 설명이 아니라 사람이 읽을 문구다.
        assertThat(violations.getFirst().message()).doesNotContain("Binding validation errors");
    }

    @Test
    @DisplayName("중첩 객체의 실패도 자기 키를 짚는다 — auth.password.try-limit 이라는 없는 키가 되면 안 된다")
    void 중첩도_키를_짚는다() {
        var violations = validator.validate(Map.of("auth.password.reset.try-limit", "0"));

        assertThat(violations).hasSize(1);
        assertThat(violations.getFirst().key()).isEqualTo("auth.password.reset.try-limit");
    }

    @Test
    @DisplayName("타입이 안 맞으면 거부한다 — 화면이 막는 형식이지만 서버가 최종 판정이다(grid-edit-validation.md §3.4)")
    void 타입_불일치도_거부() {
        var violations = validator.validate(Map.of("auth.login.fail-limit", "abc"));

        assertThat(violations).hasSize(1);
        assertThat(violations.getFirst().key()).isEqualTo("auth.login.fail-limit");
    }

    /**
     * <b>덮는 순서가 이 클래스의 전부다.</b> 오버라이드를 맨 앞에 두지 않으면 {@code yml} 이
     * 이기고, 그러면 <b>화면은 저장됐다는데 검증은 옛 값을 본다</b> — 잘못된 값이 통과한다.
     */
    @Test
    @DisplayName("오버라이드가 yml 을 덮는다 — 유틸이 마지막에 덮는다(ADR-0026 §1)")
    void 오버라이드가_이긴다() {
        // yml 의 9 는 통과하는 값이다. 덮지 못하면 이 검사가 빈 목록을 받는다.
        assertThat(validator.validate(Map.of("auth.password.min-length", "3"))).hasSize(1);
    }
}
