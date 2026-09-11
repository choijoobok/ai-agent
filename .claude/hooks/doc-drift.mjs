/**
 * 화면 소스를 고치면 그 화면의 문서를 대조하라고, 요건서가 승인 전이면 승인부터 받으라고 알린다 — AGENTS.md §6.3 · §6.5.
 *
 * <p><b>정본 둘만 본다</b> — requirements.md · manual.md. mockup.html 은 요건서의 파생물이라
 * 없는 것이 정상이고, 그것을 결손으로 세면 화면마다 경고가 떠 경고가 배경음이 된다.
 *
 * <p><b>경고다.</b> *문서를 고쳐야 하는가* 는 판단이 필요한 물음이고(§6.4 — 일치하면 고치지
 * 않는다) 차단하면 작업이 자주 막힌다. 훅이 하는 일은 <b>사슬을 계산해 주는 것</b>뿐이다:
 * 바뀐 파일 → 페이지 경로 → `documents/screen/{경로}/`.
 *
 * <h2>승인 여부도 여기서 본다 — §6.3 ③</h2>
 *
 * <p><b>승인 전에는 대조가 아니라 승인이 할 일이다.</b> 그래서 요건서 §0 의 `문서 상태` 칸이
 * 승인·구현이 아니면 대조 안내를 <b>대신한다</b> — 둘을 함께 내면 무엇이 먼저인지가 사라진다.
 *
 * <p><b>이 검사가 없던 자리는 `guard-write` ① 이 막고 있었다</b> — G3 승인 전 `sources/`
 * 차단. 그 문이 열리는 순간 ③ 을 지키는 기계가 하나도 없어진다. 그래서 <b>G3 승인 전에</b>
 * 둔다: 43개 화면이 들어온 뒤에 만들면 이미 들어온 것을 소급 판정해야 한다.
 *
 * <p><b>읽을 입력은 이미 있다</b> — 서식이 그 칸을 가졌고 메뉴 화면 23개가 전부 채워 두었다.
 * 새 칸을 만들지 않는다. 다만 <b>`_standalone/` 은 닿지 않는다</b>: `screenRegistry.ts` 에
 * 없어 페이지 경로로 매핑되지 않고, 실제로 그 여덟은 칸 자체가 비어 있다.
 *
 * <h2>한 화면당 세션에 한 번만 말한다</h2>
 *
 * <p>화면 하나를 만드는 동안 파일은 열 번 바뀐다. 매번 같은 말을 하면 <b>읽히지 않는
 * 경고</b>가 되고, 읽히지 않는 경고는 없는 것보다 나쁘다 — 다른 경고까지 같이 묻힌다.
 * 이미 말한 화면은 임시 디렉터리에 세션별로 적어 둔다(저장소를 더럽히지 않는다).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { REPO, readHookInput, targetPath, repoRelative, readText, warn, pass, skillRef } from './lib.mjs';
import { parseScreenRegistry, screenUrlOfFrontend } from './screen-registry.mjs';

const input = await readHookInput();
const path = repoRelative(targetPath(input));
if (!path) pass();

/* 문서 자신을 고치는 것은 드리프트가 아니라 그 반대다. 테스트는 화면 계약을 바꾸지 않는다. */
if (path.startsWith('documents/') || /\.(test|spec)\.[jt]sx?$/.test(path)) pass();

const screenUrl = urlOfFrontend(path) ?? urlOfBackend(path);
if (!screenUrl) pass();

if (alreadyToldThisSession(input?.session_id, screenUrl)) pass();

const docDir = `documents/screen${screenUrl}`;
/* 정본 둘만 센다. `mockup.html` 은 파생물이라 없는 것이 정상이다(AGENTS.md §4-5) —
   그것을 결손으로 세면 화면마다 경고가 떠 경고 전체가 배경음이 된다. */
const missing = ['requirements.md', 'manual.md'].filter(
  (name) => !existsSync(join(REPO, docDir, name)),
);

