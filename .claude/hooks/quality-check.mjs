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

/**
 * 창을 <b>클론으로 접는다</b> — 같은 줄을 여러 번 세지 않기 위해서다.
 *
 * <h2>창은 겹친다</h2>
 *
 * <p>6줄 창을 <b>한 줄씩</b> 미끄러뜨리므로, 7줄짜리 복사 한 곳은 창 <b>둘</b>에 걸린다.
 * 창마다 {@code (벌수-1)*6} 을 더하면 23벌짜리 {@code *ErrorCode} 블록이 <b>264줄</b>로
 * 세어지는데, 실제로 지울 수 있는 줄은 {@code 22 × 7 = 154} 다. 블록이 길수록 더 부푼다 —
 * 13줄 복사 한 쌍은 창 여덟에 걸려 <b>48줄</b>이 되고 참값은 13이다.
 *
 * <p>2026-09-06 에 재 보니 <b>6.95% 가 1.96% 였다</b>. 임계 5%는 GitClear 의 관찰에서 온
 * 값이고 <b>그쪽은 겹쳐 세지 않는다</b> — 즉 지금까지 우리는 <b>다른 자로 재고 같은 눈금을
 * 읽고 있었다</b>. 고친 것은 *무엇을 중복이라 부르는가* 이지 *얼마까지 봐주는가* 가
 * 아니다(CLAUDE.md §5-10 — 임계를 올려 통과시키지 않는다). <b>임계는 그대로 5% 다.</b>
 *
 * <h2>어떻게 접나 — 네 걸음</h2>
 *
 * <ol>
 *   <li>중복 창이 덮은 줄에 <b>표시</b>한다(같은 줄에 창이 몇 개 걸리든 한 번).
 *   <li>이어진 표시를 <b>한 덩이</b>로 묶는다 — 이것이 클론 하나의 실제 길이다.
 *   <li>같은 창을 공유하는 덩이끼리 <b>한 클래스</b>로 잇는다.
 *   <li>클래스마다 <b>가장 긴 한 벌을 남기고</b> 나머지 줄이 *지울 수 있는 줄* 이다.
 * </ol>
 *
 * <p><b>③이 없으면 경계가 갈린 짝을 놓친다.</b> 복사 둘이 나란히 붙은 파일에서는 덩이가
 * 15줄 하나로 뭉치고, 다른 파일의 7줄짜리와 <i>글자가 달라</i> 짝이 되지 못한다 — 그렇게
 * 놓친 것이 544줄이었다. 창을 공유하면 잇는 방식은 그 15줄을 7줄·8줄짜리 둘과 함께 묶어
 * {@code 30 - 15 = 15} 를 낸다(참값과 같다).
 *
 * <p>④에서 <b>가장 긴 것</b>을 남기는 이유도 같다. 짧은 쪽을 대표로 두면 대표가 남기지
 * 못한 줄이 중복으로 세어져 <b>다시 부푼다</b>.
 */
