package com.aiagent.support.lock;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.context.ApplicationContext;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.stereotype.Component;
import org.springframework.transaction.interceptor.TransactionAttributeSource;
import org.springframework.util.ClassUtils;
import org.springframework.util.ReflectionUtils;

/**
 * {@link CustomLock} 선언을 <b>기동 시점에</b> 검사한다 — 31 §4 방어 3 · §6.
 *
 * <p><b>둘을 본다.</b>
 *
 * <table>
 *   <tr><td>{@code WAIT} ∧ 쿨다운 &gt; 0</td>
 *       <td>31 §6 — <i>"락이 풀리면 실행"</i> 과 <i>"락을 유지한다"</i> 는 양립하지 않는다</td></tr>
 *   <tr><td>락 메서드에 트랜잭션 속성이 있다</td>
 *       <td>31 §4 — 락 구간에 트랜잭션이 걸친다</td></tr>
 * </table>
 *
 * <p><b>런타임 경고 로그로 흘리지 않는다</b>(31 §6). 둘 다 <i>동작은 하는데 방어가 없는</i>
 * 상태를 만들고, 그 상태의 증상은 <b>락이 없을 때와 같다</b> — 빈도만 낮다. 경고는 읽히지
 * 않고 사고는 재현되지 않는다. 기동을 실패시키는 것이 원칙 P1 의 적용이다.
 *
 * <h2>어노테이션을 직접 뒤지지 않는다</h2>
 *
 * 트랜잭션 속성 검사는 {@link TransactionAttributeSource} 에게 <b>스프링 자신의 판정</b>을
 * 묻는다. 메서드 애너테이션만 보면 클래스 레벨·상위 클래스·인터페이스·<b>메타 애너테이션</b>을
 * 전부 놓친다 — 31 §7 이 지적한 <i>"없음과 못 찾음을 구분하지 못하는 검사"</i> 와 같은
 * 함정이며, 그런 검사는 <b>조용히 통과</b>해 막으려던 사고를 그대로 낸다.
 *
 * <h2>이 검사가 잡지 못하는 것</h2>
 *
 * <b>호출자가 이미 트랜잭션을 열었을 때</b>다 — 정적으로 볼 수 없다. 그것을 잡는 것은
 * {@code CustomLockAspect} 의 런타임 검사 하나이며(방어 2), 여기는 <b>빠른 피드백</b>일 뿐
 * 대체재가 아니다.
 */
@Component
public class LockDeclarationValidator implements SmartInitializingSingleton {

    private final ApplicationContext context;
    private final TransactionAttributeSource transactionAttributes;

    public LockDeclarationValidator(
            ApplicationContext context, TransactionAttributeSource transactionAttributes) {
        this.context = context;
        this.transactionAttributes = transactionAttributes;
    }

    @Override
    public void afterSingletonsInstantiated() {
        List<String> violations = new ArrayList<>();

        for (String name : context.getBeanDefinitionNames()) {
            Class<?> targetClass = target(name);
            if (targetClass == null) {
                continue;
            }
            ReflectionUtils.doWithMethods(
                    targetClass,
                    method -> inspect(targetClass, method, violations),
                    method -> AnnotatedElementUtils.hasAnnotation(method, CustomLock.class));
        }
        if (!violations.isEmpty()) {
            throw new IllegalStateException(
                    "@CustomLock 선언이 규약을 어겼다 — 31 §4 · §6\n  " + String.join("\n  ", violations));
        }
    }

    private void inspect(Class<?> targetClass, Method method, List<String> violations) {
        CustomLock declaration = AnnotatedElementUtils.findMergedAnnotation(method, CustomLock.class);
        if (declaration == null) {
            return;
        }
        String where = targetClass.getSimpleName() + "." + method.getName();

        if (declaration.onConflict() == LockConflict.WAIT && declaration.minIntervalSeconds() > 0) {
            violations.add(where + " : WAIT 와 쿨다운은 상호 배타다(31 §6)");
        }
        if (transactionAttributes.getTransactionAttribute(method, targetClass) != null) {
            violations.add(
                    where + " : 락 메서드에 트랜잭션 속성이 있다 — 전용 락 트리거 빈을 쓰거나"
                            + " 전파를 NOT_SUPPORTED 로 덮는다(31 §4)");
        }
    }

    /**
     * 빈의 <b>실제 클래스</b>. 프록시를 벗기지 않으면 메서드 애너테이션이 보이지 않는다(31 §7).
     *
     * <p><b>빈을 꺼내지 않고 타입만 묻는다.</b> {@code getBean} 을 부르면 아직 안 만들어진
     * 지연 빈까지 여기서 만들어지고, 검증기 하나가 기동 순서를 바꾼다.
     */
    private Class<?> target(String name) {
        try {
            Class<?> type = context.getType(name);
            return type == null ? null : ClassUtils.getUserClass(type);
        } catch (RuntimeException e) {
            // 타입을 알 수 없는 빈이 있다(팩토리·스코프 프록시). 검사 대상이 아니다.
            return null;
        }
    }
}
