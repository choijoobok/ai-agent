package com.aiagent.domain.authz.menu;

import com.aiagent.support.lock.CustomLock;
import com.aiagent.support.lock.LockConflict;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;

/**
 * 트리 저장의 락 경계 — backend/persistence.md 의 <b>전용 락 트리거 빈</b> 패턴.
 *
 * <p><b>트랜잭션 애너테이션이 없는 빈이다.</b> 그것이 이 클래스가 존재하는 이유 전부이며,
 * backend/persistence.md 의 4중 방어 중 <b>첫째이자 유일하게 구조적인 것</b>이다 — 락 구간에 트랜잭션이 걸쳐
 * 있지 않으면 AOP 순서 문제가 <b>저절로 사라진다</b>.
 *
 * <p><b>{@code MenuService} 안에 두지 않는 이유가 하나 더 있다.</b> 같은 빈 안에서
 * {@code this.withLock(...)} 으로 부르면 프록시를 지나지 않아 <b>락이 아예 걸리지 않는다</b> —
 * 예외도 나지 않고, 결과는 조용한 데이터 손상이다. 다른 빈이면 <b>언제나 프록시를 지난다</b>.
 *
 * <h2>왜 트리 저장에 락이 필요한가 — 행 락으로는 안 된다</h2>
 *
 * <pre>
 * A: X 를 Y 아래로   → 잠그는 것: P1, Y
 * B: Y 를 X 아래로   → 잠그는 것: P2, X     겹치지 않는다 → 둘 다 커밋 → X→Y→X
 * </pre>
 *
 * <p>두 이동이 서로의 조상을 옮기면 <b>각자의 검사는 통과하고 합쳐진 결과만 순환</b>이다 —
 * write-skew 이며 <b>단일 노드에서도 발생한다</b>(격리 수준 문제이지 다중화 문제가 아니다).
 * 불변식이 트리 <b>전체</b>에 걸리므로 잠글 행이 없고, backend/persistence.md 의 선택 표에서 {@code @CustomLock}
 * 에 해당한다.
 *
 * <h2>{@code WAIT} 가 필수다 — 즉시실패로는 안 된다</h2>
 *
 * {@code EXCEPTION}·{@code IGNORE} 는 락 INSERT/DELETE 가 <b>별도 오토커밋</b>이라 flush+commit
 * 노출 창이 남는다(backend/persistence.md). 그 창에서 두 번째 이동이 <b>커밋 전 상태를 읽고 순환 검사를
 * 통과</b>하면 락을 걸어 막으려던 바로 그 버그가 되살아난다.
 *
 * <p><b>{@code key} 를 생략한다.</b> 기본값이 {@code 클래스명.메서드명} 이고(backend/persistence.md) 그것이 곧
 * <b>트리 전역 키</b>다 — 잠글 대상이 트리 전체이므로 키가 그 하나여야 한다. 위치 연산을
 * 메서드 하나로 모으는 이유도 같다(sys/menu.md): 이동·생성·순서가 다른 메서드면 키가 갈려
 * <b>상호 배제가 되지 않는다</b>.
 *
 * <p><b>{@code expirySeconds} 도 사실상 무의미하다</b>(sys/menu.md) — 락 행이 업무 트랜잭션에
 * 속하므로 노드가 죽으면 롤백으로 함께 사라진다. 기본값을 그대로 둔다.
 */
@Component
public class MenuTreeLockTrigger {

    /**
     * 트리를 바꾸는 모든 연산이 이 하나를 지난다.
     *
     * <p><b>{@link Supplier} 를 받는 것이 계약이다.</b> 안쪽이 자기 트랜잭션을 여는 것이
     * 아니라 <b>이 락의 트랜잭션에 참여</b>해야 하는데({@code WAIT} 의 정의), 그것을 강제하는
     * 것은 애스펙트이지 이 시그니처가 아니다 — 여기서는 <b>경계를 하나로 모으는 것</b>까지가
     * 할 일이다.
     */
    @CustomLock(type = "MENU_TREE", onConflict = LockConflict.WAIT)
    public <T> T withLock(Supplier<T> work) {
        return work.get();
    }
}
