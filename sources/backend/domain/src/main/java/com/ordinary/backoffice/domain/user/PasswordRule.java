package com.ordinary.backoffice.domain.user;

/**
 * 비밀번호 정책 중 <b>사람에게 보여줄 것</b> — 43 §6.3 의 부분집합.
 *
 * <p><b>규칙을 말하지 않고 거절하면 사용자는 맞출 수 없다.</b> 최소 길이와 문자 종류 수를
 * 모른 채 세 번 거절당하면 그 사람은 관리자에게 전화한다. 그래서 프로필을 읽을 때 함께
 * 내려간다 — 별도 왕복을 두면 <b>모달을 여는 데 호출이 둘</b>이 된다.
 *
 * <p><b>{@code tempValidHours} 나 {@code adminResetEnabled} 는 여기 없다.</b> 본인이 지킬
 * 규칙이 아니라 <b>운영의 것</b>이며, 내려보내면 그 값으로 무엇을 할 수 있는지 알려주는
 * 것뿐이다(security-design.md §4).
 *
 * @param expireDays 0 이면 주기 만료를 쓰지 않는다
 * @param reuseBlockCount 0 이면 재사용을 막지 않는다
 */
public record PasswordRule(
        int minLength, int requireCharsetKinds, int reuseBlockCount, int expireDays) {}
