package com.aiagent.domain.log;

import java.nio.charset.StandardCharsets;

/**
 * 이력의 긴 텍스트가 <b>잘렸는가</b>를 말하는 한 마디 — backend/packages.md · screen/admin/system/log/access/requirements.md.
 *
 * <p>전문도 스택도 상한에서 잘린다. 잘린 사실을 말하지 않으면 <b>잘린 JSON 을 받은 사람이
 * <i>"저장이 깨졌다"</i> 로 읽는다</b> — 이력 화면에서 가장 흔한 오독이다.
 *
 * <p><b>컬럼을 하나 더 두지 않는다.</b> {@code TRUNC_YN} 을 더하면 <b>같은 사실이 두 곳</b>이
 * 되고, 본문 끝의 표시와 그 컬럼이 어긋날 때 어느 쪽이 맞는지 알 수 없다. 표시는
 * <b>사람이 모달에서 읽는 값이기도 하므로</b> 어차피 본문에 있어야 한다.
 *
 * <p><b>이름에 {@code Access} 가 없는 이유가 있다.</b> 처음에는 {@code AccessLogPayload} 였고
 * 사용 이력의 {@code PARAMETERS} 만 알았는데, 에러 로그의 {@code ROOT_CAUSE_STACK} 이
 * <b>같은 상한과 같은 표시</b>를 쓰게 됐다(screen/admin/system/log/access/requirements.md). 그때 상수를 저쪽 이름으로 가져다 쓰면
 * <i>스택이 사용 이력의 것</i> 으로 읽히고, 복사해 두면 <b>같은 사실이 두 곳</b>이 된다 —
 * 이 클래스가 애초에 막으려던 것이 그것이다.
 *
 * <p>쓰는 쪽은 {@code api} 의 직렬화기와 예외 기록기, 읽는 쪽은 두 {@code getDetail} 이다 —
 * 그 둘이 모듈이 달라 상수가 여기(공통 의존인 {@code domain})에 있다.
 */
public final class LogText {

    /**
     * 본문 끝에 붙는 표시.
     *
     * <p><b>줄바꿈으로 시작한다</b> — JSON 본문이나 스택 프레임 뒤에 그대로 이어 붙으면
     * 마지막 값·마지막 줄의 일부로 읽힌다.
     */
    public static final String TRUNCATED_MARK = "\n… [상한에서 잘렸습니다]";

    private LogText() {}

    public static boolean isTruncated(String text) {
        return text != null && text.endsWith(TRUNCATED_MARK);
    }

    /**
     * UTF-8 <b>바이트</b> 상한. 문자 중간에서 자르지 않는다.
     *
     * <p>상한이 문자면 전부 한글일 때 <b>3배가 샌다</b>(backend/packages.md 의 실측). 그래서 바이트로
     * 세되, 자른 뒤 뒤에서부터 <b>연속 바이트(10xxxxxx)</b> 를 걷어낸다 — 그래야 마지막
     * 문자가 통째로 남거나 통째로 빠진다.
     */
    public static String truncate(String text, int maxBytes) {
        if (text == null) {
            return null;
        }
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        if (bytes.length <= maxBytes) {
            return text;
        }
        int end = maxBytes;
        while (end > 0 && (bytes[end] & 0xC0) == 0x80) {
            end--;
        }
        return new String(bytes, 0, end, StandardCharsets.UTF_8) + TRUNCATED_MARK;
    }
}
