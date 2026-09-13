package com.aiagent.domain.favorite;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.domain.favorite.entity.SysUserFavorite;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.authz.SysMenuFixture;
import com.aiagent.domain.favorite.repository.SysUserFavoriteRepository;
import com.aiagent.domain.favorite.service.FavoriteService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
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
 * 즐겨찾기 — UX-03 · sys/menu.md.
 *
 * <p>여기서 지키는 것 둘이다 — ① <b>이미 있으면 다시 넣지 않는다</b>, ② <b>맨 뒤에
 * 붙는다</b>.
 *
 * <p>①이 조용히 깨지는 종류다. 같은 메뉴가 두 줄이 되면 목록에 같은 이름이 둘 뜨고,
 * 하나를 지워도 하나가 남는다 — 사용자가 보기에 <i>지워지지 않는 즐겨찾기</i> 다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FavoriteServiceTest {

    private static final String USER = "kim";
    private static final Instant NOW = Instant.parse("2026-08-30T00:00:00Z");

    @Mock private SysUserFavoriteRepository favorites;
    @Mock private SysMenuRepository menus;

    private FavoriteService service;

    @BeforeEach
    void setUp() {
        service = new FavoriteService(favorites, menus, Clock.fixed(NOW, ZoneOffset.UTC));
        when(menus.existsById("MESSAGE_MGMT")).thenReturn(true);
    }

    @Test
    @DisplayName("TC-5101 동시 즐겨찾기 등록은 PostgreSQL 중복 무시 저장소 계약으로 성공한다")
    void exposesIdempotentInsertOperation() throws Exception {
        Query query =
                SysUserFavoriteRepository.class
                        .getDeclaredMethod(
                                "insertIfAbsent", String.class, String.class, int.class, Instant.class)
                        .getAnnotation(Query.class);

        assertThat(query).isNotNull();
        assertThat(query.value())
                .containsIgnoringCase("on conflict (user_id, menu_cd) do nothing");
    }

    @Nested
    @DisplayName("등록")
    class Add {

        @Test
        @DisplayName("이미 있으면 아무 일도 하지 않는다 — 결과가 같으므로 실패로 만들 이유가 없다")
        void ignoresDuplicate() {
            when(favorites.existsByUserIdAndMenuCd(USER, "MESSAGE_MGMT")).thenReturn(true);

            service.add(USER, "MESSAGE_MGMT");

            verify(favorites, never()).insertIfAbsent(any(), any(), anyInt(), any());
            verify(favorites, never()).save(any());
        }

        @Test
        @DisplayName("맨 뒤에 붙는다 — 넣은 순서가 곧 순서다")
        void appendsToTheEnd() {
            when(favorites.existsByUserIdAndMenuCd(USER, "MESSAGE_MGMT")).thenReturn(false);
            when(favorites.findLastSortNo(USER)).thenReturn(3);

            service.add(USER, "MESSAGE_MGMT");

            verify(favorites).insertIfAbsent(USER, "MESSAGE_MGMT", 4, NOW);
            verify(favorites, never()).save(any());
        }

        @Test
        @DisplayName("TC-5102 등록되지 않은 메뉴는 저장하지 않는다")
        void rejectsUnknownMenu() {
            assertThatThrownBy(() -> service.add(USER, "UNKNOWN"))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(CommonErrorCode.NOT_FOUND);

            verify(favorites, never()).save(any());
        }
    }

    @Test
    @DisplayName("목록은 저장 순서와 행 값을 그대로 돌려준다")
    void findsMyFavoritesInStoredOrder() {
        when(favorites.findByUserIdOrderBySortNoAsc(USER))
                .thenReturn(
                        List.of(
                                SysUserFavorite.created(USER, "MESSAGE_MGMT", 1, NOW),
                                SysUserFavorite.created(USER, "CODE_MGMT", 2, NOW)));
        when(menus.findAllById(List.of("MESSAGE_MGMT", "CODE_MGMT")))
                .thenReturn(
                        List.of(
                                SysMenuFixture.leaf("MESSAGE_MGMT", null, 1),
                                SysMenuFixture.leaf("CODE_MGMT", null, 2)));

        assertThat(service.findMine(USER))
                .containsExactly(
                        new FavoriteMenu("MESSAGE_MGMT", 1, NOW),
                        new FavoriteMenu("CODE_MGMT", 2, NOW));
    }

    @Test
    @DisplayName("TC-5103 고아 메뉴 즐겨찾기는 기능 목록에서 숨긴다")
    void hidesOrphanFavorites() {
        when(favorites.findByUserIdOrderBySortNoAsc(USER))
                .thenReturn(
                        List.of(
                                SysUserFavorite.created(USER, "MESSAGE_MGMT", 1, NOW),
                                SysUserFavorite.created(USER, "REMOVED", 2, NOW)));
        when(menus.findAllById(List.of("MESSAGE_MGMT", "REMOVED")))
                .thenReturn(
                        List.of(
                                SysMenuFixture.leaf("MESSAGE_MGMT", null, 1),
                                SysMenuFixture.orphanLeaf("REMOVED", null, 2)));

        assertThat(service.findMine(USER))
                .containsExactly(new FavoriteMenu("MESSAGE_MGMT", 1, NOW));
    }

    @Test
    @DisplayName("제거는 세션 사용자의 지정 메뉴 행만 삭제한다")
    void removesOnlyMyRequestedFavorite() {
        service.remove(USER, "MESSAGE_MGMT");

        verify(favorites).deleteByUserIdAndMenuCd(USER, "MESSAGE_MGMT");
    }

}
