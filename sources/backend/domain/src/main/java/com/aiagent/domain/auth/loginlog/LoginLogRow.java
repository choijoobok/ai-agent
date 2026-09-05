package com.aiagent.domain.auth.loginlog;

import com.aiagent.domain.auth.LoginResultCode;
import java.time.Instant;

/**
 * 로그인 이력 한 행 — screen/log/login/requirements.md. <b>목록이 곧 전부다.</b>
 *
 * <p>짝이 되는 {@code LoginLogDetail} 이 없다. 이 테이블에는 {@code nclob} 컬럼이 하나도
 * 없으므로(sys/logs.md) 실을 수 없는 값이 없고, 그래서 {@code getDetail} 이 아예 없다 — 사용
 * 이력에서 전문 하나 때문에 두 번째 호출이 생겼던 것과 <b>정반대의 경우</b>다(screen/log/login/requirements.md).
 *
 * @param userId <b>시도한 ID</b> 다 — {@code SYS_USER} 에 없는 계정의 기록이 여기 있으며
 * (sys/logs.md) 그것이 이 화면의 두 번째 용도다(screen/log/access/requirements.md)
 * @param userNm 사용자명 — <b>{@code SYS_USER} 를 {@code leftJoin} 해서 얻는다</b>
 *     (2026-09-01). 없는 계정의 시도에서는 {@code null} 이고 <b>그것이 흔한 일이다</b>:
 * screen/log/login/requirements.md 가 그 빈칸을 이유로 이름을 붙이지 않았으나, 빈칸이 문제였으므로 화면이 그
 *     자리에 <b>{@code 없는 계정} 배지</b>를 그린다(결과 컬럼의 {@code FAIL_NO_USER} 와 같은
 *     공통코드 행에서 온다). 지워진 계정의 예전 로그인도 같은 {@code null} 이다
 * @param userAgent 500자에서 잘린 채 저장된다(sys/logs.md). <b>{@code …} 를 붙이지 않는다</b> —
 * 값에 없는 문자를 화면이 만들면 엑셀과 다른 것이 나간다(frontend/grid.md)
 */
public record LoginLogRow(
        Long loginLogSeq,
        Instant creDtm,
        String userId,
        String userNm,
        LoginResultCode loginRsltCd,
        String clientIp,
        String userAgent,
        String traceId) {}
