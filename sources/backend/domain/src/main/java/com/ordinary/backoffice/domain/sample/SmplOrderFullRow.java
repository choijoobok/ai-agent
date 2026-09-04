package com.ordinary.backoffice.domain.sample;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * {@code SMPL_SINGLE_OFFSET} 의 한 행 — 68 §3.2. <b>컬럼 서른을 그대로 낸다.</b>
 *
 * <h2>{@link SmplOrderRow} 와 왜 갈리나</h2>
 *
 * <p>③은 아홉 컬럼을 그리고 이 화면은 서른을 그린다(68 §5.2 · §3.2). 한 행 타입으로 합치면
 * 둘 중 하나가 손해를 본다 —
 *
 * <ul>
 *   <li><b>③에 서른을 실으면</b> {@code MEMO}·{@code RMK} 같은 {@code nclob} 셋과 태그
 *       조인이 <b>그리지도 않는 컬럼 때문에</b> 페이지마다 왕복한다
 *   <li><b>①에 아홉만 실으면</b> 서른 중 스물하나가 빈 칸이 되어 <i>어휘의 본진</i> 이라는
 *       이 화면의 역할이 성립하지 않는다
 * </ul>
 *
 * <p><b>68 §4.2 가 같은 갈림을 이미 적었다</b> — <i>"모드는 엔드포인트가 정한다"</i>. 투영도
 * 같다: 무엇을 실을지는 테이블이 아니라 <b>부르는 화면</b>이 정한다.
 *
 * <p><b>{@code ordId} 와 {@code procMs} 가 문자열이 아니다.</b> 앞은 문자열이고(frontend-stack.md §6.1의
 * {@code bigint}) 뒤는 숫자다 — {@code procMs} 는 {@code renderer:'duration'} 이 읽는
 * <b>밀리초 그대로</b>이며(grid-column-contract.md §5.4) 2^53 근처에 갈 수 없다. 규칙은 <i>{@code bigint} 는
 * 문자열</i> 이 아니라 <b>정밀도를 잃을 수 있으면 문자열</b>이다.
 */
public record SmplOrderFullRow(
        String ordId,
        String ordNo,
        String ordNm,
        String custId,
        String custNm,
        String custGrdCd,
        String ordStatCd,
        String chnlCd,
        String priorityCd,
        @JsonFormat(shape = JsonFormat.Shape.STRING) LocalDate ordDt,
        /** {@code precision:'month'} 의 DB 형태 — {@code VARCHAR(6)} 이다(48 §4.2). */
        String dlvrYm,
        Instant ordDtm,
        int ordQty,
        BigDecimal unitAmt,
        BigDecimal ordAmt,
        BigDecimal vatAmt,
        BigDecimal dcRt,
        Long procMs,
        Boolean urgentYn,
        Boolean useYn,
        List<SmplOrderTagRow> tagList,
        String memo,
        String rmk,
        String errMsg,
        /** {@code hidden} 이다 — 화면은 그리지 않고 {@code editable} 함수만 근거로 읽는다. */
        Boolean lockYn,
        /** {@code visible:false} 다 — 기본 숨김이며 설정 창에서 사용자가 켠다(grid-column-contract.md §2.1). */
        String srcSysCd,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
