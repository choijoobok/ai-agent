/** 쓰기 전 정책을 순서대로 실행한다. */
import { readHookInput } from './lib.mjs';
import { emitHookResults, runHookChain } from './hook-chain.mjs';

const input = await readHookInput();
emitHookResults(await runHookChain(input, ['guard-write.mjs', 'guard-generated.mjs']), 'PreToolUse');
