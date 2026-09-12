// @feat FEAT-501
package com.aiagent.system.api.user;

import java.time.Instant;

/**
 * 활성 세션 하나 — AUTH-10 · screen/admin/system/user/requirements.md.
 *
 * <p><b>컬럼이 여섯이다</b> — 세션 ID(앞 8자) · 생성 시각 · 최근 접근 · 만료 예정 ·
 * 접속 IP · 브라우저.
 *
 * <h2>IP 와 User-Agent 는 <b>이력에서 온다</b> — 2026-08-31</h2>
 *
 * <p>2026-08-30 에는 두지 않기로 했다. 근거가 <i>"담으면 같은 사실이 두 곳이 되고, 세션은
 * 만료와 함께 사라지므로 짧은 쪽이 원본 행세를 한다"</i> 였는데 — <b>담지 않으면 그 문제가
 * 없다.</b> 원본은 여전히 {@code SYS_LO_LOGIN} 하나이고(sys/logs.md) 이 응답은 조회 시점에
 * <b>그 세션이 만들어진 무렵의 로그인</b>을 찾아 붙인다. 그래서 이력을 파기하면(retention.md)
 * 이 칸이 빈다 — 그것이 두 곳이 아니라는 증거다.
 *
 * <p><b>그리고 이 탭이 답하는 질문에 실제로 필요했다.</b> 여기서 하는 일이 <i>끊을까
 * 말까</i> 인 것은 그대로인데, 세션 ID 앞 8자와 시각 셋만으로는 <b>어느 것이 남의
 * 것인지</b> 를 가릴 수 없다 — <i>"모르는 곳에서 들어온 세션을 끊는다"</i> 가 이 버튼의
 * 첫 용도다. {@link #lastAccessedDtm} 은 <i>얼마나 오래</i> 를 말하고 이 둘은
 * <i>어디서</i> 를 말한다.
 *
 * <p><b>헤더가 출처를 밝힌다</b>(screen/log/access/requirements.md 과 같은 규약) — 화면이 <i>마지막 로그인
 * 이력에서</i> 라고 적는다. 그러지 않으면 <b>빈 칸이 결함으로</b> 읽히고 채워진 칸은
 * 세션이 들고 있는 사실처럼 읽힌다.
 *
 * @param sessionId <b>전체</b>가 실린다. 화면이 앞 8자만 그리지만 끊을 때는 온전한 값이
 *     필요하고, 앞 8자만 보내면 <b>서버가 접두로 찾아야</b> 한다 — 그것은 겹칠 수 있는 키다
 * @param current 이 요청을 보낸 바로 그 세션인가. 화면이 <i>(현재 세션)</i> 을 붙이고 screen/admin/system/user/requirements.md
 *     의 <b>자기 자신 금지</b>를 눈으로 확인시킨다 — 버튼이 왜 비활성인지 말하는 것이 이 값이다
 * @param expiryDtm 만료 예정 = 최근 접근 + 유휴 한도. <b>파생</b>이며 스토어가 갖고 있는
 *     값이 아니다 — 컬럼으로 두면 접근할 때마다 갱신해야 하고, 그러면 여기서 계산하는 것과
 *     같은 값을 저장만 한 번 더 하는 셈이다
 * @param clientIp 짝지은 로그인의 IP. <b>못 찾으면 {@code null}</b> 이며 그것이 정직하다 —
 *     다른 로그인의 값을 끌어다 채우면 <i>어디서 들어왔나</i> 에 <b>틀린 답</b>을 한다
 * @param userAgent 〃 브라우저. {@code VARCHAR(500)} 이라 화면이 툴팁으로 펼친다
 */
public record UserSessionRow(
        String sessionId,
        Boolean current,
        Instant createdDtm,
        Instant lastAccessedDtm,
        Instant expiryDtm,
        String clientIp,
        String userAgent) {}
