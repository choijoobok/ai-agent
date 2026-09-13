/**
 * 생성물을 손으로 고치는 것을 막는다 — AGENTS.md §5-8 · §5-11.
 *
 * <p><b>차단이다.</b> 손편집이 성공하면 그 파일은 다음 `generateXxxSeed` 에서 되돌아가고,
 * 그 사이에 `checkSeeds` 가 초록이었다면 <b>고친 사람은 고쳐졌다고 믿는다</b> — 되돌리기
 * 어려운 종류의 조용한 실패다.
 *
 * <p>목록의 원본은 `sources/backend/bootstrap/build.gradle.kts` 의 생성 태스크들이다. 태스크가
 * 파일을 더하면 여기도 더한다 — 훅이 목록을 스스로 계산하지 않는 것은, 그러려면 Gradle
 * 스크립트를 파싱해야 하고 <b>틀리게 파싱한 훅은 아무것도 안 막는 훅</b>이기 때문이다.
 */

import { readHookInput, targetPath, repoRelative, deny, pass } from './lib.mjs';

const DATA = 'sources/backend/bootstrap/src/main/resources/db/changelog/data';
const SAMPLE = 'sources/backend/bootstrap/src/main/resources/db/changelog/sample';

/** 생성물 → 무엇을 돌려야 다시 만들어지나. */
const GENERATED = new Map([
  [`${DATA}/003-init-menu.csv`, './gradlew generateMenuSeed'],
  [`${DATA}/006-init-api.csv`, './gradlew generateApiSeed'],
  [`${DATA}/007-init-menu-api.csv`, './gradlew generateApiSeed'],
  [`${DATA}/008-init-message-key.csv`, './gradlew generateMessageSeed'],
  [`${SAMPLE}/902-sample-bulk-order.csv`, './gradlew generateSampleBulkSeed'],
  [`${SAMPLE}/902-sample-bulk-item.csv`, './gradlew generateSampleBulkSeed'],
  [`${SAMPLE}/904-sample-bulk-item-dense.csv`, './gradlew generateSampleBulkSeed'],
  ['developer-guide/07-harness.md', 'node .claude/hooks/harness-doc.mjs --write'],
  ['aidd-guide/standard/registry.md', 'node .claude/hooks/commons-doc.mjs --write'],
]);

/** 무엇을 고쳐야 그 생성물이 바뀌나 — 막기만 하면 사람이 다음에 갈 곳을 모른다. */
const SOURCE_OF = new Map([
  ['003-init-menu.csv', 'sources/backend/bootstrap/src/main/resources/menu/menu-tree.yaml'],
  ['006-init-api.csv', '컨트롤러의 @RequestMapping · sources/frontend/src/features/{도메인}/api/endpoints.ts'],
  ['007-init-menu-api.csv', '〃 (메뉴 ↔ API 매핑은 경로에서 계산된다)'],
  [
    '008-init-message-key.csv',
    'sources/frontend/src/shared/i18n/messageKeys.ts · sources/backend/core/.../message/MsgKey.java',
  ],
  ['07-harness.md', '.claude/hooks/ · .claude/skills/ · .claude/settings.json 의 실물'],
  [
    'registry.md',
    'sources/frontend/src/shared/ · sources/backend/core/ · support/ 의 폴더와, 가이드 문서의 `sources:` 메타',
  ],
  ['902-sample-bulk-order.csv', 'generateSampleBulkSeed 의 파라미터'],
  ['902-sample-bulk-item.csv', '〃'],
  ['904-sample-bulk-item-dense.csv', '〃'],
]);

const input = await readHookInput();
const path = repoRelative(targetPath(input));
if (!path) pass();

const skill = path.match(/^\.(?:claude|agents)\/skills\/([^/]+)\/SKILL\.md$/)?.[1];
const task = skill
  ? 'node aidd-guide/harness/runtime/sync-skills.mjs --write'
  : GENERATED.get(path);
if (!task) pass();

const name = path.slice(path.lastIndexOf('/') + 1);
const source = skill
  ? `aidd-guide/harness/skill-src/${skill}.md`
  : SOURCE_OF.get(name) ?? '생성 태스크의 입력';

/* 시드에만 해당하는 말을 모든 생성물에 붙이지 않는다 — 마크다운 문서에 대고
   *CSV 를 커밋하라* · *changeset 이 checksum 으로 죽는다* 를 말하면 읽는 사람이
   무엇을 해야 하는지 흐려지고, 훅이 자기가 무엇을 막는지 모른다는 표시가 된다. */
const isSeed = path.endsWith('.csv');
deny(
  [
    `${path} 는 생성물이다 — 손으로 고치지 않는다(AGENTS.md §5-8 · §5-11).`,
    `고칠 곳: ${source}`,
    `고친 뒤: \`${task}\` 를 돌리고 산출물을 같은 커밋에 담는다(AGENTS.md §9).`,
    ...(isSeed
      ? ['이미 적재된 changeset 은 고치지 않는다 — 고치면 남의 로컬이 checksum 으로 죽는다.']
      : []),
  ].join('\n'),
);
