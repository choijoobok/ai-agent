package com.aiagent.support.lock;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 분산 락 선언 — backend/persistence.md.
 *
 * <pre>
 * &#64;CustomLock(type = "MENU_TREE", onConflict = LockConflict.WAIT)
 * public void withLock(Runnable work) { work.run(); }
 * </pre>
 *
 * <p><b>일반 서비스 메서드용이다.</b> 스케줄 배치는 이 애너테이션을 쓰지 않는다 — 락을 거는
 * 주체가 배치 구현체가 아니라 <b>스케줄러 래퍼</b>이고, 파라미터는 등록 행의 컬럼에서
 * 읽는다(backend/persistence.md). 배치 빈에 이것이 붙어 있으면 래퍼의 락과 <b>이중으로 걸린다</b>.
 *
 * <h2>권장 사용은 전용 락 트리거 빈이다</h2>
 *
 * backend/persistence.md 의 4중 방어 중 첫째다. 트랜잭션 애너테이션이 없는 빈을 <b>락 경계로만</b> 쓰면 두
 * 가지가 한 번에 해결된다 — 락 구간에 트랜잭션이 걸치지 않고(순서 규약이 무관해진다),
 * <b>{@code this.method()} 자기 호출로 프록시를 건너뛰는 일</b>도 구조적으로 없어진다.
 * 자기 호출은 예외도 나지 않고 <b>락이 조용히 안 걸린다</b> — 이 애너테이션에서 그것은
 * 조용한 데이터 손상이다.
 *
 * <h2>{@link #expirySeconds} 와 {@link #minIntervalSeconds} 는 다른 것이다</h2>
 *
 * backend/persistence.md 가 둘을 나눈 이유가 그것이다. 하나로 합치고 불린으로 켜면 <b>그 값에 따라
 * {@code expirySeconds} 의 의미 자체가 바뀌고</b>, 기본값 300초를 둔 채 옵션만 끄면 같은
 * 키가 5분에 한 번만 도는 사고가 난다 — <b>주석으로 경고해야 하는 설계는 잘못된 설계다.</b>
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface CustomLock {

    /** 락 키의 네임스페이스. 같은 키 문자열이 다른 자원을 뜻하는 충돌을 막는다. */
    String type() default "ANY";

    /**
     * 자원 식별자 — {@code #파라미터} 또는 {@code #파라미터.게터} 로 인자 값을 참조한다
     * ({@code #0} 처럼 위치로도 쓴다).
     *
     * <p><b>비우면 {@code 클래스명.메서드명} 이 된다</b>(backend/persistence.md) — 자원이 하나뿐인 메서드가
     * 그렇다. 메뉴 트리 저장이 실례이며, 잠글 대상이 <i>트리 전체</i> 라 키가 필요 없다.
     */
    String key() default "";

    /**
     * <b>장애 안전망</b> — 프로세스가 죽어 해제를 못 했을 때의 회수 시한이다(backend/persistence.md).
     *
     * <p>업무 규칙이 아니라 <b>인프라 사정</b>이 정한다. 재실행 간격을 이것으로 표현하지
     * 않는다 — 그 자리는 {@link #minIntervalSeconds} 다.
     */
    int expirySeconds() default 300;

    /**
     * <b>쿨다운</b> — 같은 키의 최소 재실행 간격이다(backend/persistence.md).
     *
     * <p>작업이 너무 빨리 끝나면 락이 상호 배제에 실패한다. {@code 0} 이면 작업 종료 즉시
     * 해제하고, {@code > 0} 이면 종료해도 그 시각까지 락을 유지한다 — ShedLock 의
     * {@code lockAtLeastFor} 와 같은 패턴이다.
     *
     * <p><b>{@link LockConflict#WAIT} 와 함께 쓸 수 없다</b>(backend/persistence.md). 둘 다 지정하면
     * <b>기동 시점에 거부</b>한다 — 런타임 경고 로그로 흘리지 않는다.
     */
    int minIntervalSeconds() default 0;

    LockConflict onConflict() default LockConflict.IGNORE;
}
