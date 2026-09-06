/**
 * 코드 품질 기계 검사 — 슬라이스 미니게이트(G4)의 기계가 세는 부분.
 *
 * <pre>
 *   node .claude/hooks/quality-check.mjs            전체 검사 (G4 판정 포함)
 *   node .claude/hooks/quality-check.mjs --json      기계 판독용
 *   node .claude/hooks/quality-check.mjs --baseline  현재 값을 기준선으로 저장
 * </pre>
 *
 * <h2>왜 이 셋을 세는가 (2026 실증)</h2>
 *
 * <p>GitClear·GitKraken 이 6.23억 건의 실제 코드 변경(2023→2026)을 본 결과, AI 가 코드를
 * 쓸 때 <b>가장 확실하게 나빠지는 지표가 중복과 에러 삼킴</b>이었다 — 중복 블록 +81%,
 * 레거시 리팩터링 -74%, 코드 재사용 -70%, 원인 평가 없이 에러만 잡는 코드 +47%.
 * CodeRabbit 의 GitHub 470개 저장소 관찰에서는 AI 코드의 버그가 1.7배, 논리·정확성 오류가
 * +75% 였다.
 *
 * <p><b>사람 눈으로 보는 체크리스트로는 안 잡힌다.</b> 중복은 파일이 갈려 있으면 보이지
 * 않고, 빈 catch 는 리뷰에서 가장 쉽게 넘어가는 다섯 줄이다. 그래서 기계가 센다.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { REPO, needsFeatTag } from './lib.mjs';

const CODE_EXT = new Set(['.java', '.kt', '.ts', '.tsx', '.js', '.jsx', '.py', '.cs', '.go', '.rb']);
const SKIP_DIR = new Set([
  'node_modules', 'dist', 'build', 'target', '.git', '.venv', '__pycache__',
  'vendor', 'coverage', '.next', '.gradle', 'generated', 'gen',
]);

/** 임계값 — 넘으면 G4 미충족이며 슬라이스를 done 으로 표시할 수 없다. */
const THRESHOLD = { duplicationPct: 5.0, swallowedErrors: 0, untaggedFiles: 0 };

/**
 * <b>삼키는 것이 맞는 자리</b> — `@swallow <이유>` 를 그 catch 위에 단다.
 *
 * <p>드물지만 실재한다. {@code scheduleWithFixedDelay} 는 작업이 던지면 <b>다시 부르지
 * 않으므로</b>, 거기서 올려 보내면 DB 가 잠깐 흔들린 것 때문에 <b>청소가 영영 멈춘다</b>.
 *
 * <h2>명단이 아니라 표시다</h2>
 *
 * <p>{@code feat-baseline} 과 {@code FEATURELESS} 의 갈림과 같다 — 명단은 <b>빚</b>이고
 * 표시는 <b>영구 규칙</b>이다. 이건 언젠가 갚을 것이 아니라 <i>맞는 코드</i> 라, 그
 * 사실은 <b>코드 옆</b>에 있어야 한다. 명단에 넣으면 언젠가 <i>왜 여기 있지</i> 가 된다.
 *
 * <h2>이유 없는 태그는 태그가 아니다</h2>
 *
 * <p>뒤에 글자가 없으면 인정하지 않는다. 그리고 <b>면제도 보고에 뜬다</b> — 조용히
 * 사라지면 그것은 면제가 아니라 <b>검사를 끈 것</b>이다.
 */
const SWALLOW_TAG = /@swallow\s+\S/;

/** 태그는 catch 바로 위에 산다 — 그 앞 400자를 본다. */
const tagged = (text, at) => SWALLOW_TAG.test(text.slice(Math.max(0, at - 400), at));

/** 중복 판정 최소 연속 라인 수. */
const WINDOW = 6;

