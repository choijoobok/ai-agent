package com.aiagent.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noMethods;

import com.tngtech.archunit.core.domain.JavaAnnotation;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 서비스의 <b>이름과 트랜잭션 모양</b>을 빌드가 고정한다 —
 * aidd-guide/standard/backend/packages.md.
 *
 * <p><b>왜 검사가 필요한가.</b> 둘 다 "어긋나도 컴파일되고 테스트도 통과하는" 종류다.
 * 조회 서비스 이름이 갈리면(`*AdminQueryService` 여섯 · `*QueryService` 열하나 —
 * 2026-09-02 실측) 새 화면을 만드는 사람이 <b>무엇을 따라야 할지 알 수 없고</b>, 클래스
 * 레벨 {@code readOnly} 가 빠지면 조회가 <b>쓰기 트랜잭션으로 돈다</b> — 동작은 같고
 * 플러시만 늘어나므로 아무도 알아채지 못한다.
 *
 * <p><b>세 모양을 인정한다</b>(backend/packages.md). 여기서 검사하는 것은 <b>순수 조회</b> 하나다:
 *
 * <ul>
 *   <li><b>순수 조회</b>({@code *QueryService}) — 클래스 레벨 {@code readOnly = true},
 *       메서드 레벨 없음. <b>이 테스트가 강제한다</b>
 *   <li><b>순수 명령</b>({@code *Service} — 관리 화면의 저장) — 클래스 레벨을 두지 않고
 *       쓰기 메서드마다 선언한다. 락의 트랜잭션 안에서 도는 것처럼 <b>붙이지 않는 것이
 *       맞는 경우</b>가 있어({@code MenuService}) 기계로 세지 않는다
 *   <li><b>혼합</b>(공통 계층 — 읽기와 쓰기를 함께 갖는다) — 클래스 레벨
 *       {@code readOnly = true} + 쓰기 메서드마다 선언
 * </ul>
 */
class ServiceConventionTest {

    private static final String BASE = "com.aiagent";
    private static final String TRANSACTIONAL = "org.springframework.transaction.annotation.Transactional";

    private final JavaClasses classes = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages(BASE);

    private static final ArchCondition<JavaClass> READ_ONLY_AT_CLASS_LEVEL =
            new ArchCondition<>("클래스 레벨 @Transactional(readOnly = true) 를 갖는다") {
                @Override
                public void check(JavaClass item, ConditionEvents events) {
                    if (!readOnly(item)) {
                        events.add(SimpleConditionEvent.violated(
                                item,
                                item.getName()
                                        + " 에 클래스 레벨 @Transactional(readOnly = true) 가 없다 — backend/packages.md"));
                    }
                }
            };

    private static boolean readOnly(JavaClass type) {
        Optional<? extends JavaAnnotation<?>> annotation = type.tryGetAnnotationOfType(TRANSACTIONAL);
        return annotation
                .map(found -> found.get("readOnly").orElse(Boolean.FALSE))
                .map(Boolean.TRUE::equals)
                .orElse(false);
    }

    @Test
    @DisplayName("조회 서비스는 클래스 레벨 readOnly 를 갖는다")
    void queryServicesAreReadOnly() {
        classes()
                .that().haveSimpleNameEndingWith("QueryService")
                .should(READ_ONLY_AT_CLASS_LEVEL)
                .allowEmptyShould(false)
                .check(classes);
    }

    @Test
    @DisplayName("조회 서비스의 메서드에는 @Transactional 이 없다 — 클래스 레벨이 전부다")
    void queryServiceMethodsCarryNoTransaction() {
        noMethods()
                .that().areDeclaredInClassesThat().haveSimpleNameEndingWith("QueryService")
                .should().beAnnotatedWith(TRANSACTIONAL)
                .allowEmptyShould(false)
                .check(classes);
    }

    /**
     * {@code Admin} 은 <b>패키지가 말하거나 이름 충돌을 피할 때만</b> 쓴다 — backend/packages.md.
     *
     * <p>조회에는 충돌이 없었다. 열일곱 중 여섯만 {@code Admin} 을 달고 있었고 그 여섯은
     * 모두 {@code <도메인>/admin/} 패키지 안이라 <b>같은 말을 두 번</b> 하고 있었다.
     */
    @Test
    @DisplayName("조회 서비스 이름에 Admin 을 넣지 않는다 — 패키지가 이미 말한다")
    void queryServicesAreNotNamedAdmin() {
        noClasses()
                .that().haveSimpleNameEndingWith("QueryService")
                .should().haveSimpleNameContaining("Admin")
                .allowEmptyShould(false)
                .check(classes);
    }

    @Test
    @DisplayName("컨트롤러에는 트랜잭션이 없다 — 경계는 서비스 메서드다")
    void controllersCarryNoTransaction() {
        noClasses()
                .that().haveSimpleNameEndingWith("Controller")
                .should().beAnnotatedWith(TRANSACTIONAL)
                .allowEmptyShould(false)
                .check(classes);

        noMethods()
                .that().areDeclaredInClassesThat().haveSimpleNameEndingWith("Controller")
                .should().beAnnotatedWith(TRANSACTIONAL)
                .allowEmptyShould(false)
                .check(classes);
    }
}
