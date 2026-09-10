/** Codex SessionStart 어댑터 — resume·compact 뒤 공통 상태와 현재 훅 실행 확인을 다시 주입한다. */
import { readHookInput } from '../../.claude/hooks/lib.mjs';
import { emitHookResults, runHookChain } from '../../.claude/hooks/hook-chain.mjs';
import { SESSION_RESUME } from '../../aidd-guide/harness/runtime/chains.mjs';
import {
  codexHookAttestationLine,
  configuredCodexHookRevision,
  currentCodexHookRevision,
} from '../../aidd-guide/harness/runtime/codex-hook-revision.mjs';

/* **출력은 한 곳에서만 낸다.** 어댑터가 따로 `stdout` 에 쓰면 날 것과 JSON 이 섞이고,
   섞인 출력은 파싱되지 않아 **Codex 가 훅 전체를 실패로 잡는다** — 그러면 실행 확인이
   문맥에 닿지 못한다(hooks-contract.md 의 「SessionStart 의 출력 형태」). 낼 것은
   `outputs` 에 넣어 `emitHookResults` 하나로 보낸다. */
const input = await readHookInput();
const outputs = await runHookChain(input, SESSION_RESUME);

const current = currentCodexHookRevision();
if (configuredCodexHookRevision() === current) outputs.push(codexHookAttestationLine(current));

emitHookResults(outputs, 'SessionStart');
