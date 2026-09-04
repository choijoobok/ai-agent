package com.aiagent.support.lock;

import java.time.Instant;

/**
 * 락 저장소 — 31 §11. <b>교체 가능성이 실제로 있는 지점이라 인터페이스다</b>(architecture.md §1).
 *
 * <p>기본 구현은 {@code SYS_DATA_LOCK} 의 <b>PK INSERT 성공 여부</b>로 선점을 판정한다
 * (31 §3). Redis 를 쓰지 않는 배포에서도 동작해야 하므로 DB 가 기본이며, Redis 구현을
 * 템플릿에 넣을지는 31 §12 의 미결이다(Phase 8).
 *
 * <h2>선점·해제가 두 벌인 것은 정책이 둘로 갈리기 때문이다</h2>
 *
 * <table>
 *   <tr><th>정책</th><th>쓰는 짝</th><th>트랜잭션</th></tr>
 *   <tr><td>{@code IGNORE}·{@code EXCEPTION}·{@code LOG}</td>
 *       <td>{@link #tryAcquire} → {@link #release}</td>
 *       <td><b>각각 별도 트랜잭션</b> — 업무 롤백이 선점·해제를 되돌리면 안 된다(31 §3)</td></tr>
 *   <tr><td>{@code WAIT}</td>
 *       <td>{@link #acquireInTransaction} → {@link #releaseInTransaction}</td>
 *       <td><b>부르는 쪽의 트랜잭션</b> — 해제가 곧 커밋이라 노출 창이 0 이다(31 §4)</td></tr>
 * </table>
 *
 * <p><b>한 짝으로 합치지 않는 것은 트랜잭션 전파가 정반대이기 때문이다.</b> 합치면 그 분기가
 * 구현 안으로 숨고, 잘못 부른 자리는 <b>락이 걸린 것처럼 보이면서 안 걸린다</b>.
 *
 * <p><b>{@code WAIT} 쪽에도 해제가 있다.</b> <i>커밋이 곧 해제</i> 라는 말이 <i>행이 저절로
 * 사라진다</i> 는 뜻은 아니다 — 지우는 것은 코드가 하고, <b>같은 트랜잭션에서 지운다</b>는
 * 것이 원자성의 내용이다. 빼면 락 행이 영영 남아 그 키가 다시는 잡히지 않는다.
 */
public interface LockStore {

    /**
     * 즉시 선점을 시도한다 — 잡으면 {@code true}.
     *
     * <p><b>만료 락 회수는 조건부 DELETE 다</b>(31 §3) — {@code WHERE EXPIRE_DTM < :now} 로
     * 지운 뒤 다시 INSERT 한다. <i>검사 후 삭제</i> 로 짜면 두 노드가 같은 만료 락을 함께
     * 회수하고 <b>둘 다 선점에 성공</b>한다.
     *
     * <p><b>쿨다운({@code RELEASE_DTM})이 남아 있으면 실패</b>다 — 작업이 이미 끝났어도
     * 그 시각 전에는 잡히지 않는 것이 쿨다운의 정의다(31 §5).
     *
     * @param expiresAt 장애 안전망의 만료 시각
     * @param releasableAt 쿨다운 종료 시각. {@code null} 이면 종료 즉시 해제한다
     */
    boolean tryAcquire(String type, String key, Instant expiresAt, Instant releasableAt);

    /**
     * 해제 — <b>별도 트랜잭션</b>이다(31 §3). 업무 롤백이 락 해제를 되돌리면 안 된다.
     *
     * <p><b>쿨다운이 걸린 락은 지우지 않는다</b> — {@code RELEASE_DTM} 이 미래면 행을 남기고
     * <b>만료를 그 시각으로 낮춘다</b>. 지워 버리면 쿨다운이 아무 일도 하지 않는다.
     *
     * <p>만료를 낮추는 것이 별도 컬럼을 하나 더 보는 것보다 나은 이유는 <b>회수 조건이 하나로
     * 남기</b> 때문이다 — {@link #tryAcquire} 의 조건부 DELETE 가 {@code EXPIRE_DTM} 만 보면
     * 되고, 31 §3 이 적은 그 한 줄이 그대로 유지된다.
     */
    void release(String type, String key);

    /**
     * 락이 풀릴 때까지 <b>DB 블로킹</b>으로 기다렸다가 선점한다 — {@link LockConflict#WAIT}.
     *
     * <p><b>부르는 쪽의 트랜잭션에 참여한다.</b> 같은 PK 를 INSERT 하려는 다른 트랜잭션은
     * 행 잠금으로 대기하다 <b>이 트랜잭션이 커밋·롤백하는 순간</b> 풀린다.
     *
     * <p><b>대기 상한은 DB 의 잠금 대기 타임아웃</b>이다(31 §10 · §12 의 Phase 7 미결) —
     * 여기서 초 단위 인자를 받지 않는 이유이며, 받아 두면 <i>지켜지지 않는 약속</i>이 된다.
     *
     * <p><b>쿨다운 인자가 없다.</b> {@code WAIT} 와 쿨다운은 상호 배타이며(31 §6) 그것을
     * 기동 시점에 거부하므로(<b>{@code LockDeclarationValidator}</b>), 여기 받을 값이 없다 —
     * 받아 두면 <i>선언은 막혔는데 저장소는 지원하는</i> 어긋남이 남는다.
     */
    void acquireInTransaction(String type, String key, Instant expiresAt);

