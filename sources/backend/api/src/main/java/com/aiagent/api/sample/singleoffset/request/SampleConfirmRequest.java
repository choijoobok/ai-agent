package com.aiagent.api.sample.singleoffset.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 확정 — 68 §3.4 의 실행 <b>둘 중 앞</b>({@code target:'selected'} · 프로그레스 없음).
 *
 * <p>고른 행들의 {@code ordId} 다. 문자열인 것은 {@code bigint} 어휘의 규약이며(frontend-stack.md §6.1),
 * <b>비어 있으면 400</b> 이다 — 대상 없는 실행은 화면이 이미 막지만 그것이 서버의 방어는
 * 아니다.
 *
 * <h2>이름이 {@code targets} 다 (2026-09-02)</h2>
 *
 * <p><b>{@code ordIds} 였고, 그래서 이 실행은 한 번도 서버에 닿은 적이 없다.</b> 그리드가
 * 보내는 몸통은 <b>둘로 갈린 봉투</b>이며(grid-api-contract.md §8) 그 바깥 이름은
 * {@code targets} 로 고정이다 — {@code toTargets} 는 <i>모양만 바꾸는 자리</i>라 봉투의
 * 이름을 바꾸지 못한다. 이름이 어긋나면 {@code @NotEmpty} 에 걸려 <b>400</b> 이 나고,
 * 화면에는 <i>입력값을 확인하세요</i> 만 뜬다 — 고른 행이 분명히 있는데.
 *
 * <p>다른 화면들은 처음부터 이 이름이었다({@code UserTargetRequest} ·
 * {@code BatchRunRequest} · {@code NotiRequestHandleRequest}). 참조 구현만 갈려 있었고,
 * <b>그 어긋남을 잡아 줄 것이 아무것도 없었다</b>: 이 프로젝트에 컨트롤러를 HTTP 로 부르는
 * 검사가 없어(60여 개가 전부 단위 검사다) 몸통의 모양은 <b>실기동에서만</b> 드러난다.
 * {@code SampleActionWireTest} 가 이제 그 자리를 잡는다.
 */
public record SampleConfirmRequest(@NotEmpty @Size(max = 1000) List<String> targets) {}
