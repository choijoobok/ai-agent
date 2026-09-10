/**
 * 훅들이 함께 쓰는 것 — 표준 입력 · 저장소 뿌리 · 프로젝트 상태 · 결과 내보내기.
 *
 * <p><b>의존성이 없다. `node` 하나로 돈다</b> — 폐쇄망에서 `npm i` 없이 훅이 서야 하고
 * (AGENTS.md §1), 훅이 자기 의존성을 갖는 순간 그 설치가 새 사람의 첫 관문이 된다.
 * 두 저장소에서 합칠 때 <b>런타임을 Node 하나로 고른 이유</b>가 이것이다 —
 * [`harness/hooks-contract.md`](../../aidd-guide/harness/hooks-contract.md).
 *
 * <p><b>전부 fail-open 이다.</b> 훅이 죽어도 세션을 막지 않는다. 막는 훅이 죽으면
 * 규율이 사라지지만, <b>죽은 훅이 세션을 막으면 사람이 훅을 끈다</b> — 꺼진 훅은 없는 훅이다.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let embeddedInput = null;
let embeddedRun = 0;

/**
 * chain 안에서 `pass`·`warn`·`deny` 가 결과를 들고 빠져나오는 방법.
 *
 * <p><b>그래서 셋을 `try` 안에 두지 않는다</b> — 바로 옆 `catch` 가 이것을 삼키면
 * 훅은 <i>일은 하고 아무 말도 안 하는</i> 상태가 된다(hooks-contract.md).
 */
class HookExit extends Error {
  constructor(output) {
    super('embedded hook completed');
    this.name = 'HookExit';
    this.output = output;
  }
}

/** 훅 입력 — 표준 입력의 JSON 한 덩이. 못 읽으면 빈 객체다(훅이 조용히 통과한다). */
export async function readHookInput() {
  if (embeddedInput !== null) return embeddedInput;
  if (process.env.AI_HOOK_INPUT) {
    try {
      return JSON.parse(process.env.AI_HOOK_INPUT);
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

/**
 * 저장소 뿌리 — <b>이 파일의 위치에서 올라가 찾는다</b>.
 *
 * <p>작업 디렉터리를 믿지 않는다. 훅이 어느 경로에서 불릴지는 하네스가 정하고, 그것이
 * 바뀌면 <b>훅이 조용히 아무것도 안 하게</b> 된다 — 가장 나쁜 실패다.
 */
export const REPO = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'AGENTS.md')) || existsSync(join(dir, 'CLAUDE.md'))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
})();

/** 도구 입력에서 대상 파일 경로를 꺼낸다 — Write · Edit 이 같은 칸을 쓴다. */
export function targetPath(input) {
  const raw =
    input?.tool_input?.file_path ??
    input?.tool_input?.path ??
    input?.tool_response?.filePath ??
    '';
  return raw ? resolve(raw) : '';
}

/**
 * 저장소 기준 상대 경로 — 슬래시로 통일한다(윈도우의 역슬래시가 규칙과 어긋난다).
 *
 * <p><b>바깥이면 빈 문자열이다.</b> 훅은 이 저장소의 규칙만 집행한다 — 특히
 * `normalize-encoding` 은 파일을 <b>고치므로</b>, 밖을 상대 경로로 오인하면 남의 파일을
 * 손댄다. <b>다른 드라이브</b>가 그 자리다: 윈도우에서 `relative('D:\\repo', 'C:\\tmp\\x')`
 * 는 `..` 로 시작하지 않고 <b>절대 경로 그대로</b>를 돌려준다.
 */
export function repoRelative(absolutePath) {
  if (!absolutePath) return '';
  const rel = relative(REPO, absolutePath);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return '';
  return rel.split(sep).join('/');
}

export function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

// ── 프로젝트 상태 ─────────────────────────────────────────────────

