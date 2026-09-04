package com.aiagent.domain.auth;

import java.time.Instant;

/**
 * 내 로그인 이력 한 줄 — LOG-02 · frontend/tabs.md.
 *
 * <p><b>관리자 화면의 축소판이 아니다.</b> 본인 것만 보여주며, 그래서 {@code USER_ID} 가
 * 없다 — 전부 자기 것이라 컬럼 하나가 같은 값으로 채워진다.
 *
 * <p><b>실패 기록을 뺀 목록은 이 기능의 목적을 잃는다.</b> 누군가 내 계정으로 시도했다는
 * 사실이 그 자체로 신호이며, 본인이 모르는 접속을 발견하는 유일한 경로다(frontend/tabs.md).
 *
 * <p>{@code TRACE_ID} 는 내려가지 않는다 — 운영 문의의 식별자이지 사용자가 읽을 것이 아니다.
 */
public record MyLoginRecord(
        Instant creDtm, LoginResultCode loginRsltCd, String clientIp, String userAgent) {}
