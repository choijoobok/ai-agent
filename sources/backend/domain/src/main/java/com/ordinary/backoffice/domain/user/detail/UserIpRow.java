package com.ordinary.backoffice.domain.user.detail;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 탭 3 — <b>이 사람의 접속 허용 대역</b>(AUTH-08 · 41 §7).
 *
 * <p><b>행이 없으면 제한 없음이다.</b> 그것이 이 탭에서 가장 중요한 사실이며, 화면은
 * <b>빈 목록에 그 문구를 낸다</b> — <i>"등록된 대역이 없습니다"</i> 로 끝내면 <b>지금 이
 * 계정이 어디서든 들어올 수 있다</b>는 사실을 아무도 말하지 않는다.
 *
 * <p><b>기간이 있다</b>(2026-08-31). 파견 · 출장처럼 <b>기한이 정해진 접근</b>이 이 목록의
 * 둘째 용도이며, 없으면 그 대역을 사람이 기억해서 지워야 한다 — 잊으면 <b>끝난 계약의 IP 가
 * 열려 있는 상태</b>다. {@code useYn} 은 여전히 <b>지우지 않고 끄는</b> 수단이며 기간과
 * 층이 다르다(42 §3.1 과 같은 AND).
 */
public record UserIpRow(
        String ipCidr,
        Boolean useYn,
        /** <b>양끝 포함</b>이며 {@code null} 이 제한 없음이다(40 §4.3). */
        LocalDate validFromDt,
        LocalDate validToDt,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