const SWALLOW = [
  [/catch\s*\([^)]*\)\s*\{\s*\}/g, '빈 catch 블록'],
  [/catch\s*\([^)]*\)\s*\{\s*\/\/[^\n]*\s*\}/g, '주석만 있는 catch'],
  [/catch\s*\([^)]*\)\s*\{\s*(return|break|continue)\s*;?\s*\}/g, 'catch 후 조용히 반환'],
  [/except[^:\n]*:\s*\n\s+pass\b/g, 'except: pass'],
  [/except[^:\n]*:\s*\n\s+(return|continue|break)\b/g, 'except 후 조용히 반환'],
  [/catch\s*\{\s*\}/g, '빈 catch 블록'],
  [/\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g, '빈 promise catch'],
  [/rescue\s*\n\s*end/g, '빈 rescue'],
  [/if\s+err\s*!=\s*nil\s*\{\s*\}/g, '빈 err 처리'],
];

/** 로그만 찍고 넘어가는 것도 GitClear 가 세는 '원인 평가 없음' 이다. */
const LOG_ONLY =
  /catch\s*\([^)]*\)\s*\{\s*(console\.(log|error)|log(ger)?\.\w+|print(ln)?|System\.out\.print(ln)?)\s*\([^;{}]*\)\s*;?\s*\}/gi;

const argv = process.argv.slice(2);
const metrics = scan();

if (argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
  process.exit(0);
}
if (argv.includes('--baseline')) {
  writeFileSync(join(REPO, '.quality-baseline.json'), JSON.stringify(metrics, null, 2), 'utf8');
  process.stdout.write('기준선 저장: .quality-baseline.json\n');
  process.exit(0);
}
process.stdout.write(`${report(metrics)}\n`);
process.exit(verdict(metrics).length > 0 ? 1 : 0);

// ── 셈 ────────────────────────────────────────────────────────────

function files(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (SKIP_DIR.has(name) || name.startsWith('.')) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) files(full, acc);
    else if (CODE_EXT.has(extname(name))) acc.push(full);
  }
  return acc;
}

/** 비교용 정규화 — 공백을 접고, 주석과 너무 짧은 줄을 버린다. */
/**
 * 이 줄을 <b>코드로 세는가</b> — 아니면 {@code null}.
 *
 * <h2>{@code import} 와 {@code package} 는 세지 않는다</h2>
 *
 * <p>세면 <b>파일이 늘수록 중복률이 오른다</b>. 같은 배럴을 여는 컨트롤러 열셋은 같은
 * 세 줄로 시작하지만 그것은 복사한 것이 아니라 <b>같은 것을 쓰는 것</b>이고, 추출할
 * 대상도 아니다 — 뽑아낼 로직이 한 줄도 없다.
 *
 * <p>2026-09-06 에 재 보니 <b>672 그룹 중 282 가 순전히 {@code import}</b> 였고,
 * 12.46% 가 7.37% 로 내려갔다. <b>임계는 그대로 5% 다</b> — 고친 것은 *무엇을 코드로
 * 세는가* 이지 *얼마까지 봐주는가* 가 아니다(CLAUDE.md — 임계를 올려 통과시키지 않는다).
 *
 * <p><b>애너테이션 단독 줄은 그대로 센다.</b> 함께 재 봤더니 7.37 이 7.42 로 <b>오히려
 * 올랐다</b> — 분모만 줄고 중복은 그대로였다. 값이 없는 예외는 두지 않는다.
 */
function normalize(line) {
  const s = line.trim();
  if (!s || s.startsWith('//') || s.startsWith('#') || s.startsWith('*') || s.startsWith('/*')) return null;
  if (/^(import|package)\s/.test(s)) return null;
  const flat = s.replace(/\s+/g, ' ');
  return flat.length > 12 ? flat : null;
}

