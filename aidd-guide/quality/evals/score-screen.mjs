/**
 * 화면 재현 회귀 채점기 — screen-reproduction.md(LLM-EVL-004) §3 의 축을 실제로 센다.
 *
 * <p><b>손으로 세지 않는다.</b> 문서가 채점축 여덟을 "의미 단위로 센다" 로만 적어 두면
 * 두 번째 실험이 첫 번째와 같은 기준으로 세었는지 아무도 모른다 — 그 순간 회귀가 아니라
 * 인상평이 된다.
 *
 * <p><b>재현끼리도 비교한다.</b> 재현 하나를 실물과만 대면 차이의 원인이 셋으로 뭉친다 —
 * ①가이드가 모호하다 ②실물이 표준 밖이다 ③실행 편차다. 독립한 재현 둘을 서로 대야
 * ③이 갈린다(같은 문서를 읽고 갈렸다면 그것은 문서의 침묵이 아니라 편차다).
 *
 * <p><b>파일을 추정하지 않고 발견한다.</b> 재현이 폴더를 다르게 이름 지었을 수 있고,
 * <b>그 사실 자체가 결과</b>다. 그래서 §0 메타의 경로를 믿지 않고 `screenRegistry` 가
 * 가리키는 곳을 따라간다.
 *
 * 쓰는 법:
 *   node aidd-guide/quality/evals/score-screen.mjs /log/login <재현트리> [<재현트리> …]
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 훅들과 같은 방식으로 저장소를 찾는다 — 작업 디렉터리를 믿지 않는다(lib.mjs 참조). */
const REPO = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'AGENTS.md')) || existsSync(join(dir, 'CLAUDE.md'))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
})();

const [rawScreen, ...trees] = process.argv.slice(2);
if (!rawScreen || trees.length === 0) {
  console.error('쓰는 법: node score-screen.mjs log/login <재현트리> [<재현트리> …]');
  process.exit(2);
}

/**
 * <b>앞 슬래시를 요구하지 않는다.</b> Git Bash 가 `/log/login` 을 윈도우 경로로 바꿔
 * `C:/Program Files/Git/log/login` 을 넘기는데, 그러면 아무것도 못 찾고 <b>전부 0 이라는
 * 그럴듯한 표</b>가 나온다 — 조용히 틀리는 것이 가장 나쁘다. 그래서 알아채고 멈춘다.
 */
if (/^[A-Za-z]:/.test(rawScreen)) {
  console.error(`셸이 화면 경로를 파일 경로로 바꿨다: ${rawScreen}`);
  console.error('앞 슬래시를 빼고 넘겨라 — `log/login`. (PowerShell 에서는 어느 쪽이든 된다.)');
  process.exit(2);
}
const screenPath = `/${rawScreen.replace(/^\/+/, '')}`;

const targets = [{ name: '실물', root: REPO }, ...trees.map((t, i) => ({ name: String.fromCharCode(65 + i), root: resolve(t) }))];

