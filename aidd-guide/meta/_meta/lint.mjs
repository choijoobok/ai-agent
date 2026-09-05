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
  [
    'artifact/template/02-requirements.md',
    '서식은 위에서 아래로 한 번에 채우는 것이다 — 쪼개면 칸 하나를 채우다 다른 파일로 건너가게 되고, 그러다 칸을 빼먹는다',
  ],
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
const LABEL_RE = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
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
const countIssues = checkCatalogCounts();
if (countIssues.length > 0) violations.push(['INDEX.md', lineCount(join(GUIDE, 'INDEX.md')), countIssues]);

for (const [rel, issues] of checkScreenRequirements()) violations.push([rel, 0, issues]);

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

  issues.push(...checkLabels(file, text));

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

/**
 * <b>라벨이 경로를 주장하는데 그 경로가 없는 링크.</b>
 *
 * <p>깨진 링크 검사는 <b>타깃</b>만 본다. 그래서 폴더 이름이 바뀌면 타깃은 함께 고쳐지고
 * <b>라벨만 옛 이름으로 남는다</b> — 링크는 멀쩡히 열리므로 아무 검사도 울지 않는다.
 * 그런데 읽는 사람은 <b>라벨을 보고 판단한다</b>: 클릭하지 않고 <i>"아 그건 sources/ 에
 * 있구나"</i> 로 넘어가고, 그 다음부터 없는 폴더를 찾는다.
 *
 * <p>2026-09-05 에 64곳이 그 상태였다 — `sources/`(→`standard/`) · `overlays/`(→`overlay/`) ·
 * `09-knowledge/` · `11-playbook/` · `06-framework/` · `02-context/` · `13-safety/` 처럼
 * <b>합치기 전 저장소의 폴더 이름</b>이 라벨에만 화석으로 남아 있었다.
 *
 * <p><b>슬래시가 든 라벨만 본다.</b> 파일명 하나짜리 라벨(`grid.md`)은 경로를 주장하지
 * 않으므로 정상이고, 그것까지 막으면 짧게 쓰는 관용구가 죽는다.
 */
