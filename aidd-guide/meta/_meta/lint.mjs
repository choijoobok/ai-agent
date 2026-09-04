/**
 * `aidd-guide/` 문서 게이트 — 메타블록 · 200줄 · BOM · 링크 · 폐지 번호 인용 · 선언 어휘.
 *
 * <pre>
 *   node aidd-guide/meta/_meta/lint.mjs
 * </pre>
 *
 * <p><b>위반 0 이어야 한다.</b> 종료 코드가 CI 에 배선된다.
 *
 * <h2>검사하는 것</h2>
 * <ul>
 *   <li>메타블록 필수 필드 — `id` `title` `category` `type` `created` `updated` `status`.
 *       <b>예외가 없다</b>.</li>
 *   <li>운용 파일 200줄 — 예외는 아래 {@link LENGTH_EXEMPT} 셋뿐이며 <b>여기가 유일한
 *       통로다</b>. 파일이 스스로 선언하게 두면 조용히 늘어난다.</li>
 *   <li>BOM · CRLF 는 훅이 고치므로 여기서는 남은 것만 잡는다.</li>
 *   <li>링크 — 대상 부재와 <b>대소문자 불일치</b>. 후자는 Windows·macOS 에서 통과하고
 *       Linux·GitHub 에서 404 가 되므로, 경로 조각을 실제 디렉터리 목록과 하나씩 대조한다.</li>
 *   <li><b>절이 없는 링크형 인용 집계</b> — `[x](y.md) §3` 인데 대상에 그 절이 없는 것.
 *       링크가 열리므로 사람이 대상 문서에서 절을 찾다가 못 찾는다. 위반이 아니라
 *       <b>집계</b>이며 줄어들기만 해야 한다.</li>
 *   <li>선언 어휘 대조 — 소스에 있고 `standard/frontend/declarations.md` 에 없는 키.
 *       '빠짐없음' 을 사람이 지키게 두면 낡는다.</li>
 * </ul>
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GUIDE = resolve(HERE, '..', '..'); // aidd-guide/
const REPO = resolve(GUIDE, '..');

const REQUIRED = ['id', 'title', 'category', 'type', 'created', 'updated', 'status'];

/** 200줄 예외 — 쪼개면 더 나빠지는 셋. 조건은 `meta/doc-style.md` 의 '분량 규칙' 이 갖는다. */
const LENGTH_EXEMPT = new Map([
  ['standard/backend/crosscutting.md', '필터·인터셉터의 순서가 곧 내용이다 — 쪼개면 순서를 두 파일에서 읽는다'],
  ['standard/backend/persistence.md', '다섯 벤더 × 타입·규칙 — 표가 갈리면 벤더 하나를 빠뜨린다'],
  ['phase/P3-design.md', '가장 무거운 단계의 절차를 끝까지 읽는 문서다 — 쪼개면 spec 일곱 개의 작성 순서와 동결 조건을 두 파일에서 읽는다'],
]);

const VOCAB_DOC = 'standard/frontend/declarations.md';
const VOCAB_SOURCES = [
  ['sources/frontend/src/shared/grid/types.ts', 'ColumnDef'],
  ['sources/frontend/src/shared/searchform/types.ts', 'SearchField'],
  ['sources/frontend/src/shared/grid/useGridController.ts', 'GridControllerOptions'],
  ['sources/frontend/src/shared/grid/DataGrid.tsx', 'DataGridProps'],
];

