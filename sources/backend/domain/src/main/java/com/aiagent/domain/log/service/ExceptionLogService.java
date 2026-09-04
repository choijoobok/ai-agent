package com.aiagent.domain.log.service;

import com.aiagent.domain.log.entity.SysExceptionLog;
import com.aiagent.domain.log.repository.SysExceptionLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 에러 로그 한 행을 쓴다 — architecture.md §6-1.2 · LOG-03.
 *
 * <p><b>{@code REQUIRES_NEW} 가 여기서는 더 절실하다.</b> {@link AccessLogService} 는
 * <i>롤백돼도 그 요청이 일어났다는 사실은 남아야 한다</i> 였지만, 여기는 <b>부르는 시점이
 * 언제나 예외 처리 중</b>이다 — 본 트랜잭션은 이미 rollback-only 이며, 같은 트랜잭션에
 * 얹으면 <b>예외가 난 요청의 기록만 골라서 사라진다</b>. 남길 이유가 가장 큰 행이 정확히
 * 그 이유로 사라지는 것이다.
 *
 * <p><b>실패를 여기서 삼키지 않는다.</b> {@code try/catch} 를 이 메서드 안에 두면 잡고 나서도
 * 프록시가 커밋하며 {@code UnexpectedRollbackException} 을 던진다 — 삼키는 자리는
 * <b>경계 밖</b>, 즉 부르는 {@code ExceptionLogRecorder} 다({@link AccessLogService} 와 같다).
 *
 * <p>부르는 자리는 그 기록기 하나이고, 기록기를 부르는 자리는 {@code GlobalExceptionHandler}
 * 하나다 — <b>예외가 봉투가 되는 자리가 한 곳</b>이므로 적재도 한 곳이다.
 */
@Service
public class ExceptionLogService {

    private final SysExceptionLogRepository repository;

    public ExceptionLogService(SysExceptionLogRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(SysExceptionLog entry) {
        repository.save(entry);
    }
}
