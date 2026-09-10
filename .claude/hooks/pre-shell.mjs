/** Claude shell 정책을 공통 순서로 직렬 실행한다. */
import { readHookInput } from './lib.mjs';
import { emitHookResults, runHookChain, RECOVERY } from './hook-chain.mjs';
import { PRE_SHELL } from '../../aidd-guide/harness/runtime/chains.mjs';

const input = await readHookInput();
emitHookResults(await runHookChain(input, PRE_SHELL, RECOVERY.shell), 'PreToolUse');
