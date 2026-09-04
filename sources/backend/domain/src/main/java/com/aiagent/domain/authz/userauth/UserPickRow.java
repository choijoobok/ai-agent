package com.aiagent.domain.authz.userauth;

import com.aiagent.domain.user.admin.AccountStat;

/**
 * 좌 pane 의 한 행 — screen/user/requirements.md. <b>고르기만 한다.</b>
 *
 * <p>{@code ROLE_AUTH_MGMT} 의 {@code RolePickRow} 와 같은 자리다(screen/menu/requirements.md) — 읽기 전용이고
 * 행을 추가할 수 없다. 계정 생성은 {@code USER_MGMT} 의 일이므로 <b>이 화면에는 미저장
 * 신규 부모가 생길 수 없고</b>, 그래서 frontend/grid.md 의 상태 셋 중 <i>잠긴 상태</i> 가 없다
 * (screen/user/requirements.md).
 *
 * <h2>계정 상태를 함께 내는 이유</h2>
 *
 * <p>권한을 주려는 사람이 <b>그 계정이 지금 살아 있는지</b> 를 알아야 한다. screen/user/requirements.md 이
 * 유효 권한 탭을 {@code USER_MGMT} 에 둔 근거와 같다 — backend/security.md 가 요구한 <i>"권한은 있으나
 * 로그인할 수 없는 사용자"</i> 의 구분이 <b>화면 이동 없이</b> 되어야 한다.
 *
 * <p>여기서는 그것이 더 직접적이다: 미사용 계정에 개인 예외를 열심히 주고 나서 <i>왜 안
 * 되나</i> 를 묻는 일을 <b>부여하는 자리에서</b> 막는다.
 *
 * <p><b>{@link AccountStat} 을 {@code USER_MGMT} 와 공유한다.</b> 접근 제어 체인 순서로 먼저
 * 걸린 것 하나라는 규칙이 화면마다 갈리면, 같은 계정이 두 화면에서 다른 상태로 보인다.
 *
 * <h2>유효 예외 건수를 함께 내는 이유</h2>
 *
 * <p><b>고를 사람을 좁히는 것이 이 목록의 일</b>인데, 예외가 있는 사람과 없는 사람이
 * 목록에서 <b>구분되지 않았다</b> — 누구에게 이미 예외가 있는지 알려면 <i>한 사람씩 골라
 * 트리를 읽어야</i> 했다. screen/user/requirements.md 가 <i>역할 신설을 검토하세요</i> 배너를 둔 것과 같은
 * 축이다: 예외가 몇 개인가는 <b>운영이 봐야 하는 수</b>다.
 *
 * <p><b>조회조건이 되지는 않는다</b>(screen/user/requirements.md — 부여 상태를 조건에서 뺐다). 거르면 <i>예외가
 * 없는 사람에게 처음 주는</i> 동선이 막히므로, <b>컬럼으로만</b> 낸다.
 *
 * @param activeGrantCnt <b>지금 유효한</b> 개인 예외의 건수 — 기간이 오늘을 품은 행을 센다.
 *     예정·만료는 세지 않는다: 하단 그리드의 <i>상태</i> 컬럼과 <b>같은 규칙</b>이어야
 * 화면에서 눈으로 센 수와 이 수가 맞는다(screen/user/requirements.md)
 */
public record UserPickRow(
        String userId, String userNm, AccountStat accountStat, long activeGrantCnt) {}
