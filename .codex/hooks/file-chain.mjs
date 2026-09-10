/** Codex apply_patch 입력을 파일별 Claude 호환 입력으로 바꾸고 공통 정책을 실행한다. */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readHookInput, REPO } from '../../.claude/hooks/lib.mjs';
import {
  allowHookRepair,
  emitHookResults,
  runHookChain,
  RECOVERY,
} from '../../.claude/hooks/hook-chain.mjs';

const PRE = ['guard-write.mjs', 'guard-generated.mjs'];
const POST = [
  'normalize-encoding.mjs',
  'hook-syntax.mjs',
  'trace-check.mjs',
  'doc-drift.mjs',
  'guide-drift.mjs',
  'skill-sync.mjs',
  'harness-doc.mjs',
  'commons-doc.mjs',
];

export function patchTargets(input) {
  const direct = input?.tool_input?.file_path ?? input?.tool_input?.path;
  if (direct) return [resolve(input?.cwd || REPO, direct)];

  const command = String(input?.tool_input?.command ?? '');
  const targets = [];
  for (const line of command.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^\*\*\* (?:Add|Update|Delete) File:\s*(.+?)\s*$/)
      ?? line.match(/^\*\*\* Move to:\s*(.+?)\s*$/);
    if (!match) continue;
    targets.push(resolve(input?.cwd || REPO, match[1]));
  }
  return [...new Set(targets)];
}

export async function runFileChain(input) {
  const event = input?.hook_event_name;
  const scripts = event === 'PreToolUse' ? PRE : event === 'PostToolUse' ? POST : [];
  if (!scripts.length) return [];
  const command = String(input?.tool_input?.command ?? '');
  const outputs = [];
  for (const filePath of patchTargets(input)) {
    const normalized = {
      ...input,
      tool_input: {
        ...(input?.tool_input ?? {}),
        file_path: filePath,
        content: command,
        new_string: command,
      },
    };
    const current = allowHookRepair(
      normalized,
      await runHookChain(normalized, scripts, event === 'PreToolUse' ? RECOVERY.write : undefined),
    );
    outputs.push(...current);
    if (current.some((x) => x?.hookSpecificOutput?.permissionDecision === 'deny')) break;
  }
  return outputs;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const input = await readHookInput();
  emitHookResults(await runFileChain(input), input?.hook_event_name || 'PostToolUse');
}
