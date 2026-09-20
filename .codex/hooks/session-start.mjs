/** 이전 설정과 직접 실행 호환용 어댑터 — 승인 완료 뒤에만 쓰인다. */
import { readHookInput } from '../../.claude/hooks/lib.mjs';
import { emitApprovedSession } from './approved-session.mjs';

/* 직접 실행이 필요한 호환 경로만 남긴다. 실제 SessionStart는 approval-status만 실행하며,
   승인 선택 `1` 뒤에 acknowledge가 이 adapter와 같은 chain을 호출한다. */
const input = await readHookInput();
await emitApprovedSession(input, 'startup');
