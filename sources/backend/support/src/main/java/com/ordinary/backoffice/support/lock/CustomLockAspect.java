package com.ordinary.backoffice.support.lock;

import com.ordinary.backoffice.core.error.BusinessException;
import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * {@link CustomLock} 의 집행 — 31 §4 · §11.
 *
 * <h2>정책이 둘로 갈리고, 트랜잭션 구조가 그 갈림이다</h2>
 *
 * <pre>
 * 즉시실패(IGNORE·EXCEPTION·LOG)        WAIT
 *   tryAcquire  (별도 오토커밋)           tx begin  ← 이 어드바이스가 연다
 *   ┌ proceed  (자기 트랜잭션)              acquireBlocking  (같은 tx)
 *   └ release   (별도 오토커밋)             proceed          (같은 tx)
 *                                         commit    ← 해제가 곧 커밋
 * </pre>
 *
 * <p>왼쪽에는 <b>flush+commit 구간의 노출 창</b>이 남는다(31 §4). 좁지만 안전하지 않다 —
 * 피해가 창 크기에 비례하지 않고(그 5ms 안에 {@code SELECT} 한 번만 걸리면 뒤 트랜잭션 전체가
 * 잘못된 전제 위에서 돈다), <b>확률이 가장 높은 순간에 열린다</b>(두 사람이 거의 동시에 누를
 * 때 — 정확히 방어하려던 상황이다). 오른쪽은 해제와 영속성 결정이 원자적이라 창이 0 이다.
 *
 * <h2>4중 방어 중 둘이 여기 있다 — 31 §4</h2>
 *
 * <table>
 *   <tr><td>1</td><td><b>전용 락 트리거 빈</b></td><td>구조적. 쓰는 쪽이 한다</td></tr>
 *   <tr><td>2</td><td><b>런타임 {@code isActualTransactionActive()} 거부</b></td>
 *       <td><b>여기</b> — 유일하게 빈틈이 없다</td></tr>
 *   <tr><td>3</td><td>기동 시 {@code TransactionAttributeSource} 스캔</td>
 *       <td>{@code LockBoundaryValidator}</td></tr>
 *   <tr><td>4</td><td>애스펙트 {@code @Order} 명시</td><td><b>여기</b> — 완화</td></tr>
 * </table>
 *
 * <p><b>2 만 빈틈이 없는 이유</b> — 정적 스캔은 <i>그 메서드</i> 만 본다. 실제 위험은
 * <b>호출자가 이미 트랜잭션을 열었을 때</b>도 생기며(트랜잭션 걸린 상위 서비스가 락 메서드를
 * 부르거나 {@code TransactionTemplate} 을 직접 쓴 경우) 그것은 정적으로 잡히지 않는다.
 *
 * <p><b>{@code WAIT} 도 같은 거부를 받는다.</b> 이 어드바이스가 <b>자기 트랜잭션을 열어야</b>
 * 하기 때문이다 — 이미 열려 있으면 참여하게 되고, 그러면 락의 수명이 <b>부르는 쪽</b>의
 * 커밋에 매달려 어드바이스가 통제하지 못한다.
 *
 * <p><b>{@code @Order} 를 가장 바깥으로 둔다.</b> 트랜잭션 어드바이저의 기본이
 * {@code LOWEST_PRECEDENCE} 이고 {@code @Order} 없는 커스텀 애스펙트도 같은 값이라, 동률에서
 * <b>빈 등록 순서</b>가 결과를 정한다 — 빌드마다 결정적이지만 <b>명세된 것이 아니다</b>.
 * 다만 이것은 완화일 뿐이며, 근본 해법은 <i>락 구간에 트랜잭션이 걸쳐 있지 않게 하는 것</i>
 * 이다(방어 1·2).
 */
