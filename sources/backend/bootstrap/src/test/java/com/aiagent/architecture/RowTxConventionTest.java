package com.aiagent.architecture;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiagent.core.error.RowTx;
import com.tngtech.archunit.core.domain.JavaAnnotation;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaCodeUnit;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaMethodCall;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * {@link RowTx} 의 <b>이름이 거짓이 되지 않게</b> 빌드가 지킨다 —
 * aidd-guide/standard/backend/row-transaction.md.
 *
 * <p><b>왜 검사가 필요한가.</b> {@code RowTx} 는 트랜잭션을 열지도 닫지도 못한다 — 경계는
 * {@code @Transactional} 이 <b>어디 붙어 있느냐</b> 가 정한다. 그래서 {@code oneTxPerRow} 를
 * 부르면서 그 메서드에 {@code @Transactional} 을 달아 두면 <b>이름은 건별인데 실제는 한
 * 덩이</b>가 되고, 그 어긋남은 <b>컴파일도 되고 단위 테스트도 통과한다</b>. 드러나는 자리는
 * 운영이다:
 *
 * <ul>
 *   <li>{@code oneTxPerRow} 인데 바깥이 트랜잭션 — 행마다 커밋되지 않는다. 게다가 실패를
 *       잡고 계속 돌므로 커밋 시점에 {@code UnexpectedRollbackException} 이 나서
 *       <b>499행이 성공한 실행이 통째로 사라진다</b>
 *   <li>{@code oneTxForAll} 인데 바깥에 트랜잭션이 없다 — 끝에 던져도 되돌릴 것이 없다.
 *       <b>앞선 행은 이미 커밋됐고</b> 사용자는 400 을 보며 <i>아무것도 안 됐다</i> 고 읽는다
 * </ul>
 *
 * <h2>호출 사슬을 따라간다</h2>
 *
 * <p><b>부르는 메서드 하나만 보면 안 된다.</b> 트랜잭션은 <b>진입 메서드</b>에 걸리고 그
 * 아래의 사적 헬퍼는 그 트랜잭션 안에서 돈다 — {@code ConfigService.checkKeys} 가 그 모양이며,
 * 여기를 좁게 보면 <b>맞는 코드를 틀렸다고 한다</b>(이 검사의 첫 판이 실제로 그랬다).
 *
 * <p>그래서 <b>사슬을 거슬러 올라간다</b>: 자기가 {@code @Transactional} 이면 거기서 끝이고,
 * 아니면 <b>자기를 부르는 모든 메서드</b>가 그 조건을 만족해야 한다. 부르는 이가 하나도 없는
 * 메서드는 <b>사슬이 끊긴 것</b>이라 판정할 수 없으므로 위반으로 센다 — 죽은 코드이거나
 * 우리가 못 보는 곳에서 불리는 것이고, 둘 다 손봐야 한다.
 */
class RowTxConventionTest {

    private static final String BASE = "com.aiagent";
    private static final String TRANSACTIONAL = "org.springframework.transaction.annotation.Transactional";

    private final JavaClasses classes = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages(BASE);

    /** 누가 누구를 부르나 — 사슬을 거슬러 오르려면 <b>역방향</b> 간선이 필요하다. */
    private final Map<String, List<JavaMethod>> callers = new HashMap<>();

    RowTxConventionTest() {
        for (JavaClass type : classes) {
            for (JavaMethod method : type.getMethods()) {
                for (JavaMethodCall call : method.getMethodCallsFromSelf()) {
                    callers.computeIfAbsent(call.getTarget().getFullName(), key -> new ArrayList<>())
                            .add(method);
                }
            }
        }
    }

