import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * 부여 상태의 색을 <b>공통물 밖에서 선언한 파일이 있는가</b>.
 *
 * <p><b>등재만으로는 갈림을 막지 못한다.</b> `shared/authz` 가 공통물 목록에 있었는데도
 * 2026-09-07 까지 공통물은 `SCHEDULED` 를 주의색으로, 화면 둘은 무색으로 칠하고 있었다 —
 * <b>6차 화면 재현 회귀가 사람 눈으로</b> 찾았고 아무 검사도 울지 않았다. 색을 맞추고
 * 정본을 하나로 모은 것으로도 부족하다: <b>다음 화면이 색을 손으로 적으면 그 순간 다시
 * 갈린다.</b>
 *
 * <p><b>"없다" 를 검사하는 것이 곧 그 케이스를 잠그는 것이다</b>(quality/test-design.md §2).
 * 값이 맞는지는 단위 테스트가 보고(`grantState.test.ts`), <b>아무도 제 맵을 다시 만들지
 * 않는가</b>는 소스 전체를 봐야 알므로 여기가 본다.
 *
 * <pre>
 *   npm run lint      # eslint 뒤에 이어서 돈다
 *   node scripts/check-grant-tone.mjs
 * </pre>
 *
 * <p><b>공지의 `SCHEDULED` 는 뺀다.</b> 그것은 <b>게시 상태</b>이지 부여 상태가 아니다 —
 * 이름만 같고 요건서가 주의색으로 못박았다(screen/admin/system/notice/requirements.md).
 */

const SRC = new URL('../src/', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');

/** 정본 하나. 이 목록이 늘어나는 것은 곧 갈림이므로, 늘리려면 왜인지 함께 적는다. */
const OWNERS = ['shared/authz/grantState.ts'];

/** 이름만 같고 다른 개념 — 위 머리말. */
const OTHER_MEANING = ['features/notice/', 'modules/system/features/notice/'];

const DECLARES = /\bSCHEDULED:\s*'(none|ok|warn|err|muted)'/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

const found = walk(SRC)
  .filter((path) => DECLARES.test(readFileSync(path, 'utf8')))
  .map((path) => relative(SRC, path).split(sep).join('/'))
  .filter((path) => !OTHER_MEANING.some((prefix) => path.startsWith(prefix)));

const strays = found.filter((path) => !OWNERS.includes(path));
const missing = OWNERS.filter((owner) => !found.includes(owner));

// 정본이 사라진 것도 실패다 — 검사가 아무것도 보지 못한 채 통과하면 그것은 검사가 아니다.
if (strays.length > 0 || missing.length > 0) {
  process.stdout.write(`부여 상태 색 위반: ${strays.length + missing.length} 건\n`);
  for (const path of strays) {
    process.stdout.write(`  - ${path} — 공통물 밖에서 색을 선언한다. \`GRANT_TONE\` 을 쓴다\n`);
  }
  for (const path of missing) {
    process.stdout.write(`  - ${path} — 정본이 여기 없다. 옮겼으면 이 스크립트의 OWNERS 도 옮긴다\n`);
  }
  process.exit(1);
}
process.stdout.write('부여 상태 — 색을 선언하는 곳은 공통물 하나다\n');
