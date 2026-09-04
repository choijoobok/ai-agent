/**
 * 세션이 열릴 때 <b>지금 어디인가</b>를 문맥에 넣는다 — CLAUDE.md §2.
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
  PHASES,
  PHASE_NAME,
  PHASE_FILE,
  STATE_FILE,
  inject,
} from './lib.mjs';

await readHookInput(); // 입력은 쓰지 않지만 표준 입력을 비워야 훅이 매달리지 않는다

if (!existsSync(join(REPO, STATE_FILE))) {
  inject(
    [
      '[프로젝트 상태]',
      `${STATE_FILE} 이 없다 — 아직 프로젝트가 시작되지 않았다.`,
      '사용자가 시스템 구축을 요청하면 `/kickoff` 로 P0 착수를 개시한다.',
    ].join('\n'),
  );
}

const state = readState();
const phase = currentPhase(state);
const name = state?.project?.name || '(이름 미정)';
const openQuestions = Array.isArray(state?.current?.blocked_by) ? state.current.blocked_by : [];
const oqs = Array.isArray(state?.open_questions) ? state.open_questions : [];

const MARK = { approved: '✅', self_verified: '🔍', in_progress: '🔨', not_started: '⬜' };
const gates = PHASES.map((p) => {
  const key = Object.keys(state?.gates ?? {}).find((k) => k.startsWith(`${p}_`));
  return `${p}${MARK[gateStatus(state, key)] ?? '⬜'}`;
}).join(' ');

const { count: asmCount, ids: asmIds } = openAssumptions();
const slices = Array.isArray(state?.slices) ? state.slices : [];
const running = slices.filter((s) => s?.status === 'in_progress').map((s) => s?.id).filter(Boolean);

const lines = [
  '[프로젝트 상태]',
  `프로젝트: ${name} · 단계: ${phase} ${PHASE_NAME[phase] ?? ''}`,
  `게이트: ${gates}`,
  `미결 질문(OQ) ${oqs.length}건 · 미확인 가정(ASM) ${asmCount}건${asmIds.length ? ` — ${asmIds.slice(0, 5).join(', ')}` : ''}`,
];
if (running.length > 0) lines.push(`진행 중 슬라이스: ${running.join(', ')}`);
if (openQuestions.length > 0) lines.push(`진행을 막고 있는 것: ${openQuestions.join(', ')}`);

lines.push(
  '',
  '이번 세션에 반드시:',
  `1) \`${STATE_FILE}\` 과 \`${PHASE_FILE[phase] ?? ''}\` 를 읽는다`,
  '2) 사용자에게 **3줄 브리핑**(지금 여기 / 막힌 것 / 다음 할 일)을 먼저 제시한다',
  '3) CLAUDE.md §5 절대 규칙 — 게이트 건너뛰기 금지 · ID 없는 산출물 금지 ·',
  '   `documents/spec/` 이 SSOT · **산출물 지도에 없는 문서를 만들지 않는다**',
);
if (oqs.length > 0) lines.push('', '답변 대기 중인 질문이 있다. 브리핑에 포함해 다시 제시한다.');

inject(lines.join('\n'));

/** `documents/decisions/ASSUMPTIONS.md` 의 미확인 행을 센다. */
function openAssumptions() {
  const text = readText(join(REPO, 'documents/decisions/ASSUMPTIONS.md'));
  if (!text) return { count: 0, ids: [] };
  const ids = [];
  for (const line of text.split('\n')) {
    if (!line.trim().startsWith('|') || !line.includes('ASM-') || !line.includes('미확인')) continue;
    for (const m of line.matchAll(/ASM-\d+/g)) ids.push(m[0]);
  }
  return { count: ids.length, ids };
}
