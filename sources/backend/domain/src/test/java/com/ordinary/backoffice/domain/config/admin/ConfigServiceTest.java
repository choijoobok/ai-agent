package com.ordinary.backoffice.domain.config.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ordinary.backoffice.core.error.BusinessException;
import com.ordinary.backoffice.core.grid.RowState;
import com.ordinary.backoffice.domain.config.entity.SysConfig;
import com.ordinary.backoffice.domain.config.repository.SysConfigRepository;
import com.ordinary.backoffice.domain.message.entity.SysCacheVersion;
import com.ordinary.backoffice.domain.message.repository.SysCacheVersionRepository;
import com.ordinary.backoffice.support.config.ConfigCatalog;
import com.ordinary.backoffice.support.config.ConfigKey;
import com.ordinary.backoffice.support.config.ConfigValueType;
import com.ordinary.backoffice.support.config.ConfigValidator;
import com.ordinary.backoffice.support.config.ConfigViolation;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * 저장 하나가 두 가지를 한다 — 63 §4.7.
 *
 * <p><b>여기서 지키는 것 넷이다.</b> ① 화면이 <b>키를 만들지 못한다</b>(왼쪽 테이블은 코드다),
 * ② 되돌리기는 <b>행 삭제</b>이고 없는 행을 지우려 하면 거부한다, ③ 검증은 <b>저장 후의
 * 전량</b>을 얹어 본다(델타가 아니다), ④ 캐시 버전은 <b>저장 한 번에 +1</b> 이다.
 *
 * <p>③이 특히 조용히 깨진다 — 바꾼 키만 얹으면 <i>"둘을 함께 올리는"</i> 저장이 상호 제약의
 * <b>중간 상태에서 거부</b>되고, 사용자는 <b>어느 쪽도 먼저 올릴 수 없게</b> 된다.
 */
class ConfigServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-30T00:00:00Z");

    private SysConfigRepository overrides;
    private SysCacheVersionRepository versions;
    private ConfigValidator validator;
    private ConfigService service;

    @BeforeEach
    void setUp() {
        overrides = mock(SysConfigRepository.class);
        versions = mock(SysCacheVersionRepository.class);
        validator = mock(ConfigValidator.class);

        ConfigCatalog catalog = mock(ConfigCatalog.class);
        when(catalog.keys()).thenReturn(List.of(
                new ConfigKey("auth.login.fail-limit", ConfigValueType.NUMBER, "설명", "5"),
                new ConfigKey("auth.password.min-length", ConfigValueType.NUMBER, "설명", "9")));

        when(overrides.findAll()).thenReturn(List.of());
        when(overrides.findById(anyString())).thenReturn(Optional.empty());
        when(validator.validate(any())).thenReturn(List.of());
        when(versions.findById(SysCacheVersion.CONFIG)).thenReturn(Optional.empty());

        service = new ConfigService(
                overrides, versions, catalog, validator, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static ConfigSaveRow update(String key, String value) {
        return new ConfigSaveRow(RowState.U, key, value);
    }

    private static ConfigSaveRow revert(String key) {
        return new ConfigSaveRow(RowState.D, key, null);
    }

    @Nested
    @DisplayName("적용값 수정")
    class Upsert {

        @Test
        @DisplayName("행이 없으면 만든다 — 화면이 보는 행은 언제나 있으므로 둘을 가르지 않는다")
        void 없으면_만든다() {
            service.save(List.of(update("auth.login.fail-limit", "3")));

            ArgumentCaptor<SysConfig> saved = ArgumentCaptor.forClass(SysConfig.class);
            verify(overrides).save(saved.capture());
            assertThat(saved.getValue().getCfgKey()).isEqualTo("auth.login.fail-limit");
            assertThat(saved.getValue().getCfgVal()).isEqualTo("3");
        }

        @Test
        @DisplayName("행이 있으면 값만 바꾼다 — 새 행을 만들면 PK 가 부딪힌다")
        void 있으면_고친다() {
            SysConfig existing = SysConfig.of("auth.login.fail-limit", "3");
            when(overrides.findById("auth.login.fail-limit")).thenReturn(Optional.of(existing));

            service.save(List.of(update("auth.login.fail-limit", "7")));

            verify(overrides, never()).save(any());
            assertThat(existing.getCfgVal()).isEqualTo("7");
        }

        /**
         * <b>기본값과 같은 값도 저장된다.</b> 그것이 <i>변경됨</i> 의 근거가 행의 존재인 이유다
         * (63 §4.3) — 값 비교로 판정하면 이 저장이 <b>아무 일도 안 한 것</b>이 되고, 다음
         * 배포가 {@code yml} 을 올렸을 때 그 키가 옛 값에 묶인 사실을 아무도 볼 수 없다.
         */
        @Test
        @DisplayName("기본값과 같은 값도 행을 만든다 — 배지의 근거는 값이 아니라 행이다")
        void 같은_값도_행을_만든다() {
            service.save(List.of(update("auth.login.fail-limit", "5")));

            verify(overrides).save(any(SysConfig.class));
        }
    }

    @Nested
    @DisplayName("되돌리기")
    class Revert {

        @Test
        @DisplayName("행을 지운다 — 값이 사라지는 것이 아니라 yml 이 드러난다")
        void 행을_지운다() {
            SysConfig existing = SysConfig.of("auth.login.fail-limit", "3");
            when(overrides.findById("auth.login.fail-limit")).thenReturn(Optional.of(existing));

            service.save(List.of(revert("auth.login.fail-limit")));

            verify(overrides).delete(existing);
        }

        @Test
        @DisplayName("되돌릴 행이 없으면 거부한다 — 다른 사람이 먼저 되돌렸다")
        void 없으면_거부() {
            assertThatThrownBy(() -> service.save(List.of(revert("auth.login.fail-limit"))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(ConfigErrorCode.NOT_OVERRIDDEN);
        }
    }

    @Nested
    @DisplayName("키는 코드가 정한다")
    class Keys {

        @Test
        @DisplayName("카탈로그에 없는 키는 거부한다 — 저장은 되고 동작하지 않는 실패를 막는다")
        void 없는_키는_거부() {
            assertThatThrownBy(() -> service.save(List.of(update("auth.login.nope", "1"))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(ConfigErrorCode.KEY_UNKNOWN);
            verify(overrides, never()).save(any());
        }

        @Test
        @DisplayName("행 추가(C)는 받지 않는다 — 화면에 버튼이 없고 서버도 문을 열지 않는다")
        void 신규는_거부() {
            var rows = List.of(new ConfigSaveRow(RowState.C, "auth.login.fail-limit", "1"));

            assertThatThrownBy(() -> service.save(rows))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(ConfigErrorCode.KEY_UNKNOWN);
        }

        @Test
        @DisplayName("같은 키가 두 번 오면 거부한다 — 뒤가 앞을 조용히 덮는다")
        void 중복은_거부() {
            var rows = List.of(
                    update("auth.login.fail-limit", "3"), update("auth.login.fail-limit", "7"));

            assertThatThrownBy(() -> service.save(rows)).isInstanceOf(BusinessException.class);
        }
    }

    @Nested
    @DisplayName("검증")
    class Validation {

        /**
         * <b>전량이지 델타가 아니다.</b> 상호 제약은 형제 값을 봐야 판정되므로 바꾼 키만
         * 얹으면 중간 상태에서 거부된다 — 되돌리기({@code D})가 <b>빼는 것</b>으로 반영되는
         * 것도 같은 이유다.
         */
        @Test
        @DisplayName("저장 후의 전체 오버라이드를 얹어 본다 — 지금 DB + 이번 요청")
        void 전량을_얹는다() {
            when(overrides.findAll()).thenReturn(List.of(
                    SysConfig.of("auth.login.fail-limit", "3"),
                    SysConfig.of("auth.password.min-length", "12")));
            when(overrides.findById("auth.login.fail-limit"))
                    .thenReturn(Optional.of(SysConfig.of("auth.login.fail-limit", "3")));

            service.save(List.of(revert("auth.login.fail-limit")));

            @SuppressWarnings("unchecked")
            ArgumentCaptor<Map<String, String>> sent = ArgumentCaptor.forClass(Map.class);
            verify(validator).validate(sent.capture());
            // 되돌린 키는 빠지고, 손대지 않은 키는 남는다.
            assertThat(sent.getValue()).containsOnlyKeys("auth.password.min-length");
        }

        @Test
        @DisplayName("거부되면 쓰지 않는다 — 실패는 CFG_KEY 를 달고 나간다(grid-edit-validation.md §3.4)")
        void 거부되면_쓰지_않는다() {
            when(validator.validate(any())).thenReturn(
                    List.of(new ConfigViolation("auth.password.min-length", "4 이상이어야 합니다")));

            assertThatThrownBy(() -> service.save(List.of(update("auth.password.min-length", "2"))))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(error -> {
                        BusinessException failure = (BusinessException) error;
                        assertThat(failure.errorCode()).isEqualTo(ConfigErrorCode.INVALID_VALUE);
                        assertThat(failure.fieldErrors())
                                .singleElement()
                                .satisfies(field -> {
                                    assertThat(field.field()).isEqualTo("auth.password.min-length");
                                    assertThat(field.message()).isEqualTo("4 이상이어야 합니다");
                                });
                    });
            verify(overrides, never()).save(any());
        }
    }

    @Nested
    @DisplayName("캐시 버전")
    class CacheVersion {

        @Test
        @DisplayName("저장 한 번에 +1 이다 — 행 수만큼 올리지 않는다(43 §8.1)")
        void 한_번에_한_번() {
            SysCacheVersion version = SysCacheVersion.started(SysCacheVersion.CONFIG, NOW);
            when(versions.findById(SysCacheVersion.CONFIG)).thenReturn(Optional.of(version));

            service.save(List.of(
                    update("auth.login.fail-limit", "3"), update("auth.password.min-length", "12")));

            assertThat(version.getVersion()).isEqualTo(2L);
        }

        @Test
        @DisplayName("행이 없으면 만든다 — 시드가 넣어 두지만 없어도 저장이 죽지 않아야 한다")
        void 없으면_만든다() {
            service.save(List.of(update("auth.login.fail-limit", "3")));

            verify(versions).save(any(SysCacheVersion.class));
        }
    }
}
