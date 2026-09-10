/** 쓰기 전 정책을 순서대로 실행한다. */
import { readHookInput } from './lib.mjs';
import { allowHookRepair, emitHookResults, runHookChain, RECOVERY } from './hook-chain.mjs';

const input = await readHookInput();
const outputs = await runHookChain(input, ['guard-write.mjs', 'guard-generated.mjs'], RECOVERY.write);
emitHookResults(allowHookRepair(input, outputs), 'PreToolUse');
