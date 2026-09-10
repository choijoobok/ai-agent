/**
 * spec → 사람이 읽는 문서. `documents/spec/*.yaml` 에서 `documents/generated/` 를 만든다.
 *
 * <p><b>왜 스크립트인가</b> — 파생물의 값은 *정본에서 언제든 같은 것이 다시 나온다* 는
 * 데 있다. 생성을 산문 지시로만 두면 부를 때마다 결과가 흔들리고, 그러면 그 값이 사라진다.
 * 여기 있는 대상은 **결정적으로 다시 나온다.**
 *
 * <p><b>의존성을 갖지 않는다</b> — YAML 은 `hooks/lib.mjs` 의 `parseYaml` 로 읽는다.
 * 그 파서는 일부러 좁고, 좁은 것이 값이다. PyYAML 과 전 spec 을 대조해 차이가 셋뿐임을
 * 확인했고(2026-09-07) 셋 다 *인용 없는 날짜를 문자열로 읽는다* 는 같은 것이다 —
 * 문서 생성에는 문자열이 맞다.
 *
 * <p><b>설계 원칙: 필드를 하나도 떨어뜨리지 않는다.</b> 컬럼을 골라 표를 짜면 고르지 않은
 * 칸이 조용히 사라지고, <b>파생 뷰에서 사라진 항목은 없는 항목이 된다.</b> 그래서 렌더러가
 * 항목의 모든 키를 싣고, `--check` 가 그것을 기계로 센다. 실제로 그 검사가 손으로 짠
 * 아키텍처 표에서 규범 셋이 빠진 것을 잡았다.
 *
 * <pre>
 *   node .claude/skills/doc-gen/gen.mjs                 # 구현된 대상 전부
 *   node .claude/skills/doc-gen/gen.mjs 요구사항정의서 화면정의서
 *   node .claude/skills/doc-gen/gen.mjs --check         # 생성물이 spec 을 다 담았나
 * </pre>
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, normalize, posix } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../hooks/lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const SPEC = 'documents/spec/';
const OUT = 'documents/generated/';
const RQ = `${OUT}10-요구사항정의서/`;
const TODAY = new Date().toISOString().slice(0, 10);

/** 필드 이름 → 사람이 읽는 라벨. **없는 키는 그대로 낸다** — 조용히 숨기지 않는다. */
const LABEL = {
  title: '제목', name: '이름', detail: '내용', note: '비고', why: '왜', goals: '목적',
  kind: '유형', module: '모듈', scope: '범위', constraint: '제약', area: '영역',
  decide: '확정할 내용', owner: '소유', hard_rule: '**강한 규칙**', hard_rules: '**강한 규칙**',
  hard_requirement: '**전제**', traces_to: '연결', reqs: '요구사항', who: '누가', risk: '위험',
  term: '용어', key: '영문 키', group: '분류', definition: '정의', origin: '출처',
  relation: '우리 것과의 관계', type: '유형', priority: '우선순위', actors: '액터',
  open: '미확정', open2: '미확정', category: '분류', requirement: '요구',
  measurement: '측정 방법', test_case: '테스트 케이스', target: '목표값', direction: '방향',
  aggregation: '집계 규칙',
  peer: '상대', protocol: '프로토콜', prerequisites: '전제', status: '상태', screen: '화면',
  phase: 'Phase', feature: '기능', agent_contact: 'agent 와의 접점', undecided: '미확정',
  claim: '주장', axis: '축', rank: '순위', metrics: '지표', why_first: '왜 첫째인가',
  was: '전에는', why_demoted: '왜 내렸나', includes: '포함', excludes: '제외', goal: '목표',
  object: '대상', mapping: '매핑', meaning: '뜻', users: '사용자', form: '형태',
  responsibility: '책임', forbidden: '금지', holds: '무엇을 갖나', source: '원천',
  layer: '계층', layers: '계층', infra_requirements: '인프라 요건', implementation: '구현',
  not_supported: '지원하지 않는 것', stages: '단계', means: '수단', pair: '짝',
  severity: '성격', left: '한쪽', right: '다른 쪽', middle: '가운데', evidence: '근거',
  rule: '규칙', rules: '규칙', state: '상태', next: '다음 상태',
  waits_for: '무엇을 기다리나', resume: '재개 처리', path: '경로', increments: '회차 상승',
  exceptions: '예외', baselined: '동결일', zone: '구역', contains: '무엇이 있나',
  label: '이름', from: '에서', to: '으로', mode: '방식', caution: '주의',
  core_claim: '핵심', gained: '얻은 것', catalog: '카탈로그', unique: '유일성',
  why_safe: '왜 안전한가', context: '컨텍스트', steps: '단계', abstraction: '추상화',
  account_source: '계정 원천', mapping_rules: '매핑 규칙', handling: '처리', limits: '한계',
  complement: '보완', notes: '비고', edge_invariants: '불변식', retired_at: '폐기일',
  reason: '사유', replaced_by: '대체', nodes: '구성요소', edges: '간선',
  l1: 'Level 1 에서', deploy: '배포 단위', systems: '상자', units: '배포 단위',
  decided_at: '확정일', review_signal: '재검토 신호', ownership: '데이터 소유권',
  operations: '운영 분담',
};
const lab = (k) => LABEL[k] ?? k;

/** 스칼라·리스트를 한 줄로. 리스트는 ` · ` 로 잇는다. */
function flat(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '예' : '아니오';
  if (Array.isArray(v)) return v.length ? v.map(flat).join(' · ') : '—';
  if (typeof v === 'object') {
    return Object.entries(v).map(([k, x]) => `${lab(k)}: ${flat(x)}`).join(' · ');
  }
  return String(v).replace(/\n/g, ' ').trim();
}

const keysOf = (items) => [...new Set(items.flatMap((it) => Object.keys(it)))];
const isShort = (items, keys) => items.every((it) => keys.every((k) => flat(it[k]).length <= 90));