function clones(windows, sources) {
  const dupWindows = [...windows.values()].filter((v) => v.length > 1);

  // ① 덮인 줄에 표시한다 — 창이 몇 개 걸리든 한 번이다.
  const covered = new Map();
  for (const hits of dupWindows) {
    for (const { rel, at } of hits) {
      let set = covered.get(rel);
      if (!set) covered.set(rel, (set = new Set()));
      for (let k = 0; k < WINDOW; k += 1) set.add(at + k);
    }
  }

  // ② 이어진 표시를 한 덩이로 묶는다.
  const regions = [];
  const owner = new Map();
  for (const [rel, set] of covered) {
    const norm = sources.get(rel);
    const idxs = [...set].sort((a, b) => a - b);
    for (let i = 0; i < idxs.length; ) {
      let j = i;
      while (j + 1 < idxs.length && idxs[j + 1] === idxs[j] + 1) j += 1;
      const id = regions.length;
      regions.push({ rel, line: norm[idxs[i]][0], len: idxs[j] - idxs[i] + 1, root: id });
      for (let k = i; k <= j; k += 1) owner.set(`${rel}:${idxs[k]}`, id);
      i = j + 1;
    }
  }

  // ③ 같은 창을 가진 덩이끼리 잇는다.
  const find = (x) => {
    let cur = x;
    while (regions[cur].root !== cur) {
      regions[cur].root = regions[regions[cur].root].root;
      cur = regions[cur].root;
    }
    return cur;
  };
  for (const hits of dupWindows) {
    const first = find(owner.get(`${hits[0].rel}:${hits[0].at}`));
    for (let i = 1; i < hits.length; i += 1) {
      const other = find(owner.get(`${hits[i].rel}:${hits[i].at}`));
      if (other !== first) regions[other].root = first;
    }
  }

  // ④ 클래스마다 가장 긴 한 벌을 남긴다.
  const byClass = new Map();
  for (let i = 0; i < regions.length; i += 1) {
    const root = find(i);
    if (!byClass.has(root)) byClass.set(root, []);
    byClass.get(root).push(regions[i]);
  }
  let dupLines = 0;
  const list = [];
  for (const rs of byClass.values()) {
    const keep = Math.max(...rs.map((r) => r.len));
    const gone = rs.reduce((s, r) => s + r.len, 0) - keep;
    if (gone === 0) continue;
    dupLines += gone;
    list.push({
      count: rs.length,
      lines: keep,
      gone,
      locations: rs.slice(0, 4).map((r) => `${r.rel}:${r.line}`),
    });
  }
  list.sort((a, b) => b.gone - a.gone);
  return { dupLines, cloneCount: list.length, top: list.slice(0, 10) };
}

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
  /** 파일별 정규화 줄 — 창을 클론으로 접을 때 덩이의 길이와 줄번호를 여기서 읽는다. */
  const sources = new Map();
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
    sources.set(rel, norm);
    for (let i = 0; i + WINDOW <= norm.length; i += 1) {
      const chunk = norm.slice(i, i + WINDOW).map(([, n]) => n).join('\n');
      const h = createHash('md5').update(chunk).digest('hex');
      if (!windows.has(h)) windows.set(h, []);
      windows.get(h).push({ rel, at: i });
    }
  }

  const dup = clones(windows, sources);

  return {
    files: list.length,
    codeLines: totalLines,
    duplicationPct: totalLines ? Math.round((dup.dupLines * 10000) / totalLines) / 100 : 0,
    duplicateLines: dup.dupLines,
    cloneCount: dup.cloneCount,
    topDuplicates: dup.top,
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
    ['중복 덩이', `${m.cloneCount}개 / ${m.duplicateLines}줄`, '—', true],
    ['예외 삼킴', `${m.swallowedErrors}건`, '0', m.swallowedErrors === 0],
    ['@feat 미태깅', `${m.untaggedFiles}개`, '0', m.untaggedFiles === 0],
  ];
  for (const [name, value, threshold, ok] of rows) {
    out.push(`| ${name} | ${value} | ${threshold} | ${ok ? '✅' : '❌'} |`);
  }

  /*
    <b>*회* 가 아니라 *벌 × 줄* 로 적는다.</b> 뽑을지 정하려면 <i>몇 군데인가</i> 만으로는
    모자라고 <b>한 벌이 몇 줄인가</b> 를 함께 봐야 한다 — 두 줄짜리가 스무 군데인 것과
    스무 줄짜리가 둘인 것은 <b>같은 수를 내면서 할 일이 다르다</b>.
  */
  if (m.topDuplicates.length > 0) {
    out.push('', '### 지울 수 있는 줄이 많은 덩이', '');
    for (const d of m.topDuplicates.slice(0, 5)) {
      out.push(`- ${d.count}벌 × ${d.lines}줄 → ${d.gone}줄: ${d.locations.join(', ')}`);
    }
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
