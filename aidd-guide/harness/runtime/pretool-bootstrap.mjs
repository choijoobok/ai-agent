/**
 * 파일 PreToolUse adapter가 import되기 전부터 fail-closed를 보장하는 최소 진입부.
 *
 * <p>공통 `lib.mjs`를 일부러 import하지 않는다. 그 파일이나 adapter 자체의 구문이 깨져도
 * 입력을 읽고 deny를 만들 수 있어야 하기 때문이다. 훅 파일을 고치는 patch만 통과시키고,
 * 다른 쓰기는 모두 닫는다. 이 파일 자체가 깨지면 provider command wrapper가 종료 코드 2로
 * 바꾸며, 그때는 아직 살아 있는 shell 도구로 이 파일을 고친다.
 */

import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
/*
  수리하는 자리 — 훅 adapter 둘과 **그것들이 함께 쓰는 실행 원본**이다.
  `chains.mjs` 나 `pretool-bootstrap.mjs` 가 깨지면 모든 chain 이 서지 못하는데, 그 둘을
  열지 않으면 <b>잠긴 사람이 잠근 파일을 못 고친다</b>. 이 폴더에는 훅이 지키는 생성물이
  없어(`SKILL.md` 는 `.claude/skills/`) 여는 위험이 없다.
*/
const REPAIR_PATH = /^(?:\.claude\/hooks|\.codex\/hooks|aidd-guide\/harness\/runtime)\/[^/]+\.mjs$/;

export function patchTargets(input) {
  const cwd = input?.cwd || REPO;
  const direct = input?.tool_input?.file_path ?? input?.tool_input?.path;
  if (direct) return [resolve(cwd, direct)];

  const command = String(input?.tool_input?.command ?? '');
  const targets = [];
  for (const line of command.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^\*\*\* (?:Add|Update|Delete) File:\s*(.+?)\s*$/)
      ?? line.match(/^\*\*\* Move to:\s*(.+?)\s*$/);
    if (match) targets.push(resolve(cwd, match[1]));
  }
  return [...new Set(targets)];
}

export function crashOutput(input, entry, error) {
  const targets = patchTargets(input).map(repoRelative).filter(Boolean);
  const repair = targets.length > 0 && targets.every((path) => REPAIR_PATH.test(path));
  const cause = firstLine(error);

  /* 셸 chain 도 이 진입부를 쓴다 — 진입 경로가 어느 chain인지의 정본이다. 도구 이름으로
     추정하면 MCP shell 이름을 파일 도구로 오인해 수리 안내가 뒤집힌다. */
  if (basename(String(entry).replace(/\\/g, '/')) === 'pre-shell.mjs') {
    const reason = [
      `셸 보호 진입부 실행 실패: ${entry}: ${cause}`,
      '**명령 실행을 차단했다.** 편집 도구(`Edit`)로 훅을 복구한 뒤 다시 시도한다.',
      '원인은 `node --check <훅 경로>` 가 말해 준다.',
    ].join('\n');
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    };
  }

  if (repair) {
    const message = [
      `**파일 보호 진입부가 깨져 있다**(${entry}: ${cause}). 훅 adapter 수리만 통과시킨다.`,
      '**다른 파일은 계속 닫혀 있다.** 고친 뒤 최상위 shell에서 `node --check`를 실행한다.',
    ].join('\n');
    return {
      systemMessage: message,
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: message },
    };
  }

  const reason = [
    `파일 보호 진입부 실행 실패: ${entry}: ${cause}`,
    '**쓰기를 차단했다.** shell로 원인을 확인하고 훅을 복구한 뒤 다시 시도한다.',
    '수리 쓰기는 훅 adapter(`.claude/hooks/` · `.codex/hooks/`)와 `aidd-guide/harness/runtime/` 의 `.mjs` 에만 열린다.',
  ].join('\n');
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

async function main() {
  const [provider, entry] = process.argv.slice(2);
  const input = await readInput();
  process.env.AI_HOOK_INPUT = JSON.stringify(input);
  process.env.AI_HOOK_PROVIDER = provider || 'unknown';
  process.env.AI_HOOK_BOOTSTRAP_ENTRY = resolve(REPO, entry || '');

  try {
    await import(`${pathToFileURL(process.env.AI_HOOK_BOOTSTRAP_ENTRY).href}?bootstrap=${Date.now()}`);
  } catch (error) {
    process.stdout.write(JSON.stringify(crashOutput(input, entry || '(없음)', error)));
  }
}

async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

function repoRelative(path) {
  if (!path) return '';
  const rel = relative(REPO, path);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return '';
  return rel.split(sep).join('/');
}

function firstLine(error) {
  return String(error?.message ?? error ?? 'unknown error').split(/\r?\n/)[0].slice(0, 240);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) await main();
