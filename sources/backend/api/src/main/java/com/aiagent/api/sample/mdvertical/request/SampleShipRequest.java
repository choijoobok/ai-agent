package com.aiagent.api.sample.mdvertical.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 출고 지시 — 68 §5.4 의 실행 액션(<b>프로그레스 없음</b>).
 *
 * <p>고른 행들의 {@code ordId} 다. 문자열인 것은 {@code bigint} 어휘의 규약이며(frontend-stack.md §6.1),
 * <b>비어 있으면 400</b> 이다 — 대상 없는 실행은 화면이 이미 막지만 그것이 서버의
 * 방어는 아니다.
 *
 * <h2>이름이 {@code targets} 다 (2026-09-02 — 두 번째로 같은 것을 고쳤다)</h2>
 *
 * <p><b>{@code ordIds} 였고, 그래서 이 실행은 한 번도 서버에 닿은 적이 없었다.</b> 그리드가
 * 보내는 몸통은 <b>둘로 갈린 봉투</b>이며(grid-api-contract.md §8) 그 바깥 이름은 {@code targets} 로
 * 고정이다 — 화면이 {@code toTargets} 로 {@code {ordIds: [...]}} 를 만들어도 그것은
 * <b>봉투 안</b>에 들어가므로 서버가 보는 몸통은 {@code {"targets":{"ordIds":[…]}}} 다.
 * 그러면 이 칸은 {@code null} 이고 {@code @NotEmpty} 가 <b>400</b> 을 내며, 화면에는
 * <i>입력값을 확인하세요</i> 만 뜬다 — 고른 행이 분명히 있는데.
 *
 * <p><b>①에서 같은 것을 고친 날 이 화면은 빠졌다</b>({@code SampleConfirmRequest} 의 주석 —
 * 그날 <i>"다른 화면들은 처음부터 이 이름이었다"</i> 고 적었지만 참조 구현이 하나 더 있었다).
 * 실기동으로만 드러나는 어긋남이라 그 자리에 검사를 함께 둔다 —
 * {@code SampleActionWireTest} 가 이제 이 화면의 몸통 둘을 잰다.
 */
public record SampleShipRequest(@NotEmpty @Size(max = 1000) List<String> targets) {}
