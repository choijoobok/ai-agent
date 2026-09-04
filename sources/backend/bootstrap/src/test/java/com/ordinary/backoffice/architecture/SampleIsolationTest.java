package com.ordinary.backoffice.architecture;

import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideOutsideOfPackage;
import static com.tngtech.archunit.core.domain.properties.CanBeAnnotated.Predicates.annotatedWith;
import static com.tngtech.archunit.core.domain.properties.HasName.Predicates.name;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.assertj.core.api.Assertions.assertThat;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaAnnotation;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 샘플은 <b>통째로 지울 수 있어야 한다</b> — llm-guide/06-framework/conventions.md §7.
 *
 * <p>[10] §L 이 샘플을 <i>"참조 구현"</i> 으로 정의하면서 함께 요구한 것이 격리다. 사용
 * 프로젝트는 샘플을 베낀 다음 걷어내는데, 그 삭제가 <b>폴더 하나와 선언 몇 줄</b>이 아니면
 * 아무도 걷어내지 않는다 — 남은 샘플은 업무 코드 사이에 섞여 <i>"이건 예제인가 진짜인가"</i>
 * 를 영원히 묻게 한다(48 §1.2 의 <i>"그럴듯할수록 위험하다"</i>).
 *
 * <h2>규칙이 둘이고, 방향이 반대다</h2>
 *
 * <ul>
 *   <li><b>코드 방향</b> — 밖에서 샘플을 참조하지 않는다. 참조가 하나라도 있으면 삭제가
 *       컴파일 오류가 되고, 그 순간 걷어내기는 <i>"고쳐 가며 지우는 일"</i> 이 된다.
 *   <li><b>테이블 방향</b> — 샘플은 {@code SMPL_} 테이블만 쓴다. 반대가 열리면 삭제 시
 *       공통이 깨진다 — 999-sample-remove 가 지우는 것은 {@code SMPL_} 뿐이라, 샘플이 공통
 *       테이블에 남긴 행은 <b>주인 없이 남는다</b>.
 * </ul>
 *
 * <p><b>이 파일도 샘플과 함께 지운다.</b> 샘플이 없으면 세 규칙은 위반 0건으로 조용히
 * 통과하는데, 그것은 검사가 아니라 <b>영원히 초록인 게이트</b>다(LayerDependencyTest 가
 * 임포트 비었음을 막는 것과 같은 종류의 함정). 999-sample-remove.yaml 의 걷어내기 목록에
 * 이 경로가 적혀 있다.
 */
class SampleIsolationTest {

    private static final String BASE = "com.ordinary.backoffice";

    /** 샘플의 패키지 — 계층이 어디든 마디가 {@code sample} 이면 샘플이다(68 §10.3). */
    private static final String SAMPLE = BASE + "..sample..";

    /** 문자열로 쓴다 — 이 테스트가 JPA 를 컴파일 의존으로 끌어오지 않게. */
    private static final String ENTITY = "jakarta.persistence.Entity";

    private static final String TABLE = "jakarta.persistence.Table";

    /**
     * <b>유일한 예외다</b>(68 §10.3). 코드 라벨은 <b>읽기만</b> 하며, 샘플이 지워져도
     * {@code SYS_CODE} 는 제 주인이 따로 있어 아무것도 남지 않는다. 예외를 이름 하나로
     * 못 박는 것은 패키지로 열면 <i>코드 도메인 전체</i> 가 함께 열리기 때문이다.
     */
    private static final String SYS_CODE = BASE + ".domain.code.entity.SysCode";

    private final JavaClasses classes = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages(BASE);

    /**
     * LayerDependencyTest 와 같은 이유의 방어다 — 임포트가 비면 아래 규칙이 전부 공허하게
     * 통과한다. 샘플의 존재를 걸지 않는 것은 <b>샘플이 없는 것이 정상 상태</b>이기 때문이다.
     */
    @Test
    @DisplayName("임포트가 비어 있지 않다 — 아래 규칙이 공허하게 통과하는 것을 막는다")
    void importIsNotEmpty() {
        assertThat(classes).isNotEmpty();
        assertThat(classes.stream().map(JavaClass::getName))
                .contains(BASE + ".core.domain.BaseAuditEntity");
    }

    @Test
    @DisplayName("샘플 밖에서 샘플을 참조하지 않는다 — 삭제가 폴더 하나로 끝나야 한다")
    void nothingDependsOnSample() {
        noClasses()
                .that().resideOutsideOfPackage(SAMPLE)
                .should().dependOnClassesThat().resideInAPackage(SAMPLE)
                .allowEmptyShould(true)
                .check(classes);
    }

    @Test
    @DisplayName("샘플은 밖의 엔티티를 참조하지 않는다 — SYS_CODE 읽기만 예외다")
    void sampleDoesNotTouchForeignEntities() {
        DescribedPredicate<JavaClass> foreignEntity = resideOutsideOfPackage(SAMPLE)
                .and(annotatedWith(ENTITY))
                .and(DescribedPredicate.not(name(SYS_CODE)))
                .as("샘플 밖의 엔티티 (읽기 전용 참조 SYS_CODE 는 제외)");

        noClasses()
                .that().resideInAPackage(SAMPLE)
                .should().dependOnClassesThat(foreignEntity)
                .allowEmptyShould(true)
                .check(classes);
    }

    /**
     * 앞 규칙의 뒷면이다. 밖의 엔티티를 안 쓰는 것만으로는 부족하다 — <b>샘플이 제 안에서
     * 공통 테이블에 매핑한 엔티티를 새로 만들면</b> 참조는 전부 샘플 안이라 앞 규칙에
     * 걸리지 않는데, 지울 때 그 테이블은 {@code SMPL_} 이 아니라 살아남는다.
     *
     * <p>{@code @Table} 이 없는 것도 위반이다. 없으면 하이버네이트가 클래스명으로 테이블을
     * 정하는데, 그 이름은 <b>접두 규칙과 아무 상관이 없다</b>.
     */
    @Test
    @DisplayName("샘플의 엔티티는 SMPL_ 테이블에만 매핑된다")
    void sampleEntitiesMapOnlySmplTables() {
        List<String> violations = new ArrayList<>();

        classes.stream()
                .filter(SampleIsolationTest::insideSample)
                .filter(c -> c.isAnnotatedWith(ENTITY))
                .forEach(c -> {
                    Optional<String> table = tableNameOf(c);
                    if (table.isEmpty()) {
                        violations.add(c.getName() + " — @Table 이 없다");
                    } else if (!table.get().startsWith("SMPL_")) {
                        violations.add(c.getName() + " — " + table.get());
                    }
                });

        assertThat(violations)
                .as("샘플 엔티티가 SMPL_ 밖의 테이블에 매핑됐다 — 지울 때 그 테이블이 남는다")
                .isEmpty();
    }

    /** {@link #SAMPLE} 의 자바 쪽 짝이다 — 마디가 {@code sample} 이면 샘플이다. */
    private static boolean insideSample(JavaClass javaClass) {
        String pkg = javaClass.getPackageName();
        return pkg.endsWith(".sample") || pkg.contains(".sample.");
    }

    private static Optional<String> tableNameOf(JavaClass entity) {
        if (!entity.isAnnotatedWith(TABLE)) {
            return Optional.empty();
        }
        JavaAnnotation<JavaClass> table = entity.getAnnotationOfType(TABLE);
        return table.get("name").map(String::valueOf).filter(n -> !n.isBlank());
    }
}