/**
 * `@feat` 면제 명단 — <b>{@code trace-check.mjs} 와 같은 파일을 읽는다</b>.
 *
 * <p>읽지 않으면 같은 규칙(T10)에 게이트가 둘이고 답이 갈린다. 실제로 그랬다:
 * 2026-09-05 에 {@code trace-check} 만 명단을 보게 고쳐 T10 경고가 0 이 됐는데
 * 여기는 그대로라 <b>963개 ❌ 로 빨간 채</b>였다. <b>영구히 빨간 게이트는 없는
 * 게이트다</b> — 사람이 숫자를 보지 않게 되고, 그때 새로 생긴 한 건이 묻힌다.
 */
function exemptPaths() {
  try {
    return new Set(
      readFileSync(join(REPO, '.claude/hooks/feat-baseline.txt'), 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#')),
    );
  } catch {
    return new Set();
  }
}

function scan() {
  const exempt = exemptPaths();
  const windows = new Map();
  const swallowed = [];
  const exempted = [];
  const untagged = [];
  let totalLines = 0;
  const list = files(join(REPO, 'sources'));

  for (const file of list) {
    const rel = relative(REPO, file).split(sep).join('/');
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    /*
      <b>파일 집합도 {@code trace-check} T10 과 같아야 한다.</b> 명단만 맞추고 집합이
      갈리면 답은 여전히 다르다 — 실제로 명단을 읽게 한 뒤에도 963 대 0 이 145 대 0 으로
      줄었을 뿐이었고, 남은 145 는 전부 <b>테스트 소스</b>였다. 테스트는 `@feat` 가 아니라
      TC 로 엮인다(process/05-traceability.md).
    */
    const isTestSrc = /\/(test|spec)\//.test(rel) || /\.(test|spec)\.[jt]sx?$/.test(rel);
    /*
      <b>층 규칙도 {@code trace-check} 와 같은 것을 쓴다</b>({@code needsFeatTag}). 명단만
      맞추고 층이 갈리면 답은 여전히 다르다 — 위 두 주석이 적은 사고가 그것이다.
    */
    const asks = !isTestSrc && needsFeatTag(rel) && !exempt.has(rel);
    if (asks && !text.slice(0, 1500).includes('@feat')) untagged.push(rel);

    for (const [pattern, label] of SWALLOW) {
      for (const m of text.matchAll(pattern)) {
        const hit = { file: rel, line: lineOf(text, m.index), kind: label };
        (tagged(text, m.index) ? exempted : swallowed).push(hit);
      }
    }
    for (const m of text.matchAll(LOG_ONLY)) {
      const hit = { file: rel, line: lineOf(text, m.index), kind: '로그만 찍고 원인 미평가' };
      (tagged(text, m.index) ? exempted : swallowed).push(hit);
    }

    const norm = [];
    text.split('\n').forEach((raw, i) => {
      const n = normalize(raw);
      if (n) norm.push([i + 1, n]);
    });
    totalLines += norm.length;
    for (let i = 0; i + WINDOW <= norm.length; i += 1) {
      const chunk = norm.slice(i, i + WINDOW).map(([, n]) => n).join('\n');
      const h = createHash('md5').update(chunk).digest('hex');
      if (!windows.has(h)) windows.set(h, []);
      windows.get(h).push(`${rel}:${norm[i][0]}`);
    }
  }

  const dupGroups = [...windows.values()].filter((v) => v.length > 1);
  const dupLines = dupGroups.reduce((sum, v) => sum + (v.length - 1) * WINDOW, 0);

  return {
    files: list.length,
    codeLines: totalLines,
    duplicationPct: totalLines ? Math.round((dupLines * 10000) / totalLines) / 100 : 0,
    duplicateGroups: dupGroups.length,
    topDuplicates: dupGroups
      .map((v) => ({ count: v.length, locations: v.slice(0, 4) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    swallowedErrors: swallowed.length,
    swallowedDetail: swallowed.slice(0, 20),
    exemptedSwallows: exempted.length,
    exemptedDetail: exempted.slice(0, 20),
    untaggedFiles: untagged.length,
    untaggedDetail: untagged.slice(0, 20),
  };
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// ── 판정 ──────────────────────────────────────────────────────────

function verdict(m) {
  const fails = [];
  if (m.duplicationPct > THRESHOLD.duplicationPct) {
    fails.push([
      '중복률',
      `${m.duplicationPct}%`,
      `> ${THRESHOLD.duplicationPct}%`,
      '복사 대신 추출한다. GitClear 기준 AI 코드의 최대 약점이다',
    ]);
  }
  if (m.swallowedErrors > THRESHOLD.swallowedErrors) {
    fails.push(['예외 삼킴', `${m.swallowedErrors}건`, '= 0', '원인을 평가하거나 상위로 전파한다']);
  }
  if (m.untaggedFiles > THRESHOLD.untaggedFiles) {
    fails.push(['@feat 미태깅', `${m.untaggedFiles}개`, '= 0', '추적성 T10. 파일 머리에 @feat FEAT-### 를 적는다']);
  }
  return fails;
}

function report(m) {
  const out = ['## 코드 품질 검사 (G4 기계 검사)', '', `대상: 소스 ${m.files}개 / 코드 ${m.codeLines}라인`];
  out.push('', '| 지표 | 값 | 임계 | 판정 |', '|---|---|---|---|');
  const rows = [
    ['중복률', `${m.duplicationPct}%`, `≤ ${THRESHOLD.duplicationPct}%`, m.duplicationPct <= THRESHOLD.duplicationPct],
    ['중복 그룹', String(m.duplicateGroups), '—', true],
    ['예외 삼킴', `${m.swallowedErrors}건`, '0', m.swallowedErrors === 0],
    ['@feat 미태깅', `${m.untaggedFiles}개`, '0', m.untaggedFiles === 0],
  ];
  for (const [name, value, threshold, ok] of rows) {
    out.push(`| ${name} | ${value} | ${threshold} | ${ok ? '✅' : '❌'} |`);
  }

  if (m.topDuplicates.length > 0) {
    out.push('', '### 중복이 많은 블록', '');
    for (const d of m.topDuplicates.slice(0, 5)) out.push(`- ${d.count}회: ${d.locations.join(', ')}`);
  }
  if (m.swallowedDetail.length > 0) {
    out.push('', '### 예외 삼킴', '');
    for (const s of m.swallowedDetail.slice(0, 10)) out.push(`- ${s.file}:${s.line} — ${s.kind}`);
  }
  /*
    <b>면제는 보이는 자리에 선다.</b> 태그가 붙었다고 목록에서 사라지면 그것은 면제가
    아니라 <b>검사를 끈 것</b>이고, 늘어나도 아무도 모른다. 판정에는 들어가지 않되
    <b>세어서 보인다</b> — 셋이 넘어가면 그때는 태그가 관행이 된 것이다.
  */
  if (m.exemptedDetail.length > 0) {
    out.push('', `### 삼킴 면제 — @swallow ${m.exemptedSwallows}건 (판정에 들지 않는다)`, '');
    for (const s of m.exemptedDetail.slice(0, 10)) out.push(`- ${s.file}:${s.line} — ${s.kind}`);
  }
  if (m.untaggedDetail.length > 0) {
    out.push('', '### @feat 태그 없는 파일', '');
    for (const f of m.untaggedDetail.slice(0, 10)) out.push(`- ${f}`);
  }

  const fails = verdict(m);
  out.push('', '---', '');
  if (fails.length > 0) {
    out.push(`**G4 미충족 ${fails.length}건 — 슬라이스를 done 으로 표시할 수 없다**`);
    out.push('', '| 항목 | 현재 | 기준 | 조치 |', '|---|---|---|---|');
    for (const [name, current, threshold, fix] of fails) {
      out.push(`| ${name} | ${current} | ${threshold} | ${fix} |`);
    }
  } else {
    out.push('**G4 기계 검사 통과**');
  }
  return out.join('\n');
}
