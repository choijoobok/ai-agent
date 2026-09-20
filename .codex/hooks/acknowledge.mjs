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
    emitHookResults([[
      '[Codex 훅 승인]',
      '이번 세션 시작 후 새로 승인했으므로 이 창에서는 작업을 계속할 수 없습니다.',
      '새 Codex 앱 창에서 같은 프로젝트를 열고, 승인 시점 질문에는 `1`로 답한 뒤 작업하세요.',
    ].join('\n')], 'UserPromptSubmit');
  } else {
    emitHookResults(
      await approvedSessionOutputs(input, approvalEntrySource(input)),
      'UserPromptSubmit',
    );
  }
}
