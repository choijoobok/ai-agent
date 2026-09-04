/**
 * 화면 소스를 고치면 그 화면의 문서 셋을 대조하라고 알린다 — CLAUDE.md §6.3 · §6.5.
 *
 * <p><b>경고다.</b> *문서를 고쳐야 하는가* 는 판단이 필요한 물음이고(§6.4 — 일치하면 고치지
 * 않는다) 차단하면 작업이 자주 막힌다. 훅이 하는 일은 <b>사슬을 계산해 주는 것</b>뿐이다:
 * 바뀐 파일 → 페이지 경로 → `documents/screen/{경로}/`.
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
import { REPO, readHookInput, targetPath, repoRelative, readText, warn, pass } from './lib.mjs';

const input = await readHookInput();
const path = repoRelative(targetPath(input));
if (!path) pass();

/* 문서 자신을 고치는 것은 드리프트가 아니라 그 반대다. 테스트는 화면 계약을 바꾸지 않는다. */
if (path.startsWith('documents/') || /\.(test|spec)\.[jt]sx?$/.test(path)) pass();

const screenUrl = urlOfFrontend(path) ?? urlOfBackend(path);
if (!screenUrl) pass();

if (alreadyToldThisSession(input?.session_id, screenUrl)) pass();

const docDir = `documents/screen${screenUrl}`;
const missing = ['requirements.md', 'mockup.html', 'manual.md'].filter(
  (name) => !existsSync(join(REPO, docDir, name)),
);

if (missing.length === 3) {
  warn(
    [
      `${path} 를 고쳤다 — 이 화면(${screenUrl})의 문서 셋이 **없다**.`,
      `만들 곳: ${docDir}/  (템플릿: documents/screen/_TEMPLATE/ · 스킬: /menu-doc)`,
      '메뉴 화면 착수 전에는 requirements.md 가 있어야 하고 사용자 검토를 받는다 — CLAUDE.md §6.3.',
    ].join('\n'),
  );
}

if (missing.length > 0) {
  warn(
    [
      `${path} 를 고쳤다 — 이 화면(${screenUrl})의 문서 셋이 **덜 찼다**.`,
      `없는 것: ${missing.join(' · ')}  (있는 곳: ${docDir}/)`,
      '셋 중 하나만 있는 상태로 커밋하지 않는다 — CLAUDE.md §6.3(④).',
    ].join('\n'),
  );
}

warn(
  [
    `${path} 를 고쳤다 — 이 화면(${screenUrl})의 문서 셋을 **지금 대조한다**(CLAUDE.md §6.4).`,
    `대상: ${docDir}/{requirements.md, mockup.html, manual.md}`,
    '볼 것: 컬럼 · 버튼 · API · 조회조건 · 검증 · 문구. **일치하면 고치지 않는다.**',
    '고쳤으면 소스와 문서를 **같은 커밋**에 담는다 — 나누면 그 사이의 커밋이 거짓말을 한다.',
  ].join('\n'),
);

// ── 사슬 (CLAUDE.md §5.5) ─────────────────────────────────────────

/**
 * `screenRegistry.ts` 가 소유한 것 — <b>페이지 경로 ↔ 기능 폴더</b>.
 *
 * <p>이 맵이 역인덱스의 원본이다. 정적 맵이라 파싱할 수 있고(동적 `import` 였다면 못 한다),
 * 그것이 §6.5 의 사슬이 <i>기계가 계산할 수 있는</i> 이유다.
 */
function registry() {
  const source = readText(join(REPO, 'sources/frontend/src/shared/routes/screenRegistry.ts'));
  const pairs = [];
  const pattern = /'(\/[^']*)':[\s\S]{0,200}?await import\('@\/features\/(.+?)\/pages\//g;
  for (const match of source.matchAll(pattern)) {
    pairs.push({ url: match[1], feature: match[2] });
  }
  return pairs;
}

/** `frontend/src/features/{기능}/…` → 페이지 경로. 가장 긴 기능 폴더가 이긴다(`sample/…`). */
function urlOfFrontend(changed) {
  const prefix = 'sources/frontend/src/features/';
  if (!changed.startsWith(prefix)) return null;
  const tail = changed.slice(prefix.length);
  let best = null;
  for (const { url, feature } of registry()) {
    if (tail.startsWith(`${feature}/`) && (!best || feature.length > best.feature.length)) {
      best = { url, feature };
    }
  }
  return best?.url ?? null;
}

/**
 * 컨트롤러 → 페이지 경로 — <b>`endpoints.ts` 를 거쳐 간다</b>(§6.4 의 둘째 줄).
 *
 * <p>패키지 이름으로 기능 폴더를 맞히지 않는다. 둘은 닮았을 뿐 규칙이 아니며
 * (`accesslog` ↔ `api/log`), 맞히기 시작하면 <b>틀린 화면의 문서를 가리키는 훅</b>이 된다.
 * 대신 컨트롤러가 선언한 경로를 <b>실제로 부르는 선언</b>을 찾는다 — 그 선언이 인가 시드의
 * 입력이기도 하다(CLAUDE.md §4-6).
 */
function urlOfBackend(changed) {
  if (!changed.startsWith('sources/backend/') || !changed.endsWith('Controller.java')) return null;

  const base = readText(join(REPO, changed)).match(/@RequestMapping\("([^"]+)"\)/)?.[1];
  if (!base) return null;
  const declared = `${base.replace(/^\/api/, '')}/`;

  for (const { url, feature } of registry()) {
    const endpoints = join(REPO, 'sources/frontend/src/features', feature, 'api/endpoints.ts');
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
