package com.aiagent.domain.sample;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * {@code SMPL_SINGLE_CURSOR} 의 한 행 — playbook/INDEX.md. <b>읽기 열둘만 낸다.</b>
 *
 * <p>이 화면은 <b>조회 전용</b>이라(액션 {@code R E}) 편집용 컬럼이 자리를 차지할 이유가
 * 없다. {@link SmplOrderFullRow} 가 서른을 내는 것과 갈리는 자리이며, 여기에 서른을
 * 실으면 <b>대용량 이력의 대리</b>라는 이 화면의 역할이 무너진다 — 한 장에 {@code nclob}
 * 셋과 태그 조인이 딸려 온다.
 *
 * <p><b>같은 테이블에 행 타입이 셋이다</b>({@link SmplOrderRow} · {@link SmplOrderFullRow} ·
 * 이것). playbook/INDEX.md 가 적은 <i>"커서형은 테이블이 아니라 엔드포인트의 성격"</i> 이 투영에도
 * 그대로다 — 무엇을 실을지는 테이블이 아니라 <b>부르는 화면</b>이 정한다.
 *
 * <p><b>{@code ordId} 는 그리지 않는데 싣는다.</b> playbook/INDEX.md 의 열둘에 없지만 그리드가 행을
 * 가리킬 키가 있어야 하고, 커서의 기준점도 이 값이다(backend/api.md 의 튜플 비교) — <b>보이는
 * 것과 필요한 것이 같지 않다</b>.
 */
public record SmplOrderCursorRow(
        String ordId,
        String ordNo,
        String ordNm,
        String custNm,
        String custGrdCd,
        String ordStatCd,
        @JsonFormat(shape = JsonFormat.Shape.STRING) LocalDate ordDt,
        Instant ordDtm,
        int ordQty,
        BigDecimal ordAmt,
        BigDecimal dcRt,
        Long procMs,
        String errMsg) {}
