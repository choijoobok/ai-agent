package com.aiagent.support.lock;

import java.util.function.Supplier;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * {@link LockConflict#WAIT} 가 쓰는 트랜잭션 경계 — 31 §4.
 *
 * <p><b>애스펙트가 {@code @Transactional} 을 붙일 수 없다.</b> 어드바이스 메서드는 스스로
 * 프록시를 지나지 않으므로(자기 호출과 같은 함정) 애너테이션이 아무 일도 하지 않는다 —
 * 그리고 <b>조용히</b> 하지 않는다: 락 INSERT 와 본체가 다른 트랜잭션에 놓여 {@code WAIT} 가
 * 즉시실패 정책과 같은 노출 창을 갖게 된다.
 *
 * <p>그래서 템플릿을 명시적으로 쓴다. <b>{@code PROPAGATION_REQUIRED} 그대로</b>인 것은
 * 애스펙트가 이미 <i>호출 시점에 트랜잭션이 없음</i>을 확인했기 때문이며(31 §4 방어 2),
 * {@code REQUIRES_NEW} 로 쓰면 그 확인이 없어도 도는 것처럼 보여 <b>방어가 약해진다</b>.
 *
 * <p><b>{@code support} 에 트랜잭션이 있는 것이 어색하지 않다</b> — architecture.md §1 이 이 모듈에 준
 * 책임이 <b>락 추상화</b>이고, {@code WAIT} 의 정의 자체가 <i>해제가 곧 커밋</i>이라
 * 트랜잭션 경계를 빼면 그 정의를 표현할 수 없다.
 */
@Component
public class LockTransaction {

    private final TransactionTemplate template;

    public LockTransaction(PlatformTransactionManager transactionManager) {
        this.template = new TransactionTemplate(transactionManager);
    }

    public <T> T inTransaction(Supplier<T> work) {
        return template.execute(status -> work.get());
    }
}
