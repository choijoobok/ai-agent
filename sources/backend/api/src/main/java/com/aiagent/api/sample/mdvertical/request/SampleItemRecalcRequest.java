package com.aiagent.api.sample.mdvertical.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 품목 금액 재계산 — 68 §5.4 의 실행 <b>둘 중 뒤</b>({@code target:'selected'} · 프로그레스
 * 있음 · <b>행×디테일</b>).
 *
 * <p>고른 주문들의 {@code ordId} 다. 문자열인 것은 {@code bigint} 어휘의 규약이며(frontend-stack.md §6.1),
 * <b>비어 있으면 400</b> 이다 — 대상 없는 실행은 화면이 이미 막지만 그것이 서버의 방어는
 * 아니다.
 *
 * <p><b>이름이 {@code targets} 다.</b> 그리드가 보내는 몸통은 <b>둘로 갈린 봉투</b>이며
 * (grid-api-contract.md §8) 그 바깥 이름은 고정이다 — {@code toTargets} 는 <i>모양만 바꾸는 자리</i>라 봉투의
 * 이름을 바꾸지 못한다. 어긋나면 {@code @NotEmpty} 에 걸려 <b>400</b> 이 나고 화면에는
 * <i>입력값을 확인하세요</i> 만 뜬다 — 고른 행이 분명히 있는데. 이 화면의 출고 지시가
 * 실제로 그 상태였다({@code SampleShipRequest} 의 주석).
 *
 * <p><b>{@code params} 를 선언하지 않는다.</b> 이 실행에는 사람이 주는 값이 없다 — 세율은
 * 이 자리의 것이 아니고(그것은 ①의 일괄 재계산이다) 다시 세는 기준은 <b>품목이 이미
 * 들고 있는</b> 수량과 단가다. 읽지 않는 칸을 선언하면 서버가 그것을 쓴다고 말하는 셈이다.
 *
 * <p><b>상한이 1,000 이다.</b> 주문 하나에 품목이 수천 건일 수 있으므로 이 숫자는
 * <i>대상 행</i> 의 상한이지 일의 크기가 아니다 — 진행률이 있는 이유가 그것이다.
 */
public record SampleItemRecalcRequest(@NotEmpty @Size(max = 1000) List<String> targets) {}
