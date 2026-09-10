/** 쓰기 후 교정과 드리프트 검사를 반드시 이 순서로 실행한다. */
import { readHookInput } from './lib.mjs';
import { emitHookResults, runHookChain } from './hook-chain.mjs';

const input = await readHookInput();
emitHookResults(
  await runHookChain(input, [
    'normalize-encoding.mjs',
    'hook-syntax.mjs',
    'trace-check.mjs',
    'doc-drift.mjs',
    'guide-drift.mjs',
    'skill-sync.mjs',
    'harness-doc.mjs',
    'commons-doc.mjs',
  ]),
  'PostToolUse',
);
