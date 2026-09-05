package com.aiagent.domain.config.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.search.Condition;
import com.aiagent.core.search.Op;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.PageSpec;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.core.search.SortDir;
import com.aiagent.core.search.SortSpec;
import com.aiagent.domain.config.entity.SysConfig;
import com.aiagent.domain.config.repository.SysConfigRepository;
import com.aiagent.support.config.ConfigCatalog;
import com.aiagent.support.config.ConfigKey;
import com.aiagent.support.config.ConfigValueType;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 목록은 아우터 조인이고 <b>왼쪽이 코드</b>다 — screen/config/requirements.md.
 *
 * <p><b>여기서 지키는 것 셋이다.</b> ① 오른쪽이 비어도 <b>행 수가 그대로다</b>,
 * ② {@code 변경됨} 의 근거는 <b>행의 존재</b>이지 값 비교가 아니다, ③ 조회조건 셋은
 * <b>화이트리스트</b>이며 모르는 것은 400 이다.
 *
 * <p>①이 이 화면의 전부다. {@code SELECT * FROM SYS_CONFIG} 로 목록을 만들면 <b>한 번도
 * 바꾸지 않은 키가 통째로 사라진다</b> — 그리고 그것이 대부분이다.
 */
class ConfigQueryServiceTest {

    private SysConfigRepository overrides;
    private ConfigQueryService service;

    @BeforeEach
    void setUp() {
        ConfigCatalog catalog = mock(ConfigCatalog.class);
        when(catalog.keys()).thenReturn(List.of(
                new ConfigKey("auth.login.fail-limit", ConfigValueType.NUMBER, "연속 실패 허용 횟수", "5"),
                new ConfigKey("auth.password.min-length", ConfigValueType.NUMBER, "비밀번호 최소 길이", "9"),
                new ConfigKey("auth.password.reset.try-limit", ConfigValueType.NUMBER, "시도 허용 횟수", "5"),
                new ConfigKey("ui.excel.max-rows", ConfigValueType.NUMBER, "엑셀 상한", "50000")));

        overrides = mock(SysConfigRepository.class);
        when(overrides.findAll()).thenReturn(List.of());

        service = new ConfigQueryService(catalog, overrides);
    }

    private static SearchRequest<Void> request(Condition... conditions) {
        return new SearchRequest<>(List.of(conditions), List.of(), new PageSpec(0, 100, null), null);
    }

    private PageResponse<ConfigRow> query(Condition... conditions) {
        return service.getList(request(conditions));
    }

    @Nested
    @DisplayName("아우터 조인")
    class OuterJoin {

        @Test
        @DisplayName("SYS_CONFIG 가 비어도 전 키가 나온다 — 행 수는 설정 키 수로 고정이다")
        void 오른쪽이_비어도_전건() {
            var page = query();

            assertThat(page.totalElements()).isEqualTo(4);
            assertThat(page.content()).allMatch(row -> !row.overridden());
        }

        @Test
        @DisplayName("행이 없으면 적용값은 기본값의 복사다 — 빈 칸이 아니다")
        void 없으면_기본값을_복사() {
            var row = query().content().getFirst();

            assertThat(row.cfgKey()).isEqualTo("auth.login.fail-limit");
            assertThat(row.cfgVal()).isEqualTo(row.defaultVal()).isEqualTo("5");
        }

        @Test
        @DisplayName("행이 있으면 그 값이 이긴다 · 감사 컬럼도 그 행의 것이다")
        void 있으면_덮는다() {
            when(overrides.findAll()).thenReturn(List.of(SysConfig.of("auth.login.fail-limit", "3")));

            var row = query().content().getFirst();

            assertThat(row.defaultVal()).isEqualTo("5");
            assertThat(row.cfgVal()).isEqualTo("3");
            assertThat(row.overridden()).isTrue();
        }

        /**
         * <b>배지의 근거는 값 비교가 아니다</b>(screen/config/requirements.md). 기본값과 같은 값으로 저장해 두면
         * 다음 배포가 {@code yml} 을 올려도 그 키만 옛 값에 묶이는데, 두 값이 같아 눈으로는
         * 구분되지 않으므로 <b>이것이 유일한 신호</b>다.
         */
        @Test
        @DisplayName("값이 기본값과 같아도 행이 있으면 변경됨이다")
        void 값이_같아도_변경됨() {
            when(overrides.findAll()).thenReturn(List.of(SysConfig.of("auth.login.fail-limit", "5")));

            var row = query().content().getFirst();

            assertThat(row.cfgVal()).isEqualTo(row.defaultVal());
            assertThat(row.overridden()).isTrue();
        }
    }

    @Nested
    @DisplayName("조회조건 셋")
    class Conditions {