if (missing.length === 2) {
  warn(
    [
      `${path} 를 고쳤다 — 이 화면(${screenUrl})의 문서가 **없다**.`,
      `만들 곳: ${docDir}/  (서식: aidd-guide/artifact/template/02-requirements.md · 스킬: menu-doc)`,
      '메뉴 화면 착수 전에는 requirements.md 가 있어야 하고 사용자 검토를 받는다 — AGENTS.md §6.3.',
    ].join('\n'),
  );
} else if (missing.length > 0) {
  warn(
    [
      `${path} 를 고쳤다 — 이 화면(${screenUrl})의 문서가 **덜 찼다**.`,
      `없는 것: ${missing.join(' · ')}  (있는 곳: ${docDir}/)`,
      '요건서 없이 구현하지 않고, 구현하고서 메뉴얼을 비우지 않는다 — AGENTS.md §6.3.',
    ].join('\n'),
  );
}

/*
 * <b>승인되지 않은 요건서로 화면 소스를 쓰고 있나</b> — AGENTS.md §6.3 ③.
 *
 * <p>여기까지 왔으면 정본 둘이 다 있다(위의 두 `warn` 이 프로세스를 끝낸다). 그래서 읽는 것은
 * <b>요건서가 어느 상태인가</b> 하나다.
 *
 * <p><b>첫 낱말만 본다.</b> 서식이 `{초안 / 승인 YYYY-MM-DD / 구현됨}` 이라 <b>맨 앞 토큰이
 * 상태</b>이고 뒤는 꼬리다(`구현됨 — 소스 역작성 2026-09-03` · `구현됨(위젯 슬롯) — …`).
 *
 * <p><b>낱말을 아무 데서나 찾으면 안 된다</b> — 2026-09-07 에 실제로 새어 나갔다:
 * 부분 구현 화면의 상태를 <i>`초안 — 시간대 추가 승인 전`</i> 으로 적었더니 「승인」이라는
 * 낱말에 걸려 <b>통과했다</b>. 부정문이 긍정으로 읽히는 종류이고, 그렇게 새는 검사는
 * 있으나 없으나 같다.
 */
const docStatus = readText(join(REPO, docDir, 'requirements.md')).match(
  /^\|\s*문서 상태\s*\|([^|]*)\|/m,
)?.[1];

if (docStatus === undefined || !/^\s*(승인\s*\d{4}-\d{2}-\d{2}|구현됨)/.test(docStatus)) {
  warn(
    [
      `${path} 를 고쳤다 — 이 화면(${screenUrl})의 **요건서가 승인 상태가 아니다**(AGENTS.md §6.3 ③).`,
      docStatus === undefined
        ? `요건서에 \`문서 상태\` 칸이 없다 — 승인 여부를 셀 수 없다. 서식: aidd-guide/artifact/template/02-requirements.md §0`
        : `문서 상태: ${docStatus.trim() || '(빈 칸)'}   (${docDir}/requirements.md §0)`,
      '**승인 전에는 BE·FE·시드를 건드리지 않는다.** 요건서와 목업을 *함께* 내야 승인이 성립한다 —',
      '요건서만 승인받고 목업에서 뒤집히면 그 승인이 무효다.',
      '순서: 요건서의 **달라지는 절만** 고침 → mockup 스킬 → 사용자 승인 → 구현 → 요건서 §11 변경 이력.',
      '승인받았으면 그 칸을 `승인 YYYY-MM-DD` 로 고친다 — **그 칸이 이 검사의 유일한 입력이다.**',
      '',
      '템플릿 보수처럼 게이트의 대상이 아닌 작업이면 그대로 진행한다 — 이것은 경고이며 막지 않는다.',
    ].join('\n'),
  );
}

/*
 * 역방향 — <b>주석이 남의 화면 문서를 가리키나.</b>
 *
 * <p>`lint.mjs` 의 깨진 링크 검사는 <b>파일이 있기만 하면 통과</b>한다. 그래서 화면 문서를
 * 셋으로 나누면서 링크가 대표 화면 하나로 눌린 것을 아무도 잡지 못했다(2026-09-05 에
 * 650곳을 고쳤다). <i>어느 화면을 가리켜야 하는가</i> 는 파일 경로로 계산되므로 여기서 본다.
 *
 * <p><b>제 화면이 하나도 안 끼었을 때만 말한다.</b> 화면끼리의 상호참조는 정상이며,
 * 제 화면을 함께 가리키고 있으면 그것은 인용이지 오지목이 아니다.
 */