    @Test
    @DisplayName("oneTxForAll 은 쓰기 트랜잭션 안에서 돈다")
    void allInOneRunsInsideOneTransaction() {
        List<String> violations = new ArrayList<>();
        for (JavaMethod caller : callersOf("oneTxForAll")) {
            if (!alwaysInWriteTx(caller, new HashSet<>())) {
                violations.add(caller.getFullName()
                        + " 가 oneTxForAll 을 부르는데 쓰기 트랜잭션 밖에서 닿을 수 있다 —"
                        + " 끝에 던져도 되돌릴 것이 없다(backend/row-transaction.md)");
            }
        }
        assertThat(violations).isEmpty();
    }

    /**
     * <b>클래스 레벨도 본다.</b> {@code readOnly = true} 라도 트랜잭션은 트랜잭션이라 행마다
     * 커밋되지 않는다 — 혼합 서비스({@code readOnly} + 메서드마다 쓰기)에서 <b>가장 조용히</b>
     * 어긋나는 자리가 여기다.
     */
    @Test
    @DisplayName("oneTxPerRow 는 어떤 트랜잭션 안에서도 돌지 않는다")
    void perRowRunsOutsideAnyTransaction() {
        List<String> violations = new ArrayList<>();
        for (JavaMethod caller : callersOf("oneTxPerRow")) {
            if (!neverInTx(caller, new HashSet<>())) {
                violations.add(caller.getFullName()
                        + " 가 oneTxPerRow 를 부르는데 트랜잭션 안에서 닿을 수 있다 —"
                        + " 행마다 커밋되지 않고 커밋 시점에 UnexpectedRollbackException 이 난다"
                        + "(backend/row-transaction.md)");
            }
        }
        assertThat(violations).isEmpty();
    }

    private List<JavaMethod> callersOf(String name) {
        List<JavaMethod> found = new ArrayList<>();
        for (JavaClass type : classes) {
            for (JavaMethod method : type.getMethods()) {
                if (calls(method, name)) found.add(method);
            }
        }
        return found;
    }

    private static boolean calls(JavaCodeUnit method, String name) {
        for (JavaMethodCall call : method.getMethodCallsFromSelf()) {
            if (call.getTarget().getOwner().getFullName().equals(RowTx.class.getName())
                    && call.getTarget().getName().equals(name)) {
                return true;
            }
        }
        return false;
    }

    /** 여기로 오는 <b>모든 길</b>이 쓰기 트랜잭션을 지나나. */
    private boolean alwaysInWriteTx(JavaMethod method, Set<String> seen) {
        if (!seen.add(method.getFullName())) return true; // 순환 — 이 길은 새 사실을 주지 않는다
        Optional<? extends JavaAnnotation<?>> onMethod = method.tryGetAnnotationOfType(TRANSACTIONAL);
        if (onMethod.isPresent()) return !readOnly(onMethod.get());

        Optional<? extends JavaAnnotation<?>> onClass = onClass(method);
        if (onClass.isPresent() && !readOnly(onClass.get())) return true;

        List<JavaMethod> above = callers.getOrDefault(method.getFullName(), List.of());
        if (above.isEmpty()) return false;
        return above.stream().allMatch(one -> alwaysInWriteTx(one, seen));
    }

    /** 여기로 오는 <b>모든 길</b>이 트랜잭션을 지나지 않나 — {@code readOnly} 도 트랜잭션이다. */
    private boolean neverInTx(JavaMethod method, Set<String> seen) {
        if (!seen.add(method.getFullName())) return true;
        if (method.tryGetAnnotationOfType(TRANSACTIONAL).isPresent()) return false;
        if (onClass(method).isPresent()) return false;

        return callers.getOrDefault(method.getFullName(), List.of()).stream()
                .allMatch(one -> neverInTx(one, seen));
    }

    private static Optional<? extends JavaAnnotation<?>> onClass(JavaMethod method) {
        return method.getOwner().tryGetAnnotationOfType(TRANSACTIONAL);
    }

    private static boolean readOnly(JavaAnnotation<?> annotation) {
        return Boolean.TRUE.equals(annotation.get("readOnly").orElse(Boolean.FALSE));
    }
}
