package com.aiagent.domain.menustat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.domain.authz.SysMenuFixture;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.menustat.entity.SysUserMenuStat;
import com.aiagent.domain.menustat.repository.SysUserMenuStatRepository;
import com.aiagent.domain.menustat.service.MenuStatService;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.MenuStatProps;
import com.aiagent.support.time.BusinessCalendar;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * 자주 쓰는 메뉴 — UX-16 · sys/menu.md.
 *
 * <p>여기서 지키는 것 둘이다 — ① <b>같은 달은 한 행이다</b>(카운트만 오르고 행은 늘지
 * 않는다), ② <b>창은 이번 달 포함 N개월</b>이다.
 *
 * <p>②가 조용히 깨지는 종류다. 경계를 하나 잘못 잡으면 3개월이 2개월이 되고, 그 차이는
 * <b>월이 바뀌는 날</b>에만 드러난다 — 목록이 갑자기 짧아지는데 아무 오류도 없다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MenuStatServiceTest {

    private static final String USER = "kim";
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    @Mock private SysUserMenuStatRepository stats;
    @Mock private SysMenuRepository menus;
    @Mock private ConfigLookup configs;

    private MenuStatService service;

    @Test
    @DisplayName("TC-5103 메뉴가 삭제되면 메뉴 통계도 정리할 수 있는 저장소 계약이 있다")
    void exposesMenuCleanupOperation() throws Exception {
        assertThat(SysUserMenuStatRepository.class.getDeclaredMethod("deleteByMenuCd", String.class))
                .isNotNull();
    }

    @BeforeEach
    void setUp() {
        // 2026-08-30 09:00 KST — 8월 버킷이다.
        Clock fixed = Clock.fixed(Instant.parse("2026-08-30T00:00:00Z"), SEOUL);
        service = new MenuStatService(stats, menus, configs, new BusinessCalendar("Asia/Seoul", fixed));
        when(configs.get(MenuStatProps.class)).thenReturn(new MenuStatProps(3, 10));
    }

    @Nested
    @DisplayName("세기")
    class Record {

        @Test
        @DisplayName("이번 달 행이 있으면 카운트만 올린다 — 같은 행을 한 달 내내 갱신한다")
        void countsExistingBucket() {
            SysUserMenuStat bucket =
                    SysUserMenuStat.first(USER, "MESSAGE_MGMT", "202608", Instant.EPOCH);
            when(menus.findById("MESSAGE_MGMT"))
                    .thenReturn(Optional.of(SysMenuFixture.leaf("MESSAGE_MGMT", null, 1)));
            when(stats.findByUserIdAndMenuCdAndStatYm(USER, "MESSAGE_MGMT", "202608"))
                    .thenReturn(Optional.of(bucket));

            service.record(USER, "MESSAGE_MGMT");

            assertThat(bucket.getUseCnt()).isEqualTo(2);
            verify(stats, never()).save(any());
        }

        @Test
        @DisplayName("없으면 이번 달 버킷을 만든다 — 업무 시간대의 달이다")
        void createsThisMonthBucket() {
            when(menus.findById("MESSAGE_MGMT"))
                    .thenReturn(Optional.of(SysMenuFixture.leaf("MESSAGE_MGMT", null, 1)));
            when(stats.findByUserIdAndMenuCdAndStatYm(USER, "MESSAGE_MGMT", "202608"))
                    .thenReturn(Optional.empty());

            service.record(USER, "MESSAGE_MGMT");

            ArgumentCaptor<SysUserMenuStat> saved =
                    ArgumentCaptor.forClass(SysUserMenuStat.class);
            verify(stats).save(saved.capture());
            assertThat(saved.getValue().getStatYm()).isEqualTo("202608");
            assertThat(saved.getValue().getUseCnt()).isEqualTo(1);
        }

        @Test
        @DisplayName("TC-5103 고아 메뉴 선택은 이전 세션에서도 새 통계를 만들지 않는다")
        void ignoresOrphanMenu() {
            when(menus.findById("REMOVED"))
                    .thenReturn(Optional.of(SysMenuFixture.orphanLeaf("REMOVED", null, 1)));

            service.record(USER, "REMOVED");

            verify(stats, never()).findByUserIdAndMenuCdAndStatYm(any(), any(), any());
            verify(stats, never()).save(any());
        }
    }

    @Nested
    @DisplayName("창")
    class Window {

        /**
         * <b>이번 달을 포함해서</b> 3개월이다. 포함을 빠뜨리면 창이 4개월이 되고, 그것은
         * *"3개월"* 이라고 적힌 설정과 어긋난 채 아무도 모른다.
         */
        @Test
        @DisplayName("3개월이면 이번 달 포함 두 달 전부터다 — 202608 이면 202606")
        void includesThisMonth() {
            when(stats.findTop(eq(USER), any(), any())).thenReturn(List.of());

            service.findMine(USER);

            ArgumentCaptor<String> fromYm = ArgumentCaptor.forClass(String.class);
            verify(stats).findTop(eq(USER), fromYm.capture(), any());
            assertThat(fromYm.getValue()).isEqualTo("202606");
        }

        /**
         * <b>기간을 함께 낸다.</b> 목록만으로는 <i>"무엇을 기준으로 자주인가"</i> 를 알 수
         * 없고, 창은 설정값이라 화면이 짐작하면 서버와 어긋난다.
         */
        @Test
        @DisplayName("창의 시작 달을 목록과 함께 낸다 — 화면이 짐작하지 않게")
        void tellsTheWindow() {
            when(stats.findTop(eq(USER), any(), any())).thenReturn(List.of());

            assertThat(service.findMine(USER).fromYm()).isEqualTo("202606");
        }

        @Test
        @DisplayName("합계를 그대로 낸다 — 이번 달만의 값이 아니다")
        void sumsTheWindow() {
            when(stats.findTop(eq(USER), any(), any()))
                    .thenReturn(List.<Object[]>of(new Object[] {"MESSAGE_MGMT", 7L, Instant.EPOCH}));
            when(menus.findAllById(List.of("MESSAGE_MGMT")))
                    .thenReturn(List.of(SysMenuFixture.leaf("MESSAGE_MGMT", null, 1)));

            FrequentMenus found = service.findMine(USER);

            assertThat(found.menus()).containsExactly(new FrequentMenu("MESSAGE_MGMT", 7));
        }

        @Test
        @DisplayName("TC-5103 고아 메뉴 사용 통계는 기능 목록에서 숨긴다")
        void hidesOrphanFrequentMenu() {
            when(stats.findTop(eq(USER), any(), any()))
                    .thenReturn(
                            List.<Object[]>of(
                                    new Object[] {"MESSAGE_MGMT", 7L, Instant.EPOCH},
                                    new Object[] {"REMOVED", 9L, Instant.EPOCH}));
            when(menus.findAllById(List.of("MESSAGE_MGMT", "REMOVED")))
                    .thenReturn(
                            List.of(
                                    SysMenuFixture.leaf("MESSAGE_MGMT", null, 1),
                                    SysMenuFixture.orphanLeaf("REMOVED", null, 2)));

            assertThat(service.findMine(USER).menus())
                    .containsExactly(new FrequentMenu("MESSAGE_MGMT", 7));
        }

        @Test
        @DisplayName("해가 바뀌는 경계도 문자열로 센다 — 202601 이면 202511")
        void crossesTheYear() {
            Clock january = Clock.fixed(Instant.parse("2026-01-05T00:00:00Z"), SEOUL);
            MenuStatService inJanuary =
                    new MenuStatService(stats, menus, configs, new BusinessCalendar("Asia/Seoul", january));
            when(stats.findTop(eq(USER), any(), any())).thenReturn(List.of());

            inJanuary.findMine(USER);

            ArgumentCaptor<String> fromYm = ArgumentCaptor.forClass(String.class);
            verify(stats).findTop(eq(USER), fromYm.capture(), any());
            assertThat(fromYm.getValue()).isEqualTo("202511");
        }
    }
}
