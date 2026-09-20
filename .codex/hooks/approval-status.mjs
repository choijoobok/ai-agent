import { readHookInput } from '../../.claude/hooks/lib.mjs';
import { emitHookResults } from '../../.claude/hooks/hook-chain.mjs';
import { approvalStatus } from '../../aidd-guide/harness/runtime/codex-hook-approval.mjs';

const input = await readHookInput();
emitHookResults([approvalStatus(input)], 'SessionStart');
