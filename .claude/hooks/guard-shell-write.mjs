/**
 * 셸로 파일을 쓰는 것도 파일 게이트에 태운다 — AGENTS.md §4 · §5-2 · §5-8 · §5-11.
 *
 * <p><b>왜 있나.</b> 사전 파일 chain 은 `Write`·`Edit` 같은 <i>파일 도구</i>에만 걸린다.
 * 그런데 셸은 `> 파일` 한 글자로 같은 일을 하고, <b>그 경로가 정상 운용 경로다</b> —
 * Claude 의 자동 모드는 편집을 `sed`·heredoc 으로 하라고 권한다. 2026-09-14 에 실측했다:
 * `Write` 로 막히는 `documents/` 지도 밖 경로가 `printf > …` 로는 조용히 만들어졌다.
 * 게이트가 <b>도구 이름으로</b> 서 있으면 도구를 바꾸는 것만으로 게이트가 사라진다.
 *
 * <p><b>새 정책을 만들지 않는다.</b> 명령에서 쓰기 대상 경로만 뽑아 <b>사전 파일 chain 을
 * 그대로</b> 돌린다 — 판정의 원본은 `guard-write` · `guard-generated` 하나뿐이어야
 * 한다(hooks-contract.md). 여기가 갖는 것은 <i>입력 정규화</i> 뿐이다.
 *
 * <p><b>보지 못하는 것이 있다</b>(한계를 숨기지 않는다): 스크립트가 자기 안에서 여는 파일
 * (`node -e` · `python -c` · gradle 태스크), 따옴표 안의 리다이렉션(`awk '{print > "f"}'`),
 * 변수·glob 으로 만든 경로, 명령이 파일에 든 실행(`powershell -File` · `-EncodedCommand`),
 * 이미 열린 REPL 에 이어 넣는 입력. 이것들은 <b>경로가 명령에 없어서</b> 기계가 알 수 없다.
 * 그 자리는 사후 chain 과 사람이 본다.
 */

import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readHookInput, repoRelative, runEmbeddedHook, isEmbedded, deny, pass, REPO,
} from './lib.mjs';
import { PRE_FILE } from '../../aidd-guide/harness/runtime/chains.mjs';

/** 파일이 아닌 리다이렉션 대상 — 여기에 쓰는 것은 저장소를 바꾸지 않는다. */
const NOT_A_FILE = /^(?:&|\$|-$|\/dev\/|nul$|con$)/i;

/** 마지막 인자가 대상인 명령. */
const LAST_ARG_IS_TARGET = new Set(['cp', 'mv', 'install', 'rsync']);

/** 인자 전부가 대상인 명령. */
const ALL_ARGS_ARE_TARGETS = new Set(['tee', 'touch', 'truncate']);

/** PowerShell 에서 파일을 만드는 cmdlet 과 대상을 가리키는 파라미터. */
const PS_WRITERS = new Set([
  'out-file', 'set-content', 'add-content', 'new-item', 'copy-item', 'move-item',
  'export-csv', 'export-clixml', 'tee-object',
]);
const PS_TARGET_FLAG = /^-(?:path|filepath|literalpath|destination)$/i;

/**
 * <b>상대 경로는 두 뿌리에 대 본다 — `cwd` 와 저장소 루트.</b>
 *
 * <p>2026-09-14 실측: MCP 셸 도구(`start_process`)로 `Set-Content -Path documents/x.md` 를
 * 돌리면 <b>파일은 저장소에 생기는데</b> 훅 입력의 `cwd` 는 저장소가 아니었다. `cwd` 하나만
 * 믿으면 상대 경로가 게이트 밖으로 resolve 돼 조용히 통과한다 — 절대 경로로 쓰면 막히고
 * 상대 경로로 쓰면 안 막히는, <b>가장 나쁜 종류의 반쪽 게이트</b>가 된다.
 *
 * <p>비용이 비대칭이라 이렇게 고른다. 더 잡으면 저장소 밖 파일 하나가 안내문과 함께 막히고,
 * 덜 잡으면 게이트가 사라진다.
 */
export function shellWriteTargets(command, cwd) {
  const roots = [...new Set([cwd || REPO, REPO])];
  const found = new Map();
  for (const raw of rawTargets(command, 0)) {
    if (!raw || NOT_A_FILE.test(raw) || /[*?]/.test(raw)) continue;
    for (const root of roots) {
      /* `raw` 가 절대 경로면 `root` 는 무시된다 — 두 번 같은 값이 나오고 Map 이 접는다. */
      const absolute = resolve(root, raw);
      if (repoRelative(absolute)) found.set(absolute, true);
    }
  }
  return [...found.keys()];
}

