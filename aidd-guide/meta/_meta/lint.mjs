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
 *       `records/adr/` 는 예외다: 머리말을 두지 않는 것이 결정이며(ADR 은 널리 통하는
 *       형식이고 형식을 바꾸면 번호는 같은데 다른 문서가 된다) 그 근거는 `records/adr/INDEX.md`.</li>
 *   <li>운용 파일 200줄 — `_study/` 는 예외. 그 밖의 예외는 아래 {@link LENGTH_EXEMPT} 셋뿐이며
 *       <b>여기가 유일한 통로다</b>. 파일이 스스로 선언하게 두면 조용히 늘어난다.</li>
 *   <li>BOM · CRLF 는 훅이 고치므로 여기서는 남은 것만 잡는다.</li>
 *   <li>링크 — 대상 부재와 <b>대소문자 불일치</b>. 후자는 Windows·macOS 에서 통과하고
 *       Linux·GitHub 에서 404 가 되므로, 경로 조각을 실제 디렉터리 목록과 하나씩 대조한다.</li>
 *   <li><b>폐지 문서 번호 인용 집계</b> — 위반이 아니라 <b>집계</b>다. 뜻은
 *       `records/legacy-doc-map.md` 가 갖고, <b>줄어들기만 해야 한다</b>. 목표는 0 이 되어
 *       그 지도를 지우는 것이다.</li>
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
const META_EXEMPT_DIR = 'records/adr/';

/** 200줄 예외 — 쪼개면 더 나빠지는 셋. 조건은 `meta/doc-style.md` 의 '분량 규칙' 이 갖는다. */
const LENGTH_EXEMPT = new Map([
  ['knowledge/features.md', '기능 ID 카탈로그 — 쪼개면 ID 를 부르는 258곳이 어느 파일인지 잃는다'],
  ['standard/backend/crosscutting.md', '필터·인터셉터의 순서가 곧 내용이다 — 쪼개면 순서를 두 파일에서 읽는다'],
  ['standard/backend/persistence.md', '다섯 벤더 × 타입·규칙 — 표가 갈리면 벤더 하나를 빠뜨린다'],
  ['phase/P3-design.md', '가장 무거운 단계의 절차를 끝까지 읽는 문서다 — 쪼개면 spec 일곱 개의 작성 순서와 동결 조건을 두 파일에서 읽는다'],
]);

const LEGACY_MAP = 'records/legacy-doc-map.md';
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
const NUM_SEC_RE = /(?<![\w/.\-])(\d{2})\s*§\s*([0-9]+(?:[.\-][0-9]+)*)/g;
const MAP_ROW_RE = /^\|\s*`(\d{2})`\s*\|([^|]*)\|([^|]*)\|/gm;

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
out.push('', `예외: 머리말 ${META_EXEMPT_DIR} · 200줄 ${LENGTH_EXEMPT.size}건`);
for (const [rel, why] of LENGTH_EXEMPT) {
  out.push(`    ${String(lineCount(join(GUIDE, rel))).padStart(4)}줄  ${rel} — ${why}`);
}

const zones = legacyCitations();
const grand = zones.reduce((s, z) => s + z.hits, 0);
out.push('');
out.push(`폐지 문서 번호 인용: ${grand} 곳 — 위반이 아니라 집계다. **줄어들기만 해야 한다.**`);
out.push(`  뜻과 지도는 ${LEGACY_MAP}. 목표는 0 이 되어 그 지도를 지우는 것이다.`);
out.push(`    ${'구역'.padEnd(24)} ${'곳'.padStart(6)} ${'파일'.padStart(5)} ${'절 살아있음'.padStart(11)} ${'절 죽음'.padStart(8)}`);
for (const z of zones) {
  out.push(
    `    ${z.name.padEnd(24)} ${String(z.hits).padStart(6)} ${String(z.files).padStart(5)} ` +
      `${String(z.alive).padStart(11)} ${String(z.dead).padStart(8)}`,
  );
}
const totalStale = [...stale.values()].reduce((a, b) => a + b, 0);
out.push(`  그중 링크형(열리는데 그 절이 없다) — aidd-guide 안 ${totalStale} 곳 / ${stale.size} 파일`);
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
  const isStudy = rel.includes('_study/');

  issues.push(...checkLinks(file, text));

  const m = text.match(YAML_RE);
  if (!m) {
    if (!rel.startsWith(META_EXEMPT_DIR)) issues.push('no YAML frontmatter');
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

  if (!isStudy && ['operation', 'template'].includes(type) && !LENGTH_EXEMPT.has(rel) && lines > 200) {
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

/**
 * 폐지 번호 인용 — 구역별 집계.
 *
 * <p>2026-09-04 에 '링크형' 만 세다 459 로 보고했는데, 맨숫자형(`53 §6.1`)까지 저장소 전체로
 * 세니 7723 곳이었다 — 실제의 6% 만 보이던 셈이다. <b>지표가 규모를 감추면 '줄어들기만
 * 해야 한다' 가 지켜지는지 알 수 없다.</b>
 */
function legacyCitations() {
  const targets = legacyTargets();
  const guideMd = walk(GUIDE).filter((f) => f.endsWith('.md'));
  const zones = [
    {
      name: '소스 주석 (java·ts)',
      files: walk(join(REPO, 'sources')).filter(
        (f) => /\.(java|ts|tsx)$/.test(f) && !/[\\/](build|node_modules|\.gradle)[\\/]/.test(f),
      ),
    },
    { name: 'aidd-guide 운용', files: guideMd.filter((f) => !f.includes(`_study${sep}`)) },
    { name: 'aidd-guide _study (원문)', files: guideMd.filter((f) => f.includes(`_study${sep}`)) },
    {
      name: 'documents/ 문서 셋',
      files: walk(join(REPO, 'documents')).filter((f) => /\.(md|html)$/.test(f)),
    },
  ];

  const result = [];
  for (const zone of zones) {
    let hits = 0;
    let alive = 0;
    let dead = 0;
    let nf = 0;
    for (const file of zone.files) {
      let text;
      try {
        text = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      // 규약을 설명하는 예시(`53 §6.1`)가 자기 집계에 잡히면 안 된다.
      if (file.endsWith('.md')) text = strip(text);
      const found = [...text.matchAll(NUM_SEC_RE)];
      if (found.length === 0) continue;
      nf += 1;
      for (const m of found) {
        hits += 1;
        const t = targets.get(m[1]);
        if (t && t.has(m[2].replace(/-/g, '.').replace(/\.+$/, ''))) alive += 1;
        else dead += 1;
      }
    }
    if (hits > 0) result.push({ name: zone.name, hits, files: nf, alive, dead });
  }
  return result;
}

/** 지도의 `NN` → 후속 문서의 헤딩 번호 집합. 후속이 없으면 담지 않는다. */
function legacyTargets() {
  const doc = join(GUIDE, LEGACY_MAP);
  const out = new Map();
  if (!existsSync(doc)) return out;
  for (const m of readFileSync(doc, 'utf8').matchAll(MAP_ROW_RE)) {
    const dest = m[3];
    const link = dest.match(/\]\(([^)]+)\)/);
    if (dest.includes('후속 없음') || !link) continue;
    const p = normalize(join(GUIDE, 'records', link[1]));
    if (!existsSync(p)) continue;
    out.set(m[1], headings(p));
  }
  return out;
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