function table(items, keys) {
  const rows = [`| ${keys.map(lab).join(' | ')} |`, `|${keys.map(() => '---').join('|')}|`];
  for (const it of items) rows.push(`| ${keys.map((k) => flat(it[k]).replace(/\|/g, '\\|')).join(' | ')} |`);
  return rows.join('\n');
}

/** 항목마다 소제목 + 남은 필드를 불릿으로. **키를 떨어뜨리지 않는다.** */
function blocks(items, headKeys = ['id'], titleKey = 'title', level = '###') {
  const out = [];
  for (const it of items) {
    const hid = headKeys.filter((k) => it[k] !== undefined && it[k] !== null).map((k) => String(it[k])).join(' · ');
    const ttl = it[titleKey] ?? it.name ?? it.term ?? it.area ?? it.label ?? '';
    out.push(`${level} ${hid}${ttl ? ` — ${ttl}` : ''}`, '');
    for (const [k, v] of Object.entries(it)) {
      if (headKeys.includes(k) || k === titleKey) continue;
      if (Array.isArray(v) && v.length && typeof v[0] === 'object' && v[0] !== null) {
        out.push(`- **${lab(k)}**`);
        for (const x of v) out.push(`  - ${flat(x)}`);
      } else if (Array.isArray(v) && v.length > 1) {
        out.push(`- **${lab(k)}**`);
        for (const x of v) out.push(`  - ${flat(x)}`);
      } else {
        out.push(`- **${lab(k)}** — ${flat(v)}`);
      }
    }
    out.push('');
  }
  return out.join('\n');
}

/** 짧으면 표, 길면 블록. **어느 쪽이든 모든 키를 싣는다.** */
function auto(items, { keys, level = '###', titleKey = 'title' } = {}) {
  const ks = keys ?? keysOf(items);
  return isShort(items, ks) ? table(items, ks) : blocks(items, ['id'], titleKey, level);
}

const bullets = (seq) => seq.map((x) => `- ${flat(x)}`).join('\n');

/**
 * 문서 머리. `status` 가 승인 상태를 말하며 **`mixed` 는 배너를 달지 않는다** —
 * 목차처럼 장마다 상태가 다른 문서에 하나를 적으면 거짓이 된다.
 */
function head(id, title, from, status, baselined, traces, extra = '') {
  const banner = {
    migrated:
      '> **아직 승인 전이다**(`status: migrated` · `baselined: null`). 여기의 어떤 항목도\n'
      + '> *합의된 것* 으로 인용하지 않는다 — 인용하려면 `/phase-gate` 승인이 먼저다.\n',
    baselined: `> **승인됐다**(\`baselined: ${baselined}\`). 이후 변경은 \`/change-request\` 를 거친다.\n`,
    empty: '> **비어 있다.** 아래에 *왜 비어 있고 무엇에 막혀 있는지* 를 적는다.\n',
  }[status] ?? '';
  return `---
id: ${id}
title: "${title}"
traces_to: [${(traces ?? []).join(', ')}]
status: ${status}
baselined: ${baselined ?? 'null'}
generated_from: ${from}
last_sync: ${TODAY}
---
<!-- 이 문서는 생성물입니다. 직접 수정하지 마세요. ${from} 을 수정 후 /doc-gen 하세요. -->

# ${title}

${banner}${extra}`;
}

const load = (f) => parseYaml(readFileSync(join(REPO, SPEC + f + '.yaml'), 'utf8'));
const rawSpec = (f) => readFileSync(join(REPO, SPEC + f + '.yaml'), 'utf8');

const written = [];
function write(path, parts) {
  const text = `${parts.join('\n\n').replace(/\n+$/, '')}\n`;
  const full = join(REPO, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text, 'utf8');
  written.push([path, text.split('\n').length]);
}