/** 셸을 다시 여는 래퍼 — 뒤의 인자는 <b>문자열이 아니라 명령</b>이다. */
const SHELL_WRAPPERS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'cmd', 'powershell', 'pwsh']);
/* `-File`·`-EncodedCommand` 는 넣지 않는다 — 명령이 <b>그 자리에 없어서</b> 볼 수 없다. */
const WRAPPER_FLAG = /^(?:-c|\/c|\/k|-command)$/i;

/**
 * <b>래퍼 안으로 한 겹 들어간다.</b>
 *
 * <p>2026-09-14 실측: `cmd /c "echo x > documents/x.md"` 가 통과했다. 따옴표를 존중한
 * 결과 <i>명령 전체가 한 낱말</i>이 돼 리다이렉션이 보이지 않았기 때문이다. 따옴표 존중은
 * 오탐을 막는 옳은 규칙이므로 버리지 않고, <b>래퍼로 넘긴 인자만 다시 명령으로 읽는다.</b>
 * 깊이를 둘로 묶어 `sh -c "sh -c …"` 가 무한히 도는 것을 막는다.
 */
function rawTargets(command, depth) {
  const out = [];
  for (const segment of segments(tokenize(withoutHeredocBodies(command)))) {
    out.push(...segmentTargets(segment));
    if (depth >= 2) continue;
    for (const payload of wrapperPayloads(segment)) out.push(...rawTargets(payload, depth + 1));
  }
  return out;
}

function wrapperPayloads(tokens) {
  const name = String(tokens[0] ?? '').split(/[\\/]/).pop().toLowerCase().replace(/\.exe$/, '');
  if (!SHELL_WRAPPERS.has(name)) return [];
  const payloads = [];
  for (let i = 1; i < tokens.length; i += 1) {
    if (WRAPPER_FLAG.test(tokens[i]) && tokens[i + 1] !== undefined) payloads.push(tokens[i + 1]);
  }
  return payloads;
}

// ── 명령에서 경로를 뽑는다 ─────────────────────────────────────────

/**
 * heredoc 본문을 걷어낸다 — <b>본문은 데이터지 명령이 아니다</b>.
 *
 * <p>`git commit -F -` 의 메시지에 든 `>` 를 리다이렉션으로 읽으면 정직한 커밋 메시지가
 * 막힌다(`guard-bash` 가 같은 이유로 같은 일을 한다). `cat <<EOF > 파일` 처럼 <b>진짜
 * 리다이렉션은 머리 줄에</b> 있으므로 본문을 지워도 그대로 잡힌다.
 */
function withoutHeredocBodies(command) {
  return String(command)
    .replace(/\r\n/g, '\n')
    /* 머리 줄의 나머지(`$2`)는 남긴다 — `cat <<EOF > 파일` 의 <b>리다이렉션이 거기 있다</b>. */
    .replace(/<<-?\s*'?"?([A-Za-z_][A-Za-z0-9_]*)'?"?([^\n]*)\n[\s\S]*?^\s*\1\s*$/gm, '<<$1$2')
    .replace(/@['"]([\s\S]*?)^['"]@/gm, '@HERESTRING@');
}

/** 명령 구분자 — 여기서 한 덩이가 끝난다. */
const SEPARATOR = new Set([';', '&&', '||', '|', '&', '\n']);

/**
 * <b>구분자보다 따옴표가 먼저다.</b> 문자열을 먼저 자르면 인용부 안의 `|` 가 파이프로
 * 읽혀 <i>없는 명령</i>이 생기고, 그 조각의 꼬리가 경로로 둔갑한다 — 2026-09-14 에
 * 이 훅의 첫 판이 그렇게 오탐했다. 그래서 토큰을 먼저 만들고 구분자로 묶는다.
 */
function segments(tokens) {
  const out = [[]];
  for (const token of tokens) {
    if (SEPARATOR.has(token)) {
      if (out[out.length - 1].length) out.push([]);
      continue;
    }
    out[out.length - 1].push(token);
  }
  return out.filter((segment) => segment.length);
}

/** 따옴표를 존중하며 자르고, 리다이렉션·구분자는 <b>독립 토큰</b>으로 낸다. */
function tokenize(text) {
  const tokens = [];
  let current = '';
  let quote = '';
  let started = false;
  const flush = () => {
    if (started) tokens.push(current);
    current = '';
    started = false;
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = '';
      else current += ch;
      started = true;
      continue;
    }
    /* 역슬래시는 <b>따옴표 앞에서만</b> 이스케이프로 본다. 전부 이스케이프로 읽으면
       윈도우 경로(`D:\workspace\…`)의 구분자가 지워져 경로가 딴것이 된다. */
    if (ch === '\\' && (text[i + 1] === '"' || text[i + 1] === "'")) {
      current += text[i + 1];
      started = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
      continue;
    }
    if (ch === '\n') {
      flush();
      tokens.push('\n');
      continue;
    }
    if (/\s/.test(ch)) {
      flush();
      continue;
    }
    if (ch === '>' || ch === '<' || ch === '|' || ch === '&' || ch === ';') {
      flush();
      let operator = ch;
      while (text[i + 1] === ch) {
        operator += ch;
        i += 1;
      }
      tokens.push(operator);
      continue;
    }
    current += ch;
    started = true;
  }
  flush();
  return tokens;
}

function segmentTargets(tokens) {
  const targets = [];
  const words = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '>' || token === '>>') {
      if (tokens[i + 1] !== undefined) targets.push(tokens[i + 1]);
      i += 1;
      continue;
    }
    if (token === '<' || token === '<<' || token === '<<<') {
      i += 1; // 입력은 쓰기가 아니다
      continue;
    }
    words.push(token);
  }
  targets.push(...commandTargets(words));
  return targets;
}

