import { readHookInput } from '../../.claude/hooks/lib.mjs';
import { emitHookResults } from '../../.claude/hooks/hook-chain.mjs';
import {
  acknowledge,
  approvalEntrySource,
  approvalGateReason,
} from '../../aidd-guide/harness/runtime/codex-hook-approval.mjs';
import { approvedSessionOutputs } from './approved-session.mjs';

const input = await readHookInput();
if (acknowledge(input)) {
  const denied = approvalGateReason(input);
  if (denied) {
    emitHookResults([`[Codex 훅 승인]\n\n${denied}`], 'UserPromptSubmit');
  } else {
    emitHookResults(
      await approvedSessionOutputs(input, approvalEntrySource(input)),
      'UserPromptSubmit',
    );
  }
}
