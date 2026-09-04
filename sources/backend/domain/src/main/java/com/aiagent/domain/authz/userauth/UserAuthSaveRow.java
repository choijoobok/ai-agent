package com.aiagent.domain.authz.userauth;

import com.aiagent.core.grid.RowState;
import com.aiagent.domain.authz.ActionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * 개인 예외 저장의 한 행 — screen/user/requirements.md · frontend/grid.md.
 *
 * <h2>{@code RoleAuthGrant} 와 모양이 다르다 — 그것이 두 화면의 차이 전부다</h2>
 *
 * <p>역할 쪽은 <b>{@code rowState} 가 없고 켜진 스위치 전부</b>를 보낸다(screen/menu/requirements.md). 권한이
 * 있거나 없거나 둘뿐이라 <i>수정</i> 이 존재하지 않기 때문이다.
 *
 * <p>여기는 <b>수정이 있다.</b> 기간과 사유가 붙으므로 같은 {@code (사용자, 메뉴, 액션)} 의
 * 값이 바뀔 수 있고, 그래서 <b>행 상태를 싣는다</b> — screen/user/requirements.md 가 <i>"목록이 원본이고 트리는
 * 그 투영"</i> 이라고 한 것의 와이어 쪽 모습이다.
 *
 * <table>
 *   <tr><td>{@code C}</td><td>새 부여 — 트리에서 <b>꺼진 칸</b>을 켰다</td></tr>
 * <tr><td>{@code U}</td><td>기간·사유 변경. <b>회수도 이것</b>이다 — 종료일을 어제로 한다(screen/user/requirements.md)</td></tr>
 *   <tr><td>{@code D}</td><td><b>잘못 등록한 행 정리</b>뿐이다 — 회수가 아니다</td></tr>
 * </table>
 *
 * <p><b>회수가 {@code D} 가 아닌 이유는 사유가 사라지기 때문</b>이다(screen/user/requirements.md). 변경 이력
 * 테이블을 두지 않았으므로(sys/logs.md) <i>"누구에게 왜 무엇을 언제까지 줬는가"</i> 를 남기는
 * 것이 이 행뿐이다 — 종료일을 어제로 하면 그 기록이 남는다.
 *
 * @param validFromDt {@code D} 에서는 무시한다. 나머지 둘에서는 <b>필수</b>다 —
 * {@code NOT NULL} 이고(sys/menu.md) 무기한이라는 선택지가 없다
 * @param grantRsn 〃. <b>감사 대응</b>이며 부여 작업 단위로 받아 선택 행 전체에 복사한다
 * (backend/security.md) — 화면이 그렇게 채워 보낸다
 */
public record UserAuthSaveRow(
        @NotNull RowState rowState,
        @NotBlank @Size(max = 30) String menuCd,
        @NotNull ActionType actionCd,
        LocalDate validFromDt,
        LocalDate validToDt,
        @Size(max = 500) String grantRsn) {}