function commandTargets(words) {
  const name = String(words[0] ?? '').split(/[\\/]/).pop().toLowerCase();
  const args = words.slice(1);
  const plain = args.filter((arg) => !arg.startsWith('-'));

  if (PS_WRITERS.has(name)) {
    const flagged = args.findIndex((arg) => PS_TARGET_FLAG.test(arg));
    if (flagged >= 0 && args[flagged + 1]) return [args[flagged + 1]];
    return plain.slice(0, 1);
  }
  if (ALL_ARGS_ARE_TARGETS.has(name)) return plain;
  if (LAST_ARG_IS_TARGET.has(name)) return plain.slice(-1);
  if (name === 'dd') {
    return args.filter((arg) => arg.startsWith('of=')).map((arg) => arg.slice(3));
  }
  /* `sed -i` 만 파일을 고친다 — 나머지 sed 는 읽기다. 첫 인자는 스크립트이므로 뺀다. */
  if (name === 'sed' && args.some((arg) => /^-[^-]*i/.test(arg))) return plain.slice(1);
  return [];
}

// ── 실행 ───────────────────────────────────────────────────────────
/* **선언이 전부 끝난 뒤에 실행한다.** 위의 `const` 는 호이스팅되지 않아, 실행부를 앞에
   두면 첫 호출이 TDZ 로 죽는다 — 사전 chain 은 그것을 차단으로 바꾸므로 <b>셸이 통째로
   잠긴다</b>. 2026-09-14 에 이 파일의 첫 판이 그렇게 잠갔다. */

async function enforce() {
  const input = await readHookInput();
  const command = String(input?.tool_input?.command ?? '').trim();
  if (!command) pass();

  const targets = shellWriteTargets(command, input?.cwd || REPO);
  if (targets.length === 0) pass();

  const blocked = [];
  for (const absolute of targets) {
    for (const script of PRE_FILE) {
      const output = await runEmbeddedHook(join(REPO, '.claude/hooks', script), {
        ...input,
        hook_event_name: 'PreToolUse',
        tool_name: 'Write',
        tool_input: { file_path: absolute, content: command, new_string: command },
      });
      const reason = output?.hookSpecificOutput?.permissionDecisionReason;
      if (!reason) continue;
      blocked.push(`### ${repoRelative(absolute)}\n\n${reason}`);
      break;
    }
  }

  if (blocked.length === 0) pass();

  deny(
    [
      '**셸로 쓰는 것도 같은 게이트를 지난다.** 도구를 바꿔도 규칙은 그대로다.',
      '',
      ...blocked,
      '',
      '명령 자체가 아니라 **쓰려는 경로**가 막혔다. 경로를 고치거나 위 안내를 따른다.',
    ].join('\n'),
  );
}

/* chain 안이거나 직접 실행일 때만 돈다 — 시험이 `shellWriteTargets` 하나를 import 할 때
   훅이 돌아 `process.exit` 로 시험 프로세스를 끝내지 않게 한다. */
if (isEmbedded() || resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await enforce();
}