const YAML_RE = /^---\n([\s\S]*?)\n---\n/;
const LINK_RE = /\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g;
const LINK_SEC_RE = /\[([^\]]*)\]\(([^)\s]+\.md)\)\s*§\s*([0-9][0-9.\-]*)/g;
const HEAD_NUM_RE = /^#{2,4}\s*([0-9][0-9.\-]*)[.\s]/gm;
const FENCE_RE = /^```[\s\S]*?^```/gm;
const INLINE_RE = /`[^`\n]*`/g;

// ── 실행 ──────────────────────────────────────────────────────────

/* memo 는 **최상위 실행보다 위에** 선언한다 — 아래 두면 첫 호출이 TDZ 로 죽는다. */
const DIR_CACHE = new Map();
const HEAD_CACHE = new Map();

const violations = [];
const stale = new Map();
const byCategory = new Map();
const byType = new Map();
let total = 0;

for (const file of walk(GUIDE).filter((f) => f.endsWith('.md')).sort()) {
  const rel = relative(GUIDE, file).split(sep).join('/');
  if (rel.startsWith('_meta/')) continue;
  total += 1;

  const category = rel.includes('/') ? rel.split('/')[0] : 'root';
  byCategory.set(category, (byCategory.get(category) ?? 0) + 1);

  const { issues, lineCount, type } = lintFile(file, rel);
  byType.set(type, (byType.get(type) ?? 0) + 1);
  if (issues.length > 0) violations.push([rel, lineCount, issues]);

  const n = staleSectionRefs(file);
  if (n > 0) stale.set(rel, n);
}

const vocab = checkVocabulary();
if (vocab.length > 0) violations.push([VOCAB_DOC, lineCount(join(GUIDE, VOCAB_DOC)), vocab]);

const out = [];
out.push('=== aidd-guide lint 결과 ===', `총 MD 파일: ${total}`, '');
out.push('카테고리별 파일 수:');
for (const [c, n] of [...byCategory].sort()) out.push(`  ${c}: ${n}`);
out.push('', 'type 분포:');
for (const [t, n] of [...byType].sort()) out.push(`  ${t}: ${n}`);
out.push('', `예외: 200줄 ${LENGTH_EXEMPT.size}건 — 그 밖에는 없다`);
for (const [rel, why] of LENGTH_EXEMPT) {
  out.push(`    ${String(lineCount(join(GUIDE, rel))).padStart(4)}줄  ${rel} — ${why}`);
}

out.push('');
const totalStale = [...stale.values()].reduce((a, b) => a + b, 0);
out.push(`링크형 인용 중 대상에 그 절이 없는 것: ${totalStale} 곳 / ${stale.size} 파일 — 줄어들기만 해야 한다.`);
for (const [rel, n] of [...stale].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
  out.push(`    ${String(n).padStart(4)}  ${rel}`);
}
out.push('');

if (violations.length > 0) {
  out.push(`위반: ${violations.length} 건`);
  for (const [path, lc, issues] of violations.slice(0, 50)) {
    out.push(`  [${path}] (${lc}줄)`);
    for (const i of issues) out.push(`    - ${i}`);
  }
  if (violations.length > 50) out.push(`  ... +${violations.length - 50} more`);
} else {
  out.push('위반: 0 건 (모두 통과)');
}

process.stdout.write(`${out.join('\n')}\n`);
process.exit(violations.length > 0 ? 1 : 0);

// ── 검사 ──────────────────────────────────────────────────────────

function lintFile(file, rel) {
  const issues = [];
  const raw = readFileSync(file);
  if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) issues.push('BOM detected');
  const text = raw.toString('utf8');
  if (text.includes('\r\n')) issues.push('CRLF detected');
  const lines = countLines(text);

  issues.push(...checkLinks(file, text));

  const m = text.match(YAML_RE);
  if (!m) {
    issues.push('no YAML frontmatter');
    return { issues, lineCount: lines, type: 'unknown' };
  }

  const fields = new Map();
  for (const line of m[1].split('\n')) {
    if (line.startsWith(' ') || line.startsWith('-') || !line.includes(':')) continue;
    const at = line.indexOf(':');
    fields.set(line.slice(0, at).trim(), line.slice(at + 1).trim());
  }
  for (const k of REQUIRED) if (!fields.has(k)) issues.push(`missing field: ${k}`);

  const type = (fields.get('type') ?? '').replace(/^["']|["']$/g, '');
  if (!['operation', 'study', 'template'].includes(type)) issues.push(`invalid type: ${type}`);

  if (['operation', 'template'].includes(type) && !LENGTH_EXEMPT.has(rel) && lines > 200) {
    issues.push(`exceeds 200 lines: ${lines}`);
  }
  return { issues, lineCount: lines, type: type || 'unknown' };
}

/**
 * 링크 검사 — 부재와 대소문자 불일치.
 *
 * <p>대소문자는 `realpath` 로 잡을 수 없다: Windows 는 실제 파일명으로 케이스를
 * 교정해 버린다. 그래서 경로 조각을 실제 디렉터리 목록과 하나씩 대조한다.
 */
function checkLinks(file, text) {
  const issues = [];
  const base = dirname(file);
  for (const m of text.matchAll(LINK_RE)) {
    const target = m[1];
    if (/^https?:/.test(target)) continue;
    const abs = normalize(join(base, target));
    if (!existsSync(abs)) {
      issues.push(`broken link: ${target}`);
      continue;
    }
    const rel = relative(GUIDE, abs);
    if (rel.startsWith('..')) continue; // 가이드 밖 — 존재 확인까지만
    let cur = GUIDE;
    for (const part of rel.split(sep)) {
      const names = entries(cur);
      if (!names.has(part)) {
        const actual = [...names].find((n) => n.toLowerCase() === part.toLowerCase()) ?? '?';
        issues.push(`case mismatch: ${target} (실제: ${actual})`);
        break;
      }
      cur = join(cur, part);
    }
  }
  return issues;
}

/** 대상 파일에 없는 절을 가리키는 `](./경로.md) §N` 참조 수. */
function staleSectionRefs(file) {
  const body = strip(readFileSync(file, 'utf8'));
  let n = 0;
  for (const m of body.matchAll(LINK_SEC_RE)) {
    const target = normalize(join(dirname(file), m[2]));
    if (!existsSync(target)) continue;
    const want = m[3].replace(/\.+$/, '');
    if (!headings(target).has(want)) n += 1;
  }
  return n;
}

/** 소스에 있고 문서에 없는 선언 키. 소스가 없으면 건너뛴다. */
function checkVocabulary() {
  const doc = join(GUIDE, VOCAB_DOC);
  if (!existsSync(doc)) return [];
  const body = readFileSync(doc, 'utf8');
  const missing = [];
  for (const [relSrc, iface] of VOCAB_SOURCES) {
    const src = join(REPO, relSrc);
    if (!existsSync(src)) continue;
    for (const key of [...interfaceKeys(readFileSync(src, 'utf8'), iface)].sort()) {
      if (!body.includes(`\`${key}\``)) missing.push(`${iface}.${key} (${relSrc})`);
    }
  }
  if (missing.length === 0) return [];
  return [`선언 어휘 누락 ${missing.length}건 — 소스에 있고 문서에 없다: ${missing.slice(0, 12).join(' · ')}`];
}

