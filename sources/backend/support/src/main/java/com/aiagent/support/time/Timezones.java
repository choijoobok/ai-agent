package com.aiagent.support.time;

import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * 시간대 후보와 판정 — screen/batch/schedule/requirements.md §4-1.
 *
 * <h2>후보를 좁히지 않는다</h2>
 *
 * <p>{@link ZoneId#getAvailableZoneIds()} 를 그대로 쓴다. 자주 쓰는 것만 골라 두면
 * <b>고객사가 바뀔 때마다 소스를 고쳐야</b> 하고, 그것이 이 프로젝트에서 가장 자주 배탈나는
 * 종류다. 600개는 화면의 검색이 감당한다.
 *
 * <h2>고정 오프셋은 시간대가 아니다</h2>
 *
 * <p>{@code ZoneId.of("+09:00")} 은 성공하지만 그것은 <b>서머타임이 없는 값</b>이다.
 * 배치 시간대의 목적이 <i>현지 시각을 유지하는 것</i> 이므로, 고정 오프셋을 허용하면
 * <b>그 목적을 조용히 깬 값</b>이 저장된다. 그래서 판정은 <i>파싱되나</i> 가 아니라
 * <b>아는 이름인가</b> 다.
 *
 * <h2>업무 시간대 하나만 맨 위로</h2>
 *
 * <p>그 값이 신규 행의 기본값이라 가장 자주 고른다. 여럿을 올리면 <i>왜 이것들인가</i> 를
 * 유지해야 하고 그 판단이 고객사마다 달라진다. <b>올린 값은 목록 안 제자리에도 남긴다</b> —
 * 빼면 알파벳 순으로 찾는 사람이 그 자리에서 못 찾는다.
 */
public final class Timezones {

    private static final Set<String> KNOWN = Set.copyOf(ZoneId.getAvailableZoneIds());

    private Timezones() {}

    /** 아는 시간대 이름인가 — {@code null} · 빈 문자열 · 고정 오프셋은 아니다. */
    public static boolean isKnown(String zone) {
        return zone != null && KNOWN.contains(zone);
    }

    /** 화면에 내리는 후보 — <b>업무 시간대가 맨 위, 나머지는 오름차순</b>. */
    public static List<String> candidates(ZoneId businessZone) {
        List<String> sorted = new ArrayList<>(KNOWN);
        sorted.sort(null);

        List<String> out = new ArrayList<>(sorted.size() + 1);
        String pinned = businessZone.getId();
        if (KNOWN.contains(pinned)) {
            out.add(pinned);
        }
        out.addAll(sorted);
        return List.copyOf(out);
    }
}
