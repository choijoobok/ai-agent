package com.aiagent.core.search;

import com.aiagent.core.error.BusinessException;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * 커서 한 장 — backend/api.md. <b>불투명하고 유효기간이 없다.</b>
 *
 * <pre>
 * base64url( field | dir | backward | value | pk )   // 다섯 마디를 URL 인코딩해 '|' 로 잇는다
 * </pre>
 *
 * <p><b>불투명한 이유</b> — 클라이언트가 해석하면 정렬 키가 노출되고, 형태를 바꿀 때
 * 프론트가 깨진다. 화면은 이 문자열을 <b>받은 그대로 되돌려주기만</b> 한다.
 *
 * <p><b>유효기간이 없는 이유</b> — 서버가 상태를 갖지 않는다. 토큰이 곧
 * {@code WHERE (creDtm, seq) < (?, ?)} 이며 다중화에서도 안전하다.
 *
 * <h2>다섯 마디가 각각 하는 일</h2>
 *
 * <table><caption></caption>
 * <tr><td>{@code field}·{@code dir}</td><td><b>정렬이 바뀌면 커서는 무효다</b>(backend/api.md).
 *     값만 담으면 바뀐 정렬에 옛 기준점이 그대로 먹혀 <b>결과가 조용히 틀린다</b> — 서버가
 *     알아보고 400 을 내려면 무엇으로 만든 커서인지가 토큰 안에 있어야 한다</td></tr>
 * <tr><td>{@code backward}</td><td><b>{@code ‹ 이전} 도 커서다.</b> 방향을 뒤집어 읽고
 *     결과를 되집는다 — 두 방향이 <b>같은 토큰 형식</b>을 쓰므로 화면은 둘을 구분하지 않고
 *     받은 것을 돌려준다</td></tr>
 * <tr><td>{@code value}·{@code pk}</td><td>기준점. PK 가 함께 있어야 <b>같은 시각의 행이
 * 여럿</b>일 때 경계가 흔들리지 않는다(screen/log/access/requirements.md)</td></tr>
 * </table>
 *
 * <p><b>JSON 이 아니다.</b> {@code core} 는 {@code jackson-databind} 를 갖지 않는다(backend/packages.md —
 * 프레임워크 의존 최소). 다섯 마디뿐이라 구분자 하나로 족하며, 값에 {@code |} 가 들어와도
 * <b>URL 인코딩이 먼저 막는다</b>.
 */
public record CursorToken(String field, SortDir dir, boolean backward, String value, String pk) {

    private static final String SEPARATOR = "|";

    /** 실제로 읽을 방향 — 뒤로 갈 때는 뒤집어 읽고 결과를 되집는다. */
    public SortDir scanDir() {
        if (!backward) {
            return dir;
        }
        return dir == SortDir.desc ? SortDir.asc : SortDir.desc;
    }

    public String encode() {
        String joined = String.join(
                SEPARATOR,
                escape(field),
                escape(dir.name()),
                escape(Boolean.toString(backward)),
                escape(value),
                escape(pk));
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(joined.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * 못 읽으면 400 이다 — 조용히 첫 장으로 떨어뜨리지 않는다.
     *
     * <p>떨어뜨리면 <i>"다음을 눌렀는데 1페이지로 돌아왔다"</i> 가 되고, 사용자는 그것을
     * <b>데이터가 없는 것</b>으로 읽는다.
     */
    public static CursorToken decode(String encoded) {
        try {
            String joined = new String(
                    Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8);
            String[] parts = joined.split("\\" + SEPARATOR, -1);
            if (parts.length != 5) {
                throw invalid(encoded);
            }
            return new CursorToken(
                    unescape(parts[0]),
                    SortDir.valueOf(unescape(parts[1])),
                    Boolean.parseBoolean(unescape(parts[2])),
                    unescape(parts[3]),
                    unescape(parts[4]));
        } catch (IllegalArgumentException e) {
            throw invalid(encoded);
        }
    }

    private static BusinessException invalid(String encoded) {
        return new BusinessException(
                SearchErrorCode.INVALID_CURSOR, "커서를 읽을 수 없다 — " + encoded);
    }

    private static String escape(String text) {
        return URLEncoder.encode(text == null ? "" : text, StandardCharsets.UTF_8);
    }

    private static String unescape(String text) {
        return URLDecoder.decode(text, StandardCharsets.UTF_8);
    }
}
