/** Codex Bash 입력에 공통 shell 정책 둘을 직렬 적용한다. */
import { readHookInput } from '../../.claude/hooks/lib.mjs';
import { emitHookResults, runHookChain } from '../../.claude/hooks/hook-chain.mjs';

const input = await readHookInput();
emitHookResults(await runHookChain(input, ['guard-bash.mjs', 'guard-commit.mjs']), 'PreToolUse');