// ── 43행 · 요구사항 정의서 — P0~P2 정본 여덟의 읽는 뷰 ──────────────
function 요구사항정의서() {
  const c = load('00-charter');
  const p = [head('RQ-00-charter', '개요 — 목적 · 목표 · 성공 기준 · 로드맵', `${SPEC}00-charter.yaml`,
    c.meta.status, c.meta.baselined, c.goals.map((g) => g.id))];
  p.push(`## 1. 목적\n\n**${flat(c.purpose)}**\n\n${flat(c.purpose_note)}`);
  p.push(`## 2. 배경 — 현행 시스템의 한계\n\n${auto(c.problems)}`);
  p.push(`## 3. 이 제품의 경제성\n\n**목적이 참인가는 이 다섯이 참인가에 달려 있다.**\n\n${auto(c.economics, { titleKey: 'claim' })}`);
  p.push(`## 4. 최종 목표\n\n${auto(c.goals)}`);
  p.push(`## 5. 비목표 — 하지 않는 것\n\n**하지 않겠다고 적지 않은 것은 하겠다고 읽힌다.**\n\n${auto(c.non_goals)}`);
  p.push(`## 6. 범위 (In)\n\n${bullets(c.scope_in)}\n\n**방향** — ${flat(c.direction)}`);
  const policy = c.measurement_first
    ? '**방침 — 측정을 먼저 만든다(`measurement_first: true`).** 목표를 미리 세우지 않고\n'
      + '*재는 것을 먼저 만들고 → 정확히 재고 → 개선이 필요한지 판단한다*. 그래서 `목표값` 의\n'
      + '빈칸은 **빠진 것이 아니라 아직 재지 않았다**는 뜻이다.'
    : '**방침** — 목표를 먼저 세운다.';
  p.push(`## 7. 성공 기준\n\n${policy}\n\n${auto(c.success_criteria)}`);
  p.push(`### 7.1 성공 기준에서 내린 지표 — 추적은 계속한다\n\n${auto(c.tracked_metrics, { level: '####' })}`);
  p.push(`### 7.2 불변식\n\n${auto(c.invariants, { level: '####' })}\n\n${bullets(c.success_notes)}`);
  p.push(`## 8. 로드맵\n\n${auto(c.roadmap)}\n\n${bullets(c.roadmap_notes)}`);
  p.push(`## 9. 트랙과 기대치\n\n- **트랙** — ${flat(c.track)} · ${flat(c.track_why)}\n`
    + Object.entries(c.expectations).map(([k, v]) => `- **${lab(k)}** — ${flat(v)}`).join('\n'));
  write(`${RQ}00-개요.md`, p);

  const a = load('01-actors');
  const p1 = [head('RQ-01-actors', '이해관계자 — 액터와 모듈', `${SPEC}01-actors.yaml`,
    a.meta.status, a.meta.baselined, a.actors.map((x) => x.id),
    '> **액터는 요구사항의 근거다**(추적성 T1) — 모든 요구사항은 최소 하나의 액터와 연결된다.\n')];
  const seen = new Set();
  for (const [kind, ttl] of [['human', '사람'], ['system', '외부 시스템'], ['org', '외부 조직']]) {
    const sel = a.actors.filter((x) => x.kind === kind);
    sel.forEach((x) => seen.add(x.id));
    if (sel.length) p1.push(`## ${ttl}\n\n${blocks(sel, ['id'], 'name')}`);
  }
  const rest = a.actors.filter((x) => !seen.has(x.id));
  if (rest.length) p1.push(`## 그 밖\n\n${blocks(rest, ['id'], 'name')}`);
  p1.push(`## 모듈\n\n${blocks(a.modules, ['id'], 'name')}`);
  write(`${RQ}01-이해관계자.md`, p1);

  const k = load('02-constraints');
  write(`${RQ}02-제약과-원칙.md`, [
    head('RQ-02-constraints', '제약과 설계 원칙', `${SPEC}02-constraints.yaml`,
      k.meta.status, k.meta.baselined, k.principles.map((x) => x.id)),
    '## 1. 설계 원칙\n\n> **이후 모든 판단의 기준이다.** 선택지가 갈릴 때 이 원칙에 부합하는 쪽을 택한다.\n\n'
      + blocks(k.principles, ['id'], 'title'),
    `## 2. 기술 제약\n\n${blocks(k.technical, ['id'], 'area')}`,
    `## 3. 배포·망 전제\n\n${blocks(k.deployment, ['id'], 'title')}`,
    '## 4. 착수 시 확정해야 하는 것\n\n'
      + '> **시스템 기능이 아니므로 여기서 값을 확정하지 않는다.** 대신 **확정되지 않은 상태로\n'
      + '> 구축에 들어가지 않는다**는 것을 요건으로 둔다.\n\n'
      + blocks(k.customer_agreements, ['id'], 'area'),
    `## 5. 개발 기간의 제약\n\n${blocks(k.development, ['id'], 'title')}`,
  ]);

  const g = load('03-glossary');
  const p3 = [head('RQ-03-glossary', '용어 사전 — 유비쿼터스 언어', `${SPEC}03-glossary.yaml`,
    g.meta.status, g.meta.baselined, null,
    '> **이 사전이 모든 문서·DB 테이블·API 필드 명명의 기준이다.** 동의어를 섞어 쓰지 않는다.\n'
    + '> `영문 키` 는 DB 컬럼 값과 코드 상수에서 대문자 스네이크로 쓴다.\n')];
  for (const grp of [...new Set(g.terms.map((x) => x.group))]) {
    p3.push(`## 용어 — ${grp}\n\n${blocks(g.terms.filter((x) => x.group === grp), ['id'], 'term')}`);
  }
  p3.push(`## 개념 계층\n\n\`\`\`\n${flat(g.hierarchy)}\n\`\`\``);
  p3.push(`## 턴 상태 모델\n\n${auto(g.turn_states)}\n\n### 대기 유형\n\n`
    + `${blocks(g.wait_types, ['id'], 'type', '####')}\n### 상태 규칙\n\n${bullets(g.state_rules)}`);
  p3.push(`## 되돌림과 회차\n\n${auto(g.revision_rules, { titleKey: 'path' })}\n\n${bullets(g.revision_notes)}`);
  p3.push('## 프레임워크 용어\n\n'
    + '> **우리 명명의 기준이 아니다** — 그래서 `영문 키` 가 없다. 구현과\n'
    + '> [`design/turn-execution.md`](../../design/turn-execution.md) 를 읽을 때 필요해서 싣는다.');
  for (const grp of [...new Set(g.framework_terms.map((x) => x.group))]) {
    p3.push(`### ${grp}\n\n${auto(g.framework_terms.filter((x) => x.group === grp), { titleKey: 'term', level: '####' })}`);
  }
  p3.push(`### 훅과 인터럽트의 실행 순서\n\n**우리 설계가 이 순서에 의존한다.**\n\n`
    + `\`\`\`\n${flat(g.hook_order)}\n\`\`\`\n\n${bullets(g.hook_order_notes)}`);
  p3.push('## 헷갈리는 짝 — **이 장이 사전의 본론이다**\n\n'
    + '> 정의를 나란히 두는 것으로는 혼동이 막히지 않는다. **실제로 어긋난 것만** 여기 있다.\n\n'
    + blocks(g.confusions, ['title'], null));
  write(`${RQ}03-용어.md`, p3);

  const r = load('10-requirements');
  const p4 = [head('RQ-10-requirements', '기능 요구사항 (FR)', `${SPEC}10-requirements.yaml`,
    r.meta.status, r.meta.baselined, null, `> **채번** — ${r.meta.numbering}\n`)];
  const GROUPS = [[1, 29, '질의 처리'], [30, 99, '처리 중 입력'], [100, 199, '보안·거버넌스'],
    [200, 299, '저장된 조회·개인 대시보드'], [300, 399, '업무 메타데이터'], [400, 499, '로드맵·제약에서 유도한 것']];
  for (const [lo, hi, ttl] of GROUPS) {
    const sel = r.requirements.filter((x) => {
      const n = Number(x.id.split('-')[1]);
      return n >= lo && n <= hi;
    });
    if (sel.length) p4.push(`## ${ttl} (${sel.length}건)\n\n${blocks(sel, ['id'], 'title')}`);
  }
  write(`${RQ}04-요구사항.md`, p4);

  const pr = load('11-processes');
  const why = rawSpec('11-processes').split('\n').filter((l) => l.startsWith('#'))
    .map((l) => l.replace(/^#\s?/, '').trimEnd()).join('\n');
  write(`${RQ}05-업무프로세스.md`, [
    head('RQ-11-processes', '업무 프로세스 (As-Is / To-Be)', `${SPEC}11-processes.yaml`,
      pr.meta.status, pr.meta.baselined, null,
      `> **막고 있는 것** — ${flat(pr.meta.blocked_by)}\n`),
    `## 왜 비어 있나\n\n${why}`,
    '## 이 장이 비어 있는 결과\n\n'
      + '- **P1 을 닫을 수 없다** — 채울 근거가 없다(`project.state.yaml` 의 `OQ-002`).\n'
      + '- **효과 측정의 기준선이 없다** — 성공 기준이 그 값을 기다린다.\n'
      + '- **장을 빼지 않고 비워 둔다** — 빼면 읽는 사람이 이 주제를 다룬 줄 알게 된다.',
  ]);

  const n = load('21-nfr');
  const p6 = [head('RQ-21-nfr', '비기능 요구 — 성능 · 응답성 · 비용 · 안정성', `${SPEC}21-nfr.yaml`,
    n.meta.status, n.meta.baselined, null,
    '> **목표값이 전부 `—` 다.** 미리 세우지 않고 *측정을 만들고 → 재고 → 개선이 필요한지\n'
    + '> 판단한다* 는 방침을 택했다(`ASM-002`). 그래서 빈칸은 **빠진 것이 아니라 아직 재지\n'
    + '> 않았다**는 뜻이다. 추적성 T7 은 모든 NFR 에 측정 방법과 테스트 케이스를 요구하며,\n'
    + '> **테스트 케이스가 없어 지금 T7 오류가 난다.**\n')];
  for (const cat of [...new Set(n.nfrs.map((x) => x.category))]) {
    const sel = n.nfrs.filter((x) => x.category === cat);
    p6.push(`## ${cat} (${sel.length}건)\n\n${blocks(sel, ['id'], 'title')}`);
  }
  write(`${RQ}06-비기능요구.md`, p6);

  const i = load('51-interfaces');
  const p7 = [head('RQ-51-interfaces', '외부 인터페이스', `${SPEC}51-interfaces.yaml`,
    i.meta.status, i.meta.baselined, i.interfaces.map((x) => x.id))];
  const seenIf = new Set();
  for (const [dr, ttl] of [['outbound', '나가는 연동'], ['inbound', '들어오는 연동']]) {
    const sel = i.interfaces.filter((x) => x.direction === dr);
    sel.forEach((x) => seenIf.add(x.id));
    if (sel.length) p7.push(`## ${ttl} (${sel.length}건)\n\n${blocks(sel, ['id'], 'name')}`);
  }
  const restIf = i.interfaces.filter((x) => !seenIf.has(x.id));
  if (restIf.length) p7.push(`## 그 밖\n\n${blocks(restIf, ['id'], 'name')}`);
  p7.push(`## 인터페이스가 아닌 것\n\n${auto(i.not_interfaces, { titleKey: 'name' })}`);
  write(`${RQ}07-외부인터페이스.md`, p7);

  // ── _index — 목차에는 단일 상태를 붙이지 않는다(장마다 다르다) ──
  const STAT = { migrated: '이관 · **승인 전**', baselined: '**승인됨**', empty: '**비어 있다**' };
  const CH = [
    ['00-개요.md', `문제 ${c.problems.length} · 경제성 ${c.economics.length} · 목표 ${c.goals.length} · 비목표 ${c.non_goals.length} · 성공 기준 ${c.success_criteria.length} · 로드맵 ${c.roadmap.length}`, '00-charter', c.meta.status],
    ['01-이해관계자.md', `액터 ${a.actors.length} · 모듈 ${a.modules.length}`, '01-actors', a.meta.status],
    ['02-제약과-원칙.md', `설계 원칙 ${k.principles.length} · 기술 제약 ${k.technical.length} · 배포 전제 ${k.deployment.length} · 착수 확정 ${k.customer_agreements.length} · 개발 제약 ${k.development.length}`, '02-constraints', k.meta.status],
    ['03-용어.md', `용어 ${g.terms.length} · 프레임워크 어휘 ${g.framework_terms.length} · **헷갈리는 짝 ${g.confusions.length}** · 턴 상태 ${g.turn_states.length}`, '03-glossary', g.meta.status],
    ['04-요구사항.md', `기능 요구사항 ${r.requirements.length}`, '10-requirements', r.meta.status],
    ['05-업무프로세스.md', `**비어 있다** — ${flat(pr.meta.blocked_by)} 에 막혀 있다`, '11-processes', pr.meta.status],
    ['06-비기능요구.md', `비기능 ${n.nfrs.length} (**목표값 전부 미정**)`, '21-nfr', n.meta.status],
    ['07-외부인터페이스.md', `외부 인터페이스 ${i.interfaces.length}`, '51-interfaces', i.meta.status],
  ];
  write(`${RQ}_index.md`, [
    head('RQ-INDEX', '요구사항 정의서', `${SPEC}(P0~P2 정본 여덟)`, 'mixed', null, null,
      '> **읽는 사람은 사용자(고객·의사결정자)다.** 판단하는 것은 *이대로 만들어도 되는가* 이며,\n'
      + '> 그 판단이 곧 게이트 승인이다(CLAUDE.md §5-12).\n>\n'
      + '> **정본은 `documents/spec/` 이다.** 고칠 것이 있으면 여기가 아니라 그쪽을 고치고\n'
      + '> `/doc-gen 요구사항정의서` 로 다시 만든다 — 여기 고친 것은 다음 생성에서 사라진다.\n'),
    '## 장 목록\n\n| 장 | 담는 것 | 원본 | 상태 |\n|---|---|---|---|\n'
      + CH.map(([f, d, src, st]) => `| [${f.replace('.md', '')}](./${f}) | ${d} | \`${src}.yaml\` | ${STAT[st] ?? st} |`).join('\n'),
    '## 읽는 순서\n\n'
      + '**위에서 아래로다.** 목적(00)이 액터(01)를 정하고, 제약(02)이 선택지를 좁히고, 용어(03)가\n'
      + '말을 고정한 뒤에야 요구사항(04)이 읽힌다. 프로세스(05)가 비어 있어 **요구사항의 우선순위가\n'
      + '업무 가치가 아니라 기술 의존으로 정해져 있다** — 그것이 지금 이 문서의 가장 큰 약점이다.',
    '## 아직 답이 없는 것\n\n| ID | 무엇 | 어디 |\n|---|---|---|\n'
      + '| `OQ-002` | 1차 적용 업무를 무엇으로 할 것인가 — **고객사가 없어 답할 수 없다** | 05장 |\n'
      + '| `ASM-002` | 성능·비용의 목표 수치를 실측 뒤에 세운다 | 06장 |\n'
      + '| `ASM-003` | 오케스트레이션은 LangGraph4j 로 확정된 것으로 본다 | `ADR-001`·`ADR-003` |\n'
      + '| `ASM-004` | 고객사 없이 제품을 먼저 만든다 | 00장의 경제성 전체 |',
  ]);
}

// ── 8행 · 아키텍처 ────────────────────────────────────────────────
const ZONE = { 사용자: 'USERZ', 외부망: 'EXT', DMZ: 'DMZ', Hub: 'AI', 레거시: 'LEGACY', 고객사: 'CUST' };
const ZLABEL = {
  USERZ: '사용자 구역', EXT: '외부망', DMZ: 'DMZ',
  AI: '내부 폐쇄망 — Agentic AI Hub (독립 배포 · 단일 WAS)',
  LEGACY: '내부 폐쇄망 — 레거시 업무 시스템 (복수)', CUST: '고객사 환경',
};

/** 괄호를 Mermaid 가 문서화한 엔티티로 바꾼다 — 원통 노드 `[("…")]` 안의 `)` 가
 *  셰이프 종료로 읽히면 **그림이 통째로 렌더되지 않고, 생성물이라 아무도 고치지 않는다.** */
const mmEscape = (s) => s.replace(/\(/g, '#40;').replace(/\)/g, '#41;');

/** 노드 하나를 Mermaid 상자로 — 원통은 DB 다. */
function mmBox(nd) {
  const label = mmEscape(nd.label + (nd.note ? `<br/>${nd.note}` : ''));
  const db = nd.kind === 'db';
  return `${nd.key}[${db ? '(' : ''}"${label}"${db ? ')' : ''}]`;
}

/**
 * C4 Level 1 — 시스템 컨텍스트. **노드를 `l1:` 로 접어서 그린다.**
 *
 * <p>상자와 간선을 두 벌 적지 않는 것이 요점이다(20-architecture.yaml 의 불변식) —
 * 두 벌이면 한쪽만 고쳤을 때 <b>어느 그림이 참인지 알 방법이 없다</b>. 같은 상자로
 * 접힌 간선(예: portal → AI 전용 DB)은 사라지고, 남은 간선의 라벨은 합친다.
 */
function 컨텍스트도(t) {
  const fold = new Map(t.nodes.map((n) => [n.key, n.l1]));
  const L = ['```mermaid', 'flowchart LR'];
  for (const s of t.context.systems) {
    L.push(`  ${s.key}["${mmEscape(s.label + (s.note ? `<br/>${s.note}` : ''))}"]`);
  }
  const merged = new Map();
  for (const e of t.edges) {
    const a = fold.get(e.from);
    const b = fold.get(e.to);
    if (!a || !b || a === b) continue;
    const k = `${a}>${b}`;
    if (!merged.has(k)) merged.set(k, new Set());
    if (e.label) merged.get(k).add(e.label);
  }
  for (const [k, labels] of merged) {
    const [a, b] = k.split('>');
    const l = [...labels].join(' · ');
    L.push(`  ${a} -->${l ? `|"${l}"|` : ''} ${b}`);
  }
  L.push('```');
  return L.join('\n');
}

/**
 * C4 Level 2 — 컨테이너. 구역 안에서 <b>배포 단위</b>(`deploy:`)로 한 겹 더 묶는다.
 *
 * <p>상자가 하나뿐인 배포 단위는 감싸지 않는다 — 테두리가 상자를 한 겹 덧그릴 뿐이고,
 * 그 테두리를 <i>무언가 더 있다</i> 로 읽게 만든다.
 */
function 컨테이너도(t) {
  const unit = new Map((t.containers?.units ?? []).map((u) => [u.key, u]));
  const byZone = new Map();
  for (const nd of t.nodes) {
    const z = ZONE[nd.zone] ?? 'CUST';
    if (!byZone.has(z)) byZone.set(z, []);
    byZone.get(z).push(nd);
  }
  const L = ['```mermaid', 'flowchart LR'];
  for (const z of ['EXT', 'DMZ', 'USERZ', 'AI', 'LEGACY', 'CUST']) {
    const ns = byZone.get(z) ?? [];
    if (!ns.length) continue;
    L.push(`  subgraph ${z}["${ZLABEL[z]}"]`);
    const groups = new Map();
    for (const nd of ns) {
      const g = nd.deploy ?? '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(nd);
    }
    for (const [g, list] of groups) {
      if (!g || list.length < 2) {
        for (const nd of list) L.push(`    ${mmBox(nd)}`);
        continue;
      }
      L.push(`    subgraph U_${g}["${mmEscape(unit.get(g)?.label ?? g)}"]`);
      for (const nd of list) L.push(`      ${mmBox(nd)}`);
      L.push('    end');
    }
    L.push('  end');
  }
  for (const e of t.edges) L.push(`  ${e.from} -->${e.label ? `|"${e.label}"|` : ''} ${e.to}`);
  L.push('```');
  return L.join('\n');
}

function 아키텍처() {
  const d = load('20-architecture');
  const t = d.topology;

  const p = [head('ARCH', '아키텍처 — 구성 · 경계 · 연동', `${SPEC}20-architecture.yaml`,
    d.meta.status, d.meta.baselined,
    [t.id, t.context.id, t.containers.id, ...d.module_boundaries.map((x) => x.id)],
    '> **이 아키텍처를 세운 결정**은 [`ADR-001`](../decisions/ADR-001-오케스트레이션-프레임워크.md) ·\n'
    + '> [`ADR-002`](../decisions/ADR-002-플랫폼-노선.md) · [`ADR-003`](../decisions/ADR-003-상태-원천-단일화.md) 이며,\n'
    + '> 그 **근거 자료**는 [`documents/research/`](../research/agent-frameworks.md) 가 갖는다.\n')];
  p.push(`## 1. 논리 구성도 — C4 두 계층\n\n${flat(t.core_claim)}\n\n${bullets(t.notes)}\n\n`
    + '> **두 그림은 한 원본에서 나온다.** 아래 노드·간선이 정본이고, Level 1 은 그것을 시스템\n'
    + '> 단위로 접은 것이다 — 따로 그린 그림이 아니므로 둘이 어긋날 수 없다.');
  p.push(`### 1.1 Level 1 — 시스템 컨텍스트 (${t.context.id})\n\n${컨텍스트도(t)}\n\n`
    + `${flat(t.context.claim)}\n\n${flat(t.context.note)}\n\n`
    + `${auto(t.context.systems, { titleKey: 'label', level: '####' })}`);
  p.push(`### 1.2 Level 2 — 컨테이너 (${t.containers.id})\n\n${컨테이너도(t)}\n\n`
    + `${flat(t.containers.claim)}\n\n`
    + `${auto(t.containers.units, { titleKey: 'label', level: '####' })}`);
  p.push('### 1.3 이 그림이 지켜야 하는 불변식\n\n'
    + '**그림이 예쁜 것으로는 낡음을 알 수 없다.** 아래 중 하나가 깨진 그림은 틀린 그림이다.\n\n'
    + t.edge_invariants.map((x, n) => `${n + 1}. ${flat(x)}`).join('\n'));
  p.push(`### 1.4 구역\n\n${auto(t.zones, { titleKey: 'zone', level: '####' })}`);
  p.push(`### 1.5 구성요소\n\n${auto(t.nodes, { titleKey: 'label', level: '####' })}`);
  p.push(`### 1.6 간선 — 무엇이 무엇을 부르나\n\n${auto(t.edges, { titleKey: 'label', level: '####' })}`);
  p.push('## 2. 모듈 경계\n\n'
    + '> 모듈의 정의와 책임은 [`01-이해관계자.md`](./10-요구사항정의서/01-이해관계자.md) 가 갖는다. 여기는 **경계** 다.\n\n'
    + blocks(d.module_boundaries, ['id'], 'rule'));

  const SECTIONS = [['write_ownership', '쓰기 책임'], ['deeplink', 'portal 진입 경로 — 레거시 딥링크'],
    ['datasource', '데이터소스 전략'], ['llm_layer', 'LLM 연동 계층'],
    ['identity', '인증 · 계정 원천과 신원 매핑'], ['knowledge_search', '지식 검색 구성'],
    ['execution_lease', '턴 실행 점유']];
  for (const [key, ttl] of SECTIONS) {
    const body = [];
    const walk = (obj, lvl) => {
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'id') continue;
        if (Array.isArray(v) && v.length && typeof v[0] === 'object' && v[0] !== null) {
          body.push('', `${'#'.repeat(lvl)} ${lab(k)}`, '', auto(v), '');
        } else if (Array.isArray(v)) {
          body.push(`- **${lab(k)}**`, ...v.map((x) => `  - ${flat(x)}`));
        } else if (v && typeof v === 'object') {
          body.push('', `${'#'.repeat(lvl)} ${lab(k)}`, '');
          walk(v, lvl + 1);
        } else {
          body.push(`- **${lab(k)}** — ${flat(v)}`);
        }
      }
    };
    walk(d[key], 4);
    p.push(`## ${ttl} (${d[key].id ?? '—'})\n\n${body.join('\n')}`);
  }
  write(`${OUT}20-아키텍처.md`, p);
}

