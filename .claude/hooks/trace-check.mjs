/**
 * 추적성 검사 — `PostToolUse`(`documents/spec/**` 쓰기) 훅 겸 `/trace` 스킬의 실행기.
 *
 * <pre>
 *   node .claude/hooks/trace-check.mjs --all      전체 검사 후 사람이 읽는 리포트
 *   node .claude/hooks/trace-check.mjs --report   〃 + 추적성 매트릭스
 *   (인자 없이 표준 입력으로 훅 입력을 받으면 spec 변경 직후 축약 검사)
 * </pre>
 *
 * <p>규칙은 `aidd-guide/process/traceability.md` 의 T1~T12 다. <b>여기는 집행이고 정의는
 * 그쪽이다</b> — 규칙을 두 곳에 적으면 갈리고, 갈리면 초록불이 거짓이 된다.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { REPO, readHookInput, targetPath, repoRelative, readText, parseYaml, warn, pass } from './lib.mjs';

const SPEC_DIR = 'documents/spec';
const SPEC = {
  req: '10-requirements.yaml',
  nfr: '21-nfr.yaml',
  uc: '30-usecases.yaml',
  feat: '31-features.yaml',
  ent: '40-domain.yaml',
  api: '50-api.yaml',
  scr: '60-screens.yaml',
  tc: '70-testcases.yaml',
};

const ID_RE =
  /\b(ACT|CON|PRC|REQ|TRM|ADR|NFR|UC|FEAT|ENT|API|SCR|IF|TC|SLICE|DEF|ASM|CR|MNU|GOAL|NGOAL|PRN)-[0-9]{2,}(?:-[0-9]{2,})?\b/g;

/** 정의가 다른 원장에 있는 접두 — dangling 판정에서 뺀다. */
const EXTERNAL = ['ASM-', 'CR-', 'DEF-', 'SLICE-', 'ADR-'];

const argv = process.argv.slice(2);
if (argv.includes('--all') || argv.includes('--report')) {
  const { errors, warnings } = fullCheck();
  process.stdout.write(report(errors, warnings));
  if (argv.includes('--report')) process.stdout.write('\n\n' + matrix());
  process.stdout.write('\n');
  process.exit(0);
}

const input = await readHookInput();
const path = repoRelative(targetPath(input));
if (!path || !path.startsWith(`${SPEC_DIR}/`)) pass();

const { errors } = fullCheck();
if (errors.length === 0) pass();

const head = errors.slice(0, 8).map(([rule, target, msg]) => `  [${rule}] ${target}: ${msg}`);
warn(
  [
    `추적성 오류 ${errors.length}건이 남아 있다 (게이트 통과 불가):`,
    ...head,
    errors.length > 8 ? `  … 외 ${errors.length - 8}건. \`/trace\` 로 전체 확인` : '',
  ]
    .filter(Boolean)
    .join('\n'),
);

// ── 검사 ──────────────────────────────────────────────────────────

