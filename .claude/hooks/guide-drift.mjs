/**
 * `sources:` 에 이 파일을 적은 <b>가이드 문서</b>를 대조하라고 알린다 — 소스든 문서든.
 *
 * <p><b>`doc-drift` 와 축이 다르다.</b> 저 훅은 화면 소스 → `documents/screen/{경로}/` 이고,
 * `features/**` 와 컨트롤러만 매핑한다 — <b>`shared/` 는 매핑 자체가 없다</b>. 그래서 공통
 * 컴포넌트를 고쳐도 아무도 `aidd-guide/` 를 가리키지 않았고, 2026-09-06 에 표준 넷은
 * 고쳐지고 <b>레시피 다섯이 낡은 통로를 계속 가르쳤다</b>.
 *
 * <h2>`sources/` 밖도 본다 — 판단을 뒤집은 것이다</h2>
 *
 * <p>여기에 <i>가이드 자신을 고치는 것은 드리프트가 아니라 그 반대다</i> 라는 줄이 있었고,
 * `sources/` 로 시작하지 않는 경로에서 즉시 통과했다. <b>엔트리가 소스 경로뿐일 때는
 * 맞는 판단이었다.</b>
 *
 * <p>그런데 역인덱스에는 다른 것들도 있다 — 가이드가 가이드를(`logging.md` 가
 * `packages.md` 를), 문서가 설정을(`safety/pii.md` 가 `log-mask.patterns` 를), 문서가
 * 헌법을(`conventions.md` 가 `CLAUDE.md` 를) 근거로 적은 값들이다. <b>그쪽은 반대 방향이
 * 쓸모 있는 방향이다</b>: 근거가 바뀌면 그것을 근거로 규약을 적은 문서가 낡는다.
 *
 * <p>그 값들이 <b>아무것도 하지 않은 채 서른한 개</b> 있었다. 지우는 것도 답이었지만,
 * 값이 사실이므로 <b>읽는 쪽을 고쳤다.</b>
 *
 * <p><b>자기 자신은 뺀다.</b> `lint.mjs` 가 자기 참조를 막으므로 남아 있지 않아야 하지만,
 * 검사보다 훅이 먼저 도는 순간이 있다 — 그때 <i>이 문서를 고쳤으니 이 문서를 보라</i> 고
 * 말하면 훅 전체가 우스워진다.
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

/* 테스트는 계약을 바꾸지 않는다. */
if (/[/\\]src[/\\]test[/\\]|\.(test|spec)\.[jt]sx?$/.test(path)) pass();

/* 자기 자신은 뺀다 — 위 주석. */
const docs = guidesForSource(path).filter((doc) => doc !== path);
if (docs.length === 0) pass();

const fresh = docs.filter((doc) => !alreadyToldThisSession(input?.session_id, doc));
if (fresh.length === 0) pass();

const isSource = path.startsWith('sources/');
warn(
  [
    isSource
      ? `${path} 를 고쳤다 — 이 소스를 설명하는 가이드 문서가 있다.`
      : `${path} 를 고쳤다 — 이것을 \`sources:\` 에 적은 가이드 문서가 있다.`,
    ...fresh.map((doc) => `  · ${doc}`),
    '',
    ...(isSource
      ? [
          '선언 이름 · 기본값 · 규칙이 달라졌으면 함께 고친다. **일치하면 고치지 않는다.**',
          '이름을 바꾼 것이라면 옛 이름에 `@deprecated {@link 새이름}` 을 달아 둔다 —',
          'lint.mjs 가 그것을 아직 가르치는 문서를 전부 열거한다(standard/frontend/packages.md §3).',
        ]
      : [
          '그 문서들이 **이것을 근거로 규약을 적었다.** 근거가 달라졌으면 함께 고친다 —',
          '특히 **그 문서가 인용한 이름·기본값·절**이 아직 여기 있는지 본다.',
          '**일치하면 고치지 않는다.**',
        ]),
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
