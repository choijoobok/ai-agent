package com.ordinary.backoffice.domain.authz;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * {@code X-Authz-Version} — 50 §8.1.
 *
 * <p>이 값이 틀리는 방향은 둘이고 <b>비용이 다르다</b>. 같아야 하는데 다르면 프론트가 헛
 * 재조회를 돌고(성능), <b>달라야 하는데 같으면 회수된 권한의 메뉴가 화면에 남는다</b>(오답).
 * 그래서 아래 테스트는 후자 쪽에 더 무겁다.
 */
class EffectiveAuthorityVersionTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 8, 29);

    @Test
    @DisplayName("같은 집합이면 같다 — 순서가 달라도 같아야 한다")
    void sameSetSameVersion() {
        // Set 의 순회 순서는 구현에 달렸다. 정렬 없이 이어 붙이면 같은 권한에 다른 버전이 난다.
        EffectiveAuthority one = authority(
                new MenuAction("USER_MGMT", ActionType.READ),
                new MenuAction("ORDER", ActionType.SAVE));
        EffectiveAuthority other = authority(
                new MenuAction("ORDER", ActionType.SAVE),
                new MenuAction("USER_MGMT", ActionType.READ));

        assertThat(one.version()).isEqualTo(other.version());
    }

    @Test
    @DisplayName("계산 날짜가 달라도 같다 — 버전이 세는 것은 권한이지 시점이 아니다")
    void calcDateDoesNotAffectVersion() {
        Set<MenuAction> grants = Set.of(new MenuAction("ORDER", ActionType.READ));

        assertThat(new EffectiveAuthority(grants, TODAY).version())
                .isEqualTo(new EffectiveAuthority(grants, TODAY.plusDays(1)).version());
    }

    @Test
    @DisplayName("액션 하나가 늘면 달라진다")
    void addedActionChangesVersion() {
        EffectiveAuthority before = authority(new MenuAction("ORDER", ActionType.READ));
        EffectiveAuthority after = authority(
                new MenuAction("ORDER", ActionType.READ), new MenuAction("ORDER", ActionType.SAVE));

        assertThat(before.version()).isNotEqualTo(after.version());
    }

    @Test
    @DisplayName("쌍이 옮겨 가면 달라진다 — 개수가 같다고 같은 권한이 아니다")
    void movedPairChangesVersion() {
        // (A,READ)+(B,SAVE) 와 (A,SAVE)+(B,READ) 는 토큰 개수도 메뉴 집합도 액션 집합도 같다.
        // 구분 단위가 쌍이 아니면 이 둘이 같은 버전을 갖는다 — security-design.md §4 의 곱집합 실수와 같은 모양이다.
        EffectiveAuthority one = authority(
                new MenuAction("A", ActionType.READ), new MenuAction("B", ActionType.SAVE));
        EffectiveAuthority other = authority(
                new MenuAction("A", ActionType.SAVE), new MenuAction("B", ActionType.READ));

        assertThat(one.version()).isNotEqualTo(other.version());
    }

    @Test
    @DisplayName("경계가 없으면 다른 집합이 같은 문자열로 접힌다")
    void tokensAreDelimited() {
        // "AB:READ" 하나와 "A" + "B:READ" 는 이어 붙이면 같아진다. 구분자가 그것을 막는다.
        EffectiveAuthority one = authority(new MenuAction("AB", ActionType.READ));
        EffectiveAuthority other = authority(
                new MenuAction("A", ActionType.READ), new MenuAction("B", ActionType.READ));

        assertThat(one.version()).isNotEqualTo(other.version());
    }

    @Test
    @DisplayName("뺐다가 되돌리면 같다 — 결과가 같으므로 다시 받을 이유도 없다")
    void revertedChangeIsNotDetected() {
        // 단조 증가 카운터로 두면 이 경우에 헛 재조회가 생긴다(50 §8.1).
        EffectiveAuthority before = authority(new MenuAction("ORDER", ActionType.READ));
        EffectiveAuthority reverted = authority(new MenuAction("ORDER", ActionType.READ));

        assertThat(before.version()).isEqualTo(reverted.version());
    }

    @Test
    @DisplayName("헤더에 실릴 만큼 짧고 16진수다")
    void versionIsShortHex() {
        assertThat(authority(new MenuAction("ORDER", ActionType.READ)).version())
                .hasSize(16)
                .matches("[0-9a-f]+");
    }

    @Test
    @DisplayName("공집합에도 버전이 있다 — null 을 내면 프론트가 '헤더 없음' 과 구분하지 못한다")
    void emptyAuthorityHasVersion() {
        assertThat(new EffectiveAuthority(Set.of(), TODAY).version()).isNotBlank();
    }

    private static EffectiveAuthority authority(MenuAction... grants) {
        return new EffectiveAuthority(new LinkedHashSet<>(List.of(grants)), TODAY);
    }
}
