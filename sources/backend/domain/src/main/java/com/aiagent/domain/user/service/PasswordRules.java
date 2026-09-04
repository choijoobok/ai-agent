package com.aiagent.domain.user.service;

/**
 * 비밀번호가 정책의 <b>형태</b> 요건을 채우는가 — 43 §6.3.
 *
 * <p><b>순수 함수로 떼어 둔 것이 요점이다.</b> 이 판정은 본인 변경(AUTH-05)·관리자 발급
 * (AUTH-06)·분실 재설정(AUTH-07) 세 경로가 모두 써야 하며, 서비스 안에 묻어 두면 <b>세 곳이
 * 각자 조금씩 다른 규칙</b>을 갖게 된다.
 *
 * <p><b>금지 목록·사전 검사·아이디 포함 검사는 없다.</b> 정책({@code AuthPasswordProps})이
 * 가진 축은 길이와 문자 종류 둘뿐이며, 여기에만 있는 규칙을 더하면 <b>설정으로 끌 수 없는
 * 규칙</b>이 생긴다 — 정책이 그 축을 갖게 되는 날 이 클래스가 함께 자란다.
 */
public final class PasswordRules {

    private PasswordRules() {}

    /**
     * 영대 · 영소 · 숫자 · 그 밖(특수) 네 계열 중 몇 종이 쓰였는가.
     *
     * <p><b>"그 밖" 이 특수문자다.</b> 허용 특수문자 목록을 두지 않는 것이 결정이다 —
     * 목록을 두면 한글·이모지·비ASCII 가 <b>아무 계열도 아닌 문자</b>가 되어, 그것만으로
     * 만든 비밀번호가 0종으로 계산되고 <i>왜 거절되는지</i> 를 설명할 수 없다.
     */
    public static int charsetKinds(String password) {
        boolean upper = false;
        boolean lower = false;
        boolean digit = false;
        boolean other = false;

        for (int i = 0; i < password.length(); i++) {
            char c = password.charAt(i);
            if (c >= 'A' && c <= 'Z') {
                upper = true;
            } else if (c >= 'a' && c <= 'z') {
                lower = true;
            } else if (c >= '0' && c <= '9') {
                digit = true;
            } else {
                other = true;
            }
        }
        return (upper ? 1 : 0) + (lower ? 1 : 0) + (digit ? 1 : 0) + (other ? 1 : 0);
    }

    /** 길이와 종류 수를 함께 본다 — 하나라도 모자라면 거짓이다. */
    public static boolean satisfies(String password, int minLength, int requireCharsetKinds) {
        return password.length() >= minLength && charsetKinds(password) >= requireCharsetKinds;
    }
}