/** 단계 순서 — `documents/project.state.yaml` 의 `gates:` 키와 짝이다. */
/**
 * <b>어느 기능에도 속하지 않는 층</b> — `@feat` 태그를 묻지 않는다(T10).
 *
 * <p>여기 있는 코드의 존재 이유가 <b>여러 기능이 함께 쓴다</b>는 것이다. 공통물은 두 번째
 * 사용에 올라오므로(AGENTS.md §8) <b>정의상 둘 이상의 기능</b>에 속하고, 그중 하나를 골라
 * 적으면 나머지와의 연결이 조용히 사라진다. 프레임워크 최하층(`core`)·설정(`support`·
 * `bootstrap`)·셸(`layouts`·`app`)은 아예 어느 기능도 아니다.
 *
 * <p><b>태그를 요구하면 결국 아무 FEAT 나 붙는다.</b> 거짓 연결은 빈칸보다 나쁘다 — 빈칸은
 * 모른다고 말하지만 거짓 연결은 <b>안다고 말한다</b>. T4·T9 가 그 위에서 초록이 된다.
 *
 * <p><b>전제는 기능 코드가 여기 살지 않는다는 것</b>이다. 백엔드는 `domain`·`api`, 프론트는
 * `features` 가 그 자리다(standard/backend/packages.md · standard/frontend/packages.md).
 * 경계가 무너지면 이 면제도 함께 무너지므로 <b>여기에 기능을 넣지 않는 것</b>이 규칙의
 * 절반이다.
 *
 * <p><b>면제 명단(`feat-baseline.txt`)과 뜻이 다르다.</b> 저것은 갚아야 할 빚이라 줄어들기만
 * 하고, 이것은 영구 규칙이다. 한 파일을 둘이 함께 덮지 않는다 — 덮으면 이 목록을 고쳐도
 * <b>아무 일도 일어나지 않는다</b>. → process/05-traceability.md §3
 */
export const FEATURELESS = [
  /^sources\/backend\/(core|support|bootstrap)\//,
  /^sources\/frontend\/src\/(shared|layouts|app|locales)\//,
  // 진입점과 빌드 설정 — 코드이지만 업무가 아니다.
  /^sources\/frontend\/src\/main\.tsx$/,
  /^sources\/frontend\/[^/]+\.(ts|js|cjs|mjs)$/,
];

/** 그 층 밖인가 — <b>두 게이트가 이 함수 하나를 쓴다</b>(T10 의 답이 갈리지 않게). */
export function needsFeatTag(rel) {
  return !FEATURELESS.some((zone) => zone.test(rel));
}

export const PHASES = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

export const PHASE_NAME = {
  P0: '착수',
  P1: '발견·요구사항',
  P2: '아키텍처',
  P3: '설계',
  P4: '구현',
  P5: '검증',
  P6: '인도',
};

export const PHASE_FILE = {
  P0: 'aidd-guide/phase/P0-inception.md',
  P1: 'aidd-guide/phase/P1-discovery.md',
  P2: 'aidd-guide/phase/P2-architecture.md',
  P3: 'aidd-guide/phase/P3-design.md',
  P4: 'aidd-guide/phase/P4-build.md',
  P5: 'aidd-guide/phase/P5-verify.md',
  P6: 'aidd-guide/phase/P6-deliver.md',
};

export const STATE_FILE = 'documents/project.state.yaml';

/** 진행 상태 — 없으면 빈 객체(훅들이 전부 무동작한다). */
export function readState() {
  const text = readText(join(REPO, STATE_FILE));
  if (!text) return {};
  return parseYaml(text);
}

export function currentPhase(state) {
  return state?.current?.phase || 'P0';
}

export function gateStatus(state, key) {
  return state?.gates?.[key]?.status || 'not_started';
}

// ── 결과 내보내기 ─────────────────────────────────────────────────

/** 통과 — 아무 말도 하지 않는다. */
export function pass() {
  finish(null);
}

/**
 * 막는다 — `PreToolUse` 전용. 도구 호출 자체가 서지 않는다.
 *
 * <p><b>되돌리기 어려운 것에만 쓴다</b>(생성물 덮어쓰기 · 경로 없는 커밋 · 파괴적 명령 ·
 * 게이트 이전 구현). 판단이 필요한 것은 {@link warn} 이다 — 차단이 잦으면 훅을 끄게 되고,
 * 꺼진 훅은 없는 훅이다.
 */
