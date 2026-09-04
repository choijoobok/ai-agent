package com.ordinary.backoffice.core.message;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 문구의 {@code {name}} 자리를 채운다 — 프론트 {@code label()} 의 {@code format} 과 <b>같은
 * 규칙</b>이다(43 §3).
 *
 * <p><b>규칙이 갈리면 같은 문구가 두 곳에서 다르게 그려진다.</b> 비밀번호 정책 문구는
 * 정책 API 로 서버가 완성해 내려주고 그것을 프론트가 그대로 쓰는데, 자리표 문법이 다르면
 * 번역자가 어느 쪽 문법으로 써야 하는지 알 수 없다.
 *
 * <p><b>자리표가 없으면 그대로 둔다.</b> 번역이 자리표를 빠뜨렸을 때 빈 칸이 아니라 원문이
 * 그대로 보여야 무엇이 잘못됐는지 드러난다 — 프론트의 그 문장과 같은 판단이다.
 *
 * <p>{@code MessageFormat} 을 쓰지 않는다. 그쪽은 {@code {0}} 위치 인자에 작은따옴표
 * 이스케이프 규칙이 붙어 있어, 한국어 문구에는 없는 규칙을 번역자에게 요구하게 된다.
 */
public final class MsgFormat {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{(\\w+)}");

    private MsgFormat() {}

    public static String format(String template, Map<String, ?> params) {
        if (template == null || params == null || params.isEmpty()) {
            return template;
        }
        Matcher matcher = PLACEHOLDER.matcher(template);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            Object value = params.get(matcher.group(1));
            matcher.appendReplacement(
                    out,
                    Matcher.quoteReplacement(value == null ? matcher.group() : String.valueOf(value)));
        }
        matcher.appendTail(out);
        return out.toString();
    }
}
