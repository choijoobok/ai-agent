package com.aiagent.domain.sample;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** 디테일 목록의 한 행 — playbook/INDEX.md. */
public record SmplOrderItemRow(
        String ordId,
        Integer itemSeq,
        String ordNo,
        String itemCd,
        String itemNm,
        String uomCd,
        BigDecimal qty,
        BigDecimal unitAmt,
        BigDecimal amt,
        @JsonFormat(shape = JsonFormat.Shape.STRING) LocalDate dlvrDt,
        String itemStatCd,
        Boolean useYn,
        String rmk,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
