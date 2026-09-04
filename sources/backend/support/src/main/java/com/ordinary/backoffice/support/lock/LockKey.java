package com.ordinary.backoffice.support.lock;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

/**
 * {@code key} 식을 인자 값으로 편다 — 31 §2 의 {@code #파라미터.게터}.
 *
 * <pre>
 * #job.getJobNo   → job 인자의 getJobNo() 결과
 * #orderNo        → orderNo 인자 그대로
 * #0              → 첫 번째 인자
 * (비움)          → 클래스명.메서드명
 * </pre>
 *
 * <h2>SpEL 을 쓰지 않는다</h2>
 *
 * 31 §2 가 적은 식이 {@code #job.getJobNo} 로 <b>괄호가 없다</b> — SpEL 문법이 아니다. 맞춰
 * 고쳐 SpEL 을 열 수도 있었지만 <b>락 키에 표현식 엔진이 필요한 자리가 없다</b>: 키는 자원
 * 하나를 가리키는 값이고, 그 이상이 필요하면 그것은 키가 아니라 <b>연산</b>이다.
 *
 * <p>얻는 것이 둘이다 — 식이 <b>인자와 게터 이름뿐</b>이라 컴파일된 코드에서 눈으로 검증되고,
 * SpEL 컨텍스트가 없으므로 <b>키 문자열이 코드를 실행하는 표면</b>이 생기지 않는다.
 *
 * <h2>인자 이름은 {@code -parameters} 가 준다</h2>
 *
 * 빌드가 그 플래그를 켜 두었다(루트 {@code build.gradle.kts}). 꺼지면 이름이
 * {@code arg0} 이 되어 <b>{@code #job} 이 조용히 못 찾는 이름</b>이 되는데, 그때는
 * {@link #NOT_FOUND} 로 떨어지지 않고 <b>기동 시점에 터진다</b> — 락 키가 조용히 바뀌면
 * 상호 배제가 사라지고 그 사실이 드러나지 않는다.
 */
final class LockKey {

    private static final String NOT_FOUND = "인자를 찾을 수 없다";

    /** 비어 있으면 {@code 클래스명.메서드명} — 31 §2. */
    static String resolve(CustomLock lock, Method method, Object[] args, Class<?> targetClass) {
        String expression = lock.key().trim();
        if (expression.isEmpty()) {
            return targetClass.getSimpleName() + "." + method.getName();
        }
        if (!expression.startsWith("#")) {
            throw new IllegalStateException(
                    "락 키는 #파라미터 또는 #파라미터.게터 여야 한다 — " + describe(method) + " : " + expression);
        }
        String[] parts = expression.substring(1).split("\\.", 2);
        Object value = argument(method, args, parts[0]);
        if (parts.length == 2) {
            value = invoke(value, parts[1], method);
        }
        return value == null ? "" : value.toString();
    }

    private static Object argument(Method method, Object[] args, String name) {
        // 위치 지정 — `#0`. 이름이 없어도 쓸 수 있는 유일한 형태다(31 §4 의 락 트리거 빈).
        if (name.chars().allMatch(Character::isDigit) && !name.isEmpty()) {
            int index = Integer.parseInt(name);
            if (index >= args.length) {
                throw new IllegalStateException(
                        "락 키가 없는 인자 자리를 가리킨다 — " + describe(method) + " : #" + index);
            }
            return args[index];
        }
        java.lang.reflect.Parameter[] parameters = method.getParameters();
        for (int i = 0; i < parameters.length; i++) {
            if (parameters[i].getName().equals(name)) {
                return args[i];
            }
        }
        throw new IllegalStateException(
                NOT_FOUND + " — " + describe(method) + " : #" + name
                        + " (컴파일에 -parameters 가 켜져 있는지 본다)");
    }

    private static Object invoke(Object target, String getter, Method method) {
        if (target == null) {
            return null;
        }
        try {
            Method accessor = target.getClass().getMethod(getter);
            accessor.setAccessible(true);
            return accessor.invoke(target);
        } catch (NoSuchMethodException e) {
            throw new IllegalStateException(
                    "락 키의 게터가 없다 — " + describe(method) + " : " + getter, e);
        } catch (IllegalAccessException | InvocationTargetException e) {
            throw new IllegalStateException(
                    "락 키의 게터를 부를 수 없다 — " + describe(method) + " : " + getter, e);
        }
    }

    private static String describe(Method method) {
        return method.getDeclaringClass().getSimpleName() + "." + method.getName();
    }

    private LockKey() {}
}
