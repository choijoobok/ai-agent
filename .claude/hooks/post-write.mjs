/** 쓰기 후 교정과 드리프트 검사를 반드시 이 순서로 실행한다. */
import { readHookInput } from './lib.mjs';
import { emitHookResults, runHookChain } from './hook-chain.mjs';
import { POST_FILE } from '../../aidd-guide/harness/runtime/chains.mjs';

const input = await readHookInput();
emitHookResults(
  await runHookChain(input, POST_FILE),
  'PostToolUse',
);
