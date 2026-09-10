/**
 * 쓰기의 다섯 사고를 막는다 — AGENTS.md §5 · §7.
 *
 * <p>① <b>G3 승인 전 구현 코드</b> — 차단. AI 의 과속을 막는 자리다.
 * <p>② <b>생성물 직접 수정</b> — 차단. SSOT 위반이며 다음 생성에서 조용히 되돌아간다.
 * <p>③ <b>산출물 지도에 없는 문서를 새로 만드는 것</b> — 차단. <b>문서 폭증의 유일한
 * 기계적 방어선</b>이다(§4).
 * <p>④ <b>베이스라인 이후 spec 변경</b> — 경고. CR 절차를 거쳤는지 묻는다.
 * <p>⑤ <b>단계에 맞지 않는 spec 선행 작성</b> — 경고.
 *
 * <p>③ 의 허용 목록을 <b>여기에 적지 않는다</b> — `aidd-guide/artifact/INDEX.md` 의 산출물
 * 지도에서 계산한다. 목록을 두 곳에 두면 갈리고, 갈렸을 때 <i>훅이 이긴다</i>. 그러면 지도가
 * 거짓말이 된다.
 */

import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  STATE_FILE,
  REPO,
  readHookInput,
  targetPath,
  repoRelative,
  readText,
  readState,
  currentPhase,
  gateStatus,
  deny,
  warn,
  pass,
} from './lib.mjs';

/*
  자리표시자를 정규식으로 바꾸는 값들. **최상위 실행보다 위에 선언한다** — 아래 두면
  `artifactSlots()` 가 TDZ 로 죽고, 훅은 fail-open 이라 **문서 예산 게이트가 조용히
  사라진다**(2026-09-04 실물: 훅을 직접 돌려 보고 발견했다). `log-raw.mjs` 가 같은 함정을
  기록해 두었는데도 반복했다 — 그래서 훅은 **쓴 뒤 반드시 한 번 돌려 본다**.
*/
/** 자리표시자 `{...}` 가 되는 정규식 — **한 단계 이상의 경로**. */
const SEGMENTS = '[^/]+(?:/[^/]+)*';

/** 자리표시자를 잠시 대신하는 표식. **경로에 나타날 수 없는 문자**여야 한다. */
const MARK = '\u0000';

/** 단계별로 쓰기가 허용되는 spec 파일 (앞 단계 것은 항상 허용). */
const PHASE_SPEC = {
  P0: ['00-charter', '01-actors', '02-constraints'],
  P1: ['03-glossary', '10-requirements', '11-processes'],
  P2: ['20-architecture', '21-nfr', '22-authz'],
  P3: ['30-usecases', '31-features', '40-domain', '50-api', '51-interfaces', '60-screens', '70-testcases'],
};
const ORDER = ['P0', 'P1', 'P2', 'P3'];

const input = await readHookInput();
const abs = targetPath(input);
const path = repoRelative(abs);
if (!path) pass();

const state = readState();
if (!state?.current) pass(); // 진행 상태가 없다 — 훅은 무동작한다

const phase = currentPhase(state);
const g3 = gateStatus(state, 'P3_design');
const templateMode = state?.current?.template_maintenance === true;

// ── ① G3 승인 전 구현 코드 ────────────────────────────────────────

if (path.startsWith('sources/') && g3 !== 'approved' && !templateMode) {
  deny(
    [
      `설계 베이스라인(G3)이 승인되지 않아 구현 코드를 쓸 수 없다 — AGENTS.md §5-2.`,
      `현재 단계: ${phase} / G3: ${g3}`,
      '',
      '지금 할 일은 현재 단계의 산출물을 완성하고 phase-gate 스킬로 승인을 받는 것이다.',
      '',
      '**템플릿 자체의 보수라면 게이트의 대상이 아니다.** 그 작업이면 사용자에게 확인받고',
      `\`documents/project.state.yaml\` 의 \`current.template_maintenance: true\` 를 켠다 —`,
      '켜 두었다는 사실이 상태 파일에 남아, 무엇을 왜 열었는지가 추적된다.',
      '',
      '기술 검증용 프로토타입이 꼭 필요하면 사용자에게 명시적으로 요청하고',
      '`prototype/` 아래에 폐기 예정임을 밝히고 만든다.',
    ].join('\n'),
  );
}

