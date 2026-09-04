package com.ordinary.backoffice.api.message.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;

/**
 * 공개 메시지 번들 — 50 §3.2.
 *
 * <p><b>{@code messages} 가 없는 응답이 정상 경로다.</b> 두 번째 이후 접속은 버전만 확인하고
 * 본문 없이 끝난다 — 번들은 전 사용자 공통이고 변경이 드물어 사실상 한 번만 받는다.
 *
 * <p><b>{@code lang} 을 되돌려 주는 것이 중요하다.</b> 요청한 언어와 서버가 고른 언어가 다를
 * 수 있다({@code ja} → {@code en}). 프론트가 요청 값으로 {@code localStorage} 키를 만들면
 * 다음 접속에서 <b>영어 번들을 일본어 칸에</b> 넣고 매번 다시 받는다.
 *
 * @param langs 지원 언어 전부 — <b>{@code unchanged} 여도 함께 온다.</b> 43 §7 이 이 목록의
 *     원본을 공통코드({@code LANG_CD})로 정했고 63 §3.2 는 다국어 관리 화면의 하단 행 수가
 *     <i>"이미 캐시에 있는"</i> 그 목록에서 온다고 했다. {@code SYS_CODE} 가 없는 동안 이
 *     번들이 그 캐시 자리를 대신한다 — <b>별도 API 를 두면 화면 진입마다 왕복이 하나
 *     늘고</b>, 그 API 는 공통코드가 생기는 날 지울 것이 된다
 * @param unchanged 참이면 클라이언트가 들고 있는 것이 최신이다. {@code messages} 는 없다
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MessageBundleResponse(
        String lang,
        List<String> langs,
        long version,
        boolean unchanged,
        Map<String, String> messages) {

    public static MessageBundleResponse unchanged(String lang, List<String> langs, long version) {
        return new MessageBundleResponse(lang, langs, version, true, null);
    }

    public static MessageBundleResponse of(
            String lang, List<String> langs, long version, Map<String, String> messages) {
        return new MessageBundleResponse(lang, langs, version, false, messages);
    }
}
