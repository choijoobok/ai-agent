package com.aiagent.domain.log.errorlog;

import java.time.Instant;

/**
 * 에러 로그 한 행 — screen/log/error/requirements.md. <b>{@code ROOT_CAUSE_STACK} 이 없다.</b>
 *
 * <p>스택은 컬럼이 아니라 {@code getDetail} 의 결과다(screen/log/error/requirements.md) — {@code AccessLogRow} 가
 * {@code PARAMETERS} 를 뺀 것과 같은 이유이며, 그 자리에 {@code hasStack} 한 칸이 온다.
 *
 * <p><b>{@code errCd} 와 {@code errMsg} 는 목록에 있다.</b> 그것이 이 테이블의 요점이다 —
 * 셋 다 {@code nclob} 이었다면 <i>"같은 오류가 몇 건인가"</i> 를 물을 수 없었을 것이고,
 * 그래서 sys/logs.md 가 {@code VARCHAR} 로 정했다(screen/log/access/requirements.md).
 *
 * @param httpStat <b>4xx 와 5xx 를 가른다</b> — 403 홍수 속에서 500 을 찾는 유일한 값이다
 * @param userNm 사용자명 — {@code SYS_USER} 를 {@code leftJoin} 해서 얻는다(2026-09-01).
 *     <b>{@code null} 이 두 가지 뜻</b>이다: 미인증 요청이라 {@code userId} 자체가 없거나,
 * 그 계정이 <b>지금 {@code SYS_USER} 에 없다</b>(FK 가 없다 — sys/logs.md). 둘을 가르는 것은
 *     {@code userId} 의 유무이며 그 판단은 화면이 한다
 * @param menuNm 메뉴명 — {@code MENU_CD} 가 아니라 <b>번역된 이름</b>이다(sys/code.md).
 *     {@code AccessLogRow} 와 같은 규칙이며 없으면 {@code null} 이다
 * @param hasStack 스택이 있는가 — <b>값이 아니라 유무다</b>(screen/log/error/requirements.md). {@code false} 는 곧
 * <i>4xx 라 저장하지 않았다</i> 이며(screen/log/error/requirements.md) 모달의 스택 탭이 그것으로 비활성이 된다
 */
public record ErrorLogRow(
        Long exceptionLogSeq,
        Instant creDtm,
        Short httpStat,
        String errCd,
        String errMsg,
        String userId,
        String userNm,
        String menuCd,
        String menuNm,
        String requestUri,
        boolean hasStack,
        String clientIp,
        String traceId) {}
