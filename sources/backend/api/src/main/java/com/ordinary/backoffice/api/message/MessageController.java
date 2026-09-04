package com.ordinary.backoffice.api.message;

import com.ordinary.backoffice.api.message.response.MessageBundleResponse;
import com.ordinary.backoffice.api.trace.TraceId;
import com.ordinary.backoffice.core.response.ApiResponse;
import com.ordinary.backoffice.domain.message.entity.SysCacheVersion;
import com.ordinary.backoffice.domain.message.service.CacheVersionService;
import com.ordinary.backoffice.domain.message.service.MessageService;
import com.ordinary.backoffice.support.config.ConfigLookup;
import com.ordinary.backoffice.support.config.props.MessageProps;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 공개 메시지 번들 — 50 §3.2.
 *
 * <p><b>{@code public} 인 것이 이 API 의 존재 이유다.</b> 로그인 화면에도 문구가 있고 사용자
 * 언어({@code LOCALE_CD})는 로그인해야 알 수 있다 — 순환이며, 그것을 끊는 것이 이 호출이다.
 * 정적 폴백 문구로 로그인 화면을 먼저 그리는 대안은 <b>문구의 원본을 둘로 만든다</b>.
 *
 * <p>경로가 50 §3.2 의 예시({@code /api/public/messages})와 다르다. api-conventions.md §2.2 가 <b>소스의
 * 메서드명이 그대로 경로</b>라고 확정했고 {@code AUTH_ENDPOINTS} 가 이미 그것을 따르므로,
 * 규약 쪽을 택하고 그 문서를 고쳤다(2026-08-29).
 */
@RestController
public class MessageController {

    private final MessageService messages;
    private final CacheVersionService versions;
    private final RequestLocale locale;
    private final ConfigLookup configs;

    public MessageController(
            MessageService messages,
            CacheVersionService versions,
            RequestLocale locale,
            ConfigLookup configs) {
        this.messages = messages;
        this.versions = versions;
        this.locale = locale;
        this.configs = configs;
    }

    /**
     * @param lang 프론트가 정한 언어(50 §3.2 의 2순위 규칙). 없으면 {@code Accept-Language}
     * @param v 클라이언트가 들고 있는 번들의 버전. 같으면 본문 없이 끝낸다(43 §8.1)
     */
    @GetMapping("/api/public/message/getBundle")
    public ApiResponse<MessageBundleResponse> getBundle(
            @RequestParam(required = false) String lang, @RequestParam(required = false) Long v) {

        String resolved = lang == null ? locale.current() : locale.normalize(lang);
        long version = versions.current(SysCacheVersion.MESSAGE);
        List<String> langs = configs.get(MessageProps.class).supported();

        MessageBundleResponse body =
                v != null && v == version
                        ? MessageBundleResponse.unchanged(resolved, langs, version)
                        : MessageBundleResponse.of(resolved, langs, version, messages.bundle(resolved));

        return ApiResponse.success(body, TraceId.current());
    }
}