// ── 읽기 거들기 ───────────────────────────────────────────────────

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** 코드에서 주석을 지운다 — 이 저장소는 주석이 본문보다 길어 세면 전부 주석을 센다. */
function strip(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * 선언 블록을 잘라 낸다 — `): ColumnDef<T>[] {` 같은 <b>함수 서명부터 열 첫머리의 `}` 까지</b>.
 *
 * <p>컬럼과 조회조건이 둘 다 `field:` 를 쓰므로 전역 정규식으로는 갈리지 않는다. 이 저장소는
 * 선언을 <b>반환 타입이 붙은 함수</b>로 내보내는 것이 관용구라(declarations.md) 서명이 경계다.
 */
function blocks(src, re) {
  const out = [];
  for (const m of src.matchAll(re)) {
    const start = m.index + m[0].length;
    const end = src.indexOf('\n}', start);
    out.push(src.slice(start, end === -1 ? src.length : end));
  }
  return out;
}

/**
 * 블록을 <b>컬럼 하나씩</b>으로 쪼갠다 — `field:` 부터 다음 `field:` 앞까지.
 *
 * <p>이 저장소는 `field` 를 객체 맨 위에 적는다(declarations.md §1 의 첫 줄이다). 그 관용구를
 * 어긴 재현은 속성이 앞 컬럼에 붙어 <b>차이로 드러난다</b> — 그것도 결과다.
 */
function cells(block) {
  return block
    .split(/\bfield:\s*'/)
    .slice(1)
    .map((p) => ({ name: p.slice(0, p.indexOf("'")), body: p }));
}

/** 속성이 붙은 컬럼 이름 — `editable: true` 처럼 값이 참인 것만. */
const flagged = (cs, key) =>
  cs.filter((c) => new RegExp(`\\b${key}:\\s*true\\b`).test(c.body)).map((c) => c.name);

/** 값이 있는 속성 — `validate:` 처럼 있고 없고가 결정인 것. */
const present = (cs, key) =>
  cs.filter((c) => new RegExp(`\\b${key}:`).test(c.body)).map((c) => `${c.name}:${key}`);

const set = (arr) => [...new Set(arr)].sort();
const diff = (a, b) => a.filter((x) => !b.includes(x));

// ── 화면의 실물을 찾는다 ──────────────────────────────────────────

/**
 * `screenRegistry.ts` 가 그 경로에서 어느 기능 폴더를 부르는지 따라간다.
 *
 * <p>재현이 등록을 잊었으면 <b>그것이 결과</b>이므로 추측해 메우지 않고 `null` 을 돌린다.
 */
function featureDir(root) {
  const reg = read(join(root, 'sources/frontend/src/shared/routes/screenRegistry.ts'));
  const esc = screenPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = reg.match(new RegExp(`'${esc}':[\\s\\S]{0,200}?@/features/([A-Za-z0-9_-]+)/`));
  return m ? m[1] : null;
}

/**
 * 백엔드는 <b>클래스 이름의 접두</b>로 찾는다 — 패키지 자리가 갈리는 것도 결과이기 때문이다.
 *
 * <p>접두를 폴더 이름에서 만들지 않는다. `loginlog` 를 대문자화하면 `Loginlog` 가 되어
 * `LoginLog` 와 어긋나고, <b>백엔드가 0 개라는 그럴듯한 표</b>가 나온다. 대신 API 경로
 * `/service/loginLog/getList` 의 도메인 마디를 쓴다 — backend/api.md 가 정한 자리라
 * 재현이 어떻게 이름 짓든 이 마디는 계약이다.
 */
function backendPrefix(feature, endpoints) {
  const url = endpoints.map((e) => e.split(' → ')[1]).find((u) => u?.split('/').length > 2);
  const domain = url ? url.split('/')[2] : feature;
  return domain ? domain[0].toUpperCase() + domain.slice(1) : '';
}

/**
 * 접두로 <b>자리를 찾고</b>, 그 자리의 <b>파일 전부</b>를 가져온다.
 *
 * <p>접두만으로 거르면 재현이 곁들여 만든 클래스를 놓친다 — 실제로 한 재현이
 * `LoginResultGroup` 을 더 만들었는데 접두가 어긋나 <b>차이가 0 이라는 표</b>가 나왔다.
 * 재현이 무엇을 <i>더</i> 만들었나가 이 실험이 보려는 것 중 하나이므로, 놓치면 안 된다.
 */
function backendFiles(root, prefix) {
  if (!prefix) return [];
  const all = walk(join(root, 'sources/backend')).filter(
    (p) => !p.includes(`${sep}build${sep}`) && p.endsWith('.java'),
  );
  const dirs = new Set(
    all.filter((p) => p.split(sep).pop().startsWith(prefix)).map((p) => p.slice(0, p.lastIndexOf(sep))),
  );
  return all.filter((p) => dirs.has(p.slice(0, p.lastIndexOf(sep))));
}

function frontFiles(root, feature) {
  return feature ? walk(join(root, 'sources/frontend/src/features', feature)) : [];
}

// ── 축 ────────────────────────────────────────────────────────────

function facts(root) {
  const feature = featureDir(root);
  const fe = frontFiles(root, feature);
  /*
   * <b>축은 선언만 센다.</b> 테스트를 섞으면 픽스처의 `grpCd: 'ORD_STAT'` 가 <i>값의 출처</i> 로,
   * JUnit 의 {@code @Nested class CodeNames} 가 <i>백엔드 클래스</i> 로 세어진다 — 둘 다
   * 설계 결정이 아니고, 그 자리에서 실제 차이를 <b>가린다</b>. 기계 규칙이 이미 같은 이유로
   * 테스트를 뺐는데(eslint 가 거기서 꺼진다) 나머지 축이 따라가지 않았다.
   */
  const isFeTest = (p) => /\.(test|spec)\.tsx?$/.test(p);
  const feSrc = fe.filter((p) => !isFeTest(p)).map((p) => read(p)).join('\n');
  const feCode = strip(feSrc);
  const endpoints = set([...feCode.matchAll(/(\w+):\s*'(\/[^']+)'/g)].map((m) => `${m[1]} → ${m[2]}`));

  const be = backendFiles(root, backendPrefix(feature, endpoints));
  const isBeTest = (p) => /Test\.java$/.test(p) || p.includes(`${sep}src${sep}test${sep}`);
  const beSrc = be.filter((p) => !isBeTest(p)).map((p) => read(p)).join('\n');

  /* URL 선언은 `endpoints.ts` 의 <b>일</b>이다 — 거기서 센 리터럴은 위반이 아니라 규약이다. */
  const notEndpoints = strip(fe.filter((p) => !/endpoints\.ts$/.test(p)).map((p) => read(p)).join('\n'));

  /*
   * 기계 규칙은 <b>테스트를 뺀 것</b>에만 센다 — `eslint.config` 가 `**\/*.test.ts` 에서
   * `no-restricted-syntax` 를 끄기 때문이다. 빼지 않으면 <b>선언 검사를 쓴 재현이
   * 위반 스물아홉으로 나오고</b>, 잘한 쪽이 벌을 받는다.
   */
  const linted = strip(
    fe.filter((p) => !/\.(test|spec)\.tsx?$/.test(p)).map((p) => read(p)).join('\n'),
  );
  const lintedNoEndpoints = strip(
    fe.filter((p) => !/\.(test|spec)\.tsx?$/.test(p) && !/endpoints\.ts$/.test(p))
      .map((p) => read(p))
      .join('\n'),
  );

  /*
   * 선언 블록 — 컬럼과 조회조건을 갈라 센다. 조회 전용 화면에서는 둘의 구분이 없어도
   * 됐지만(조회조건 field 가 대개 컬럼 field 의 부분집합이었다) 저장이 있는 화면에서는
   * <b>편집 가능 여부가 컬럼에만 있는 축</b>이라 갈리지 않으면 아무것도 못 본다.
   */
  const colCells = blocks(feCode, /:\s*ColumnDef<[^>]*>(?:\[\])?\s*\{/g).flatMap(cells);
  const searchCells = blocks(feCode, /:\s*SearchField\[\]\s*\{/g).flatMap(cells);

  return {
    feature,
    files: {
      front: fe.map((p) => relative(join(root, 'sources/frontend/src/features'), p).split(sep).join('/')),
      back: be.map((p) => p.split(sep).pop()),
      /* 테스트는 축에서 빼되 <b>몇 벌 썼는지는 남긴다</b> — 안 쓴 재현과 갈려야 한다. */
      tests: [...fe.filter(isFeTest), ...be.filter(isBeTest)].length,
    },
    /* [계약] endpoints 의 키와 URL */
    endpoints,
    /* [타입] interface 이름과 필드 */
    types: set([...feCode.matchAll(/(?:interface|type)\s+(\w+)/g)].map((m) => m[1])),
    fields: set([...feCode.matchAll(/^\s{2}(\w+)\??:\s*[\w'|\s[\]]+;/gm)].map((m) => m[1])),
    /* [화면] 그리드 컬럼 field */
    columns: set([...feCode.matchAll(/\bfield:\s*'(\w+)'/g)].map((m) => m[1])),
    widths: set([...feCode.matchAll(/\bfield:\s*'(\w+)'[\s\S]{0,120}?\bwidth:\s*(\d+)/g)].map((m) => `${m[1]}=${m[2]}`)),
    /* [화면] 조회조건 — 컬럼과 갈라 센다 */
    searchFields: set(searchCells.map((c) => c.name)),
    /* [화면] 셀 유형 — 같은 컬럼을 다른 유형으로 그렸는지 */
    colTypes: set(
      colCells
        .map((c) => [c.name, c.body.match(/\btype:\s*'(\w+)'/)?.[1]])
        .filter(([, t]) => t)
        .map(([n, t]) => `${n}=${t}`),
    ),
    /* [편집] 편집이 열린 컬럼 — 기본이 false 라 <b>명시한 것만</b> 열린다(declarations.md §1) */
    editables: set(flagged(colCells, 'editable')),
    /* [편집] 필수·PK — 저장을 거부하는 자리 */
    guards: set([...flagged(colCells, 'required').map((n) => `${n}:required`), ...flagged(colCells, 'pk').map((n) => `${n}:pk`)]),
    /* [편집] 검증·연쇄·여는 것 — 규칙이 어느 셀에 붙었나 */
    rules: set([
      ...present(colCells, 'validate'),
      ...present(colCells, 'afterEdit'),
      ...present(colCells, 'popup'),
      ...present(colCells, 'listModal'),
      ...present(colCells, 'viewer'),
    ]),
    /* [편집] 값의 출처 — 공통코드 그룹 · 고정 목록 · 동적 컬럼 */
    valueSrc: set([
      ...[...feCode.matchAll(/\bgrpCd:\s*'([^']+)'/g)].map((m) => `grpCd:${m[1]}`),
      ...present(colCells, 'options'),
      ...flagged(colCells, 'dynamic').map((n) => `${n}:dynamic`),
    ]),
    /* [계약] api 선언 — 무엇이 서는가. `read` 가 없으면 조회 버튼이 없다(declarations.md §3) */
    apiDecl: set([
      ...[...feCode.matchAll(/\b(read|save|actions):\s*[{[]/g)].map((m) => m[1]),
      ...[...feCode.matchAll(/\bkey:\s*'(\w+)'/g)].map((m) => `action:${m[1]}`),
    ]),
    /*
     * [계약] 컨트롤러·저장 옵션 — declarations.md §3·§4 의 어휘를 그대로 센다.
     *
     * <p>컬럼에 붙지 않는 결정이 여기 있다. 저장 전 확인 창을 띄우나, 서버 필드 오류를
     * 셀에 꽂나, 저장 본문을 화면이 만드나 — <b>조회 전용 화면에는 아예 없던 축</b>이라
     * 컬럼만 세면 저장이 통째로 빠진 재현도 만점이 나온다.
     */
    ctrlOpts: set(
      [
        ...feCode.matchAll(
          /\b(confirm|warn|reloadAfter|locateFieldErrors|onSuccess|toSavePayload|addRow|canAdd|defaults|emptyNotice|searchParams|pageSize|menuCd|progress|eligible|target|toTargets):/g,
        ),
      ].map((m) => m[1]),
    ),
    /* [문구] MSG 키 */
    msg: set([...feCode.matchAll(/\bMSG\.([A-Z0-9_]+)/g)].map((m) => m[1])),
    /* [뼈대] shared import */
    shared: set([...feCode.matchAll(/from\s+'(@\/shared\/[^']*)'/g)].map((m) => m[1])),
    /* [백엔드] 클래스와 public 메서드 */
    classes: set([...beSrc.matchAll(/\b(?:class|record|interface|enum)\s+(\w+)/g)].map((m) => m[1])),
    methods: set(
      [...strip(beSrc).matchAll(/\bpublic\s+(?:static\s+)?[\w<>,.\s[\]?]+\s+(\w+)\s*\(/g)].map((m) => m[1]),
    ),
    /*
     * [기계 규칙] 어기면 빌드가 깨지는 것들 — 샌드박스에는 게이트가 없으므로 정적으로 센다.
     *
     * **자기 기능을 부르는 import 는 위반이 아니다.** 금지된 것은 `features/*` 끼리이며
     * 자기 폴더를 별칭으로 부르는 것은 표준이 권하는 쪽이다.
     */
    violations: [
      ...rule(linted, /['"`][^'"`\n]*[가-힣][^'"`\n]*['"`]/g, '한글 리터럴'),
      ...rule(linted, />\s*[^<>{}\n]*[가-힣][^<>{}\n]*\s*</g, 'JSX 한글'),
      ...rule(linted, /from\s+'@\/shared\/api\/[^']+'/g, '딥 임포트(@/shared/api/*)'),
      ...rule(linted, new RegExp(`from\\s+'@/features/(?!${feature ?? '__none__'}/)`, 'g'), 'features 간 import'),
      ...rule(lintedNoEndpoints, /['"`]\/(?:api|service)\/[^'"`]*['"`]/g, 'URL 리터럴(endpoints.ts 밖)'),
    ],
    /* [근거 분포] _EVAL/SOURCES.md */
    sources: evidence(root),
  };
}

function rule(src, re, label) {
  const hits = [...src.matchAll(re)].map((m) => m[0].trim().slice(0, 60));
  return hits.length ? [`${label} ${hits.length}건 — 예: ${hits[0]}`] : [];
}

/** `SOURCES.md` 의 표에서 근거 분류를 센다. 한 행에 둘이 걸리면 둘 다 센다(중복 허용). */
function evidence(root) {
  const md = read(join(root, '_EVAL/SOURCES.md'));
  if (!md) return null;
  const rows = md.split('\n').filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:|-]+\|/.test(l) && !/근거\s*분류/.test(l));
  const count = { 요건서: 0, 가이드: 0, 옆화면: 0, 추측: 0 };
  for (const r of rows) for (const k of Object.keys(count)) if (r.includes(k)) count[k] += 1;
  return { rows: rows.length, count };
}

// ── 견주기 ────────────────────────────────────────────────────────

const data = targets.map((t) => ({ ...t, ...facts(t.root) }));
const [real, ...runs] = data;

const AXES = [
  ['계약 (endpoints)', 'endpoints'],
  ['타입 이름', 'types'],
  ['타입 필드', 'fields'],
  ['그리드 컬럼', 'columns'],
  ['컬럼 폭', 'widths'],
  ['셀 유형', 'colTypes'],
  ['조회조건', 'searchFields'],
  ['편집 열린 컬럼', 'editables'],
  ['필수 · PK', 'guards'],
  ['검증 · 연쇄 · 여는 것', 'rules'],
  ['값의 출처', 'valueSrc'],
  ['api 선언 · 액션', 'apiDecl'],
  ['컨트롤러 · 저장 옵션', 'ctrlOpts'],
  ['문구 키 (MSG)', 'msg'],
  ['공통물 import', 'shared'],
  ['백엔드 클래스', 'classes'],
  ['백엔드 public 메서드', 'methods'],
];

const out = [];
const say = (s = '') => out.push(s);

say(`# 화면 재현 채점 — ${screenPath}`);
say();
say(`| 트리 | 기능 폴더 | 프론트 파일 | 백엔드 파일 | 그중 테스트 |`);
say(`|---|---|---|---|---|`);
for (const d of data) {
  say(
    `| ${d.name} | ${d.feature ?? '**등록 없음**'} | ${d.files.front.length} | ${d.files.back.length} | ${d.files.tests} |`,
  );
}

say();
say(`## 축별 일치`);
say();
say(`| 축 | ${data.map((d) => d.name).join(' | ')} | ${runs.map((r) => `${r.name}↔실물`).join(' | ')} | ${runs.length > 1 ? 'A↔B' : ''} |`);
say(`|---|${data.map(() => '---').join('|')}|${runs.map(() => '---').join('|')}|${runs.length > 1 ? '---|' : ''}`);
for (const [label, key] of AXES) {
  const sizes = data.map((d) => d[key].length);
  const vsReal = runs.map((r) => symdiff(real[key], r[key]));
  const ab = runs.length > 1 ? symdiff(runs[0][key], runs[1][key]) : '';
  say(`| ${label} | ${sizes.join(' | ')} | ${vsReal.join(' | ')} | ${ab} |`);
}
say();
say(`숫자는 **집합의 크기**, 뒤쪽 칸은 **대칭차**(양쪽 중 한쪽에만 있는 원소 수) — 0 이면 완전 일치.`);

for (const [label, key] of AXES) {
  const lines = [];
  for (const r of runs) {
    const only = diff(r[key], real[key]);
    const miss = diff(real[key], r[key]);
    if (only.length) lines.push(`- **${r.name} 에만**: ${only.join(' · ')}`);
    if (miss.length) lines.push(`- **${r.name} 에 없음**: ${miss.join(' · ')}`);
  }
  if (lines.length) {
    say();
    say(`### ${label}`);
    say();
    lines.forEach(say);
  }
}

say();
say(`## 기계 규칙 위반`);
say();
for (const d of data) {
  say(`- **${d.name}**: ${d.violations.length ? d.violations.join(' · ') : '없음'}`);
}

say();
say(`## 근거 분포 — 결정 중 그 근거가 낀 비율`);
say();
say(`| 트리 | 결정 | 요건서 | 가이드 | 옆화면 | 추측 |`);
say(`|---|---|---|---|---|---|`);
for (const d of data) {
  const e = d.sources;
  if (!e) {
    say(`| ${d.name} | — | — | — | — | — |`);
    continue;
  }
  const pct = (n) => (e.rows ? `${Math.round((n / e.rows) * 100)}%` : '—');
  say(`| ${d.name} | ${e.rows} | ${pct(e.count.요건서)} | ${pct(e.count.가이드)} | ${pct(e.count.옆화면)} | ${pct(e.count.추측)} |`);
}
say();
say(`> **\`옆화면\` 이 내려가야 한다** — 문서가 소스를 대신하는 만큼 내려간다.`);
say(`> **\`추측\` 이 높으면 다음에 쓸 문서를 가리킨다.**`);

function symdiff(a, b) {
  return diff(a, b).length + diff(b, a).length;
}

console.log(out.join('\n'));
