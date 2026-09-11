/**
 * 세션이 열릴 때 <b>지금 어디인가</b>를 문맥에 넣는다 — AGENTS.md §2.
 *
 * <p>AI 는 세션이 바뀌면 맥락을 잃는다. `documents/project.state.yaml` 을 읽는 것을
 * 잊지 않게 하고, <b>3줄 브리핑</b>(지금 여기 / 막힌 것 / 다음 할 일)을 강제한다.
 *
 * <p><b>표준 출력이 그대로 모델의 문맥이 된다.</b> 그래서 짧게 쓴다 — 세션 진입의 문맥은
 * 매 세션의 예산에서 빠지므로, 여기가 길어지는 것은 <i>일할 자리</i>가 줄어드는 것이다.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPO,
  readHookInput,
  readText,
  readState,
  currentPhase,
  gateStatus,
  currentWorkstream,
  PHASES,
  PHASE_NAME,
  PHASE_FILE,
  STATE_FILE,
  inject,
  skillRef,
} from './lib.mjs';
import { checkHarness } from '../../aidd-guide/harness/runtime/harness-check.mjs';

await readHookInput(); // 입력은 쓰지 않지만 표준 입력을 비워야 훅이 매달리지 않는다
const harnessIssues = checkHarness();

if (!existsSync(join(REPO, STATE_FILE))) {
  inject(
    [
      '[프로젝트 상태]',
      `${STATE_FILE} 이 없다 — 아직 프로젝트가 시작되지 않았다.`,
      `사용자가 시스템 구축을 요청하면 ${skillRef('kickoff')} 로 P0 착수를 개시한다.`,
      ...harnessNotice(),
    ].join('\n'),
  );
}

const state = readState();
const phase = currentPhase(state);
const focus = currentWorkstream(state);
const focusPhase = focus?.phase || phase;
/*
  **차수와 단계는 다른 축인데 글자가 같다**(`RM-P1` 과 `P1`). 브리핑에 단계만 실으면 읽는
  쪽이 게이트 표를 *제품 전체의 진척* 으로 읽는다 — 실제로는 **이 차수의 진척**이다.
*/
const roadmap = state?.current?.roadmap || '차수 미정';
const name = state?.project?.name || '(이름 미정)';
const globalBlocks = Array.isArray(state?.current?.blocked_by) ? state.current.blocked_by : [];
const focusBlocks = Array.isArray(focus?.blocked_by) ? focus.blocked_by : [];
const openQuestions = [...new Set([...globalBlocks, ...focusBlocks])];
const oqs = Array.isArray(state?.open_questions) ? state.open_questions : [];

const MARK = { approved: '✅', self_verified: '🔍', in_progress: '🔨', not_started: '⬜' };
const gates = PHASES.map((p) => {
  const key = Object.keys(state?.gates ?? {}).find((k) => k.startsWith(`${p}_`));
  return `${p}${MARK[gateStatus(state, key)] ?? '⬜'}`;
}).join(' ');
const workstreamLine = Object.entries(state?.workstreams ?? {}).map(([key, value]) => {
  const wsPhase = value?.phase || 'P?';
  const gateKey = Object.keys(value?.gates ?? {}).find((candidate) => candidate.startsWith(`${wsPhase}_`));
  const mark = MARK[value?.gates?.[gateKey]?.status] ?? '⬜';
  return `${key} ${wsPhase}${mark}${value?.deferred_until ? '⏸' : ''}`;
}).join(' · ');

const { count: asmCount, ids: asmIds } = openAssumptions();
const slices = Array.isArray(state?.slices) ? state.slices : [];
const running = slices.filter((s) => s?.status === 'in_progress').map((s) => s?.id).filter(Boolean);