function interfaceKeys(text, name) {
  const m = text.match(new RegExp(`^(?:export )?interface ${name}(?![A-Za-z0-9])[^{]*\\{([\\s\\S]*?)^\\}`, 'm'));
  if (!m) return new Set();
  return new Set([...m[1].matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*)\??:/gm)].map((x) => x[1]));
}

// ── 거들기 ────────────────────────────────────────────────────────

function entries(dir) {
  if (!DIR_CACHE.has(dir)) {
    try {
      DIR_CACHE.set(dir, new Set(readdirSync(dir)));
    } catch {
      DIR_CACHE.set(dir, new Set());
    }
  }
  return DIR_CACHE.get(dir);
}

function walk(dir, acc = []) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of names) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function headings(file) {
  if (!HEAD_CACHE.has(file)) {
    const text = readFileSync(file, 'utf8');
    HEAD_CACHE.set(
      file,
      new Set([...text.matchAll(HEAD_NUM_RE)].map((m) => m[1].replace(/-/g, '.').replace(/\.+$/, ''))),
    );
  }
  return HEAD_CACHE.get(file);
}

function strip(text) {
  return text.replace(FENCE_RE, '').replace(INLINE_RE, '');
}

function lineCount(file) {
  try {
    return countLines(readFileSync(file, 'utf8'));
  } catch {
    return 0;
  }
}

/**
 * 줄 수 — <b>끝의 개행을 세지 않는다</b>(Python `splitlines()` 와 같은 셈).
 *
 * <p>`split()` 의 길이로 세면 정상적으로 개행으로 끝나는 파일이 <b>1줄 더 많게</b> 나온다.
 * 200줄 규칙의 경계에서 그 하나가 <b>없는 위반을 만든다</b> — 파이썬에서 이식할 때 실제로
 * 두 파일이 걸렸다(2026-09-04).
 */
function countLines(text) {
  const parts = text.split('\n');
  if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
  return parts.length;
}