const cited = [
  ...new Set(
    [...readText(join(REPO, path)).matchAll(/screen\/[a-z0-9/_-]+\/requirements\.md/g)].map((m) => m[0]),
  ),
];
const own = `screen${screenUrl}/requirements.md`;
const misdirected = cited.length > 0 && !cited.includes(own);

/* `warn` 은 프로세스를 끝낸다 — 따로 부르면 아래의 대조 안내가 사라진다. 한 번에 말한다. */
warn(
  [
    `${path} 를 고쳤다 — 이 화면(${screenUrl})의 문서를 **지금 대조한다**(AGENTS.md §6.4).`,
    `대상: ${docDir}/{requirements.md, manual.md}`,
    '볼 것: 컬럼 · 버튼 · API · 조회조건 · 검증 · 문구 · 테스트 케이스. **일치하면 고치지 않는다.**',
    `요건서를 고쳤으면 ${skillRef('mockup')} 으로 목업을 다시 만든다 — 목업을 손으로 맞추지 않는다.`,
    '고쳤으면 소스와 문서를 **같은 커밋**에 담는다 — 나누면 그 사이의 커밋이 거짓말을 한다.',
    ...(misdirected
      ? [
          '',
          `**주석이 자기 화면의 요건서를 한 번도 가리키지 않는다.** 가리키는 곳: ${cited.join(' · ')}`,
          `이 파일의 것은 \`${own}\` 다. 상호참조라면 그대로 두고, 아니면 고친다.`,
        ]
      : []),
  ].join('\n'),
);

// ── 사슬 (AGENTS.md §6.5) ─────────────────────────────────────────

/**
 * `screenRegistry.ts` 가 소유한 것 — <b>페이지 경로 ↔ 기능 폴더</b>.
 *
 * <p>이 맵이 역인덱스의 원본이다. 정적 맵이라 파싱할 수 있고(동적 `import` 였다면 못 한다),
 * 그것이 §6.5 의 사슬이 <i>기계가 계산할 수 있는</i> 이유다.
 */
function registry() {
  const source = readText(join(REPO, 'sources/frontend/src/shared/routes/screenRegistry.ts'));
  return parseScreenRegistry(source);
}

/** 레지스트리가 가리킨 실제 기능 폴더 → 페이지 경로. 가장 긴 소스 폴더가 이긴다. */
function urlOfFrontend(changed) {
  return screenUrlOfFrontend(changed, registry());
}

/**
 * 컨트롤러 → 페이지 경로 — <b>`endpoints.ts` 를 거쳐 간다</b>(§6.4 의 둘째 줄).
 *
 * <p>패키지 이름으로 기능 폴더를 맞히지 않는다. 둘은 닮았을 뿐 규칙이 아니며
 * (`accesslog` ↔ `api/log`), 맞히기 시작하면 <b>틀린 화면의 문서를 가리키는 훅</b>이 된다.
 * 대신 컨트롤러가 선언한 경로를 <b>실제로 부르는 선언</b>을 찾는다 — 그 선언이 인가 시드의
 * 입력이기도 하다(AGENTS.md §8).
 */
function urlOfBackend(changed) {
  if (!changed.startsWith('sources/backend/') || !changed.endsWith('Controller.java')) return null;

  const base = readText(join(REPO, changed)).match(/@RequestMapping\("([^"]+)"\)/)?.[1];
  if (!base) return null;
  const declared = `${base.replace(/^\/api/, '')}/`;

  for (const { url, sourceDir } of registry()) {
    const endpoints = join(REPO, 'sources/frontend/src', sourceDir, 'api/endpoints.ts');
    if (existsSync(endpoints) && readText(endpoints).includes(`'${declared}`)) return url;
  }
  return null;
}

// ── 같은 말을 두 번 하지 않는다 ────────────────────────────────────

function alreadyToldThisSession(sessionId, url) {
  if (!sessionId) return false;
  const dir = join(tmpdir(), 'ai-agent-doc-drift');
  const file = join(dir, `${String(sessionId).replace(/[^\w-]/g, '')}.json`);
  let told = [];
  try {
    told = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    told = [];
  }
  if (told.includes(url)) return true;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify([...told, url]), 'utf8');
  } catch {
    /* 못 적어도 경고는 나가야 한다 — 시끄러운 것이 조용한 것보다 낫다. */
  }
  return false;
}
