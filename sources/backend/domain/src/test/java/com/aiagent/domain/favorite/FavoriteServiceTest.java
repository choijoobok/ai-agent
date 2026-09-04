package com.aiagent.domain.favorite;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.domain.favorite.entity.SysUserFavorite;
import com.aiagent.domain.favorite.repository.SysUserFavoriteRepository;
import com.aiagent.domain.favorite.service.FavoriteService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
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
 * 즐겨찾기 — UX-03 · 42 §7.
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

    private FavoriteService service;

    @BeforeEach
    void setUp() {
        service = new FavoriteService(favorites, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Nested
    @DisplayName("등록")
    class Add {

        @Test
        @DisplayName("이미 있으면 아무 일도 하지 않는다 — 결과가 같으므로 실패로 만들 이유가 없다")
        void ignoresDuplicate() {
            when(favorites.existsByUserIdAndMenuCd(USER, "MESSAGE_MGMT")).thenReturn(true);

            service.add(USER, "MESSAGE_MGMT");

            verify(favorites, never()).save(any());
        }

        @Test
        @DisplayName("맨 뒤에 붙는다 — 넣은 순서가 곧 순서다")
        void appendsToTheEnd() {
            when(favorites.existsByUserIdAndMenuCd(USER, "MESSAGE_MGMT")).thenReturn(false);
            when(favorites.findLastSortNo(USER)).thenReturn(3);

            service.add(USER, "MESSAGE_MGMT");

            ArgumentCaptor<SysUserFavorite> saved = ArgumentCaptor.forClass(SysUserFavorite.class);
            verify(favorites).save(saved.capture());
            assertThat(saved.getValue().getSortNo()).isEqualTo(4);
            assertThat(saved.getValue().getCreDtm()).isEqualTo(NOW);
        }
    }

}
