package com.aiagent.domain.auth.service;

import com.aiagent.domain.auth.LoginResultCode;
import com.aiagent.domain.auth.MyLoginRecord;
import com.aiagent.domain.auth.entity.SysLoginLog;
import com.aiagent.domain.auth.repository.SysLoginLogRepository;
import com.aiagent.support.time.BusinessCalendar;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 로그인 이력 적재 — sys/logs.md.
 *
 * <p><b>{@code REQUIRES_NEW} 인 것이 요건이다.</b> 실패 로그인은 본 트랜잭션이 롤백될 수
 * 있는데(예: 잠금 갱신 중 예외) 그때 이력까지 사라지면 <i>"왜 로그인이 안 되나"</i> 에
 * 답할 근거가 없어진다 — 이력 기록은 본 트랜잭션과 분리한다(backend/packages.md).
 */
@Service
public class LoginHistoryService {

    /**
     * 내 이력 화면이 한 번에 받는 줄 수 — frontend/tabs.md.
     *
     * <p>30 인 것은 <b>한 달 남짓</b>이라는 뜻이다. 모르는 접속을 알아채는 것이 목적이므로
     * 기간이 너무 짧으면 놓치고, 길면 스크롤만 길어진다. 페이징은 두지 않는다 — 더 깊이
     * 봐야 하는 사람은 관리자 화면(LOG-02)의 대상이다.
     */
    public static final int MY_HISTORY_LIMIT = 30;

    private final SysLoginLogRepository repository;
    private final BusinessCalendar calendar;

    public LoginHistoryService(SysLoginLogRepository repository, BusinessCalendar calendar) {
        this.repository = repository;
        this.calendar = calendar;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String userId, LoginResultCode result, LoginContext context) {
        repository.save(SysLoginLog.builder()
                .userId(userId)
                .loginRsltCd(result)
                .clientIp(context.clientIp())
                .userAgent(context.userAgent())
                .traceId(context.traceId())
                .creDtm(calendar.now())
                .build());
    }

    /**
     * 내 로그인 이력 — LOG-02 · frontend/tabs.md. <b>읽기이며 {@code REQUIRES_NEW} 가 아니다</b>.
     *
     * <p><b>건수를 설정으로 두지 않았다.</b> sys/code.md 의 값들은 <i>운영이 바꿀 이유가 있는
     * 것</i>이고 이것은 화면이 한 번에 보여 줄 줄 수다 — 키를 하나 늘리면 yml·프로퍼티
     * 레코드·문서·{@code SYS_CONFIG} 가 함께 늘고, 그것을 바꿔야 할 상황이 떠오르지 않는다.
     * 필요해지면 그때 옮긴다.
     */
    @Transactional(readOnly = true)
    public List<MyLoginRecord> findMine(String userId) {
        return repository.findByUserIdOrderByCreDtmDesc(userId, Limit.of(MY_HISTORY_LIMIT)).stream()
                .map(log -> new MyLoginRecord(
                        log.getCreDtm(),
                        log.getLoginRsltCd(),
                        log.getClientIp(),
                        log.getUserAgent()))
                .toList();
    }

    /**
     * 성공한 로그인 최근 몇 건 — <b>활성 세션 탭이 어디서 들어왔나를 채운다</b>(screen/user/requirements.md).
     *
     * <p>세션 스토어는 IP 도 User-Agent 도 갖고 있지 않고, 담지도 않는다 — 원본은 이 이력
     * 하나다(sys/logs.md). 부르는 쪽이 <b>세션 생성 시각으로 짝짓는다</b>.
     *
     * <p><b>짝짓기를 여기서 하지 않는다.</b> 그것은 세션을 아는 일이고 세션은 {@code api}
     * 의 것이다(backend/packages.md) — 도메인이 {@code FindByIndexNameSessionRepository} 를 알게 되면
     * 그 경계가 갈린다.
     *
     * <p><b>성공만 읽는 것이 요점이다.</b> 실패한 시도는 세션을 만들지 않으므로 짝의 후보가
     * 아니고, 섞어 읽으면 <b>비밀번호를 틀린 시도의 IP</b> 가 살아 있는 세션의 값으로
     * 붙는다 — 잠금 직전까지 실패가 여러 건 쌓이는 것이 흔한 경우다.
     */
    @Transactional(readOnly = true)
    public List<LoginOrigin> findRecentSuccess(String userId, int limit) {
        return repository
                .findByUserIdAndLoginRsltCdOrderByCreDtmDesc(
                        userId, LoginResultCode.SUCCESS, Limit.of(limit))
                .stream()
                .map(log -> new LoginOrigin(log.getCreDtm(), log.getClientIp(), log.getUserAgent()))
                .toList();
    }

    /** 이력이 요구하는 요청 부수 정보. 서블릿 타입을 domain 으로 들이지 않으려고 값으로 받는다. */
    public record LoginContext(String clientIp, String userAgent, String traceId) {}

    /**
     * 성공 로그인 하나의 <b>출처</b> — screen/user/requirements.md.
     *
     * <p>{@link MyLoginRecord} 와 달리 결과 코드가 없다. 성공만 담기므로 그 칸이 <b>언제나
     * 같은 값</b>이 되고, 같은 값을 나르는 칸은 읽는 사람에게 <i>다를 수 있다</i> 고
     * 말한다.
     */
    public record LoginOrigin(Instant at, String clientIp, String userAgent) {}
}