const lines = [
  '[프로젝트 상태]',
  `프로젝트: ${name} · 차수: ${roadmap} · 전역 단계: ${phase} ${PHASE_NAME[phase] ?? ''}` +
    (focus ? ` · 현재 작업흐름: ${focus.key} ${focusPhase} ${PHASE_NAME[focusPhase] ?? ''}` : ''),
  `게이트: ${gates}   ← ${roadmap} 의 것이다(차수마다 한 벌 돈다)`,
  ...(workstreamLine ? [`작업흐름: ${workstreamLine}  (⏸ 의도적 대기)`] : []),
  `미결 질문(OQ) ${oqs.length}건 · 미확인 가정(ASM) ${asmCount}건${asmIds.length ? ` — ${asmIds.slice(0, 5).join(', ')}` : ''}`,
];
if (running.length > 0) lines.push(`진행 중 슬라이스: ${running.join(', ')}`);
if (openQuestions.length > 0) lines.push(`진행을 막고 있는 것: ${openQuestions.join(', ')}`);
/*
  **브리핑의 셋째 줄에 재료를 준다.** 아래에서 *다음 할 일* 을 요구하면서 그 값을 주지
  않고 있었다 — 그러면 AI 가 상태 파일을 뒤져 짐작하거나, 어제 사용자가 고른 것을 모른 채
  같은 질문을 다시 한다. **한 문장만 싣는다**(`tasks` 는 아니다) — 여기 출력이 매 세션의
  예산에서 빠지므로 목록까지 넣으면 일할 자리가 줄어든다. 상세는 AI 가 파일에서 읽는다.
*/
const nextUp = typeof state?.next_up?.choice === 'string' ? state.next_up.choice.trim() : '';
if (nextUp) lines.push(`다음 할 일(사용자가 택했다): ${nextUp}`);

lines.push(
  '',
  '이번 세션에 반드시:',
  `1) \`${STATE_FILE}\` 과 현재 작업흐름 단계의 \`${PHASE_FILE[focusPhase] ?? ''}\` 를 읽는다`,
  '2) 사용자에게 **3줄 브리핑**(지금 여기 / 막힌 것 / 다음 할 일)을 먼저 제시한다',
  '3) AGENTS.md §5 절대 규칙 — 게이트 건너뛰기 금지 · ID 없는 산출물 금지 ·',
  '   `documents/spec/` 이 SSOT · **산출물 지도에 없는 문서를 만들지 않는다**',
);
lines.push(...harnessNotice());
if (oqs.length > 0) lines.push('', '답변 대기 중인 질문이 있다. 브리핑에 포함해 다시 제시한다.');

inject(lines.join('\n'));

/**
 * `documents/decisions/ASSUMPTIONS.md` 의 미확인 행을 센다.
 *
 * <p><b>행 전체가 아니라 상태 칸을 본다.</b> 이전에는 줄 어디에든 *미확인* 이 있으면 셌는데,
 * 결과 칸은 <i>확인되지 않으면 이렇게 된다</i> 같은 서술을 담는 자리라 <b>확인됨으로 판정한
 * 가정이 계속 미확인으로 세어졌다</b>(ASM-002 · 2026-09-10). 브리핑의 수가 틀리면 그 수를
 * 근거로 게이트를 판단하게 된다.
 */
function openAssumptions() {
  const text = readText(join(REPO, 'documents/decisions/ASSUMPTIONS.md'));
  if (!text) return { count: 0, ids: [] };
  const ids = [];
  for (const line of text.split('\n')) {
    if (!line.trim().startsWith('|') || !line.includes('ASM-')) continue;
    const cells = line.split('|');
    if (cells.length < 8 || !cells[6]?.includes('미확인')) continue; // 확인됨·기각됨은 끝났다
    for (const m of cells[1].matchAll(/ASM-\d+/g)) ids.push(m[0]);
  }
  return { count: ids.length, ids };
}

function harnessNotice() {
  if (!harnessIssues.length) return [];
  return [
    '',
    `[하네스 불일치] ${harnessIssues.length}건 — 일반 작업보다 harness-sync 복구가 먼저다.`,
    ...harnessIssues.slice(0, 3).map((issue) => `- ${issue}`),
  ];
}