// ── 11행 · 기능 목록 ──────────────────────────────────────────────
function 기능목록() {
  const f = load('31-features');
  const mods = [...new Set(f.features.map((x) => x.module))];
  const p = [head('FEAT-LIST', '기능 목록 · 메뉴 구조', `${SPEC}31-features.yaml`,
    f.meta.status, f.meta.baselined, null, `> **채번** — ${f.meta.numbering}\n`)];
  p.push('## 요약\n\n| 모듈 | 기능 수 | Phase 분포 |\n|---|---:|---|\n'
    + mods.map((m) => {
      const sel = f.features.filter((x) => x.module === m);
      const phases = [...new Set(sel.map((x) => x.phase).filter(Boolean))].sort();
      return `| ${m} | ${sel.length} | ${phases.map((ph) => `${ph} ${sel.filter((x) => x.phase === ph).length}`).join(' · ')} |`;
    }).join('\n'));
  for (const m of mods) {
    const sel = f.features.filter((x) => x.module === m);
    p.push(`## ${m} (${sel.length}건)\n\n${table(sel, ['id', 'title', 'screen', 'phase', 'reqs'])}`
      + `\n\n### 상세\n\n${blocks(sel, ['id'], 'title', '####')}`);
  }
  p.push('## 폐기한 기능\n\n**ID 는 재사용하지 않는다** — 결번으로 남기고 사유를 적는다.\n\n'
    + auto(f.retired));
  write(`${OUT}31-기능목록.md`, p);
}

