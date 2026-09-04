package com.aiagent.core.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * {@code IN} 목록 쪼개기 — backend/persistence.md.
 *
 * <p><b>이 실패는 오라클로 배포한 뒤에야 나타난다.</b> PostgreSQL·MySQL 로 개발하는 동안에는
 * 목록이 아무리 길어도 통과하고, 같은 코드가 오라클에서 {@code ORA-01795} 로 죽는다 —
 * 그래서 벤더 없이 재는 자리가 필요하다.
 */
class InChunksTest {

    private static List<Integer> range(int size) {
        return IntStream.range(0, size).boxed().toList();
    }

    @Test
    @DisplayName("한계 이하면 조각이 하나다 — 짧은 목록에 질의를 더 만들지 않는다")
    void keepsShortListWhole() {
        assertThat(InChunks.split(range(InChunks.LIMIT))).hasSize(1);
    }

    @Test
    @DisplayName("한계를 하나 넘으면 둘로 나뉜다 — 경계가 곧 실패 지점이다")
    void splitsJustOverTheLimit() {
        List<List<Integer>> chunks = InChunks.split(range(InChunks.LIMIT + 1));

        assertThat(chunks).hasSize(2);
        assertThat(chunks.get(0)).hasSize(InChunks.LIMIT);
        assertThat(chunks.get(1)).hasSize(1);
    }

    /**
     * <b>여백이 요점이다.</b> 1000 은 오라클의 한계와 <i>같은</i> 값이라 조건이 하나 더
     * 붙거나 판이 바인드를 하나 더 쓰면 그 자리에서 깨진다.
     */
    @Test
    @DisplayName("조각이 오라클의 1000 아래에 있다 — 같은 값이면 여유가 없다")
    void staysBelowOracleLimit() {
        assertThat(InChunks.LIMIT).isLessThan(1000);

        for (List<Integer> chunk : InChunks.split(range(5_000))) {
            assertThat(chunk).hasSizeLessThan(1000);
        }
    }

    @Test
    @DisplayName("나눠도 원소는 하나도 잃지 않는다 — 빠진 키는 값이 빈 행으로 보인다")
    void keepsEveryElement() {
        List<Integer> all = range(2_345);

        assertThat(InChunks.split(all).stream().flatMap(List::stream).toList()).isEqualTo(all);
    }

    @Test
    @DisplayName("빈 목록은 빈 조각 하나다 — 부르는 쪽이 조각 목록 하나만 다루면 된다")
    void keepsEmptyShapeStable() {
        assertThat(InChunks.split(List.of())).containsExactly(List.of());
    }
}
