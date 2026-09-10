/**
 * 공통 스킬 원본이 바뀌면 두 AI 의 `SKILL.md` 를 다시 만든다 — AGENTS.md §11.
 *
 * <p><b>왜 즉시인가.</b> `.claude/skills/{name}/SKILL.md` 와 `.agents/skills/{name}/SKILL.md`
 * 는 생성물이고 `guard-generated` 가 손편집을 막는다. 그러면 원본
 * (`aidd-guide/harness/skill-src/{name}.md`)을 고친 사람은 <b>고쳤다고 믿는데, AI 가 실제로
 * 부르는 것은 여전히 옛 파일</b>이다 — 다음 세션의 `harness-check` 가 알려 주지만
 * <b>이번 세션 안에서는 고친 스킬을 쓸 수 없다.</b> 이것이 조용한 실패의 정의다.
 *
 * <p><b>왜 경고가 아니라 생성인가.</b> 답이 하나뿐이기 때문이다 — 원본이 정본이므로
 * 생성물은 원본을 따라가는 것 말고 될 것이 없다. 판단이 필요 없는 것은 묻지 않고 고친다
 * (`harness-doc` · `commons-doc` 과 같은 자리다).
 *
 * <p><b>이름이 어긋나면 만들지 않고 말한다.</b> `skill-src/{name}.md` 의 frontmatter `name`
 * 이 파일 이름과 다르면 생성기가 거절한다 — 그것은 사람이 고칠 오타이지 훅이 고를 일이
 * 아니다.
 */

import { readHookInput, repoRelative, targetPath, pass, warn } from './lib.mjs';
import { skillDiffs, writeSkills } from '../../aidd-guide/harness/runtime/sync-skills.mjs';

const input = await readHookInput();
const path = repoRelative(targetPath(input));

/* 생성기 자체가 바뀌어도 산출물이 달라진다 — 원본만 보면 그 변경을 놓친다. */
if (
  !path
  || !/^(aidd-guide\/harness\/skill-src\/|aidd-guide\/harness\/runtime\/sync-skills\.mjs$)/.test(path)
) pass();

let issues = [];
let failure = '';
try {
  issues = skillDiffs();
} catch (error) {
  failure = String(error?.message ?? error);
}

if (failure) {
  warn(
    [
      `공통 스킬을 생성할 수 없다 — ${failure}`,
      '고칠 곳: `aidd-guide/harness/skill-src/{이름}.md` 의 frontmatter `name` 은 파일 이름과 같아야 한다.',
    ].join('\n'),
  );
}

if (issues.length === 0) pass();

let result = null;
try {
  result = writeSkills();
} catch (error) {
  failure = String(error?.message ?? error);
}

if (failure) {
  warn(`공통 스킬을 쓰지 못했다 — ${failure}\n\`node aidd-guide/harness/runtime/sync-skills.mjs --write\` 를 직접 돌린다.`);
}

const stale = [...new Set(issues.map((line) => line.split(':')[1]?.trim().split(' ')[0]).filter(Boolean))];
warn(
  [
    `공통 스킬 원본이 바뀌어 **\`SKILL.md\` 를 다시 만들었다** — ${stale.join(' · ')}.`,
    'Claude(`.claude/skills/`)와 Codex(`.agents/skills/`) 양쪽이며, **소스와 같은 커밋에 담는다**(AGENTS.md §9).',
    ...(result?.failures?.length ? [`쓰지 못한 것: ${result.failures.join(', ')}`] : []),
  ].join('\n'),
);
