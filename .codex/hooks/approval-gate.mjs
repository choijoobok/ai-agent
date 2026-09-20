import { readHookInput } from '../../.claude/hooks/lib.mjs';
import { emitHookResults } from '../../.claude/hooks/hook-chain.mjs';
import { approvalGateReason } from '../../aidd-guide/harness/runtime/codex-hook-approval.mjs';

const input = await readHookInput();
const reason = approvalGateReason(input);
emitHookResults(reason ? [{ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }] : [], 'PreToolUse');
