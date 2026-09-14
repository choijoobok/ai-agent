/**
 * 미룬 것 모으기 — `/pm-status` 의 한 절.
 *
 * <p><b>목록을 만들지 않고 긁어 모으기만 한다.</b> 미룬 결정 하나하나는 이미 제자리를
 * 갖고 있다 — 미결 질문은 `project.state.yaml`, 미확인 가정은 `ASSUMPTIONS.md`,
 * 화면의 미확정은 논리 문서 `60-screens`. 그것을 따로 옮겨 적는 순간 정본이 둘이 되고,
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
import { parseYaml } from '../../hooks/lib.mjs';
import { loadSpecSet } from '../../../aidd-guide/harness/runtime/spec-set.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

/** 훑을 자리. `sources/` 는 코드라 넣지 않는다 — 미룬 *결정* 을 찾는 것이다. */
const SCAN = ['documents', 'aidd-guide', 'developer-guide', 'AGENTS.md'];
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

/** 앞뒤의 마크다운 꾸밈을 턴다 — 뜻이 아니라 서식이다. */
// 굵게는 **줄 안에서도** 턴다 — 줄을 이으면 닫는 `**` 가 문장 한가운데 남는다.
const strip = (s) => s.replace(/\*\*/g, '').replace(/^[-—\s`*|]+/, '').replace(/[\s|"'`*]+$/, '');

/**
 * 다음 줄로 넘어간 문장을 붙인다 — <b>최대 둘</b>.
 *
 * <p>줄바꿈은 글쓴이가 폭을 맞춘 흔적이지 문장의 끝이 아니다. 붙이지 않으면 목록의
 * 항목이 문장 중간에서 잘려 <b>무엇을 미뤘는지 읽을 수 없다</b>.
 *
 * <p><b>새로 시작하는 것에서 멈춘다</b> — 빈 줄 · 다음 항목 · 제목 · 표 · YAML 의 키.
 * 거기서 멈추지 않으면 남의 문장을 이 항목의 것으로 싣게 된다.
 *
 * <p><b>마크다운에서만 붙인다.</b> YAML 은 줄이 곧 값이라 다음 줄은 이어지는 문장이
 * 아니라 <b>다음 필드</b>다 — 붙이면 <i>…정한다 swallowed_errors: 1 # 임계 0</i> 이 된다.
 *
 * <p><b>인용문 안에서는 들여쓰기가 아니라 `&gt;` 가 이음을 말한다.</b> `aidd-guide` 의
 * 콜아웃 관용구가 인용문이라 미룬 것이 거기 사는 일이 잦은데, 인용문의 다음 줄은
 * 들여쓸 자리가 없어 <i>들여쓰였는가</i> 로 물으면 <b>언제나 아니오</b>다 — 그래서
 * golden-set.md 의 항목이 <i>…나오므로(아래 추가</i> 에서 괄호도 못 닫고 잘렸다.
 * 태그가 인용문에 있으면 <b>같은 인용문에 남아 있는가</b> 로 묻는다.
 */
function continuation(lines, at, file) {
  if (!/\.md$/.test(file)) return { text: '', cut: false };
  const quoted = /^\s*>/.test(lines[at]);
  const goes = (i) => {
    const raw = lines[i];
    if (i >= lines.length) return null;
    if (quoted && !/^\s*>/.test(raw)) return null; // 인용문 밖으로 나갔다
    const next = quoted ? raw.replace(/^\s*>\s?/, '') : raw;
    if (!next.trim()) return null;
    if (/^\s*([-*+]\s|#{1,6}\s|\||```|\d+\.\s)/.test(next)) return null;
    if (/^\s*[\w.-]+:\s/.test(next)) return null; // YAML 의 키가 왔다
    if (!quoted && !/^\s{2,}/.test(next)) return null; // 이어지는 줄은 들여쓰여 있다
    return next.trim();
  };
  let out = '';
  let i = at + 1;
  for (; i <= at + 2; i += 1) {
    const next = goes(i);
    if (next === null) return { text: out, cut: false };
    out += ' ' + next;
  }
  // 상한에서 멈췄다 — 더 갈 줄이 남았으면 문장이 잘린 것이다.
  return { text: out, cut: goes(i) !== null };
}

/**
 * <b>문장 한가운데서 끊지 않는다.</b> 상한에 걸려 잘렸으면 마지막 온전한 문장까지만 싣는다 —
 * <i>…길이 없는 것보다 목적지가</i> 로 끝나는 항목은 <b>읽을 수 없고, 읽을 수 없는 항목은
 * 없는 항목과 같다</b>.
 *
 * <p>파일 이름의 점은 문장 끝이 아니다({@code master-tabs.md 의}) — 뒤에 공백이나 줄끝이
 * 와야 문장으로 본다.
 */
const toSentence = (s) => {
  const ends = [...s.matchAll(/[.!?](?=\s|$)/g)];
  return ends.length ? s.slice(0, ends[ends.length - 1].index + 1) : s;
};

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
//
// **읽을 수 있게 낸다.** 마크다운 안에 사는 태그라 앞뒤에 백틱과 별표가 붙고, 문장이
// 다음 줄로 넘어간다 — 그대로 실으면 `` ` — 부분 실패가 남긴…`` 처럼 앞이 깨지고 뒤가
// 잘린 채 목록에 선다. **읽을 수 없는 항목은 없는 항목과 같다.**
const files = SCAN.flatMap((s) => walk(join(REPO, s)));
for (const f of files) {
  const rel = relative(REPO, f).split('\\').join('/');
  const lines = read(f).split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/@defer\s+([A-Z]?[0-9]|지금|\?)[:\s]*(.*)$/);
    if (!m) return;
    /*
     * **인라인 코드 안의 것은 태그가 아니라 태그를 가리키는 말이다.** `@defer ?` 로 남겼다 ·
     * ASM-002(`@defer P1`)처럼 **설명하는 문장**이 항목으로 서면, 목록이 남의 문장 꼬리를
     * 미룬 것으로 싣는다(2026-09-07 에 하루 세 번 걸렸다). 여는 백틱의 수가 홀수면 안이다.
     */
    if (((line.slice(0, m.index).match(/`/g) || []).length % 2) === 1) return;
    // 앞뒤의 꾸밈(백틱 · 별표 · 이음표)과, 표 칸에서 딸려 오는 `|` 를 턴다.
    const more = continuation(lines, i, f);
    const joined = strip(m[2] + more.text);
    const tail = more.cut ? toSentence(joined) : joined;
    // `?` 는 **기한을 아직 못 정했다**는 정직한 표시다 — 기한 없음 칸으로 간다.
    add(m[1] === '?' ? null : m[1], null, tail || strip(line), `${rel}:${i + 1}`);
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

// ── ④ 화면의 미확정 (UND) — 60-screens 논리 문서 ─────────────────
{
  const spec = loadSpecSet({ repo: REPO, name: '60-screens', parseYaml, required: false });
  const rel = spec?.source ?? 'documents/spec/60-screens/';
  for (const undecided of spec?.document?.undecided ?? []) {
    const { id, item, when = '', resolved } = undecided ?? {};
    if (!id || resolved) continue;
    // `@defer` 를 품고 있으면 ① 이 이미 기한과 함께 잡았다 — 두 번 세지 않는다.
    if (JSON.stringify(undecided).includes('@defer')) continue;
    add(String(when).match(/G[0-6]|P[0-6]/)?.[0], id, `${item} — ${when}`, rel);
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
