/** Codex SessionStart 어댑터 — resume·compact 뒤 공통 상태와 비차단 주의사항을 다시 주입한다. */
import { readHookInput } from '../../.claude/hooks/lib.mjs';
import { emitHookResults, runHookChain } from '../../.claude/hooks/hook-chain.mjs';
import { SESSION_RESUME } from '../../aidd-guide/harness/runtime/chains.mjs';
import { SESSION_NOTICE } from './session-notice.mjs';

/* **출력은 한 곳에서만 낸다.** 어댑터가 따로 `stdout` 에 쓰면 날 것과 JSON 이 섞이고,
   섞인 출력은 파싱되지 않아 **Codex 가 훅 전체를 실패로 잡는다**. 낼 것은
   `outputs` 에 넣어 `emitHookResults` 하나로 보낸다. */
const input = await readHookInput();
const outputs = await runHookChain(input, SESSION_RESUME);
outputs.unshift(SESSION_NOTICE);

emitHookResults(outputs, 'SessionStart', { systemMessage: SESSION_NOTICE });
