package com.aiagent.domain.user.admin;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 사용자 관리 마스터의 한 행 — screen/user/requirements.md. <b>목록이 곧 상세다.</b>
 *
 * <p>편집 폼을 없애면서(frontend/grid.md) 이 행이 {@code SYS_USER} 의 모든 컬럼을 갖게 됐다 —
 * 숨김 컬럼도 응답에는 들어 있고 그리드 설정에서 켜면 보인다(frontend/grid.md). 그래서 {@code getDetail}
 * 이 없다: 행을 골라 다시 조회할 것이 없고, 탭이 부르는 것은 {@code SYS_USER} <b>밖</b>의
 * 데이터뿐이다(screen/user/requirements.md).
 *
 * <h2>비밀번호가 없다</h2>
 *
 * <p>해시조차 내리지 않는다. 관리자는 임시 비밀번호를 <b>발급</b>할 뿐 값을 정하지 않으며
 * (backend/security.md · AUTH-07), 응답에 담기는 순간 그것은 <b>화면에 없어도 브라우저에 있는 값</b>이 된다.
 * 대신 {@link #pwdInitYn} 과 {@link #pwdChgDtm} 이 <i>지금 어떤 상태인가</i> 를 말한다.
 *
 * @param accountStat 파생 하나 — 체인 순서로 먼저 걸린 것이다({@link AccountStat}). 원본 넷은
 * 아래에 각각 있고 화면에서 기본 숨김이다(screen/user/requirements.md)
 * @param lockYn 시스템이 건다 — <b>셀이 읽기 전용</b>이고 푸는 것은 ①의 잠금 해제다(screen/user/requirements.md)
 * @param loginFailCnt 잠금 직전 진단용. 〃
 * @param dormantYn 배치가 건다. <b>푸는 수단은 ①의 휴면 해제이거나 본인 재설정</b>이다(sys/user-role.md)
 * @param pwdInitYn 발급 후 미변경(AUTH-06) — 임시 비밀번호가 그대로 남아 있다는 뜻이다
 */
public record UserRow(
        String userId,
        String userNm,
        String email,
        AccountStat accountStat,
        Boolean useYn,
        LocalDate validFromDt,
        LocalDate validToDt,
        Instant lastLoginDtm,
        String localeCd,
        Boolean lockYn,
        Instant lockDtm,
        Integer loginFailCnt,
        Boolean dormantYn,
        Boolean pwdInitYn,
        Instant pwdChgDtm,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
