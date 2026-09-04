package com.aiagent.core.search;

import java.util.ArrayList;
import java.util.List;

/**
 * {@code IN} 목록을 <b>DB 가 받아 주는 크기로 쪼갠다</b> — db-portability.md §4.6.
 *
 * <p><b>목록 길이에 한계가 있다.</b> 오라클은 {@code IN} 의 표현식을 <b>1000개</b>까지만
 * 받고 넘으면 {@code ORA-01795} 다. SQL Server 는 개수가 아니라 <b>바인드 파라미터
 * 2100개</b>가 한계이고, MySQL 은 개수 대신 <b>패킷 크기</b>({@code max_allowed_packet})로
 * 막는다 — 재는 자가 벤더마다 다르므로 <b>가장 낮은 것에 맞춘다</b>.
 *
 * <p><b>{@link #LIMIT} 가 1000 이 아니라 900 인 것이 요점이다.</b> 1000 은 오라클의 한계와
 * 같은 값이라 여유가 없다 — 조건이 하나 더 붙어 바인드가 늘거나, 판이 내부적으로 하나를
 * 더 쓰면 그 자리에서 깨진다. 100개의 여백이 그것을 산다.
 *
 * <p><b>왜 지금 필요한가.</b> {@link PageSpec#MAX_SIZE} 가 1000 이라 페이지 하나 분량은
 * 정확히 <b>경계 위</b>에 있다 — 지금은 통과하지만 상한을 한 칸만 올려도 오라클에서
 * 깨지고, 그 실패는 <b>오라클로 배포한 뒤에야</b> 나타난다.
 */
public final class InChunks {

    /** 한 번에 보낼 최대 개수. 오라클 1000 에서 여백 100 을 뺀 값이다. */
    public static final int LIMIT = 900;

    private InChunks() {}

    /**
     * 목록을 {@link #LIMIT} 이하의 조각으로 나눈다.
     *
     * <p>한계 이하면 <b>원본을 그대로 담은 조각 하나</b>다 — 복사하지 않는 것이 아니라
     * 조각이 하나라는 뜻이며, 부르는 쪽은 언제나 같은 모양(조각 목록)을 다룬다.
     */
    public static <T> List<List<T>> split(List<T> values) {
        if (values.size() <= LIMIT) {
            return List.of(values);
        }
        List<List<T>> chunks = new ArrayList<>((values.size() / LIMIT) + 1);
        for (int from = 0; from < values.size(); from += LIMIT) {
            chunks.add(values.subList(from, Math.min(from + LIMIT, values.size())));
        }
        return chunks;
    }
}
