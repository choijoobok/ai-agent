package com.aiagent.support.lock;

/**
 * 락을 못 잡았을 때 무엇을 하는가 — backend/persistence.md.
 *
 * <p><b>넷의 성격이 둘로 갈린다.</b> 앞의 셋은 <i>실행하지 않는다</i> 이고 {@link #WAIT} 만
 * <i>기다렸다 실행한다</i> 인데, 그 차이가 락 트랜잭션의 구조까지 바꾼다(backend/persistence.md).
 *
 * <table>
 *   <tr><th></th><th>락 INSERT·DELETE</th><th>커밋 전 노출 창</th></tr>
 *   <tr><td>즉시실패 셋</td><td><b>별도 오토커밋</b> 트랜잭션</td><td>flush+commit 구간이 남는다</td></tr>
 *   <tr><td>{@link #WAIT}</td><td>업무와 <b>같은 트랜잭션</b></td><td><b>0</b> — 해제가 곧 커밋</td></tr>
 * </table>
 *
 * <p>그래서 {@code WAIT} 는 비관적 락과 같은 성질을 갖는다(backend/persistence.md) — <b>구조 불변식이 여러
 * 행에 걸치는</b> 자리에서 {@code WAIT} 가 필수인 이유이며, 메뉴 트리의 순환 금지가 그
 * 실례다(sys/menu.md).
 */
public enum LockConflict {

    /** 실행하지 않고 조용히 반환한다. <b>기본값</b>이다. */
    IGNORE,

    /** {@link LockErrorCode#CONFLICT} 로 던진다 — 사람이 누른 버튼이 실패를 알아야 할 때. */
    EXCEPTION,

    /**
     * 락이 풀릴 때까지 <b>DB 블로킹</b>으로 기다렸다가 실행한다.
     *
     * <p><b>폴링이 아니다</b>(backend/persistence.md). 락 INSERT 와 본체가 한 트랜잭션이므로 같은 PK 를
     * INSERT 하려는 다른 트랜잭션이 <b>행 잠금으로 대기</b>한다 — 대신 <b>대기 중 커넥션을
     * 점유</b>하므로 동시성 상한이 필요하다.
     *
     * <p><b>쿨다운과 상호 배타</b>다(backend/persistence.md). <i>"락이 풀리면 실행"</i> 이 전제인데 쿨다운은
     * 락을 유지하는 것이라 둘이 양립하지 않는다 — 함께 선언하면 <b>기동이 실패한다</b>.
     */
    WAIT,

    /** 실행하지 않고 경고 로그만 남긴다 — 배치처럼 <i>다음 주기에 또 온다</i> 가 참인 자리. */
    LOG
}
