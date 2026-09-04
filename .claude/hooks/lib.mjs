/**
 * 훅 열하나가 함께 쓰는 것 — 표준 입력 · 저장소 뿌리 · 프로젝트 상태 · 결과 내보내기.
 *
 * <p><b>의존성이 없다. `node` 하나로 돈다</b> — 폐쇄망에서 `npm i` 없이 훅이 서야 하고
 * (CLAUDE.md §1), 훅이 자기 의존성을 갖는 순간 그 설치가 새 사람의 첫 관문이 된다.
 * 두 저장소에서 합칠 때 <b>런타임을 Node 하나로 고른 이유</b>가 이것이다 —
 * [`harness/hooks.md`](../../aidd-guide/harness/hooks.md).
 *
 * <p><b>전부 fail-open 이다.</b> 훅이 죽어도 세션을 막지 않는다. 막는 훅이 죽으면
 * 규율이 사라지지만, <b>죽은 훅이 세션을 막으면 사람이 훅을 끈다</b> — 꺼진 훅은 없는 훅이다.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 훅 입력 — 표준 입력의 JSON 한 덩이. 못 읽으면 빈 객체다(훅이 조용히 통과한다). */
export async function readHookInput() {
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
    if (existsSync(join(dir, 'CLAUDE.md'))) return dir;
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
  process.exit(0);
}

/**
 * 막는다 — `PreToolUse` 전용. 도구 호출 자체가 서지 않는다.
 *
 * <p><b>되돌리기 어려운 것에만 쓴다</b>(생성물 덮어쓰기 · 경로 없는 커밋 · 파괴적 명령 ·
 * 게이트 이전 구현). 판단이 필요한 것은 {@link warn} 이다 — 차단이 잦으면 훅을 끄게 되고,
 * 꺼진 훅은 없는 훅이다.
 */
export function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

/**
 * 알린다 — `PostToolUse` 전용. 작업은 그대로 가고 <b>모델의 문맥에 사실이 들어간다</b>.
 *
 * <p>`systemMessage` 는 사람에게, `additionalContext` 는 모델에게 간다. 둘 다 보내는 것은
 * <i>사람이 봤는데 AI 는 모르는</i> 상태를 만들지 않기 위해서다.
 */
export function warn(message) {
  process.stdout.write(
    JSON.stringify({
      systemMessage: message,
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: message },
    }),
  );
  process.exit(0);
}

/** 세션 시작에 문맥을 넣는다 — 표준 출력이 그대로 모델의 문맥이 된다. */
export function inject(text) {
  process.stdout.write(text);
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
