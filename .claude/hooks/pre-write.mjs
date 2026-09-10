/** 쓰기 전 정책을 순서대로 실행한다. */
import { readHookInput } from './lib.mjs';
import { allowHookRepair, emitHookResults, runHookChain, RECOVERY } from './hook-chain.mjs';
import { PRE_FILE } from '../../aidd-guide/harness/runtime/chains.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function runPreWrite() {
  const input = await readHookInput();
  const outputs = await runHookChain(input, PRE_FILE, RECOVERY.write);
  emitHookResults(allowHookRepair(input, outputs), 'PreToolUse');
}

const self = fileURLToPath(import.meta.url);
if (resolve(process.argv[1] ?? '') === self || process.env.AI_HOOK_BOOTSTRAP_ENTRY === self) {
  await runPreWrite();
}
