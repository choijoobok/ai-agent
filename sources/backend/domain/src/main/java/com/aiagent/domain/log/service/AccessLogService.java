package com.aiagent.domain.log.service;

import com.aiagent.domain.log.entity.SysAccessLog;
import com.aiagent.domain.log.repository.SysAccessLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사용 이력 한 행을 쓴다 — backend/packages.md · LOG-01.
 *
 * <p><b>{@code REQUIRES_NEW} 다.</b> 본 트랜잭션이 롤백되어도 <i>그 요청이 일어났다</i> 는
 * 사실은 남아야 한다 — 실패한 시도가 빠지면 sys/logs.md 이 감사 이력을 이 로깅으로 대체한
 * 전제가 깨진다(screen/admin/system/log/access/requirements.md).
 *
 * <p><b>실패를 여기서 삼키지 않는다.</b> {@code try/catch} 를 이 메서드 안에 두면 잡고 나서도
 * <b>프록시가 커밋하며 {@code UnexpectedRollbackException} 을 던진다</b> — 트랜잭션이 이미
 * rollback-only 로 표시돼 있기 때문이다. 삼키는 자리는 <b>경계 밖</b>, 즉 부르는
 * {@code UserActionLogInterceptor} 다(backend/packages.md 의 <i>"warn 만 남기고 삼킴"</i>).
 *
 * <p>부르는 자리는 그 인터셉터 하나다.
 */
@Service
public class AccessLogService {

    private final SysAccessLogRepository repository;

    public AccessLogService(SysAccessLogRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(SysAccessLog entry) {
        repository.save(entry);
    }
}
