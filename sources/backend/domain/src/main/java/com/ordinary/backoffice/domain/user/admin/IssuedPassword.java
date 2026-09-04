package com.ordinary.backoffice.domain.user.admin;

/**
 * 발급된 임시 비밀번호 하나 — AUTH-07 · 61 §3.4.
 *
 * <p><b>이 응답에만 있는 값이다.</b> DB 에는 해시가 들어가므로 재조회로 다시 얻을 수 없고,
 * 잃으면 <b>다시 발급하는 것 말고 길이 없다</b> — 그래서 실행 API 가 결과를 화면에 준다
 * ({@code ActionApi.onSuccess} 가 있는 이유다).
 *
 * <h2>화면에 보여주는 것이 결정이다</h2>
 *
 * <p>61 §6 이 <i>"메일 발송이 없는 배포에서 화면에 표시할지"</i> 를 미결로 남겼다.
 * <b>표시한다</b>(2026-08-30) — 43 §6.3 이 {@code admin-reset-enabled} 의 기본값을 켜 두며
 * 적은 근거가 <i>"메일 연동이 없는 배포에서 잠긴 계정을 푸는 <b>유일한 경로</b>"</i> 인데,
 * 전달 수단이 없으면 그 경로는 <b>있으나 마나</b>다. 발급하고 알려 주지 않는 것은 계정을
 * 잠그는 것과 같다.
 *
 * <p><b>대신 값의 수명을 짧게 묶는다.</b> {@code PWD_INIT_YN='Y'} 라 다음 로그인이 곧바로
 * 강제 변경으로 가고, {@code tempValidHours} 가 지나면 로그인 자체가 막힌다(security-design.md §4).
 * <i>"관리자가 아는 비밀번호가 생긴다"</i> 는 우려(61 §3.2)는 <b>사실이며 받아들인다</b> —
 * 그것이 아는 즉시 쓸모없어지는 값이라는 것이 방어다.
 *
 * <p><b>알림(NOTI)이 서면 뒤집는다.</b> 그때는 메일이 전달을 맡으므로 화면이 값을 볼 이유가
 * 없어지고, 이 레코드에서 {@link #password} 가 빠진다.
 *
 * @param userNm 함께 내리는 이유는 <b>여러 건을 한 번에</b> 발급할 수 있기 때문이다 — 모달이
 *     <i>누구의 것인지</i> 를 말하지 못하면 관리자가 값을 잘못 전한다
 */
public record IssuedPassword(String userId, String userNm, String password) {}
