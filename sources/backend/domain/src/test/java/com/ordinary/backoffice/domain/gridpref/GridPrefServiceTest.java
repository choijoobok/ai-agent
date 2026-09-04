package com.ordinary.backoffice.domain.gridpref;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ordinary.backoffice.domain.gridpref.entity.SysUserGridPref;
import com.ordinary.backoffice.domain.gridpref.repository.SysUserGridPrefRepository;
import com.ordinary.backoffice.domain.gridpref.service.GridPrefService;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * 그리드 개인화 — UX-06 · UX-13 · grid-standard.md §5.
 *
 * <p><b>시그니처 판정이 전부다.</b> 어긋난 설정을 그대로 내려 주면 <i>없어진 컬럼이 숨김
 * 목록에 남고 새 컬럼은 순서 없이 끼는</i> 상태가 되며, 사용자가 겪는 것은 *"설정이
 * 이상하다"* 인데 <b>원인을 짐작할 수 없다.</b>
 *
 * <p>조용히 깨지는 종류다 — 어긋나도 저장은 성공하고 화면도 그려진다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GridPrefServiceTest {

    private static final String USER = "kim";
    private static final String MENU = "MESSAGE_MGMT";
    private static final String GRID = "main";

    @Mock private SysUserGridPrefRepository preferences;

    private GridPrefService service;

    @BeforeEach
    void setUp() {
        service = new GridPrefService(preferences);
        when(preferences.findByUserIdAndMenuCdAndGridId(any(), any(), any()))
                .thenReturn(Optional.empty());
    }

    private void stored(String signature) {
        when(preferences.findByUserIdAndMenuCdAndGridId(USER, MENU, GRID))
                .thenReturn(Optional.of(
                        SysUserGridPref.created(USER, MENU, GRID, "{}", signature)));
    }

    @Test
    @DisplayName("시그니처가 같으면 그대로 돌려준다")
    void returnsWhenSignatureMatches() {
        stored("abc");

        assertThat(service.find(USER, MENU, GRID, "abc")).isEqualTo(new GridPref("{}"));
        verify(preferences, never()).delete(any());
    }

    @Test
    @DisplayName("시그니처가 다르면 없다고 답하고 그 행을 지운다 — 살려 두면 다른 기기에서 다시 읽힌다")
    void discardsWhenSignatureDiffers() {
        stored("abc");

        assertThat(service.find(USER, MENU, GRID, "xyz")).isNull();
        // 다음 저장 때까지 맞지 않는 설정을 DB 에 남기지 않는다(UX-13).
        verify(preferences).delete(any());
    }

    @Test
    @DisplayName("저장된 것이 없으면 null 이다 — 지울 것도 없다")
    void returnsNullWhenAbsent() {
        assertThat(service.find(USER, MENU, GRID, "abc")).isNull();
        verify(preferences, never()).delete(any());
    }

    @Test
    @DisplayName("같은 자리에 덮어쓴다 — 개인 설정에 이력을 두지 않는다")
    void overwritesInPlace() {
        stored("old");

        service.save(USER, MENU, GRID, "{\"a\":1}", "new");

        verify(preferences, never()).save(any());
        assertThat(service.find(USER, MENU, GRID, "new")).isEqualTo(new GridPref("{\"a\":1}"));
    }

    @Test
    @DisplayName("초기화는 행을 지운다 — 지금의 기본값을 굳혀 저장하지 않는다")
    void resetDeletes() {
        service.reset(USER, MENU, GRID);

        // 기본값은 화면 선언이고 배포마다 바뀔 수 있다 — 굳히면 *초기화했는데 옛 기본값* 이다.
        verify(preferences).deleteByUserIdAndMenuCdAndGridId(USER, MENU, GRID);
        verify(preferences, never()).save(any());
    }
}
