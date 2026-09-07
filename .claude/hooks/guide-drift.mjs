/**
 * 공통물·표준 소스를 고치면 <b>그것을 설명하는 가이드 문서</b>를 대조하라고 알린다.
 *
 * <p><b>`doc-drift` 와 축이 다르다.</b> 저 훅은 화면 소스 → `documents/screen/{경로}/` 이고,
 * `features/**` 와 컨트롤러만 매핑한다 — <b>`shared/` 는 매핑 자체가 없다</b>. 그래서 공통
 * 컴포넌트를 고쳐도 아무도 `aidd-guide/` 를 가리키지 않았고, 2026-09-06 에 표준 넷은
 * 고쳐지고 <b>레시피 다섯이 낡은 통로를 계속 가르쳤다</b>.
 *
 * <h2>역인덱스는 이미 있는 메타에서 나온다</h2>
 *
 * <p>가이드 문서의 메타블록에 `sources:` 가 있다. 새로 만들 것이 없고, 그 값이 낡으면
 * `lint.mjs` 가 잡는다(실물과 맞지 않는 엔트리는 위반이다).
 *
 * <p><b>축약 경로를 허용한다.</b> `sources/backend/api/error/` 의 실물은
 * `.../api/src/main/java/com/aiagent/api/error/` 다 — 사람이 적는 값이라 모듈 안쪽의 관례
 * 경로를 접는다. 그래서 <b>세그먼트가 순서대로 나타나면</b> 맞는 것으로 본다.
 *
 * <p><b>세그먼트 셋 미만은 역인덱스에 넣지 않는다.</b> `sources/backend/` 하나로 백엔드
 * 전체를 주장하는 문서가 있고, 그것까지 태우면 백엔드를 건드릴 때마다 같은 이름이 떠
 * <b>경고가 배경음</b>이 된다.
 *
 * <p><b>경고다.</b> 문서를 고쳐야 하는가는 판단이며(일치하면 고치지 않는다) 차단하면
 * 작업이 자주 막힌다. 훅이 하는 일은 <b>사슬을 계산해 주는 것</b>뿐이다.
 */

import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readHookInput, targetPath, repoRelative, guidesForSource, warn, pass } from './lib.mjs';

const input = await readHookInput();
const path = repoRelative(targetPath(input));
if (!path) pass();

/* 가이드 자신을 고치는 것은 드리프트가 아니라 그 반대다. 테스트는 계약을 바꾸지 않는다. */
if (!path.startsWith('sources/')) pass();
if (/[/\\]src[/\\]test[/\\]|\.(test|spec)\.[jt]sx?$/.test(path)) pass();

const docs = guidesForSource(path);
if (docs.length === 0) pass();

const fresh = docs.filter((doc) => !alreadyToldThisSession(input?.session_id, doc));
if (fresh.length === 0) pass();

warn(
  [
    `${path} 를 고쳤다 — 이 소스를 설명하는 가이드 문서가 있다.`,
    ...fresh.map((doc) => `  · ${doc}`),
    '',
    '선언 이름 · 기본값 · 규칙이 달라졌으면 함께 고친다. **일치하면 고치지 않는다.**',
    '이름을 바꾼 것이라면 옛 이름에 `@deprecated {@link 새이름}` 을 달아 둔다 —',
    'lint.mjs 가 그것을 아직 가르치는 문서를 전부 열거한다(standard/frontend/packages.md §3).',
  ].join('\n'),
);

// ── 같은 말을 두 번 하지 않는다 ────────────────────────────────────

/**
 * 문서 하나당 세션에 한 번. 공통물 하나를 고치는 동안 파일은 열 번 바뀌고, 매번 같은
 * 이름을 대면 <b>읽히지 않는 경고</b>가 된다 — 그것은 없는 것보다 나쁘다(다른 경고까지
 * 함께 묻힌다). `doc-drift` 와 같은 방법이며 저장소를 더럽히지 않는다.
 */
function alreadyToldThisSession(sessionId, doc) {
  if (!sessionId) return false;
  const dir = join(tmpdir(), 'ai-agent-guide-drift');
  const file = join(dir, `${String(sessionId).replace(/[^\w-]/g, '_')}.txt`);
  try {
    const seen = existsSync(file) ? readFileSync(file, 'utf8').split('\n') : [];
    if (seen.includes(doc)) return true;
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, [...seen, doc].join('\n'), 'utf8');
    return false;
  } catch {
    return false;
  }
}
