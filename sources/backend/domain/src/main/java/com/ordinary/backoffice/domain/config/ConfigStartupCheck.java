package com.ordinary.backoffice.domain.config;

import com.ordinary.backoffice.support.config.ConfigCatalog;
import com.ordinary.backoffice.support.config.ConfigLookup;
import com.ordinary.backoffice.support.config.ConfigValidator;
import com.ordinary.backoffice.support.config.ConfigViolation;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * 기동 시 <b>예행 바인딩</b> — ADR-0026 §3.
 *
 * <p>{@code SYS_CONFIG} 전량을 {@code yml} 위에 얹어 <b>전 props 클래스를 한 번</b>
 * 바인딩해 본다. 실패하면 <b>기동이 실패한다.</b>
 *
 * <h2>왜 필요한가</h2>
 *
 * <p>재바인딩이 {@code @Validated} 를 다시 돌리므로 <b>화면을 안 거친 값도 검증을 만난다</b>
 * — 그것이 이 설계가 원한 바인데, 대가가 있다.
 *
 * <pre>
 * UPDATE SYS_CONFIG SET CFG_VAL = '-1'  WHERE CFG_KEY = 'auth.login.fail-limit';  -- @Min(0) 위반
 * </pre>
 *
 * <p>이 행이 들어간 순간에는 아무 일도 없다. <b>터지는 것은 다음 작업</b>이고, 죽는 것은
 * 넣은 사람이 아니라 <b>그 설정을 읽는 아무 요청</b>이다 — {@code auth.login.*} 이면
 * 로그인이 전부 죽는다.
 *
 * <p>그래서 <b>배포자가 보게</b> 한다. 이미 들어가 있던 나쁜 행은 기동에서 걸리고, 기동
 * 후에 들어온 것은 런타임 재바인딩이 예외로 낸다 — <b>둘을 함께 둔다</b>. 그 키만
 * {@code yml} 로 되돌리면 로그만 남고 조용하며, <b>화면은 {@code 변경됨} 이라 말하는데
 * 동작은 기본값</b>인 바로 그 실패가 된다.
 *
 * <h2>왜 {@code ApplicationRunner} 인가</h2>
 *
 * <p>Liquibase 는 컨텍스트 초기화 중에 돌므로 이 시점에는 테이블이 이미 있다. 그리고
 * <b>러너에서 던진 예외는 기동을 실패시킨다</b> — {@code ApplicationReadyEvent} 리스너보다
 * 그 사실이 분명하다.
 *
 * <p><b>경계를 직접 연다.</b> 여기는 요청도 배치도 아니라 열어 줄 사람이 없다 —
 * {@code inNewSnapshot} 이 그 자리다(ADR-0026 §2).
 *
 * <p><b>{@code Started …Application} 로그가 먼저 찍히고 그 뒤에 죽는다.</b> 러너는 웹
 * 서버가 뜬 뒤에 도므로 그렇게 보이며, 프로세스는 <b>0이 아닌 코드로 끝난다</b> —
 * 오케스트레이터가 보는 것은 그쪽이다. 초기화 중으로 당기려면 빈 초기화 순서에 기대야
 * 하는데, <b>Liquibase 보다 뒤</b>라는 것을 그 방식으로는 선언할 자리가 마땅치 않다.
 */
@Component
public class ConfigStartupCheck implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ConfigStartupCheck.class);

    private final ConfigLookup configs;
    private final ConfigValidator validator;
    private final ConfigCatalog catalog;
    private final SysConfigOverrideSource overrides;

    public ConfigStartupCheck(
            ConfigLookup configs,
            ConfigValidator validator,
            ConfigCatalog catalog,
            SysConfigOverrideSource overrides) {
        this.configs = configs;
        this.validator = validator;
        this.catalog = catalog;
        this.overrides = overrides;
    }

    @Override
    public void run(ApplicationArguments args) {
        configs.inNewSnapshot(() -> {
            var values = overrides.load();
            List<ConfigViolation> violations = validator.validate(values);
            if (!violations.isEmpty()) {
                throw new IllegalStateException(describe(violations));
            }
            log.info(
                    "설정 예행 바인딩 통과 — 키 {}개 중 오버라이드 {}개",
                    catalog.keys().size(),
                    values.size());
        });
    }

    /**
     * <b>전부 적는다.</b> 하나씩 고치며 기동을 반복하게 두지 않는다 — SQL 로 직접 넣은
     * 행은 보통 한 번에 여럿이다.
     */
    private static String describe(List<ConfigViolation> violations) {
        StringBuilder text = new StringBuilder(
                "SYS_CONFIG 의 값이 바인딩을 통과하지 못했다 — 이 테이블의 쓰기 경로는"
                        + " 관리 화면 하나이며 SQL 직접 수정은 비지원이다(ADR-0026 §3).");
        violations.forEach(violation ->
                text.append("\n  ").append(violation.key()).append(": ").append(violation.message()));
        return text.toString();
    }
}
