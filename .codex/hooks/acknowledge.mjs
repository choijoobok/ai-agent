import { readHookInput } from '../../.claude/hooks/lib.mjs';
import { acknowledge } from '../../aidd-guide/harness/runtime/codex-hook-approval.mjs';

acknowledge(await readHookInput());
