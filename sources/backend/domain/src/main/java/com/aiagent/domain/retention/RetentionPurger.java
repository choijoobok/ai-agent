package com.aiagent.domain.retention;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 청크 하나를 <b>자기 트랜잭션에서</b> 지운다 — retention.md.
 *
 * <p>{@link RetentionPurgeJob} 에서 떼어 낸 이유가 둘이다.
 *
 * <table><caption></caption>
 *   <tr><td><b>분할 커밋이 성립하려면</b></td>
 *       <td>같은 빈 안에서 부르면 프록시를 지나지 않아 {@code @Transactional} 이
 *           <b>아무 일도 하지 않는다</b> — 90일분이 한 트랜잭션이 되고 그것이 이 절이
 *           막으려던 것이다</td></tr>
 *   <tr><td><b>중단이 먹으려면</b></td>
 *       <td>청크가 커밋돼야 <b>지운 만큼은 남는다</b>. 한 트랜잭션이면 중단이 곧
 *           전부 롤백이고, 다음 실행이 <b>처음부터 다시</b> 한다</td></tr>
 * </table>
 *
 * <p><b>{@code REQUIRES_NEW} 다.</b> 배치 본체는 트랜잭션 밖에서 돌지만
 * ({@code BatchRunner#execute}) 그 계약에 기대지 않는다 — 나중에 누군가 바깥에
 * 트랜잭션을 두면 분할 커밋이 조용히 사라진다.
 */
@Service
public class RetentionPurger {

    /**
     * 한 청크 — <b>지운 행 수</b>를 돌려준다.
     *
     * <p>{@code PageRequest.ofSize} 는 언제나 <b>첫 페이지</b>다. 지우면서 도는 순환이라
     * offset 을 밀면 지운 만큼 건너뛴다 — 여기서 필요한 것은 페이지가 아니라 <b>한도</b>다.
     *
     * @return 지운 행 수. {@code chunkSize} 보다 작으면 <b>그 대상은 끝났다</b>
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int purgeChunk(RetentionTarget target, Instant cutoff, int chunkSize) {
        List<Long> ids = target.findIds().apply(cutoff, PageRequest.ofSize(chunkSize));
        if (ids.isEmpty()) {
            return 0;
        }
        target.deleteByIds().accept(ids);
        return ids.size();
    }
}
