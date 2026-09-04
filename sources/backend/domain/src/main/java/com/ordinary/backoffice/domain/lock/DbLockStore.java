package com.ordinary.backoffice.domain.lock;

import com.ordinary.backoffice.domain.lock.entity.SysDataLock;
import com.ordinary.backoffice.domain.lock.repository.SysDataLockRepository;
import com.ordinary.backoffice.support.lock.LockStore;
import com.ordinary.backoffice.support.lock.NodeId;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Instant;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.AuditorAware;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code SYS_DATA_LOCK} 을 저장소로 쓰는 기본 구현 — 31 §3.
 *
 * <p><b>Redis 를 쓰지 않는 배포에서도 동작해야 하므로 DB 가 기본이다.</b> Redis 구현을
 * 템플릿에 넣을지는 31 §12 의 미결이며(Phase 8), 그때 이 클래스를 고치는 것이 아니라
 * {@link LockStore} 의 다른 구현이 온다.
 *
 * <h2>{@code flush()} 를 부르는 것이 이 클래스의 핵심이다</h2>
 *
 * JPA 는 커밋 시점에 flush 하므로, 그냥 {@code save} 만 하면 <b>PK 충돌이 커밋 때 터진다</b> —
 * 그때는 이미 업무 로직이 다 돌아간 뒤이고, 즉시실패 정책에서는 <i>실행하지 않는다</i> 는
 * 약속이 깨진다. 선점 판정은 <b>지금</b> 나야 한다.
 *
 * <h2>전파가 메서드마다 다르다</h2>
 *
 * <table>
 *   <tr><td>{@link #tryAcquire} · {@link #release}</td>
 *       <td>{@code REQUIRES_NEW} — 업무 롤백이 선점·해제를 되돌리면 안 된다(31 §3)</td></tr>
 *   <tr><td>{@link #acquireInTransaction} · {@link #releaseInTransaction}</td>
 *       <td>{@code MANDATORY} — <b>없으면 터진다.</b> {@code WAIT} 의 원자성은 부르는 쪽의
 *           트랜잭션에 참여하는 것으로만 성립하므로, 없을 때 조용히 새로 여는 것은
 *           <b>보호가 없는데 있는 것처럼 도는 것</b>이다</td></tr>
 * </table>
 *
 * <h2>설정이 없으면 이것이다</h2>
 *
 * <p>{@code app.lock.store} 가 비어 있으면 이 빈이 뜬다({@code matchIfMissing}) — Redis 를
 * 쓰지 않는 배포에서도 <b>락은 반드시 동작해야</b> 하므로 DB 가 기본이다. 값을 코드가 아는
 * 것은 <b>기본값이 문서에만 있으면 갈리기</b> 때문이다.
 *
 * <p><b>아직 없는 값을 적으면 기동이 죽는다.</b> {@code redis} 는 31 §12 의 미결이라 구현이
 * 없고, 그러면 {@link LockStore} 를 받는 락 애스펙트가 실패한다 — Boot 의 실패 분석기가
 * <i>이 조건 때문에 빠졌다</i> 를 프로퍼티 이름과 함께 찍는다. <b>조용히 DB 로 떨어지는
 * 쪽이 더 나쁘다</b>: 그때는 락이 <i>걸리기는 하므로</i> 아무 증상이 없고, 배포는 Redis 를
 * 쓰는 줄 안 채로 돈다.
 */
@Component
@ConditionalOnProperty(name = "app.lock.store", havingValue = "db", matchIfMissing = true)
public class DbLockStore implements LockStore {

    private final SysDataLockRepository locks;
    private final EntityManager entityManager;
    private final NodeId nodeId;
    private final AuditorAware<String> auditor;
    private final Clock clock;

    public DbLockStore(
            SysDataLockRepository locks,
            EntityManager entityManager,
            NodeId nodeId,
            AuditorAware<String> auditor,
            Clock clock) {
        this.locks = locks;
        this.entityManager = entityManager;
        this.nodeId = nodeId;
        this.auditor = auditor;
        this.clock = clock;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean tryAcquire(String type, String key, Instant expiresAt, Instant releasableAt) {
        Instant now = clock.instant();
        locks.deleteExpired(type, key, now);
        try {
            insert(type, key, expiresAt, releasableAt, now);
            return true;
        } catch (DataIntegrityViolationException e) {
            /*
              남이 잡고 있다 — 만료 전이거나 쿨다운 중이다. 둘을 여기서 가르지 않는 것은
              <b>부르는 쪽이 할 일이 같기 때문</b>이다(실행하지 않는다). 가르려면 행을 다시
              읽어야 하고, 그 읽기는 판정에 아무것도 더하지 않는다.
            */
            return false;
        }
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void release(String type, String key) {
        // 쿨다운이 남았으면 만료를 그 시각으로 낮춰 <b>행을 남긴다</b> — 31 §5.
        if (locks.holdForCooldown(type, key, clock.instant()) == 0) {
            locks.deleteLock(type, key);
        }
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void acquireInTransaction(String type, String key, Instant expiresAt) {
        Instant now = clock.instant();
        /*
          회수를 먼저 한다. 만료된 행이 남아 있으면 INSERT 가 <b>대기하지 않고 즉시 실패</b>
          하는데, `WAIT` 에서 그것은 <i>기다리기로 한 호출이 예외로 끝나는 것</i>이다.

          정상 경로에서는 지울 것이 없다 — `WAIT` 는 커밋 전에 자기 행을 지우므로 프로세스가
          죽어 롤백된 경우조차 행이 남지 않는다. 남는 것은 즉시실패 정책이 같은 키를 쓰다
          누수시킨 경우뿐이며, 그 하나 때문에 이 줄이 있다.
        */
        locks.deleteExpired(type, key, now);
        // 쿨다운은 여기 없다 — WAIT 와 상호 배타이며 기동 시점에 거부한다(31 §6).
        insert(type, key, expiresAt, null, now);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void releaseInTransaction(String type, String key) {
        locks.deleteLock(type, key);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void forceRelease(String type, String key) {
        /*
          조건 없는 DELETE 다 — 쿨다운을 우회하는 것이 목적이므로 RELEASE_DTM 을 보면
          아무 일도 하지 않는다. 실행 중인 락까지 지울 수 있고, 그것을 막는 것은
          부르는 쪽의 책임이다(LockStore#forceRelease).

          별도 트랜잭션인 것은 tryAcquire·release 와 같은 이유다 — 뒤따르는 업무가
          롤백돼도 이 해제는 되돌아가지 않는다. 되돌아가면 우회한 줄 알고 시작한 실행이
          다음 순간 락에 막힌다.
        */
        locks.deleteLock(type, key);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean heartbeat(String type, String key, Instant expiresAt) {
        /*
          별도 트랜잭션인 것이 여기서는 <b>필수</b>다. 하트비트를 부르는 자리는 오래 도는
          작업의 한가운데이며, 그 작업의 트랜잭션에 참여하면 갱신이 <b>작업이 끝날 때까지
          커밋되지 않는다</b> — 즉 밀어야 할 그 기간 동안 아무것도 밀리지 않는다.
        */
        return locks.heartbeat(type, key, nodeId.value(), expiresAt) > 0;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public boolean isHeldBy(String type, String key, String owner) {
        return locks.existsLive(type, key, owner, clock.instant());
    }

    /**
     * <b>{@code flush} 가 선점 판정이다.</b>
     *
     * <p>{@code saveAndFlush} 를 쓰지 않는 것은 {@code deleteExpired} 의 벌크 DELETE 와 순서를
     * 맞춰야 하기 때문이다 — 벌크 연산은 영속성 컨텍스트를 지나지 않으므로, 여기서
     * {@code flush} 를 명시해 <b>DELETE 다음 INSERT</b> 라는 순서를 SQL 수준에서 고정한다.
     */
    private void insert(
            String type, String key, Instant expiresAt, Instant releasableAt, Instant now) {
        locks.save(new SysDataLock(
                type,
                key,
                expiresAt,
                releasableAt,
                nodeId.value(),
                // 진단용이라 없어도 된다 — 배치·부팅 경로에는 주체가 없다(46 §2.2).
                auditor.getCurrentAuditor().orElse(null),
                now));
        entityManager.flush();
    }
}