// ── 16행 · 화면 목록 · 화면 정의서 ────────────────────────────────
function 화면정의서() {
  const s = load('60-screens');
  const mc = s.menu_criteria;
  const p = [head('SCR-LIST', '화면 목록 · 화면 정의서', `${SPEC}60-screens.yaml`,
    s.meta.status, s.meta.baselined, null,
    '> **화면 하나의 컬럼·검증·테스트 케이스는 여기 없다.** 그것은\n'
    + '> `documents/screen/{페이지경로}/requirements.md` 가 갖는다(산출물 지도 33행) — 설계자가\n'
    + '> 목업과 함께 보고 승인하는 대상이며 spec 에 담기지 않는 분량이다. 여기는 **목록과 소속**이다.\n')];
  p.push(`## 1. 무엇을 메뉴로 두는가\n\n**${flat(mc.claim)}** — ${flat(mc.why)}\n\n${bullets(mc.tests)}`
    + (mc.note ? `\n\n> ${flat(mc.note)}` : ''));
  p.push(`## 2. 통제 경계\n\n${auto(s.control_boundaries)}`);
  p.push(`## 3. 규칙\n\n${bullets(s.rules)}`);
  let n = 3;
  for (const m of [...new Set(s.screens.map((x) => x.module))]) {
    const sel = s.screens.filter((x) => x.module === m);
    n += 1;
    p.push(`## ${n}. ${m} 화면 (${sel.length}건)`);
    for (const grp of [...new Set(sel.map((x) => x.group))]) {
      const gs = sel.filter((x) => x.group === grp);
      p.push(`### ${grp ?? '(분류 없음)'}\n\n${table(gs, ['id', 'title', 'feature', 'phase'])}`
        + `\n\n${blocks(gs, ['id'], 'title', '####')}`);
    }
  }
  p.push(`## ${n + 1}. Phase 별 노출\n\n`
    + Object.entries(s.phase_rollout).map(([k, v]) => `- **${k}** — ${flat(v)}`).join('\n'));
  p.push(`## ${n + 2}. 메뉴로 나타나지 않는 것\n\n${auto(s.not_menus, { titleKey: 'name' })}`);
  p.push(`## ${n + 3}. 미확정 (${s.undecided.length}건)\n\n${auto(s.undecided)}`);
  p.push(`## ${n + 4}. 화면 문서의 단위와 순서\n\n`
    + Object.entries(s.doc_order).map(([k, v]) => `- **${lab(k)}** — ${flat(v)}`).join('\n'));
  write(`${OUT}60-화면정의서.md`, p);
}

