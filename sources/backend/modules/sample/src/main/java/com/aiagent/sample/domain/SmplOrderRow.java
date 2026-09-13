// @feat FEAT-503
package com.aiagent.sample.domain;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * 마스터 목록의 한 행 — playbook/INDEX.md.
 *
 * <p><b>{@code ordId} 가 문자열이다</b>(frontend/packages.md). {@code bigint} 어휘가 뜻을 가지려면 API 가
 * 문자열로 내려야 한다 — 자바스크립트의 수는 2^53 을 넘기면 <b>조용히 정밀도를 잃고</b>,
 * 그 손실은 화면이 아니라 <b>저장 요청</b>에서 다른 행을 가리키는 것으로 드러난다.
 *
 * <p><b>{@code itemCnt} 를 함께 싣는다.</b> 마스터 삭제 게이트가 이 값을 읽는다(frontend/grid.md) —
 * 화면이 체크박스를 열지 말지 정하려면 <b>품목이 있는지</b>를 알아야 하고, 행마다 물으면
 * 목록 한 장에 왕복이 스물이다.
 */
public record SmplOrderRow(
        String ordId,
        String ordNo,
        String ordNm,
        String custId,
        String custNm,
        String ordStatCd,
        @JsonFormat(shape = JsonFormat.Shape.STRING) LocalDate ordDt,
        Instant ordDtm,
        int ordQty,
        BigDecimal unitAmt,
        BigDecimal ordAmt,
        BigDecimal vatAmt,
        BigDecimal dcRt,
        Boolean urgentYn,
        Boolean useYn,
        /** {@code hidden} 이다 — 화면은 그리지 않고 {@code editable} 함수만 읽는다(playbook/INDEX.md). */
        Boolean lockYn,
        String errMsg,
        long itemCnt,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
