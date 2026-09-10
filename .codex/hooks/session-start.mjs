/** Codex SessionStart(startup) 어댑터 — 원격을 당기고 공통 상태를 주입한다. */
import { readHookInput } from '../../.claude/hooks/lib.mjs';
import { emitHookResults, runHookChain } from '../../.claude/hooks/hook-chain.mjs';
import { SESSION_START } from '../../aidd-guide/harness/runtime/chains.mjs';

/* Codex 는 `startup` matcher 로만 이 어댑터를 부른다. `resume`·`clear`·`compact` 는
   session-brief 만 도는 별도 그룹이다 — 작업 중간에 파일을 바꾸지 않기 위해서이고,
   Claude 는 같은 결과를 훅 입력의 `source` 로 판정한다(hooks-contract.md). */
const input = await readHookInput();
emitHookResults(
  await runHookChain({ ...input, source: 'startup' }, SESSION_START),
  'SessionStart',
);