function checkLabels(file, text) {
  const issues = [];
  const base = dirname(file);
  for (const m of text.matchAll(LABEL_RE)) {
    const label = m[1].split(/\s/)[0].replace(/[`*]/g, '');
    if (!label.includes('/')) continue;
    if (!/^[A-Za-z0-9_./-]+\.(md|mjs|ts|tsx|java|html|yaml)$/.test(label)) continue;
    const found = [join(REPO, label), join(GUIDE, label), join(base, label)].some((p) =>
      existsSync(normalize(p)),
    );
    if (!found) issues.push(`label lies: ${label} — 타깃은 ${m[2]}`);
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
    /*
      <b>제목 쪽과 같은 방식으로 정규화한다</b>(`headings()`). 전에는 여기만 끝 점을
      떼고 하이픈을 그대로 두어, `§5-1` 인용이 제목 `5.1` 과 어긋나 <b>멀쩡한 인용이
      위반으로 세어졌다</b>. 검사기의 오탐은 그 검사를 무시하는 법을 가르친다.
    */
    const want = m[3].replace(/-/g, '.').replace(/\.+$/, '');
    if (!headings(target).has(want)) n += 1;
  }
  return n;
}

/**
 * <b>카탈로그가 주장하는 문서 수 ↔ 실제.</b>
 *
 * <p>개수는 <b>아무도 모르게 낡는다</b> — 파일 하나를 더할 때 그 숫자를 고칠 이유가 그
 * 순간에는 없다. 2026-09-05 에 아홉 칸 중 <b>여섯이 어긋나 있었고</b> `standard` 는
 * 48 대 36 이었다. `CLAUDE.md` §4-2 가 헌법에 현황을 적지 말라고 한 것과 같은 이유이며,
 * <b>적을 것이면 기계가 지켜야 한다.</b>
 */
function checkCatalogCounts() {
  const file = join(GUIDE, 'INDEX.md');
  if (!existsSync(file)) return [];
  const issues = [];
  const rows = readFileSync(file, 'utf8').matchAll(/^\| \[([a-z]+)\]\([^)]+\)[^|]*\|[^|]*\|\s*\d+\s*\|\s*(\d+)\s*\|$/gm);
  for (const m of rows) {
    const dir = join(GUIDE, m[1]);
    if (!existsSync(dir)) {
      issues.push(`카탈로그가 없는 폴더를 적었다: ${m[1]}`);
      continue;
    }
    const actual = countMd(dir);
    if (actual !== Number(m[2])) {
      issues.push(`문서 수가 다르다: ${m[1]} — 적힌 값 ${m[2]}, 실제 ${actual}`);
    }
  }
  return issues;
}

/**
 * <b>화면 요건서가 서식의 필수 칸을 갖는가</b> — `artifact/template/02-requirements.md`.
 *
 * <p>서식은 있는데 <b>지키는지 보는 것이 없었다.</b> 2026-09-06 에 세어 보니 업무 화면
 * 17개는 §4 컬럼 표를 전부 갖고(12~38행) <b>샘플 여섯은 전부 0</b> 이었다 — 그런데
 * `CLAUDE.md` §3 이 <i>표준을 추정하지 말고 읽으라</i> 고 지정한 것이 그 여섯이다.
 * 같은 날 재현 실험에서 재현 둘이 컬럼을 정하려고 공통 컴포넌트의 javadoc 까지 읽었고,
 * 그러고도 <b>양식 컬럼 하나가 갈렸다</b>.
 *
 * <p><b>`_standalone/` 은 보지 않는다</b> — 메뉴가 없는 모달·팝업이라 그리드도 백엔드도
 * 없는 것이 정상이다. 여기서 재는 것은 <b>메뉴 화면</b>이다.
 */
function checkScreenRequirements() {
  const root = join(REPO, 'documents', 'screen');
  if (!existsSync(root)) return [];
  const out = [];
  for (const file of walk(root)) {
    if (!file.endsWith('requirements.md')) continue;
    const rel = relative(REPO, file).split(sep).join('/');
    if (rel.includes('/_standalone/')) continue;
    const text = readFileSync(file, 'utf8');
    const issues = [];

    if (!/^\| 백엔드 패키지 \|/m.test(text)) {
      issues.push('§0 메타에 `백엔드 패키지` 칸이 없다 — 구현자가 자리를 추측한다');
    }

    const four = text.match(/^## 4\.[\s\S]*?(?=^## 5\.)/m);
    const rows = four ? (four[0].match(/^\|.*\|.*\|$/gm) || []).length : 0;
    if (rows < 3) {
      issues.push(`§4 에 컬럼 표가 없다(표 ${rows}행) — 폭·타입·편집이 어디에도 없으면 화면마다 갈린다`);
    }

    for (const m of (four ? four[0].match(/^\| 컬럼 \| 라벨 키 \| DB 컬럼 \|.*$/gm) || [] : [])) {
      if (!/필드명/.test(m)) {
        issues.push('§4 표에 `필드명` 칸이 없다 — DB 컬럼의 camelCase 는 관례일 뿐이라 파생·조인 컬럼에서 갈린다');
        break;
      }
    }

    // 그리드를 가리키는 소절인데 표도, 표를 가진 다른 요건서로 가는 링크도 없다
    let head = '';
    let bodyRows = 0;
    let link = false;
    const flush = () => {
      if (head && bodyRows < 2 && !link && /그리드|탭|마스터|디테일|목록|양식|트리|폼/.test(head)) {
        issues.push(`§4 ${head.replace(/^###\s*/, '').slice(0, 40)} 에 컬럼 표가 없다`);
      }
    };
    for (const line of (four ? four[0].split('\n') : [])) {
      if (/^### 4-1/.test(line)) { flush(); head = line; bodyRows = 0; link = false; continue; }
      if (/^### 4-[2-9]/.test(line)) { flush(); head = ''; continue; }
      if (head && /^\|.*\|.*\|/.test(line)) bodyRows += 1;
      if (head && /requirements\.md\)/.test(line)) link = true;
    }
    flush();

    let prev = -1;
    for (const m of text.matchAll(/^\| `[A-Z]+\d*-(\d+)`/gm)) {
      const n = Number(m[1]);
      if (n < prev) {
        issues.push(`§9 테스트 케이스 번호가 뒤집혔다: ${prev} 다음에 ${n} — 목업이 그대로 옮긴다`);
        break;
      }
      prev = n;
    }

    if (issues.length > 0) out.push([rel, issues]);
  }
  return out;
}

function countMd(dir) {
  let n = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) n += countMd(p);
    else if (name.endsWith('.md')) n += 1;
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