        @Test
        @DisplayName("키와 설명을 한 칸이 함께 건다 — 설명은 DB 에 없는 문자열이다")
        void 키와_설명을_함께() {
            // 키만 걸리는 말
            assertThat(query(new Condition("keyword", Op.contains, "fail-limit")).content())
                    .extracting(ConfigRow::cfgKey)
                    .containsExactly("auth.login.fail-limit");

            // 설명만 걸리는 말 — 키에는 '비밀번호' 가 없다
            assertThat(query(new Condition("keyword", Op.contains, "비밀번호")).content())
                    .extracting(ConfigRow::cfgKey)
                    .containsExactly("auth.password.min-length");

            // 둘에 걸치는 말 — 설명이 이어 준다
            assertThat(query(new Condition("keyword", Op.contains, "허용 횟수")).content())
                    .extracting(ConfigRow::cfgKey)
                    .containsExactly("auth.login.fail-limit", "auth.password.reset.try-limit");
        }

        @Test
        @DisplayName("대소문자를 가리지 않는다 — LIKE 와 같은 규칙이다(backend/api.md)")
        void 대소문자를_가리지_않는다() {
            assertThat(query(new Condition("keyword", Op.contains, "FAIL")).content()).hasSize(1);
        }

        @Test
        @DisplayName("접두사는 시작으로 건다")
        void 접두사() {
            assertThat(query(new Condition("prefix", Op.startsWith, "auth.password.")).content())
                    .extracting(ConfigRow::cfgKey)
                    .containsExactly("auth.password.min-length", "auth.password.reset.try-limit");
        }

        @Test
        @DisplayName("변경 여부는 전량에서 걸린다 — 판정은 행의 존재다")
        void 변경_여부() {
            when(overrides.findAll()).thenReturn(List.of(SysConfig.of("ui.excel.max-rows", "50000")));

            assertThat(query(new Condition("overridden", Op.eq, "Y")).content())
                    .extracting(ConfigRow::cfgKey)
                    .containsExactly("ui.excel.max-rows");
            assertThat(query(new Condition("overridden", Op.eq, "N")).content()).hasSize(3);
        }

        @Test
        @DisplayName("모르는 필드는 400 이다 — 조용히 무시하면 화면의 오타가 안 걸린다")
        void 모르는_필드() {
            assertThatThrownBy(() -> query(new Condition("nope", Op.eq, "x")))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("문자열 비교가 아닌 연산자는 400 이다")
        void 못_쓰는_연산자() {
            assertThatThrownBy(() -> query(new Condition("keyword", Op.gt, "x")))
                    .isInstanceOf(BusinessException.class);
        }
    }

    @Nested
    @DisplayName("정렬과 페이징")
    class SortAndPage {

        @Test
        @DisplayName("기본은 키 오름차순이다")
        void 기본_정렬() {
            assertThat(query().content()).extracting(ConfigRow::cfgKey).isSorted();
        }

        @Test
        @DisplayName("키 내림차순을 연다")
        void 내림차순() {
            var request = new SearchRequest<Void>(
                    List.of(),
                    List.of(new SortSpec("cfgKey", SortDir.desc)),
                    new PageSpec(0, 100, null),
                    null);

            assertThat(service.getList(request).content().getFirst().cfgKey())
                    .isEqualTo("ui.excel.max-rows");
        }

        @Test
        @DisplayName("값으로는 정렬하지 않는다 — 열지 않은 필드는 400 이다")
        void 값_정렬은_막는다() {
            var request = new SearchRequest<Void>(
                    List.of(),
                    List.of(new SortSpec("cfgVal", SortDir.asc)),
                    new PageSpec(0, 100, null),
                    null);

            assertThatThrownBy(() -> service.getList(request)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("페이지를 자른다 — 총 건수는 자르기 전의 것이다")
        void 페이징() {
            var request = new SearchRequest<Void>(List.of(), List.of(), new PageSpec(1, 3, null), null);
            var page = service.getList(request);

            assertThat(page.content()).hasSize(1);
            assertThat(page.totalElements()).isEqualTo(4);
            assertThat(page.hasNext()).isFalse();
        }

        @Test
        @DisplayName("범위를 넘는 페이지는 빈 목록이다 — 예외가 아니다")
        void 넘는_페이지() {
            var request = new SearchRequest<Void>(List.of(), List.of(), new PageSpec(9, 100, null), null);

            assertThat(service.getList(request).content()).isEmpty();
        }
    }

    @Nested
    @DisplayName("접두사 목록")
    class Prefixes {

        /**
         * <b>관리하지 않는다</b>(screen/config/requirements.md). 전 키에서 마디 단위로 도출하므로 키를 하나 더하면
         * 그 접두사가 저절로 선다 — 목록으로 두면 <b>관리하는 순간 어긋난다</b>.
         */
        @Test
        @DisplayName("마디마다 하나씩 나오고 자기 자신은 아니다")
        void 도출한다() {
            assertThat(service.prefixes())
                    .containsExactly("auth.", "auth.login.", "auth.password.", "auth.password.reset.", "ui.", "ui.excel.");
        }

        @Test
        @DisplayName("루트가 붙지 않는다 — 첫 마디가 전부 같으면 아무 정보가 없다")
        void 루트가_없다() {
            assertThat(service.prefixes()).noneMatch(prefix -> prefix.startsWith("sys-config."));
        }
    }
}
