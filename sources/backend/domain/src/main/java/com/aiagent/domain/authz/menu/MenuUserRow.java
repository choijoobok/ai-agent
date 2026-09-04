package com.aiagent.domain.authz.menu;

import com.aiagent.domain.authz.ActionType;
import java.time.LocalDate;
import java.util.List;

/**
 * 탭 2 — 이 메뉴를 쓸 수 있는 사용자(AUTHZ-13 · 62 §4.11).
 *
 * <p><b>사용자 하나가 여러 행일 수 있다.</b> 역할 둘로 같은 메뉴에 닿으면 <b>경유가 둘</b>
 * 이고, 그것이 이 탭이 답해야 하는 것이다 — <i>"이 사람이 왜 이 화면에 닿는가"</i>. 합쳐서
 * 한 행으로 내면 액션 합집합은 맞아도 <b>어느 역할을 회수해야 하는지</b> 를 잃는다.
 *
 * <p><b>역할 화면의 것과 API 를 공유하지 않는다</b>(62 §4.11). 62 §3.7 은 <i>"같은 그리드이면
 * 경로도 같아야 한다"</i> 고 했지만 <b>여기는 같은 그리드가 아니다</b> — 묻는 것이
 * <i>"이 역할을 가진 사람"</i> 에서 <i>"이 메뉴에 닿는 사람"</i> 으로 바뀌면 조인이 달라지고
 * (security-design.md §4) 열도 는다.
 *
 * @param via <b>역할명 또는 개인 예외</b> — security-design.md §4 의 메뉴→사용자 식이 두 갈래의 합집합이다.
 *     역할 경유면 그 역할의 이름이 들어오고, 개인 예외면 {@link #PERSONAL} 이 들어온다
 * @param roleId 경유가 역할일 때만 채운다. 화면이 <b>더블 클릭으로 그 역할을 열</b> 수
 *     있어야 하는데 이름만으로는 열 수 없다 — 개인 예외면 {@code null} 이다
 * @param accountUsable 계정이 <b>관리자가 정한 뜻으로</b> 살아 있는가({@code USE_YN} 과 계정
 *     유효기간). 잠금·휴면은 보지 않는다 — 41 §4.2 가 넷을 <b>축이 다르다</b> 고 갈랐고,
 *     뒤의 둘은 <b>일시적이고 스스로 풀린다</b>
 * @param actions 이 경유로 얻는 액션들. <b>합집합이 아니라 이 경유의 것</b>이다 — 합치는
 *     것은 유효 권한 계산의 일이고(security-design.md §4 ③) 이 탭이 하는 일은 <b>그 앞의 출처를 펴는 것</b>이다
 * @param validFromDt 부여 기간의 시작. 역할 부여는 <b>{@code null} 이 제한 없음</b>이고
 *     개인 예외는 {@code NOT NULL} 이다(42 §3.1) — 둘의 성질 차이가 그대로 드러난다
 * @param grantState 예정 · 유효 · 만료(42 §3.1). <b>기간에서 파생</b>하며 컬럼이 아니다 —
 *     만료 판정은 조회 시 계산이고 배치가 행을 비활성화하지 않는다
 */
public record MenuUserRow(
        String userId,
        String userNm,
        boolean accountUsable,
        String via,
        String roleId,
        List<ActionType> actions,
        GrantState grantState,
        LocalDate validFromDt,
        LocalDate validToDt) {

    /** 경유가 역할이 아닐 때의 값 — 화면이 문구로 바꾼다. */
    public static final String PERSONAL = "PERSONAL";

    /**
     * 부여가 <b>지금</b> 어디에 있는가 — 42 §3.1.
     *
     * <p>기간에서 파생한다. 컬럼으로 두면 배치가 그것을 갱신해야 하고, 배치가 실패한 동안
     * <b>화면과 판정이 갈린다</b> — 계정 잠금 자동 해제를 조회 시 계산으로 둔 것과 같은
     * 구조다(41 §4.2).
     */
    public enum GrantState {
        /** 시작 전 — <b>목록에 낸다.</b> 감추면 *"왜 아직 안 되나"* 에 답할 것이 없다. */
        SCHEDULED,
        /** 지금 유효하다 — 이 사람은 실제로 이 메뉴에 닿는다. */
        ACTIVE,
        /** 지났다 — 이 행이 있는데 안 되는 이유가 이것이다. */
        EXPIRED
    }
}