@Aspect
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CustomLockAspect {

    private static final Logger log = LoggerFactory.getLogger(CustomLockAspect.class);

    private final LockStore store;
    private final LockTransaction transaction;
    private final Clock clock;

    public CustomLockAspect(LockStore store, LockTransaction transaction, Clock clock) {
        this.store = store;
        this.transaction = transaction;
        this.clock = clock;
    }

    @Around("@annotation(com.ordinary.backoffice.support.lock.CustomLock)")
    public Object lock(ProceedingJoinPoint point) throws Throwable {
        MethodSignature signature = (MethodSignature) point.getSignature();
        Method method = signature.getMethod();
        CustomLock declaration = method.getAnnotation(CustomLock.class);

        reject(method);

        Class<?> targetClass = point.getTarget().getClass();
        String key = LockKey.resolve(declaration, method, point.getArgs(), targetClass);

        return declaration.onConflict() == LockConflict.WAIT
                ? waiting(point, declaration, key)
                : immediate(point, declaration, key, method);
    }

    /**
     * 방어 2 — <b>호출 시점에 트랜잭션이 살아 있으면 거부한다.</b>
     *
     * <p>{@link IllegalStateException} 이지 업무 예외가 아니다. 사용자가 고칠 수 있는 것이
     * 아니라 <b>코드 배치의 잘못</b>이며, 500 으로 드러나 개발 중에 잡혀야 한다.
     */
    private static void reject(Method method) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException(
                    "락 구간에 트랜잭션이 걸쳐 있다 — "
                            + method.getDeclaringClass().getSimpleName() + "." + method.getName()
                            + " (31 §4: 전용 락 트리거 빈을 쓰거나 전파를 NOT_SUPPORTED 로 덮는다)");
        }
    }

    /**
     * {@code WAIT} — 락과 본체가 <b>한 트랜잭션</b>이다(31 §4).
     *
     * <p>해제도 <b>같은 트랜잭션</b>이다 — 별도 트랜잭션으로 지우면 그 원자성이 깨져 즉시실패
     * 정책과 같은 노출 창이 생긴다. <b>{@code finally} 가 아닌 것</b>이 여기서는 옳다: 본체가
     * 던지면 트랜잭션이 롤백되고 <b>INSERT 자체가 사라지므로</b> 지울 것이 없다.
     */
    private Object waiting(ProceedingJoinPoint point, CustomLock declaration, String key) {
        Instant expiresAt = clock.instant().plusSeconds(declaration.expirySeconds());
        return transaction.inTransaction(() -> {
            store.acquireInTransaction(declaration.type(), key, expiresAt);
            Object result = proceed(point);
            store.releaseInTransaction(declaration.type(), key);
            return result;
        });
    }

    /**
     * 즉시실패 셋 — 선점과 해제가 각각 <b>별도 오토커밋</b>이다(31 §3).
     *
     * <p><b>해제는 반드시 {@code finally} 다.</b> 예외 경로에서 락이 남으면
     * {@code expirySeconds} 까지 잠기고, 그 시간 동안 증상은 <i>기능이 통째로 멎은 것</i>으로
     * 보인다.
     */
    private Object immediate(
            ProceedingJoinPoint point, CustomLock declaration, String key, Method method)
            throws Throwable {
        Instant now = clock.instant();
        Instant expiresAt = now.plusSeconds(declaration.expirySeconds());
        Instant releasableAt = declaration.minIntervalSeconds() > 0
                ? now.plusSeconds(declaration.minIntervalSeconds())
                : null;

        if (!store.tryAcquire(declaration.type(), key, expiresAt, releasableAt)) {
            return onConflict(declaration, key, method);
        }
        try {
            return point.proceed();
        } finally {
            store.release(declaration.type(), key);
        }
    }

    /** 잡지 못했을 때 — 셋 다 <b>실행하지 않는다</b>. 다른 것은 그 사실을 알리는 방법뿐이다. */
    private static Object onConflict(CustomLock declaration, String key, Method method) {
        switch (declaration.onConflict()) {
            case EXCEPTION -> throw new BusinessException(
                    LockErrorCode.CONFLICT, "락 선점 실패 — " + declaration.type() + ":" + key);
            case LOG -> log.warn(
                    "락 선점 실패로 건너뛴다 — {}:{} ({}.{})",
                    declaration.type(),
                    key,
                    method.getDeclaringClass().getSimpleName(),
                    method.getName());
            // IGNORE 는 조용히 반환한다. WAIT 는 여기 오지 않는다.
            default -> { }
        }
        return null;
    }

    /**
     * 체크 예외를 트랜잭션 콜백 밖으로 나른다.
     *
     * <p>{@code proceed()} 가 {@link Throwable} 을 던지는데 {@link java.util.function.Supplier}
     * 는 그것을 받지 못한다. <b>{@code sneakyThrow} 로 감싸지 않고 그대로 던진다</b> — 감싸면
     * 업무 예외가 {@code RuntimeException} 한 겹을 더 쓰고 나가, 예외 핸들러가 그 안을 열어
     * 봐야 한다.
     */
    @SuppressWarnings("unchecked")
    private static <E extends Throwable> Object proceed(ProceedingJoinPoint point) throws E {
        try {
            return point.proceed();
        } catch (Throwable e) {
            throw (E) e;
        }
    }
}