function load(file) {
  const p = join(REPO, SPEC_DIR, file);
  if (!existsSync(p)) return null;
  try {
    return parseYaml(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** 문서에서 항목 리스트를 꺼낸다 — 최상위 리스트이거나, 리스트를 담은 첫 칸이다. */
function asList(doc, key) {
  if (!doc) return [];
  if (Array.isArray(doc)) return doc.filter(Boolean);
  if (typeof doc === 'object') {
    if (Array.isArray(doc[key])) return doc[key].filter(Boolean);
    for (const v of Object.values(doc)) if (Array.isArray(v)) return v.filter(Boolean);
  }
  return [];
}

/** 여러 칸에 흩어진 참조 ID 를 하나의 집합으로 모은다. */
function refs(item, ...keys) {
  const out = new Set();
  for (const k of keys) {
    const v = item?.[k];
    if (typeof v === 'string') out.add(v);
    else if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') out.add(x);
    else if (v && typeof v === 'object') {
      for (const vv of Object.values(v)) {
        if (typeof vv === 'string') out.add(vv);
        else if (Array.isArray(vv)) for (const x of vv) if (typeof x === 'string') out.add(x);
      }
    }
  }
  return out;
}

/** spec 전체에서 `id:` 정의와 본문 참조를 모은다 — T11 · T12 의 근거. */
function collectIds() {
  const defined = new Map();
  const referenced = new Map();
  const base = join(REPO, SPEC_DIR);
  if (!existsSync(base)) return { defined, referenced };
  for (const file of walk(base)) {
    if (!/\.(ya?ml)$/.test(file)) continue;
    const text = readText(file);
    const rel = relative(REPO, file).split(sep).join('/');
    for (const line of text.split('\n')) {
      const m = line.match(/(?:^|[-\s{])id:\s*([A-Z]+-[0-9][\w-]*)/);
      if (m) {
        if (!defined.has(m[1])) defined.set(m[1], []);
        defined.get(m[1]).push(rel);
      }
    }
    for (const m of text.matchAll(ID_RE)) {
      if (!referenced.has(m[0])) referenced.set(m[0], new Set());
      referenced.get(m[0]).add(rel);
    }
  }
  return { defined, referenced };
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function fullCheck() {
  const errors = [];
  const warnings = [];

  const reqs = asList(load(SPEC.req), 'requirements');
  const nfrs = asList(load(SPEC.nfr), 'nfrs');
  const ucs = asList(load(SPEC.uc), 'usecases');
  const feats = asList(load(SPEC.feat), 'features');
  const ents = asList(load(SPEC.ent), 'entities');
  const apis = asList(load(SPEC.api), 'apis');
  const scrs = asList(load(SPEC.scr), 'screens');
  const tcs = asList(load(SPEC.tc), 'testcases');

  // T12 — ID 중복 정의
  const { defined, referenced } = collectIds();
  for (const [id, files] of defined) {
    if (files.length > 1) errors.push(['T12', id, `ID 중복 정의: ${[...new Set(files)].sort().join(', ')}`]);
  }

  // T11 — dangling reference
  for (const [id, files] of referenced) {
    if (defined.has(id)) continue;
    if (EXTERNAL.some((p) => id.startsWith(p))) continue;
    errors.push(['T11', id, `정의되지 않은 ID 참조: ${[...files].sort().join(', ')}`]);
  }

  // 커버리지 맵
  const ucReqs = new Set();
  for (const u of ucs) for (const r of refs(u, 'reqs', 'req')) ucReqs.add(r);
  const featUp = new Set();
  for (const f of feats) for (const r of refs(f, 'usecases', 'reqs')) featUp.add(r);

  // T1 — REQ ↔ ACT
  for (const r of reqs) {
    if (r?.type === 'functional' && refs(r, 'actors', 'actor').size === 0) {
      errors.push(['T1', r?.id, '액터 연결 없음']);
    }
  }

  // T2 — 미실현 REQ
  for (const r of reqs) {
    if (r?.type !== 'functional' || r?.priority === 'wont') continue;
    if (!ucReqs.has(r?.id) && !featUp.has(r?.id)) {
      errors.push(['T2', r?.id, '미실현 요구사항 — UC/FEAT 연결 없음']);
    }
  }

  // T3 — UC → REQ
  for (const u of ucs) {
    if (refs(u, 'reqs', 'req').size === 0) errors.push(['T3', u?.id, '근거 REQ 없음']);
  }

  /*
    T4 — FEAT → UC / REQ / **NFR**

    `nfrs` 를 받아들이는 것이 원래 규칙과 다르다. **비기능 목표만 실현하는 기능이 실재한다** —
    모델 단가 관리 · 전사 예산 계획 · 토큰 집계 · 스케줄러는 어느 기능 요구사항의 실현체도
    아니고 비용·안정성 목표의 실현체다. 그것을 고아로 부르면 **없는 REQ 를 만들어 붙이게
    되고**, 그 REQ 는 추적성을 위해서만 존재하는 거짓 항목이 된다.
    → aidd-guide/process/traceability.md §3
  */
  for (const f of feats) {
    if (refs(f, 'usecases', 'reqs', 'nfrs').size === 0) {
      errors.push(['T4', f?.id, '고아 기능 — UC/REQ/NFR 역추적 불가']);
    }
  }

  // T5 · T6 — FEAT → TC
  const tcByFeat = new Map();
  for (const t of tcs) {
    const key = t?.feature;
    if (!tcByFeat.has(key)) tcByFeat.set(key, []);
    tcByFeat.get(key).push(t);
  }
  const EXCEPTION_TYPES = ['business_exception', 'validation', 'permission', 'exception'];
  for (const f of feats) {
    const mine = tcByFeat.get(f?.id) ?? [];
    if (mine.length === 0) {
      errors.push(['T5', f?.id, '테스트 케이스 없음']);
    } else if (!mine.some((t) => EXCEPTION_TYPES.includes(t?.type))) {
      warnings.push(['T6', f?.id, '정상 케이스만 있다 — 예외 TC 필요']);
    }
  }

  // T7 — NFR 측정
  for (const n of nfrs) {
    if (!n?.measurement || !n?.test_case) {
      errors.push(['T7', n?.id, '측정 방법 또는 TC 없음 — 측정 못 하는 목표는 목표가 아니다']);
    }
  }

  // T8 — 미사용 ENT
  const usedEnt = new Set();
  for (const f of feats) for (const e of refs(f, 'entities')) usedEnt.add(e);
  for (const e of ents) {
    if (!usedEnt.has(e?.id)) warnings.push(['T8', e?.id, '어떤 FEAT 에서도 쓰이지 않는다']);
  }

  // T9 — API/SCR → FEAT
  for (const a of apis) if (!a?.feature) errors.push(['T9', a?.id, '소속 FEAT 없음']);
  for (const s of scrs) if (!s?.feature) errors.push(['T9', s?.id, '소속 FEAT 없음']);

  // UC 예외 흐름 (G3 필수)
  for (const u of ucs) {
    if (!u?.exception_flows) errors.push(['UC', u?.id, '예외 흐름 없음 — 예외 없는 유즈케이스는 미완성']);
  }

  // ENT 필수 속성
  for (const e of ents) {
    const attrs = Array.isArray(e?.attributes) ? e.attributes : [];
    if (!attrs.some((a) => a?.pk)) errors.push(['ENT', e?.id, 'PK 없음']);
    if (attrs.some((a) => a?.enum && a?.name === 'status') && !e?.state_machine) {
      errors.push(['ENT', e?.id, 'status 컬럼이 있으나 state_machine 미정의']);
    }
    if (!e?.delete_policy) warnings.push(['ENT', e?.id, '삭제 정책(delete_policy) 미정의']);
  }

  /*
    T10 — 코드 태그. **개별 파일을 나열하지 않고 건수로 집계한다.**

    백오피스 템플릿이 이 추적성 체계보다 앞서 들어왔으므로 미태깅이 수백 건이다. 줄줄이
    나열하면 <b>T6·T8 의 경고가 그 아래 묻힌다</b> — 많은 것을 다 보여주는 것이 아무것도
    보여주지 않는 것이 된다. 상한까지만 예로 들고 나머지는 수로 말한다.
    → aidd-guide/process/traceability.md §3
  */
  const src = join(REPO, 'sources');
  if (existsSync(src)) {
    const untagged = [];
    for (const file of walk(src)) {
      const rel = relative(REPO, file).split(sep).join('/');
      if (!/\.(java|kt|ts|tsx|js|jsx)$/.test(rel)) continue;
      if (/\/(node_modules|build|dist|target|\.gradle)\//.test(rel)) continue;
      if (/\/(test|spec)\//.test(rel) || /\.(test|spec)\.[jt]sx?$/.test(rel)) continue;
      if (!readText(file).slice(0, 1500).includes('@feat')) untagged.push(rel);
    }
    if (untagged.length > 0) {
      warnings.push([
        'T10',
        `소스 ${untagged.length}개`,
        `@feat FEAT-### 태그 없음 — 예: ${untagged.slice(0, 3).join(' · ')}${untagged.length > 3 ? ' …' : ''}`,
      ]);
    }
  }

  return { errors, warnings };
}

// ── 리포트 ────────────────────────────────────────────────────────

function report(errors, warnings) {
  const out = ['## 추적성 검사 결과', '', `**오류 ${errors.length}건 / 경고 ${warnings.length}건**`];
  if (errors.length > 0) {
    out.push('', '### 오류 (게이트 통과 불가)', '', '| 규칙 | 대상 | 내용 |', '|---|---|---|');
    for (const [rule, target, msg] of errors.slice(0, 80)) out.push(`| ${rule} | ${target} | ${msg} |`);
    if (errors.length > 80) out.push(`| … | | 외 ${errors.length - 80}건 |`);
  }
  if (warnings.length > 0) {
    out.push('', '### 경고', '', '| 규칙 | 대상 | 내용 |', '|---|---|---|');
    for (const [rule, target, msg] of warnings.slice(0, 60)) out.push(`| ${rule} | ${target} | ${msg} |`);
    if (warnings.length > 60) out.push(`| … | | 외 ${warnings.length - 60}건 |`);
  }
  if (errors.length === 0 && warnings.length === 0) out.push('', '모든 추적성 규칙을 통과했다.');
  return out.join('\n');
}

/** 추적성 매트릭스 — `/trace --report` 가 `documents/generated/` 로 옮겨 담는다. */
function matrix() {
  const reqs = asList(load(SPEC.req), 'requirements');
  const ucs = asList(load(SPEC.uc), 'usecases');
  const feats = asList(load(SPEC.feat), 'features');
  const apis = asList(load(SPEC.api), 'apis');
  const scrs = asList(load(SPEC.scr), 'screens');
  const tcs = asList(load(SPEC.tc), 'testcases');

  const rows = ['## 추적성 매트릭스', '', '| REQ | 우선순위 | UC | FEAT | ENT | API | SCR | TC |', '|---|---|---|---|---|---|---|---|'];
  for (const r of reqs) {
    const myUcs = ucs.filter((u) => refs(u, 'reqs', 'req').has(r?.id));
    const myFeats = feats.filter(
      (f) => refs(f, 'reqs').has(r?.id) || myUcs.some((u) => refs(f, 'usecases').has(u?.id)),
    );
    const featIds = myFeats.map((f) => f?.id);
    const cell = (xs) => (xs.length > 0 ? xs.join(', ') : '—');
    rows.push(
      `| ${r?.id} | ${r?.priority ?? '—'} | ${cell(myUcs.map((u) => u?.id))} | ${cell(featIds)} | ` +
        `${cell([...new Set(myFeats.flatMap((f) => [...refs(f, 'entities')]))])} | ` +
        `${cell(apis.filter((a) => featIds.includes(a?.feature)).map((a) => a?.id))} | ` +
        `${cell(scrs.filter((s) => featIds.includes(s?.feature)).map((s) => s?.id))} | ` +
        `${cell(tcs.filter((t) => featIds.includes(t?.feature)).map((t) => t?.id))} |`,
    );
  }
  rows.push('', '`—` 이 REQ 행에 남아 있으면 **미실현 요구사항**이며 G3 를 통과할 수 없다.');
  return rows.join('\n');
}