// ── 19행 · 권한 매트릭스 ──────────────────────────────────────────
function 권한매트릭스() {
  const z = load('22-authz');
  const p = [head('AUTHZ', '권한 매트릭스 — 그룹 판정 · 매핑 · SQL 통제', `${SPEC}22-authz.yaml`,
    z.meta.status, z.meta.baselined, null,
    '> **요구사항은 `04-요구사항.md`(REQ-103·105·111)가 갖는다** — 여기는 *모델* 이다.\n')];
  p.push(`## 1. 통제의 축\n\n**${flat(z.axis.claim)}** — ${flat(z.axis.why)}`);
  const j = z.judgement;
  p.push(`## 2. 그룹 판정 (${j.id})\n\n**${flat(j.rule)}**\n\n`
    + `- **적용 대상** — ${flat(j.applies_to)}\n- **공통 컴포넌트** — ${flat(j.single_component)}\n`
    + bullets(j.rules));
  p.push(`## 3. 매핑 구조 — 역할 × 대상\n\n${auto(z.mappings)}\n\n${bullets(z.mapping_rules)}`);
  const SEC = [['row_scope', '행 스코프'], ['sql_control', 'SQL 통제'], ['injection_control', '주입 통제'],
    ['default_filter', '기본 필터'], ['operational_means', '운영 수단'],
    ['responsibility_layers', '책임의 층'], ['rate_limit_ownership', '유량 제한의 소유']];
  for (const [key, ttl] of SEC) {
    const v = z[key];
    const body = [];
    for (const [k, x] of Object.entries(v)) {
      if (k === 'id') continue;
      if (Array.isArray(x) && x.length && typeof x[0] === 'object' && x[0] !== null) {
        body.push(`- **${lab(k)}**`, '', auto(x), '');
      } else if (Array.isArray(x)) {
        body.push(`- **${lab(k)}**`, ...x.map((y) => `  - ${flat(y)}`));
      } else {
        body.push(`- **${lab(k)}** — ${flat(x)}`);
      }
    }
    p.push(`## ${ttl} (${v.id ?? '—'})\n\n${body.join('\n')}`);
  }
  write(`${OUT}22-권한매트릭스.md`, p);
}

