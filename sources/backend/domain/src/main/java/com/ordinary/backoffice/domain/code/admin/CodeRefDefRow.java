package com.ordinary.backoffice.domain.code.admin;

import java.time.Instant;

/**
 * 정의 모달의 한 행 — 63 §2.4. <b>이 행 하나가 하단 그리드의 컬럼 하나다.</b>
 *
 * @param refNm 하단 그리드의 <b>컬럼 헤더</b>가 된다. 메시지 키가 아니라 <b>완성된 문자열</b>
 *     이며 grid-column-contract.md §2 계약의 유일한 예외다(grid-column-contract.md §2.2) — 같은 {@code REF_CD} 를 그룹마다 다르게
 *     부르는 것이 이 값의 존재 이유라 전역 코드명이 대신할 수 없다(43 §5.2)
 * @param valueCount 이 정의로 <b>입력된 값</b> 의 수. 정의를 지울 때 <i>"입력된 참조값 12건이
 *     함께 삭제됩니다"</i> 를 말하는 근거다 — 게이트가 아니라 <b>확인</b>이며, 값 → 정의
 *     순서로 지우면 FK 가 거부하지 않는다(63 §2.5)
 */
public record CodeRefDefRow(
        String refCd,
        String refNm,
        String refDesc,
        long valueCount,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
