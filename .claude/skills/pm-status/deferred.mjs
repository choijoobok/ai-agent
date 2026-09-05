/**
 * 미룬 것 모으기 — `/pm-status` 의 한 절.
 *
 * <p><b>목록을 만들지 않고 긁어 모으기만 한다.</b> 미룬 결정 하나하나는 이미 제자리를
 * 갖고 있다 — 미결 질문은 `project.state.yaml`, 미확인 가정은 `ASSUMPTIONS.md`,
 * 화면의 미확정은 `60-screens.yaml`. 그것을 따로 옮겨 적는 순간 정본이 둘이 되고,
 * 한쪽만 닫혔을 때 어느 쪽이 참인지 알 방법이 없다(CLAUDE.md §4-2·§4-3).
 * 그래서 <b>이 스크립트의 출력은 파일로 남기지 않는다</b> — 매번 다시 만든다.
 *
 * <p>산문에 묻혀 기계가 못 찾는 것에는 <b>`@defer &lt;기한&gt;`</b> 을 그 자리에 붙인다.
 * 소스에 `@feat FEAT-###` 를 다는 것과 같은 방식이다(추적성 T10).
 *
 * <p>기한이 없는 항목을 <b>따로 세어 마지막에 낸다</b> — 기한 없이 미룬 것은
 * 미룬 것이 아니라 잊은 것이다.
 *
 * <p>의존성이 없다. `node .claude/skills/pm-status/deferred.mjs` 로 돈다.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

/** 훑을 자리. `sources/` 는 코드라 넣지 않는다 — 미룬 *결정* 을 찾는 것이다. */
const SCAN = ['documents', 'aidd-guide', 'user-guide', 'CLAUDE.md'];
const SKIP = new Set(['node_modules', '.git', 'generated', 'build']);

/** 기한을 정렬한다. 앞설수록 급하다. 모르는 값은 뒤로 보낸다. */
const ORDER = ['지금', 'G0', 'P1', 'G1', 'P2', 'G2', 'P3', 'G3', 'P4', 'G4', 'P5', 'G5', 'P6', 'G6'];
const rank = (d) => {
  const i = ORDER.indexOf(d);
  return i < 0 ? ORDER.length : i;
};

const items = [];
const add = (due, id, what, where) =>
  items.push({ due: due || null, id, what: (what || '').replace(/\s+/g, ' ').trim(), where });

function read(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

function walk(p, out = []) {
  let st;
  try {
    st = statSync(p);
  } catch {
    return out;
  }
  if (st.isFile()) {
    if (/\.(md|ya?ml)$/.test(p)) out.push(p);
    return out;
  }
  for (const e of readdirSync(p)) {
    if (SKIP.has(e)) continue;
    walk(join(p, e), out);
  }
  return out;
}

// ── ① `@defer <기한>` 토큰 — 산문 어디에 있든 잡는다 ─────────────
// 형식: `@defer G1` · `@defer P4` · `@defer 지금`. 그 줄의 나머지를 내용으로 쓴다.
const files = SCAN.flatMap((s) => walk(join(REPO, s)));
for (const f of files) {
  const rel = relative(REPO, f).split('\\').join('/');
  const lines = read(f).split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/@defer\s+([A-Z]?[0-9]|지금|\?)[:\s]*(.*)$/);
    if (!m) return;
    // 앞의 이음표와, 표 칸 안에 있을 때 딸려 오는 뒤쪽 `|` · 꾸밈 문자를 턴다.
    const tail = m[2].replace(/^[-—\s]+/, '').replace(/[\s|"'`*]+$/, '');
    // `?` 는 **기한을 아직 못 정했다**는 정직한 표시다 — 기한 없음 칸으로 간다.
    add(m[1] === '?' ? null : m[1], null, tail || line.trim(), `${rel}:${i + 1}`);
  });
}

// ── ② 미결 질문 (OQ) — project.state.yaml ────────────────────────
{
  const rel = 'documents/project.state.yaml';
  const src = read(join(REPO, rel));
  const block = src.split(/^open_questions:/m)[1]?.split(/^\S/m)[0] ?? '';
  for (const chunk of block.split(/^\s+- id: /m).slice(1)) {
    const id = chunk.match(/^(OQ-\S+)/)?.[1];
    const q = chunk.match(/question:\s*"([^"]*)"/)?.[1];
    const phase = chunk.match(/^\s+phase:\s*(\S+)/m)?.[1];
    if (id) add(phase, id, q, rel);
  }

  // 답 못 받은 역질문 — ID 가 없고 기한도 없다. 그것이 이 항목의 성격이다.
  const rq = src.split(/^\s+unanswered_reverse_q:/m)[1]?.split(/^\s{0,2}\S/m)[0] ?? '';
  for (const line of rq.split('\n')) {
    const m = line.match(/^\s+- "(.*)"\s*$/);
    if (m) add(null, '역질문', m[1].slice(0, 110), rel);
  }
}

// ── ③ 미확인 가정 (ASM) — ASSUMPTIONS.md 의 표 ───────────────────
// 칸: ID | 내용 | 근거 | 영향 | **확인 기한** | 상태 | 결과
{
  const rel = 'documents/decisions/ASSUMPTIONS.md';
  for (const line of read(join(REPO, rel)).split('\n')) {
    if (!/^\|\s*ASM-\d+\s*\|/.test(line)) continue;
    const c = line.split('|').map((x) => x.trim());
    if (c[6] && c[6] !== '미확인') continue; // 확인됨·기각됨은 끝난 것이다
    add(c[5]?.match(/G[0-6]|P[0-6]/)?.[0], c[1], c[2], rel);
  }
}

// ── ④ 화면의 미확정 (UND) — 60-screens.yaml ──────────────────────
{
  const rel = 'documents/spec/60-screens.yaml';
  const block = read(join(REPO, rel)).split(/^undecided:/m)[1]?.split(/^\S/m)[0] ?? '';
  for (const chunk of block.split(/^\s+- id: /m).slice(1)) {
    const id = chunk.match(/^(UND-\S+)/)?.[1];
    const item = chunk.match(/item:\s*"([^"]*)"/)?.[1];
    const when = chunk.match(/when:\s*"([^"]*)"/)?.[1] ?? '';
    if (id) add(when.match(/G[0-6]|P[0-6]/)?.[0], id, `${item} — ${when}`, rel);
  }
}

// ── 출력 — 기한이 이른 순. 기한 없는 것은 맨 뒤에 경고로 ─────────
const dated = items.filter((x) => x.due).sort((a, b) => rank(a.due) - rank(b.due));
const undated = items.filter((x) => !x.due);

const out = ['=== 미룬 것 ===', `총 ${items.length}건 — 기한 있음 ${dated.length} · 기한 없음 ${undated.length}`, ''];

let cur = null;
for (const x of dated) {
  if (x.due !== cur) {
    cur = x.due;
    out.push(`── ${cur} 까지 ──`);
  }
  out.push(`  ${x.id ? `[${x.id}] ` : ''}${x.what}`);
  out.push(`      ${x.where}`);
}

if (undated.length) {
  out.push('', `── 기한 없음 (${undated.length}) — 미룬 것이 아니라 잊은 것이 된다 ──`);
  for (const x of undated) {
    out.push(`  ${x.id ? `[${x.id}] ` : ''}${x.what}`);
    out.push(`      ${x.where}`);
  }
}

console.log(out.join('\n'));
