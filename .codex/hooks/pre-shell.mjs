/** Codex Bash 입력에 공통 shell 정책 둘을 직렬 적용한다. */
import { readHookInput } from '../../.claude/hooks/lib.mjs';
import { emitHookResults, runHookChain, RECOVERY } from '../../.claude/hooks/hook-chain.mjs';
import { PRE_SHELL } from '../../aidd-guide/harness/runtime/chains.mjs';

const input = await readHookInput();
emitHookResults(
  await runHookChain(input, PRE_SHELL, RECOVERY.shell),
  'PreToolUse',
);
