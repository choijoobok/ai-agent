package com.aiagent.domain.user.service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 관리자가 발급하는 임시 비밀번호를 만든다 — AUTH-07 · screen/user/requirements.md.
 *
 * <p>{@link PasswordRules} 와 <b>짝</b>이다. 저것은 <i>이 값이 정책을 채우는가</i> 를 묻고
 * 이것은 <b>채우는 값을 만든다</b> — 규칙이 하나뿐이므로 만든 것이 검사를 통과하지 못하는
 * 일이 없어야 하고, 그래서 정책을 <b>인자로 받는다</b>. 여기에만 있는 상수를 두면
 * {@code sys-config} 로 정책을 조인 배포에서 <b>발급된 비밀번호가 바로 거절된다</b>.
 *
 * <h2>헷갈리는 글자를 빼는 것이 이 클래스의 전부다</h2>
 *
 * <p>이 값은 <b>사람이 옮겨 적는다</b>. 메일 연동이 없는 배포에서 관리자가 화면에서 읽어
 * 전화나 메신저로 전하며(sys/code.md 의 {@code admin-reset-enabled} 가 <i>"유일한 경로"</i> 라고
 * 적은 그것이다), {@code 0}·{@code O}·{@code 1}·{@code l}·{@code I} 가 섞이면 <b>로그인
 * 실패가 잠금까지 간다</b> — 다섯 번이면 계정이 잠기고, 그 계정은 방금 임시 비밀번호를 받은
 * 계정이다.
 *
 * <p>특수문자도 <b>키보드에서 흔들리지 않는 여섯</b>만 쓴다. 전화로 불러 주기 어려운 글자를
 * 넣어 봐야 실제로 늘어나는 것은 엔트로피가 아니라 재발급 요청이다.
 */
public final class TemporaryPasswords {

    private static final String UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
    private static final String LOWER = "abcdefghijkmnpqrstuvwxyz";
    private static final String DIGIT = "23456789";
    private static final String OTHER = "!@#$%*";

    /** {@link PasswordRules#charsetKinds} 가 세는 네 계열과 <b>같은 순서</b>다. */
    private static final List<String> POOLS = List.of(UPPER, LOWER, DIGIT, OTHER);

    private static final SecureRandom RANDOM = new SecureRandom();

    private TemporaryPasswords() {}

    /**
     * 정책을 <b>확실히</b> 채우는 값을 만든다.
     *
     * <p>요구된 종류 수만큼 계열에서 <b>한 자씩 먼저 뽑고</b> 나머지를 그 계열들의 합집합에서
     * 채운 뒤 섞는다. 무작위로 만들고 검사에서 떨어지면 다시 만드는 방식은 <b>정책이 빡빡할
     * 때 몇 번을 도는지 말할 수 없다</b>.
     *
     * <p><b>길이는 정책보다 짧을 수 없고 8자보다도 짧지 않다.</b> 정책의 최소 길이가 4까지
     * 내려갈 수 있는데({@code AuthPasswordProps}) 그것은 <i>사람이 정하는 비밀번호</i> 의
     * 하한이고, 여기서 만드는 것은 <b>기계가 만들어 잠깐 쓰는 값</b>이라 짧게 만들 이유가
     * 하나도 없다.
     *
     * @param minLength 정책의 최소 길이 — {@code AuthPasswordProps.minLength}
     * @param requireCharsetKinds 정책이 요구하는 문자 종류 수(1~4)
     */
    public static String generate(int minLength, int requireCharsetKinds) {
        int kinds = Math.clamp(requireCharsetKinds, 1, POOLS.size());
        int length = Math.max(Math.max(minLength, kinds), 12);

        List<String> picked = POOLS.subList(0, kinds);
        StringBuilder alphabet = new StringBuilder();
        picked.forEach(alphabet::append);

        List<Character> chars = new ArrayList<>(length);
        for (String pool : picked) {
            chars.add(pool.charAt(RANDOM.nextInt(pool.length())));
        }
        while (chars.size() < length) {
            chars.add(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
        }
        /*
          <b>섞지 않으면 앞자리가 계열 순서를 그대로 드러낸다</b> — 첫 글자는 언제나 대문자,
          둘째는 언제나 소문자다. 값이 짧고 수명이 짧아도 그 패턴은 공짜로 줄 필요가 없다.
        */
        Collections.shuffle(chars, RANDOM);

        StringBuilder value = new StringBuilder(length);
        chars.forEach(value::append);
        return value.toString();
    }
}