// ── ② 생성물 직접 수정 ───────────────────────────────────────────

if (path.startsWith('documents/generated/') && existsSync(abs)) {
  const head = readText(abs).slice(0, 800);
  if (head.includes('generated_from:')) {
    const src = head.match(/generated_from:\s*(\S+)/)?.[1] ?? 'documents/spec/';
    deny(
      [
        `${path} 는 생성물이다 — 손으로 고치면 다음 doc-gen 실행에서 덮어써진다.`,
        `원본을 고친다: ${src} → 고친 뒤 doc-gen 스킬로 재생성.`,
        'AGENTS.md §5-4: `documents/spec/` 이 유일한 진실이다.',
      ].join('\n'),
    );
  }
}

// ── ③ 산출물 지도에 없는 문서 ────────────────────────────────────

if (path.startsWith('documents/') && !existsSync(abs)) {
  const slots = artifactSlots();
  if (slots.length > 0 && !slots.some((slot) => slot.test(path))) {
    deny(
      [
        `${path} 는 산출물 지도에 없는 자리다 — 새 문서를 만들 수 없다(AGENTS.md §4).`,
        '',
        '**이 규칙이 이 프로젝트가 세 저장소에서 물려받은 가장 큰 문제를 막는다** —',
        '정리한 내역을 적는 문서, 근거를 적는 문서, 그 문서를 설명하는 문서가 늘어나',
        '어느 것이 참인지 알 수 없게 되는 것. 자리가 정해진 것만 만든다.',
        '',
        '둘 중 하나로 진행한다:',
        '1. 이 사실이 들어갈 **기존 산출물**을 찾아 거기에 적는다 (대개 이쪽이 맞다)',
        '2. 정말 새 종류의 산출물이면 `aidd-guide/artifact/INDEX.md` 의 지도에',
        '   **먼저 행을 더하고** 사용자에게 왜 필요한지 보고한 뒤 만든다',
      ].join('\n'),
    );
  }
}

// ── ④ 베이스라인 이후 spec 변경 ──────────────────────────────────

if (path.startsWith('documents/spec/') && g3 === 'approved') {
  warn(
    [
      `spec 베이스라인 이후 변경이다: ${path}`,
      'change-request 스킬로 영향 분석 → 3옵션 → 사용자 판정을 거쳤는지 확인한다.',
      '이미 CR-### 로 승인된 변경이면 그대로 진행하고, 아니면 지금 CR 을 먼저 연다.',
    ].join('\n'),
  );
}

// ── ⑤ 템플릿 보수를 켜는 순간 ────────────────────────────────────

/*
  <b>켠 사실은 커밋에만 남는다.</b> 훅은 파일의 *현재 값* 만 보므로, 켜고 작업하고
  끄면 워킹 트리만 오갔을 뿐 **git 에는 아무것도 남지 않는다** — 그러면 G3 이전의
  `sources/` 커밋을 보고 *승인된 보수였나, 게이트를 무시했나* 를 구별할 방법이 없다.

  **막지 않는다.** 여기서 커밋을 강제하면 세션마다 토글 커밋이 하나씩 붙고, 그
  마찰이 이 기록의 값보다 크다. `doc-drift`·`guide-drift` 와 같은 강도로 **가리키기만**
  한다(AGENTS.md §6.5).

  2026-09-06 에 이것이 없어 실제로 놓쳤다 — 문을 열어 커밋 넷을 찍고 닫았는데
  기록이 남지 않았고, 게이트는 전부 초록이었다.
*/
if (path === STATE_FILE && turnsOnTemplateMode(input)) {
  warn(
    [
      '템플릿 보수를 켠다 — **이 줄을 첫 작업 커밋에 함께 담는다**.',
      '별도 커밋이 아니다: `ce9e63f` 처럼 `project.state.yaml` 한 줄이 소스 변경과 같은 커밋에 얹힌다.',
      '담지 않으면 문이 열렸던 사실이 git 에 남지 않고, 끌 때가 되면 되돌릴 수 없다.',
    ].join('\n'),
  );
}

