/** Codex SessionStart(startup) 어댑터 — 원격을 당기고 공통 상태를 주입한다. */
import { readHookInput } from '../../.claude/hooks/lib.mjs';
import { emitHookResults, runHookChain } from '../../.claude/hooks/hook-chain.mjs';
import { SESSION_START } from '../../aidd-guide/harness/runtime/chains.mjs';
import {
  codexHookAttestationLine,
  configuredCodexHookRevision,
  currentCodexHookRevision,
} from '../../aidd-guide/harness/runtime/codex-hook-revision.mjs';

/* Codex 는 `startup` matcher 로만 이 어댑터를 부른다. `resume`·`clear`·`compact` 는
   session-brief 만 도는 별도 그룹이다 — 작업 중간에 파일을 바꾸지 않기 위해서이고,
   Claude 는 같은 결과를 훅 입력의 `source` 로 판정한다(hooks-contract.md). */
const input = await readHookInput();
const before = currentCodexHookRevision();
const outputs = await runHookChain({ ...input, source: 'startup' }, SESSION_START);
const after = currentCodexHookRevision();
const configured = configuredCodexHookRevision();

/* git-sync가 시작 중 하네스를 당겼다면 승인된 옛 배선과 새 디스크가 섞인 상태다.
   새 revision을 실행했다고 증명하지 않고 다음 task의 `/hooks` 검토로 넘긴다. */
if (before === after && configured === after) {
  outputs.push(codexHookAttestationLine(after));
} else {
  outputs.push('[Codex 훅 승인] 시작 중 훅이 바뀌었거나 revision이 맞지 않아 실행 확인을 발급하지 않았다. CLI(TUI)의 `/hooks`에서 승인하고 새 task를 연다.');
}

emitHookResults(outputs, 'SessionStart');