export function deny(reason) {
  finish({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  });
}

/**
 * 알린다 — `PostToolUse` 전용. 작업은 그대로 가고 <b>모델의 문맥에 사실이 들어간다</b>.
 *
 * <p>`systemMessage` 는 사람에게, `additionalContext` 는 모델에게 간다. 둘 다 보내는 것은
 * <i>사람이 봤는데 AI 는 모르는</i> 상태를 만들지 않기 위해서다.
 */
export function warn(message) {
  finish({
    systemMessage: message,
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: message },
  });
}

/** 세션 시작에 문맥을 넣는다 — 표준 출력이 그대로 모델의 문맥이 된다. */
export function inject(text) {
  finish(text);
}

/**
 * 지금 이 훅을 부른 것이 누구인가 — `claude` · `codex` · `unknown`.
 *
 * <p><b>배선 경로가 정한다.</b> Codex 는 언제나 `.codex/hooks/*.mjs` 어댑터를 거치고
 * Claude 는 `.claude/hooks/*.mjs` 를 직접 부른다 — <b>우리가 그렇게 배선했으므로</b>
 * 짐작이 아니라 사실이다(`harness-check` 가 그 전제를 검사한다). 훅 입력의 필드를
 * 뒤지지 않는 이유가 이것이다: 안정 계약에 없는 필드로 분기하면 <b>조용히 틀린다.</b>
 *
 * <p>손으로 `node .claude/hooks/…` 를 돌린 경우처럼 배선 밖이면 환경 변수를 본다.
 * 둘 다 모르면 <b>`unknown` 이다</b> — 모르는 것을 아는 척하지 않는다(AGENTS.md §3).
 */
export function provider() {
  const bootstrapped = String(process.env.AI_HOOK_PROVIDER ?? '').toLowerCase();
  if (bootstrapped === 'claude' || bootstrapped === 'codex') return bootstrapped;
  const entry = String(process.argv[1] ?? '').replace(/\\/g, '/');
  if (entry.includes('/.codex/')) return 'codex';
  if (entry.includes('/.claude/')) return 'claude';
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT) return 'claude';
  if (process.env.CODEX_HOME || process.env.CODEX_SANDBOX) return 'codex';
  return 'unknown';
}

/** 사람에게 보이는 이름 — 로그와 커밋 표식이 함께 쓴다. */
export const PROVIDER_NAME = { claude: 'Claude', codex: 'Codex', unknown: 'AI' };

/**
 * 스킬을 <b>그 자리에서 실행할 수 있는 형태</b>로 적는다 — Claude 는 `/이름`,
 * Codex 는 `$이름`.
 *
 * <p>공통 훅이 한쪽 문법을 박으면 다른 쪽에서 <i>실행되지 않는 말</i>이 되고, 둘 다
 * 피해 "이름 스킬" 로만 적으면 <b>양쪽 모두에게 한 단계 멀어진다.</b> 아는 쪽에서는
 * 부를 수 있게 적고, 모르면 중립으로 적는다.
 */
export function skillRef(name) {
  const who = provider();
  if (who === 'claude') return `\`/${name}\``;
  if (who === 'codex') return `\`$${name}\``;
  return `${name} 스킬`;
}

/** 같은 프로세스에서 기존 top-level 훅을 한 번 실행한다 — 직렬 chain 전용. */
export async function runEmbeddedHook(scriptPath, input) {
  embeddedInput = input;
  try {
    const url = `${pathToFileURL(scriptPath).href}?embedded=${embeddedRun++}`;
    await import(url);
    return null;
  } catch (error) {
    if (error instanceof HookExit) return error.output;
    throw error;
  } finally {
    embeddedInput = null;
  }
}

function finish(output) {
  if (embeddedInput !== null) throw new HookExit(output);
  if (output !== null && output !== undefined) {
    process.stdout.write(typeof output === 'string' ? output : JSON.stringify(output));
  }
  process.exit(0);
}

// ── 최소 YAML ─────────────────────────────────────────────────────

