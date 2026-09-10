/**
 * 방금 고친 훅이 구문부터 깨졌는지 그 자리에서 본다 — 다음 쓰기가 잠기기 전에.
 *
 * <p><b>왜 여기인가.</b> 구문이 깨진 훅은 사전 chain 을 통째로 죽여 <b>모든 쓰기를
 * 막는다</b>. CI 도 같은 것을 보지만 CI 는 커밋 뒤이고, 그 사이에 <i>깨뜨린 사람이 먼저
 * 잠긴다</i> — 고칠 때 쓰는 도구가 막힌 그것이기 때문이다
 * ([hooks-contract.md](../../aidd-guide/harness/hooks-contract.md) 의 「깨진 보호에서
 * 빠져나오는 길」). <b>깨뜨린 턴에 말하면 애초에 잠기지 않는다.</b>
 *
 * <p>실제로 이 세션에서 일괄 치환 하나가 템플릿 리터럴을 닫지 않았다. 사후 chain 의
 * 훅이라 경고만 죽었지, 같은 실수가 `guard-write.mjs` 에서 났으면 그때부터 아무것도
 * 고칠 수 없었다.
 *
 * <p><b>고쳐 주지는 않는다.</b> 구문 오류의 올바른 형태는 하나가 아니다 — 무엇이
 * 어디서 깨졌는지만 정확히 옮긴다.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, readHookInput, repoRelative, targetPath, pass, warn } from './lib.mjs';

/** 훅으로 실행되는 것들 — CI 의 `node --check` 대상과 같은 셋이다. */
const HOOK_FILE = /^(\.claude\/hooks\/|\.codex\/hooks\/|aidd-guide\/harness\/runtime\/)[^/]+\.mjs$/;

const input = await readHookInput();
const path = repoRelative(targetPath(input));
if (!path || !HOOK_FILE.test(path)) pass();

const absolute = join(REPO, path);
if (!existsSync(absolute)) pass();

let error = '';
try {
  execFileSync(process.execPath, ['--check', absolute], {
    timeout: 10_000,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
} catch (thrown) {
  error = String(thrown?.stderr || thrown?.message || '').trim();
}

if (!error) pass();

/* `node --check` 의 stderr 는 파일 경로 · 문제의 줄 · 캐럿 · 오류 이름 순이다.
   스택은 버린다 — 훅 자신의 내부 경로라 고치는 사람에게 쓸모가 없다. */
const head = error
  .split('\n')
  .filter((line) => !/^\s+at /.test(line) && line.trim())
  .slice(0, 5)
  .join('\n');

warn(
  [
    `**${path} 의 구문이 깨졌다** — 지금 고친다.`,
    head,
    '',
    '이대로 두면 **다음 쓰기부터 전부 막힌다**(사전 chain 이 이 파일을 불러오다 죽는다).',
    '막힌 뒤에는 `.claude/hooks/*.mjs` 를 고치는 쓰기 하나만 열리며, 그때는 Bash 로 고친다.',
  ].join('\n'),
);