// ── 26행 · 추적성 매트릭스 ────────────────────────────────────────
/** **셈은 `trace-check` 가 낸다.** 여기서 다시 세지 않는다 — 두 곳에서 세면 갈린다. */
function 추적성() {
  const body = execFileSync('node', ['.claude/hooks/trace-check.mjs', '--report'],
    { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
  write(`${OUT}90-추적성매트릭스.md`, [
    head('TRACE', '추적성 매트릭스', `${SPEC}(전체)`, 'mixed', null, null,
      '> **셈은 `node .claude/hooks/trace-check.mjs --report` 가 낸다.** 여기서 다시 세지 않는다 —\n'
      + '> 두 곳에서 세면 갈리고, 갈렸을 때 어느 쪽이 참인지 알 방법이 없다. 이 문서는 그\n'
      + '> 출력을 사람이 읽는 형태로 담은 것뿐이다.\n>\n'
      + '> 규칙 T1~T13 는 [`aidd-guide/process/05-traceability.md`](../../aidd-guide/process/05-traceability.md) 가 갖는다.\n'),
    body,
  ]);
}

// ── 대상 등록 ─────────────────────────────────────────────────────
const TARGETS = { 요구사항정의서, 아키텍처, 기능목록, 화면정의서, 권한매트릭스, 추적성 };

/**
 * 같은 대상의 다른 이름. `SKILL.md` 의 인자 줄은 짧은 이름(`화면`·`권한`)을 쓰고
 * 「생성 대상」 표는 긴 이름(`화면정의서`·`권한매트릭스`)을 쓴다. **둘 다 받는다** —
 * 이름이 갈린 것을 사용자가 외워서 피하게 만들지 않는다(CLAUDE.md §5-13 과 같은 뿌리).
 */
const ALIAS = {
  화면: '화면정의서', 권한: '권한매트릭스', '기능목록·메뉴': '기능목록',
  테스트케이스: '테스트', 사용자매뉴얼: '매뉴얼',
};
const resolve = (a) => ALIAS[a] ?? a;

/**
 * **아직 스크립트가 만들지 않는 대상.** 산문 지시(`SKILL.md` 의 「생성 대상」)가 갖는다.
 * <b>여기에 적어 두는 이유는 조용히 빠지지 않게 하는 것이다</b> — 목록에 없으면 아무도
 * 부르지 않고, 부르지 않으면 없는 기능이 된다.
 */
const NOT_YET = {
  유즈케이스: '30-usecases.yaml 이 비어 있다',
  시퀀스: '30-usecases.yaml 이 비어 있다',
  ERD: '40-domain.yaml 이 비어 있다',
  DDL: '40-domain.yaml 이 비어 있다',
  API: '50-api.yaml 이 비어 있다',
  테스트: '70-testcases.yaml 이 비어 있다',
  요건정의서: '30-usecases · 40-domain · 50-api · 70-testcases 를 참조한다 — 지금 만들면 빈 칸이 든 85장이 생긴다',
  매뉴얼: 'P6 산출물이다',
};

// ── --check · 생성물이 spec 을 다 담았나 ──────────────────────────
/**
 * <b>파생 뷰에서 조용히 사라진 항목은 없는 항목이 된다.</b> 그것이 이 프로젝트가
 * 이관에서 겪은 사고이므로 기계로 센다. 셋을 본다 — spec ID · 25자 넘는 스칼라 값 ·
 * 상대 링크.
 *
 * <p><b>P3 spec 이 채워지면 이 검사가 빨개지는 것이 정상이다</b> — 새 대상을 만들라는
 * 신호이며, 초록으로 만들려고 검사를 좁히지 않는다.
 */
function check() {
  const mdFiles = [];
  const walkDir = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walkDir(full);
      else if (e.name.endsWith('.md')) mdFiles.push(full);
    }
  };
  walkDir(join(REPO, OUT));
  if (!mdFiles.length) {
    console.log('생성물이 없다 — 먼저 생성한다.');
    process.exitCode = 1;
    return;
  }
  const texts = new Map(mdFiles.map((f) => [f, readFileSync(f, 'utf8')]));
  const all = [...texts.values()].join('\n');
  // Mermaid 레이블은 괄호가 escape 돼 있으므로 풀어서 대조한다
  const norm = all.replace(/#40;/g, '(').replace(/#41;/g, ')').replace(/\s+/g, ' ');

  const specFiles = readdirSync(join(REPO, SPEC)).filter((f) => f.endsWith('.yaml'));
  const ids = new Set();
  const leaves = [];
  const collect = (v, path) => {
    if (Array.isArray(v)) v.forEach((x, n) => collect(x, `${path}[${n}]`));
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) if (k !== 'meta') collect(x, `${path}.${k}`);
    } else if (typeof v === 'string' && v.length > 25) leaves.push([path, v]);
  };
  for (const f of specFiles) {
    const raw = readFileSync(join(REPO, SPEC + f), 'utf8');
    for (const m of raw.matchAll(/^\s*(?:-\s*)?id:\s*([A-Z][A-Z0-9]*-[0-9A-Za-z]+)\s*$/gm)) ids.add(m[1]);
    collect(parseYaml(raw), f);
  }
  const goneIds = [...ids].filter((i) => !all.includes(i)).sort();
  const goneVals = leaves.filter(([, v]) => !norm.includes(v.trim().replace(/\s+/g, ' ').slice(0, 40)));

  const badLinks = [];
  for (const [file, text] of texts) {
    for (const m of text.matchAll(/\]\(([^)#][^)]*?)\)/g)) {
      const t = m[1].split('#')[0];
      if (!t || /^(https?:|mailto:)/.test(t)) continue;
      if (!existsSync(normalize(join(dirname(file), t)))) badLinks.push([posix.basename(file), t]);
    }
  }

  console.log(`생성물 ${mdFiles.length}개 · ${all.split('\n').length}줄`);
  console.log(`spec ID ${ids.size}개 중 생성물에 없는 것: ${goneIds.length}`);
  goneIds.slice(0, 20).forEach((i) => console.log(`  ${i}`));
  console.log(`25자 넘는 스칼라 ${leaves.length}개 중 생성물에서 못 찾은 것: ${goneVals.length}`);
  goneVals.slice(0, 20).forEach(([p, v]) => console.log(`  ${p}\n    ${v.slice(0, 90)}`));
  console.log(`깨진 상대 링크: ${badLinks.length}`);
  badLinks.slice(0, 20).forEach(([f, t]) => console.log(`  ${f} → ${t}`));
  const bad = goneIds.length + goneVals.length + badLinks.length;
  console.log(bad === 0 ? '\n초록 — spec 이 생성물에 빠짐없이 실렸다.' : `\n빨강 — ${bad}건. 새 대상이 필요하거나 렌더러가 필드를 떨어뜨렸다.`);
  process.exitCode = bad === 0 ? 0 : 1;
}

// ── 진입 ──────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (argv.includes('--check')) {
  check();
} else {
  const want = argv.filter((a) => !a.startsWith('--')).map(resolve);
  const unknown = want.filter((a) => !(a in TARGETS));
  for (const u of unknown) {
    if (u in NOT_YET) console.log(`건너뜀 — \`${u}\` : 아직 스크립트가 만들지 않는다 (${NOT_YET[u]})`);
    else console.log(`모르는 대상 — \`${u}\`. 아는 것: ${Object.keys(TARGETS).join(' ')}`);
  }
  const run = want.length ? want.filter((a) => a in TARGETS) : Object.keys(TARGETS);
  for (const name of run) TARGETS[name]();
  for (const [p, n] of written) console.log(`${p}  ${n}줄`);
  if (!want.length) {
    console.log(`\n아직 만들지 않는 대상 ${Object.keys(NOT_YET).length}개 — ${Object.entries(NOT_YET).map(([k, v]) => `${k}(${v})`).join(' · ')}`);
  }
}