/**
 * <b>우리 spec 형식만 읽는 최소 파서</b> — 들여쓰기 맵 · 대시 리스트 · 스칼라 ·
 * 인라인 `{k: v}` · 인라인 `[a, b]` · `|`/`>` 블록 · `#` 주석.
 *
 * <p>앵커·태그·복합 키·여러 문서(`---`)는 지원하지 않는다. <b>일부러 좁게 만들었다</b> —
 * 훅이 의존성을 갖지 않는 것이 우선이고(위), 형식을 넓히면 <i>틀리게 파싱한 훅</i>이 된다.
 * 틀리게 파싱한 검사기는 아무것도 안 막으면서 초록불을 준다.
 *
 * <p>지원 범위를 벗어난 문법이 spec 에 들어오면 파서를 넓히지 말고 <b>spec 을 좁힌다</b>.
 * SSOT 의 문법이 단순한 것은 비용이 아니라 값이다.
 */
export function parseYaml(text) {
  const lines = [];
  for (const raw of String(text).replace(/\r\n/g, '\n').split('\n')) {
    if (!raw.trim() || /^\s*#/.test(raw)) continue;
    if (raw.trim() === '---') continue;
    const indent = raw.length - raw.replace(/^\s*/, '').length;
    lines.push({ indent, text: stripComment(raw.trim()) });
  }
  const [value] = block(lines, 0, 0);
  return value ?? {};
}

function stripComment(s) {
  let quote = null;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quote) {
      if (c === quote && s[i - 1] !== '\\') quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).trim();
  }
  return s;
}

/** [값, 다음 줄 번호] — indent 보다 깊은 줄들을 하나의 맵 또는 리스트로 읽는다. */
function block(lines, i, indent) {
  if (i >= lines.length || lines[i].indent < indent) return [null, i];
  if (lines[i].text.startsWith('- ')) return list(lines, i, lines[i].indent);
  if (lines[i].text === '-') return list(lines, i, lines[i].indent);
  return map(lines, i, lines[i].indent);
}

function map(lines, i, indent) {
  const out = {};
  while (i < lines.length && lines[i].indent >= indent) {
    if (lines[i].indent > indent) { i += 1; continue; } // 형식 이탈 — 건너뛴다
    const m = lines[i].text.match(/^("[^"]*"|'[^']*'|[^:]+?)\s*:\s*(.*)$/);
    if (!m) { i += 1; continue; }
    const key = unquote(m[1]);
    const inline = m[2];
    if (inline === '' || inline === '|' || inline === '>' || inline === '|-' || inline === '>-') {
      const [child, next] = inline.startsWith('|') || inline.startsWith('>')
        ? scalarBlock(lines, i + 1, indent)
        : block(lines, i + 1, indent + 1);
      out[key] = child ?? (inline === '' ? null : '');
      i = next;
    } else {
      out[key] = scalar(inline);
      i += 1;
    }
  }
  return [out, i];
}

function list(lines, i, indent) {
  const out = [];
  while (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith('-')) {
    const head = lines[i].text.replace(/^-\s*/, '');
    if (head === '') {
      const [child, next] = block(lines, i + 1, indent + 1);
      out.push(child);
      i = next;
    } else if (/^("[^"]*"|'[^']*'|[\w.-]+)\s*:/.test(head)) {
      // `- id: X` — 첫 칸이 대시와 같은 줄에 있다. 가상 들여쓰기로 맵을 읽는다.
      const virtual = [{ indent: indent + 2, text: head }];
      let j = i + 1;
      while (j < lines.length && lines[j].indent > indent) {
        virtual.push({ indent: lines[j].indent, text: lines[j].text });
        j += 1;
      }
      const [child] = map(virtual, 0, indent + 2);
      out.push(child);
      i = j;
    } else {
      out.push(scalar(head));
      i += 1;
    }
  }
  return [out, i];
}

function scalarBlock(lines, i, indent) {
  const parts = [];
  while (i < lines.length && lines[i].indent > indent) {
    parts.push(lines[i].text);
    i += 1;
  }
  return [parts.join('\n'), i];
}

function scalar(s) {
  const t = s.trim();
  if (t === '' || t === '~' || t === 'null') return null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t.startsWith('[') && t.endsWith(']')) {
    const body = t.slice(1, -1).trim();
    return body ? splitTop(body).map(scalar) : [];
  }
  if (t.startsWith('{') && t.endsWith('}')) {
    const out = {};
    for (const part of splitTop(t.slice(1, -1))) {
      const m = part.match(/^([^:]+):\s*(.*)$/);
      if (m) out[unquote(m[1].trim())] = scalar(m[2]);
    }
    return out;
  }
  if (/^-?\d+$/.test(t)) return Number(t);
  if (/^-?\d*\.\d+$/.test(t)) return Number(t);
  return unquote(t);
}

