/** Codex startup — 브리핑과 비차단 훅 주의사항을 함께 주입한다. */
import { readHookInput } from '../../.claude/hooks/lib.mjs';
import { emitHookResults, runHookChain } from '../../.claude/hooks/hook-chain.mjs';
import { SESSION_START } from '../../aidd-guide/harness/runtime/chains.mjs';
import { SESSION_NOTICE } from './session-notice.mjs';

const input = await readHookInput();
const outputs = await runHookChain({ ...input, source: 'startup' }, SESSION_START);
outputs.unshift(SESSION_NOTICE);
emitHookResults(outputs, 'SessionStart', { systemMessage: SESSION_NOTICE });