    /**
     * {@code WAIT} 의 해제 — <b>부르는 쪽의 트랜잭션에서</b> 지운다.
     *
     * <p>커밋 전까지 이 DELETE 는 다른 트랜잭션에 보이지 않는다. 대기하던 INSERT 는
     * <b>정확히 커밋 시점에</b> 풀리며, 그래서 <i>해제와 영속성 결정이 원자적</i>이다(31 §4).
     *
     * <p><b>{@link #release} 와 달리 쿨다운을 보지 않는다</b> — 이 경로에는 쿨다운이 없다.
     */
    void releaseInTransaction(String type, String key);

    /**
     * 쿨다운을 <b>강제로 끝낸다</b> — 31 §7 의 <i>"수동 실행은 쿨다운을 우회한다"</i>.
     *
     * <p>{@link #release} 는 쿨다운이 남았으면 <b>행을 남긴다</b>. 그것이 쿨다운의 정의라
     * 그 메서드로는 우회할 수 없고, {@link #tryAcquire} 는 그 행을 만나면 실패한다 —
     * 즉 <b>이 메서드가 없으면 즉시 실행이 쿨다운에 막힌다</b>. 65 §3.7 이 거부 사유를
     * <i>실행 중</i> 하나로 못박고 <i>쿨다운은 일어나지 않는다</i> 고 적은 것을 집행할
     * 수단이 여기다.
     *
     * <p><b>부르는 쪽이 "지금 아무도 안 돌고 있다" 를 먼저 확인해야 한다.</b> 이 메서드는
     * 실행 중인 락과 쿨다운만 남은 락을 <b>가리지 않는다</b> — 가리려면 저장소가 업무의
     * 진행 상태를 알아야 하고, 그것은 락이 아는 것이 아니다(architecture.md §1). 배치의 경우 그
     * 확인은 {@code SYS_BATCH_HISTORY} 의 {@code RUNNING} 행이 한다.
     *
     * <p><b>{@code @CustomLock} 에는 이 경로가 없다.</b> 선언으로 쓰는 락에 <i>강제 해제</i>
     * 를 열면 애스펙트가 무엇을 우회하는지 선언에서 읽히지 않는다 — 우회는 <b>부르는
     * 코드가 이유를 아는 자리</b>에서만 뜻이 있다.
     */
    void forceRelease(String type, String key);

    /**
     * 만료를 <b>앞으로 민다</b> — 31 §5.1. 오래 도는 작업이 <i>자기 락을 잃는 것</i>을 막는다.
     *
     * <p>{@code EXPIRE_DTM} 은 <b>프로세스가 죽었을 때</b> 락을 회수하려고 둔 안전망이다
     * (31 §5). 그런데 그 시각은 <b>선점할 때 한 번</b> 정해지므로, 작업이 그보다 오래 걸리면
     * 안전망이 <b>살아 있는 작업의 락을 회수</b>한다 — 다음 노드가 선점에 성공하고
     * <b>같은 작업이 둘</b> 돈다. 그것이 락으로 막으려던 바로 그 사고다.
     *
     * <p>기간을 넉넉히 잡는 것으로는 풀리지 않는다. 넉넉하면 <b>진짜로 죽었을 때</b> 그만큼
     * 오래 막히고, 짧게 잡으면 위의 사고가 난다 — <b>둘 다 만족시키는 상수는 없다</b>.
     * 살아 있는 동안 주기적으로 미는 것이 유일한 답이며, 그때 {@code EXPIRE_DTM} 의 뜻이
     * <i>이만큼 걸릴 것이다</i> 에서 <b>이만큼 소식이 없으면 죽은 것이다</b> 로 바뀐다.
     *
     * <p><b>자기 락만 민다.</b> {@code NODE_ID} 가 일치할 때만 갱신하므로, 이미 회수돼
     * 남이 잡은 락을 <b>되살리지 못한다</b> — 되살리면 두 노드가 같은 락을 자기 것으로
     * 믿는 최악이 된다.
     *
     * @return 아직 이 노드가 쥐고 있었는가. {@code false} 면 <b>이미 뺏겼다</b>
     */
    boolean heartbeat(String type, String key, Instant expiresAt);

    /**
     * 그 노드가 <b>지금도 쥐고 있는가</b> — 유령 판정의 유일한 증거다(65 §4.4).
     *
     * <p>{@link #heartbeat} 가 있어서 이 질문이 뜻을 갖는다. 하트비트가 없으면 살아 있는
     * 노드의 락도 만료되므로 <i>락이 없다</i> 가 <i>노드가 죽었다</i> 를 뜻하지 않는다.
     *
     * <p><b>{@code nodeId} 를 함께 묻는 것이 중요하다.</b> 키만 물으면 <i>그 배치가 지금
     * 다시 돌고 있는 경우</i> 에 옛 실행의 락으로 오인한다 — {@link NodeId} 가 기동마다
     * 달라지므로(재기동한 같은 호스트도 다르다) 그 비교가 <b>프로세스 동일성</b>을 정확히
     * 가른다.
     */
    boolean isHeldBy(String type, String key, String nodeId);
}