/** 최상위 콤마로만 자른다 — 중첩 `[]`·`{}` 와 인용부호 안의 콤마를 지킨다. */
function splitTop(s) {
  const out = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '[' || c === '{') depth += 1;
    else if (c === ']' || c === '}') depth -= 1;
    else if (c === ',' && depth === 0) {
      out.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = s.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

function unquote(s) {
  const t = String(s).trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

// ── 가이드 역인덱스 (`sources:` 메타) ─────────────────────────────

/**
 * 역인덱스에 넣을 <b>폴더</b> 엔트리의 최소 세그먼트 — 넷이다.
 *
 * <p>`sources/frontend/src/` 셋은 <i>프론트 전부</i> 를 주장하는 값이고, 그것까지 태우면
 * 프론트를 건드릴 때마다 같은 문서 이름이 뜬다. 넷이면 `sources/frontend/src/shared/grid/`
 * 처럼 <b>무엇에 대한 문서인지 말하는 값</b>만 남는다.
 *
 * <p><b>파일 엔트리에는 걸지 않는다</b>({@link namesFile}). 문턱의 목적은 <i>너무 넓은
 * 값을 빼는 것</i> 인데 파일은 하나를 가리키므로 넓을 수가 없다 — 세그먼트로만 재면
 * `AGENTS.md`(하나) · `sources/build.gradle.kts`(둘) · `.claude/hooks/log-mask.patterns`(셋)
 * 처럼 <b>가장 구체적인 값이 가장 먼저 빠진다.</b> 실제로 그랬다: 문서 다섯이
 * `"AGENTS.md"` 를, 둘이 빌드 파일을, 둘이 마스킹 패턴을 적어 두었는데 역인덱스에 하나도
 * 오르지 않아 <b>그 파일을 고쳐도 아무 문서도 지목되지 않았다.</b>
 */
const MIN_SEGMENTS = 4;

/**
 * 저장소 경로로 볼 접두 — 그 밖은 인용(외부 문서·실험 기록)이라 경로가 아니다.
 *
 * <p><b>같은 목록이 `aidd-guide/meta/_meta/lint.mjs` 에도 있다</b> — 저쪽은 문서 게이트고
 * 이쪽은 훅이라 서로 import 하지 않는다. <b>하나를 고치면 다른 하나도 고친다.</b>
 */
const REPO_ROOTS = [
  'sources/',
  'aidd-guide/',
  'documents/',
  'user-guide/',
  '.claude/',
  '.agents/',
  '.codex/',
  '.github/',
];

/** 파일을 가리키는 엔트리인가 — 마지막 마디에 확장자가 있으면 파일이다. */
function namesFile(entry) {
  const last = entry.split('/').filter(Boolean).at(-1) ?? '';
  return /\.[A-Za-z0-9]+$/.test(last);
}

/**
 * 저장소 안의 경로인가 — 접두 목록이거나 <b>루트에 바로 있는 파일</b>.
 *
 * <p>{@link REPO_ROOTS} 가 폴더 접두만 담아서 `AGENTS.md` · `.gitignore` 는 접두에 걸리지
 * 않는다. 문서 다섯이 `"AGENTS.md"` 를 적어 두었고 <b>그 값은 역인덱스에 오른 적이
 * 없다</b> — 헌법을 고쳐도 그것을 근거로 적은 문서가 지목되지 않았다.
 */
function isRepoEntry(entry) {
  if (REPO_ROOTS.some((root) => entry.startsWith(root))) return true;
  return !entry.includes('/') && namesFile(entry) && existsSync(join(REPO, entry));
}

/**
 * 엔트리의 세그먼트가 경로에 <b>순서대로</b> 나타나면 맞다 — 축약 경로를 허용한다.
 *
 * <p>`sources/backend/support/logging/` 의 실물은
 * `.../support/src/main/java/com/aiagent/support/logging/` 다. 사람이 적는 값이라 모듈
 * 안쪽의 관례 경로를 접는다.
 */
export function sourceEntryMatches(entry, path) {
  const want = entry.replace(/\/$/, '').split('/');
  let i = 0;
  for (const seg of path.split('/')) if (seg === want[i]) i += 1;
  return i === want.length;
}

/**
 * `aidd-guide/` 전체의 `sources:` 메타를 한 번 읽어 만든 역인덱스.
 *
 * <p><b>둘이 쓴다</b> — `guide-drift`(소스를 고쳤을 때 대조할 문서)와 `commons-doc`(공통물
 * 목록의 「어디를 읽나」 칸). 매처를 양쪽에 두면 갈리고, 갈리면 <b>훅과 목록이 서로 다른
 * 사실을 말한다</b>(AGENTS.md §4-3).
 *
 * @returns {{doc: string, title: string, entries: string[]}[]}
 */
export function guideSourceIndex() {
  const out = [];
  for (const file of walkFiles(join(REPO, 'aidd-guide'))) {
    if (!file.endsWith('.md')) continue;
    const text = readText(file);
    const line = text.match(/^sources:\s*(\[.*\])\s*$/m)?.[1];
    if (!line) continue;
    const entries = [...line.matchAll(/"([^"]+)"/g)]
      .map(([, e]) => e)
      .filter(isRepoEntry)
      .filter((e) => namesFile(e) || e.split('/').filter(Boolean).length >= MIN_SEGMENTS);
    if (entries.length === 0) continue;
    out.push({
      doc: relative(REPO, file).split(sep).join('/'),
      title: (text.match(/^title:\s*"?(.*?)"?\s*$/m)?.[1] ?? '').trim(),
      entries,
    });
  }
  return out.sort((a, b) => a.doc.localeCompare(b.doc));
}

/** 이 소스 경로를 `sources:` 에 적은 가이드 문서들 — 저장소 기준 경로로. */
export function guidesForSource(path, index = guideSourceIndex()) {
  return index
    .filter(({ entries }) => entries.some((e) => sourceEntryMatches(e, path)))
    .map(({ doc }) => doc);
}

/** `node_modules` · `.git` 을 뺀 파일 전수. */
export function walkFiles(dir, acc = []) {
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
    if (st.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

/**
 * 이 <b>폴더</b>를 지목한 가이드 문서들 — {@link guidesForSource} 와 질의가 다르다.
 *
 * <p>파일 단위 질의는 <i>엔트리가 이 파일을 덮나</i> 를 묻는다.
 * `sources/.../shared/grid/excel/` 은 `grid/DataGrid.tsx` 를 덮지 않으므로 맞지 않고,
 * 드리프트 훅에서는 그것이 옳다 — 안 고친 파일의 문서를 가리키면 경고가 배경음이 된다.
 *
 * <p>폴더 단위는 반대로 <b>엔트리가 이 폴더 안을 가리키기만 해도</b> 맞다. 목록의
 * 「어디를 읽나」 칸이 묻는 것은 <i>이 공통물에 대해 쓰인 문서가 있나</i> 이기 때문이다.
 * 그래서 <b>어느 쪽이든 부분 수열이면</b> 맞는 것으로 본다(축약 경로 양방향).
 */
export function guidesForFolder(folder, index = guideSourceIndex()) {
  return index
    .filter(({ entries }) =>
      entries.some((e) => sourceEntryMatches(e, folder) || sourceEntryMatches(folder, e)),
    )
    .map(({ doc, title }) => ({ doc, title }));
}
