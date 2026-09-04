package com.ordinary.backoffice.api.message;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.ordinary.backoffice.support.config.ConfigLookup;
import com.ordinary.backoffice.support.config.props.MessageProps;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 언어 정규화 — 50 §3.2 순위 2.
 *
 * <p>이 규칙이 지켜야 하는 것은 <b>어떤 입력이든 지원 언어 하나로 닫힌다</b>는 것이다.
 * 닫히지 않는 입력이 하나라도 있으면 <i>"서버 기본 언어"</i> 라는 3순위가 필요해지고,
 * 그 순간 <i>"서버 기본이 ko 인데 브라우저가 ja 면?"</i> 이 되살아난다.
 *
 * <p><b>같은 규칙이 프론트에도 있다</b>(`shared/i18n/lang.ts`). 프론트는 첫 요청을 보내기
 * 전에 언어를 정해야 하므로 피할 수 없는 중복이며, 그래서 <b>양쪽 다 이 표를 지킨다</b>.
 */
@ExtendWith(MockitoExtension.class)
class RequestLocaleTest {

    @Mock private ConfigLookup configs;

    private RequestLocale locale;

    @BeforeEach
    void setUp() {
        when(configs.get(MessageProps.class))
                .thenReturn(new MessageProps(List.of("ko", "en"), "ko", "en", 30));
        locale = new RequestLocale(configs);
    }

    @Test
    @DisplayName("지역을 버리고 언어만 본다 — ko-KR 도 ko-Kore-KR 도 ko 다")
    void keepsOnlyTheLanguageSubtag() {
        assertThat(locale.normalize("ko-KR")).isEqualTo("ko");
        assertThat(locale.normalize("en-US")).isEqualTo("en");
        assertThat(locale.normalize("ko_KR")).isEqualTo("ko");
    }

    @Test
    @DisplayName("대소문자를 가리지 않는다 — Accept-Language 는 대소문자 무의미이다")
    void isCaseInsensitive() {
        assertThat(locale.normalize("KO")).isEqualTo("ko");
        assertThat(locale.normalize("EN-us")).isEqualTo("en");
    }

    @Test
    @DisplayName("모르는 언어는 en 이다 — 기본 언어(ko)가 아니다")
    void unknownLanguageGoesToTheBrowserFallback() {
        // 일본어 브라우저에 한국어를 주는 것은 답이 아니다. 이것이 defaultLang 과 다른 축인
        // 이유이며, 둘을 한 값으로 합치면 이 사람은 읽을 수 없는 화면을 받는다.
        assertThat(locale.normalize("ja")).isEqualTo("en");
        assertThat(locale.normalize("zh-CN")).isEqualTo("en");
    }

    @Test
    @DisplayName("비었거나 없으면 en 이다 — 던지지 않는다")
    void emptyInputIsClosedToo() {
        assertThat(locale.normalize(null)).isEqualTo("en");
        assertThat(locale.normalize("")).isEqualTo("en");
        assertThat(locale.normalize("   ")).isEqualTo("en");
    }

    @Test
    @DisplayName("망가진 태그도 닫힌다 — 입력이 사용자 헤더라 무엇이든 올 수 있다")
    void garbageIsClosedToo() {
        assertThat(locale.normalize("!!!")).isEqualTo("en");
        assertThat(locale.normalize("-")).isEqualTo("en");
    }
}
