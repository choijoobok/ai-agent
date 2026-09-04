package com.ordinary.backoffice.domain.authz;

import java.time.LocalDate;
import java.util.List;

/**
 * 내 역할 — AUTHZ-04 · main-shell.md §8 의 <b>내 역할</b> 탭. <b>읽기 전용이다.</b>
 *
 * <p><b>있으면 권한 문의가 줄어든다</b>(main-shell.md §8). <i>"왜 이 메뉴가 안 보이나"</i> 를 스스로
 * 확인할 곳이 없으면 그 물음은 전부 관리자에게 간다.
 *
 * <p><b>유효 권한(메뉴×액션 집합)이 아니라 부여의 목록이다.</b> 둘은 다른 것이며 —
 * {@link EffectiveAuthority} 는 <i>무엇을 할 수 있는가</i>, 이것은 <i>그것이 어디서
 * 왔는가</i> 다. 문의에 답하는 것은 언제나 후자다: 역할이 꺼졌는지, 기간이 지났는지.
 *
 * <p><b>역할과 개인 예외를 한 목록으로 합치지 않는다.</b> 출처가 다르고 고치는 사람이
 * 다르며(역할은 역할 관리, 예외는 사용자별 부여), 합치면 <i>"이건 누구한테 말해야 하나"</i>
 * 가 사라진다(42 §6).
 *
 * @param businessToday 유효 판정의 기준일. 화면이 <b>왜 만료로 보이는지</b> 를 설명할 수
 *     있어야 한다 — 업무 시간대의 오늘이며 브라우저의 오늘이 아니다(40 §4.3).
 */
public record MyAuthority(
        List<MyRoleGrant> roles, List<MyMenuGrant> grants, LocalDate businessToday) {}
