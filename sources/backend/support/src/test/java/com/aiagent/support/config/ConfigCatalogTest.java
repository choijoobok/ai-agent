package com.aiagent.support.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/**
 * 왼쪽 테이블이 코드에서 나온다 — screen/config/requirements.md.
 *
 * <p><b>여기서 지키는 것 넷이다.</b> ① 등록 목록을 관리하지 않는다(애노테이션 스캔),
 * ② 중첩 객체는 재귀한다, ③ 컬렉션은 목록에 없다, ④ <b>설명이 빌드 산출물에서 온다</b>.
 *
 * <p>④가 특히 <b>조용히 깨진다.</b> {@code record} 컴포넌트 위의 주석은 Javadoc 이 아니라
 * 그냥 주석이라 프로세서가 보지 못한다 — {@code @param} 이 정규 자리이며, 모르고 두면
 * 빌드도 기동도 성공하고 <b>관리 화면의 설명 컬럼만 빈다</b>.
 */
class ConfigCatalogTest {

    private ConfigCatalog catalog;

    @BeforeEach
    void setUp() {
        MockEnvironment environment = new MockEnvironment();
        // 이 테스트가 보는 것은 <b>키의 존재</b>이지 값이 아니다 — 몇 개만 채운다.
        environment.setProperty("sys-config.auth.login.fail-limit", "5");
        environment.setProperty("sys-config.auth.password.reset.try-limit", "5");
        catalog = new ConfigCatalog(environment);
    }

    private Map<String, ConfigKey> byKey() {
        return catalog.keys().stream()
                .collect(java.util.stream.Collectors.toMap(ConfigKey::key, key -> key));
    }

    @Nested
    @DisplayName("키 목록")
    class Keys {

        @Test
        @DisplayName("애노테이션 스캔이 실제로 찾았다 — 0건이면 아래 검사가 공허하게 통과한다")
        void 스캔이_찾았다() {
            assertThat(catalog.propsClasses()).isNotEmpty();
            assertThat(catalog.keys()).isNotEmpty();
        }

        @Test
        @DisplayName("접두사에서 루트를 뺀 것 + 필드명(kebab)이 CFG_KEY 다 — sys/code.md")
        void 키는_루트를_뺀_나머지다() {
            assertThat(byKey()).containsKey("auth.login.fail-limit");
            // 루트가 붙으면 접두사 콤보의 첫 마디가 전부 같아진다 — sys/config.md.
            assertThat(catalog.keys()).noneMatch(key -> key.key().startsWith("sys-config."));
        }

        @Test
        @DisplayName("중첩 객체는 재귀한다 — auth.password.reset.try-limit 이 그것이다")
        void 중첩은_재귀한다() {
            assertThat(byKey()).containsKey("auth.password.reset.try-limit");
        }

        @Test
        @DisplayName("[TC-5063] sys-config 밖의 비밀·보호 경로는 없다 — 배포 설정이라 화면에 나오지 않는다")
        void 루트_밖은_없다() {
            assertThat(byKey()).doesNotContainKey("security.concurrent-session.max-sessions");
            assertThat(byKey()).doesNotContainKey("logging.sql.enabled");
        }

        @Test
        @DisplayName("컬렉션은 목록에 없다 — 맵의 키가 곧 프로퍼티 이름이라 키가 고정되지 않는다")
        void 컬렉션은_빠진다() {
            assertThat(byKey()).doesNotContainKey("message.supported");
            // 같은 클래스의 스칼라는 남는다 — 클래스째로 빠지는 것이 아니다.
            assertThat(byKey()).containsKey("message.default-lang");
        }

        @Test
        @DisplayName("키 오름차순이다 — 화면의 기본 정렬이 여기서 온다")
        void 정렬돼_있다() {
            List<String> keys = catalog.keys().stream().map(ConfigKey::key).toList();
            assertThat(keys).isSorted();
        }
    }

    @Nested
    @DisplayName("유형은 필드 타입에서 온다")
    class Types {

        @Test
        @DisplayName("Integer 는 NUMBER, Boolean 은 BOOLEAN, String 은 STRING")
        void 셋이_갈린다() {
            assertThat(byKey().get("auth.login.fail-limit").type()).isEqualTo(ConfigValueType.NUMBER);
            assertThat(byKey().get("auth.login.deny-empty-authority").type())
                    .isEqualTo(ConfigValueType.BOOLEAN);
            assertThat(byKey().get("message.default-lang").type()).isEqualTo(ConfigValueType.STRING);
        }
    }

    @Nested
    @DisplayName("설명은 빌드 산출물에서 온다 — screen/config/requirements.md")
    class Descriptions {

        /**
         * <b>이 검사가 막는 것은 오타가 아니라 자리다.</b> 새 props 를 만들며 설명을 컴포넌트
         * 위에 주석으로 쓰면 그것은 Javadoc 이 아니라 그냥 주석이고, 메타데이터에 실리지
         * 않는다 — 그 사실은 <b>화면을 열어 봐야</b> 드러난다.
         */
        @Test
        @DisplayName("모든 키에 설명이 있다 — 없으면 @param 이 아닌 곳에 썼거나 프로세서가 빠졌다")
        void 설명이_전부_있다() {
            assertThat(catalog.keys())
                    .allSatisfy(key -> assertThat(key.description())
                            .as("%s 의 설명이 비었다 — @param 자리인지, 프로세서가 붙었는지 본다", key.key())
                            .isNotBlank());
        }

        @Test
        @DisplayName("Javadoc 표기를 걷어낸다 — 셀에 마크업이 보이면 안 된다")
        void 마크업이_없다() {
            assertThat(catalog.keys())
                    .allSatisfy(key -> assertThat(key.description()).doesNotContain("{@", "<b>", "</b>"));
        }
    }

    @Nested
    @DisplayName("기본값은 Environment 유효값이다")
    class Defaults {

        @Test
        @DisplayName("yml 에 있으면 그 값이다")
        void 값을_읽는다() {
            assertThat(byKey().get("auth.login.fail-limit").defaultValue()).isEqualTo("5");
        }

        /**
         * <b>여기서 던지지 않는다.</b> 값이 없는 것은 기동이 이미 실패했어야 할 상태인데
         * (sys/code.md), 그 판정은 바인딩의 것이지 카탈로그의 것이 아니다 — 카탈로그가 함께
         * 죽으면 <b>기동 실패의 원인이 두 곳</b>에서 나온다.
         */
        @Test
        @DisplayName("yml 에 없으면 null 이다 — 목록이 통째로 죽지 않는다")
        void 없으면_null() {
            assertThat(byKey().get("ui.excel.max-rows").defaultValue()).isNull();
        }
    }
}
