/** Codex 어댑터의 patch 정규화와 공통 차단 연결을 실제 자식 프로세스로 확인한다. */

import { strict as assert } from 'node:assert';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, provider, skillRef } from '../../.claude/hooks/lib.mjs';
import { allowHookRepair, runHookChain } from '../../.claude/hooks/hook-chain.mjs';
import { patchTargets, runFileChain } from './file-chain.mjs';
import { crashOutput, patchTargets as bootstrapTargets } from '../../aidd-guide/harness/runtime/pretool-bootstrap.mjs';

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

/* 커밋 본문은 POSIX heredoc과 PowerShell here-string을 모두 읽고 provider의 정확한 마지막
   trailer를 요구한다. Codex에서 실제로 쓰는 PowerShell 쪽을 빼면 표식 없이 통과한다. */
const preShell = (command) => runHookChain({
  cwd: REPO,
  hook_event_name: 'PreToolUse',
  tool_name: 'Bash',
  tool_input: { command },
}, ['guard-commit.mjs']);
const posixCommit = (body) => `git commit -F - -- AGENTS.md <<'EOF'\n${body}\nEOF`;
const powershellCommit = (body) => `$message = @'\n${body}\n'@\n$message | git commit -F - -- AGENTS.md`;
const isDenied = (outputs) => outputs.some((x) => x?.hookSpecificOutput?.permissionDecision === 'deny');

assert.equal(isDenied(await preShell(posixCommit('subject\n\nAgent: Codex'))), false);
assert.equal(isDenied(await preShell(posixCommit('subject'))), true);
assert.equal(isDenied(await preShell(powershellCommit('subject'))), true);
assert.equal(isDenied(await preShell(posixCommit('subject\n\nAgent: Potato'))), true);
assert.equal(isDenied(await preShell(posixCommit('subject\n\nAgent: Codex\ntrailing body'))), true);
assert.equal(isDenied(await preShell("git commit -m 'subject' -- AGENTS.md")), true);

const savedProvider = process.env.AI_HOOK_PROVIDER;
process.env.AI_HOOK_PROVIDER = 'claude';
assert.equal(isDenied(await preShell(posixCommit(
  'subject\n\nAgent: Claude\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>',
))), false);
if (savedProvider === undefined) delete process.env.AI_HOOK_PROVIDER;
else process.env.AI_HOOK_PROVIDER = savedProvider;
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

/* provider 판정의 전제 — 이 파일 자체가 `.codex/hooks/` 에서 돌므로 codex 로 보여야 한다.
   틀리면 커밋 표식과 대화 기록이 **조용히 남의 이름으로 남는다.** */
assert.equal(provider(), 'codex');
assert.equal(skillRef('trace'), '`$trace`');

/* 수리 경로 — 훅이 죽었을 때 **훅 파일만** 열리고 나머지는 닫혀 있어야 한다.
   여는 쪽만 시험하면 게이트가 통째로 열린 것을 못 본다. 양쪽을 다 센다. */
const crashed = [{ crashed: 'guard-write.mjs', hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'x' } }];
const asWrite = (rel) => ({ hook_event_name: 'PreToolUse', tool_input: { file_path: join(REPO, ...rel.split('/')) } });

assert.equal(allowHookRepair(asWrite('.claude/hooks/guard-write.mjs'), crashed)[0]?.hookSpecificOutput?.permissionDecision, undefined);
assert.equal(allowHookRepair(asWrite('.codex/hooks/file-chain.mjs'), crashed)[0]?.hookSpecificOutput?.permissionDecision, undefined);
assert.equal(allowHookRepair(asWrite('documents/INDEX.md'), crashed)[0]?.hookSpecificOutput?.permissionDecision, 'deny');
assert.equal(allowHookRepair(asWrite('.claude/skills/trace/SKILL.md'), crashed)[0]?.hookSpecificOutput?.permissionDecision, 'deny');

/* adapter나 lib import 전 오류는 bootstrap이 같은 범위만 열어야 한다. */
const adapterError = new SyntaxError('adapter parse failed');
assert.deepEqual(bootstrapTargets(asWrite('.codex/hooks/file-chain.mjs')), [join(REPO, '.codex', 'hooks', 'file-chain.mjs')]);
assert.equal(crashOutput(asWrite('.codex/hooks/file-chain.mjs'), 'file-chain.mjs', adapterError)?.hookSpecificOutput?.permissionDecision, undefined);
assert.equal(crashOutput(asWrite('documents/INDEX.md'), 'file-chain.mjs', adapterError)?.hookSpecificOutput?.permissionDecision, 'deny');

/* 구문이 깨진 훅을 **그 자리에서** 잡는다. 깨진 파일을 실제로 만들어야 의미가 있으므로
   `finally` 로 반드시 지운다 — 시험이 저장소에 쓰레기를 남기면 다음 사람이 그것을 의심한다. */
const probe = join(REPO, '.claude', 'hooks', '_syntax-probe.mjs');
writeFileSync(probe, 'const x = `닫히지 않은 템플릿;\n', 'utf8');
try {
  const broken = await runHookChain(
    { hook_event_name: 'PostToolUse', tool_input: { file_path: probe } },
    ['hook-syntax.mjs'],
  );
  assert.match(String(broken[0]?.systemMessage ?? ''), /구문이 깨졌다|구문 검사를 실행하지 못했다/);
} finally {
  rmSync(probe, { force: true });
}

const healthy = await runHookChain(
  { hook_event_name: 'PostToolUse', tool_input: { file_path: join(REPO, '.claude', 'hooks', 'lib.mjs') } },
  ['hook-syntax.mjs'],
);
if (healthy.length) {
  assert.match(String(healthy[0]?.systemMessage ?? ''), /구문 검사를 실행하지 못했다/);
  assert.doesNotMatch(String(healthy[0]?.systemMessage ?? ''), /구문이 깨졌다/);
} else {
  assert.deepEqual(healthy, []);
}

/* 정책 차단(`crashed` 없음)은 훅 파일이라도 절대 열리지 않는다. */
const policy = [{ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'x' } }];
assert.equal(allowHookRepair(asWrite('.claude/hooks/guard-write.mjs'), policy)[0]?.hookSpecificOutput?.permissionDecision, 'deny');

console.log('Codex hook adapter self-test 통과');
