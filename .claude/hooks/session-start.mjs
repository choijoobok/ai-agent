/** 세션이 열릴 때의 정책을 순서대로 실행한다 — 원격을 먼저 당기고 나서 상태를 읽는다. */
import { readHookInput } from './lib.mjs';
import { emitHookResults, runHookChain } from './hook-chain.mjs';
import { SESSION_START } from '../../aidd-guide/harness/runtime/chains.mjs';

/* 순서가 의미를 갖는다. `session-brief` 는 `documents/project.state.yaml` 을 읽어 문맥에
   넣는데, 그 파일이 원격에서 바뀌었다면 **당기기 전에 읽은 상태는 낡은 것**이다. */
const input = await readHookInput();
emitHookResults(await runHookChain(input, SESSION_START), 'SessionStart');
