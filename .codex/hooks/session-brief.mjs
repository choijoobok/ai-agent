/** Codex SessionStart 어댑터 — compact 뒤에도 공통 상태와 훅 실행 확인을 다시 주입한다. */
import {
  codexHookAttestationLine,
  configuredCodexHookRevision,
  currentCodexHookRevision,
} from '../../aidd-guide/harness/runtime/codex-hook-revision.mjs';

const current = currentCodexHookRevision();
if (configuredCodexHookRevision() === current) {
  process.stdout.write(`${codexHookAttestationLine(current)}\n`);
}
await import('../../.claude/hooks/session-brief.mjs');