// ── ⑥ 단계 밖 spec 선행 작성 ─────────────────────────────────────

if (path.startsWith('documents/spec/')) {
  const stem = basename(path).replace(/\.[^.]+$/, '');
  if (!stem.startsWith('_') && !allowedSpec(phase).includes(stem)) {
    warn(
      [
        `현재 단계(${phase})의 산출물이 아니다: ${path}`,
        '앞 단계 산출물을 먼저 완성하고 게이트를 통과한다.',
        '필요한 이유가 있으면 사용자에게 설명하고 진행한다.',
      ].join('\n'),
    );
  }
}

pass();

// ── 거들기 ────────────────────────────────────────────────────────

/**
 * 이 쓰기가 <b>플래그를 켜는가</b> — 끄는 쓰기와 무관한 쓰기는 조용히 지나간다.
 *
 * <p>{@code Write} 는 본문 전체를, {@code Edit} 는 바뀔 조각을 준다. 어느 쪽이든
 * <b>새로 들어갈 글자</b>에 켜짐이 있고 <b>지금 파일</b>이 꺼짐일 때만 참이다 —
 * 이미 켜져 있는데 다른 줄을 고치는 것은 새로 여는 일이 아니다.
 */
function turnsOnTemplateMode(hookInput) {
  const incoming = hookInput?.tool_input?.content ?? hookInput?.tool_input?.new_string ?? '';
  return /template_maintenance:\s*true/.test(incoming) && !templateMode;
}

function allowedSpec(currentPhaseId) {
  const out = [];
  for (const p of ORDER) {
    out.push(...(PHASE_SPEC[p] ?? []));
    if (p === currentPhaseId) return out;
  }
  return out; // P4~P6 — 전부 허용
}

/**
 * 산출물 지도에서 <b>허용된 자리</b>를 계산한다.
 *
 * <p>지도의 경로 칸에 적힌 `documents/...` 를 정규식으로 바꾼다.
 *
 * <p><b>`{...}` 는 "한 단계 이상의 경로" 를 뜻한다.</b> 한 단계로만 두면
 * `documents/screen/{페이지경로}/requirements.md` 가 <b>`log/access` 같은 두 단계 페이지
 * 경로를 막는다</b>(2026-09-04 실물). 페이지 경로는 `screenRegistry.ts` 가 소유하고 깊이가
 * 정해져 있지 않으므로 <b>자리표시자가 그것을 수용해야 한다</b>.
 *
 * <p>지도를 읽지 못하면 <b>빈 목록을 돌려 아무것도 막지 않는다</b> — 지도를 못 읽는 훅이
 * 문서 생성을 전부 막으면 그것이 더 나쁘다.
 */
function artifactSlots() {
  const map = readText(join(REPO, 'aidd-guide/artifact/INDEX.md'));
  if (!map) return [];
  const slots = [];
  for (const m of map.matchAll(/`(documents\/[^`\s]+)`/g)) {
    /*
      자리표시자를 **먼저** 표식으로 바꾼다 — 뒤의 이스케이프가 자리표시자 안의 문자를
      건드려도 안 되고, 자리표시자가 된 정규식이 이스케이프되어도 안 된다.
    */
    const pattern = m[1]
      .replace(/\{[^}]*\}/g, MARK)
      .replace(/[.+^$()|[\]\\*?]/g, '\\$&')
      .split(MARK)
      .join(SEGMENTS);
    slots.push(new RegExp(`^${pattern}$`));
    // 디렉터리로 적힌 자리는 그 아래 전부를 연다
    if (m[1].endsWith('/')) slots.push(new RegExp(`^${pattern}.+$`));
  }
  return slots;
}
