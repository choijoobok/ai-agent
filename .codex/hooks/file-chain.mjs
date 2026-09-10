/** Codex apply_patch 입력을 파일별 Claude 호환 입력으로 바꾸고 공통 정책을 실행한다. */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readHookInput, REPO } from '../../.claude/hooks/lib.mjs';
import { POST_FILE, PRE_FILE } from '../../aidd-guide/harness/runtime/chains.mjs';
import {
  allowHookRepair,
  emitHookResults,
  runHookChain,
  RECOVERY,
} from '../../.claude/hooks/hook-chain.mjs';

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
  const scripts = event === 'PreToolUse' ? PRE_FILE : event === 'PostToolUse' ? POST_FILE : [];
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

const self = fileURLToPath(import.meta.url);
if (resolve(process.argv[1] ?? '') === self || process.env.AI_HOOK_BOOTSTRAP_ENTRY === self) {
  const input = await readHookInput();
  emitHookResults(await runFileChain(input), input?.hook_event_name || 'PostToolUse');
}
