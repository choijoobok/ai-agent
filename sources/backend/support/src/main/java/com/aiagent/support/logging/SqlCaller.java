package com.aiagent.support.logging;

import java.util.List;
import java.util.Optional;

/**
 * 이 쿼리를 부른 <b>우리 코드의 첫 자리</b> — backend/logging.md.
 *
 * <p>P6Spy 는 JDBC 계층이라 호출자를 모른다. 스택을 직접 걸어 찾는다.
 *
 * <p><b>{@code Thread.getStackTrace()} 가 아니라 {@link StackWalker} 다.</b> 앞의 것은
 * 전체 스택을 배열로 만들어 버리는데, 우리가 쓰는 것은 <b>맨 앞 하나</b>뿐이다.
 * {@code StackWalker} 는 게으르게 순회하다 첫 매칭에서 멈춘다.
 *
 * <p><b>못 찾는 경우가 있다</b>(backend/logging.md). JPA 는 엔티티를 고쳐 두면 <b>커밋 시점</b>에
 * UPDATE 를 내보내는데, 그 스택에는 값을 바꾼 서비스 메서드가 이미 없다. 그때 답은
 * {@code MDC} 의 {@code requestId} 이며(backend/logging.md) 이 클래스가 할 수 있는 일은 아니다.
 */
public final class SqlCaller {

    /** 우리 코드만 본다 — 판의 프레임은 <b>어느 것이든</b> 답이 아니다. */
    private static final String BASE_PACKAGE = "com.aiagent";

    /**
     * 우리 패키지 안이지만 <b>호출자가 아닌</b> 자리.
     *
     * <p>이 클래스 자신과 로그 포맷터가 스택의 맨 위에 있다 — 거르지 않으면 모든 줄이
     * <i>"SqlLogFormat 이 불렀다"</i> 가 된다.
     */
    private static final List<String> SKIP = List.of("com.aiagent.support.logging");

    private SqlCaller() {}

    public static String find() {
        Optional<String> frame =
                StackWalker.getInstance()
                        .walk(
                                stack ->
                                        stack.filter(SqlCaller::isOurs)
                                                .findFirst()
                                                .map(SqlCaller::describe));
        return frame.orElse("unknown");
    }

    private static boolean isOurs(StackWalker.StackFrame frame) {
        String name = frame.getClassName();
        return name.startsWith(BASE_PACKAGE) && SKIP.stream().noneMatch(name::startsWith);
    }

    private static String describe(StackWalker.StackFrame frame) {
        return frame.getClassName()
                + "."
                + frame.getMethodName()
                + "("
                + frame.getFileName()
                + ":"
                + frame.getLineNumber()
                + ")";
    }
}
