/** Codex 어댑터의 patch 정규화와 공통 차단 연결을 실제 자식 프로세스로 확인한다. */

import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { REPO } from '../../.claude/hooks/lib.mjs';
import { runHookChain } from '../../.claude/hooks/hook-chain.mjs';
import { patchTargets, runFileChain } from './file-chain.mjs';

const generated = 'sources/backend/bootstrap/src/main/resources/db/changelog/data/003-init-menu.csv';
const patch = `*** Begin Patch\n*** Update File: ${generated}\n@@\n-old\n+new\n*** End Patch`;
const input = {
  cwd: REPO,
  hook_event_name: 'PreToolUse',
  tool_name: 'apply_patch',
  tool_input: { command: patch },
};

assert.deepEqual(patchTargets(input), [join(REPO, ...generated.split('/'))]);
const denied = await runFileChain(input);
assert.equal(denied.some((x) => x?.hookSpecificOutput?.permissionDecision === 'deny'), true);

const generatedSkill = await runFileChain({
  ...input,
  tool_input: {
    command: '*** Begin Patch\n*** Update File: .agents/skills/trace/SKILL.md\n*** End Patch',
  },
});
assert.equal(generatedSkill.some((x) => x?.hookSpecificOutput?.permissionDecision === 'deny'), true);

const safe = await runFileChain({
  ...input,
  tool_input: { command: '*** Begin Patch\n*** Update File: AGENTS.md\n*** End Patch' },
});
assert.equal(safe.some((x) => x?.hookSpecificOutput?.permissionDecision === 'deny'), false);

const post = await runFileChain({
  ...input,
  hook_event_name: 'PostToolUse',
  tool_input: { command: '*** Begin Patch\n*** Update File: README.md\n*** End Patch' },
});
assert.equal(post.some((x) => String(x?.systemMessage ?? '').includes('실행 실패')), false);

const shell = await runHookChain({
  cwd: REPO,
  hook_event_name: 'PreToolUse',
  tool_name: 'Bash',
  tool_input: { command: 'DROP TABLE customer' },
}, ['guard-bash.mjs', 'guard-commit.mjs']);
assert.equal(shell.some((x) => x?.hookSpecificOutput?.permissionDecision === 'deny'), true);
/* `git-sync` 는 작업 중간(`compact`)에 아무것도 하지 않는다 — 여기서 원격을 당기면 AI 가
   방금 읽은 파일과 디스크가 어긋난다. **당기는 쪽은 시험하지 않는다**: 시험이 네트워크를
   타고 CI 의 트리를 실제로 바꾸게 된다. */
const midSession = await runHookChain(
  { cwd: REPO, hook_event_name: 'SessionStart', source: 'compact' },
  ['git-sync.mjs'],
);
assert.deepEqual(midSession, []);

/* 공통 스킬 원본을 고쳐도 chain 이 깨지지 않는다 — 생성은 `skill-sync` 가 맡는다. */
const skillSrc = await runFileChain({
  ...input,
  hook_event_name: 'PostToolUse',
  tool_input: {
    command: '*** Begin Patch\n*** Update File: aidd-guide/harness/skill-src/adr.md\n*** End Patch',
  },
});
assert.equal(skillSrc.some((x) => String(x?.systemMessage ?? '').includes('실행 실패')), false);

console.log('Codex hook adapter self-test 통과');
