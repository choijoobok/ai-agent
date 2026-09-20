/** 훅 승인 완료 뒤에만 세션 시작 chain을 실행한다. */

import { emitHookResults, runHookChain } from '../../.claude/hooks/hook-chain.mjs';
import { SESSION_RESUME, SESSION_START } from '../../aidd-guide/harness/runtime/chains.mjs';
import {
  codexHookAttestationLine,
  codexHookReentryMessage,
  configuredCodexHookRevision,
  currentCodexHookRevision,
} from '../../aidd-guide/harness/runtime/codex-hook-revision.mjs';

export async function approvedSessionOutputs(input, source = 'startup') {
  const before = currentCodexHookRevision();
  const scripts = source === 'startup' ? SESSION_START : SESSION_RESUME;
  const outputs = await runHookChain({ ...input, source }, scripts);
  const after = currentCodexHookRevision();
  const configured = configuredCodexHookRevision();

  if (before === after && configured === after) {
    outputs.push(codexHookAttestationLine(after));
  } else {
    outputs.push([
      '[Codex 훅 승인] 승인 뒤 세션 시작 중 훅이 바뀌었거나 revision이 맞지 않아 실행 확인을 발급하지 않았다.',
      codexHookReentryMessage(),
    ].join('\n'));
  }
  return outputs;
}

export async function emitApprovedSession(input, source = 'startup', eventName = 'SessionStart') {
  emitHookResults(await approvedSessionOutputs(input, source), eventName);
}
