package com.aiagent.domain.log.admin;

import java.time.Instant;

/**
 * 사용 이력 한 행 — 64 §3.2. <b>{@code PARAMETERS} 가 없다.</b>
 *
 * <p>전문은 컬럼이 아니라 {@code getDetail} 의 결과다(64 §2.4). 100행 × 1MB = 100MB 이고,
 * Oracle LOB 성능이 그 앞에서 먼저 무너진다(db-portability.md §6.1 S-2).
 *
 * <p>그래서 이 레코드가 나르는 것은 <b>{@code hasParameters} 한 칸</b>이다 — 값이 아니라
 * <i>값이 있는가</i> 이며 화면은 그것으로 {@code [보기]} 를 그린다(grid-column-contract.md §5.4).
 *
 * @param userNm 사용자명 — {@code SYS_USER} 를 {@code leftJoin} 해서 얻는다(2026-09-01).
 *     <b>{@code null} 이 두 가지 뜻</b>이다: 미인증 요청이라 {@code userId} 자체가 없거나,
 *     그 계정이 <b>지금 {@code SYS_USER} 에 없다</b>(FK 가 없다 — 45 §2.2). 둘을 가르는 것은
 *     {@code userId} 의 유무이며 그 판단은 화면이 한다
 * @param menuNm 메뉴명 — {@code MENU_CD} 가 아니라 <b>번역된 이름</b>이다(43 §3).
 *     {@code menuCd} 가 {@code null} 이거나 {@code SYS_MENU} 에 없으면 <b>{@code null}</b>
 *     이며, 그 자리에 무엇을 그릴지는 화면이 정한다(64 §3.2.1 의 {@code (메뉴 없음)})
 */
public record AccessLogRow(
        Long accessLogSeq,
        Instant creDtm,
        Short httpStat,
        String userId,
        String userNm,
        String menuCd,
        String menuNm,
        String requestUri,
        boolean hasParameters,
        String clientIp,
        String traceId) {}
