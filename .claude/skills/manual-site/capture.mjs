/**
 * 실제 화면 캡처 — <b>옵션</b>이다. 기본 산출물은 목업 그림으로 만들어진다.
 *
 * <pre>
 *   npm i -D playwright && npx playwright install chromium     (한 번만)
 *   node .claude/skills/manual-site/capture.mjs --id=admin --pw=... [옵션]
 *
 *     --base=http://localhost:3000   띄워 둔 화면 주소 (기본값)
 *     --only=/user,/role             이 경로만 찍는다 (기본 전부)
 *     --width=1600 --height=900      뷰포트
 *     --wait=1200                    화면이 그려질 때까지 기다리는 밀리초
 * </pre>
 *
 * <p>찍은 것은 `documents/screen/{경로}/screen.png` 로 들어간다 — <b>목업 그림이 있던 자리</b>이며,
 * 그 다음 `build.mjs` 를 돌리면 산출물이 캡처로 바뀐다(`--shots=auto` 의 기본 동작).
 *
 * <h2>왜 기본이 아닌가</h2>
 *
 * <p>이 스크립트만 <b>의존성과 전제를 갖는다</b> — playwright · 브라우저 바이너리 · 띄워 둔
 * 로컬 앱 · 로그인 계정 · 화면에 보일 만한 데이터. 폐쇄망에서 그 전제가 하나도 없을 수 있고,
 * 그때도 메뉴얼은 나와야 한다(CLAUDE.md §1). <b>그래서 캡처는 있으면 쓰고 없으면 목업이다.</b>
 *
 * <p><b>계정과 비밀번호를 소스에 적지 않는다.</b> 인자나 환경변수로만 받는다.
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DOCS, REPO, menuTree, screensOf } from './lib/menu.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const options = {
  base: flag('base', 'http://localhost:3000').replace(/\/+$/, ''),
  id: flag('id', process.env.MANUAL_CAPTURE_ID ?? ''),
  pw: flag('pw', process.env.MANUAL_CAPTURE_PW ?? ''),
  only: flag('only', '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
  width: Number(flag('width', '1600')),
  height: Number(flag('height', '900')),
  wait: Number(flag('wait', '1200')),
};

if (!options.id || !options.pw) {
  console.error('로그인 계정이 필요하다 — --id=... --pw=... 또는 MANUAL_CAPTURE_ID/PW.');
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    [
      'playwright 가 없다. 캡처는 옵션이라 기본 설치에 넣지 않았다.',
      '',
      '  npm i -D playwright',
      '  npx playwright install chromium',
      '',
      '설치가 어려운 환경이면 캡처 없이 그대로 두면 된다 — build.mjs 가 목업 그림으로 만든다.',
      '화면을 손으로 캡처해 documents/screen/{경로}/screen.png 로 넣어도 결과는 같다.',
    ].join('\n'),
  );
  process.exit(1);
}

const { roots } = menuTree();
const targets = screensOf(roots).filter(
  (screen) => options.only.length === 0 || options.only.includes(screen.url),
);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: options.width, height: options.height },
  deviceScaleFactor: 2, // 인쇄에 들어가므로 2배로 찍는다
  locale: 'ko-KR',
});
const pageTab = await context.newPage();

const done = [];
const failed = [];

try {
  await login(pageTab);
  for (const screen of targets) {
    try {
      await pageTab.goto(`${options.base}${screen.url}`, { waitUntil: 'networkidle' });
      await pageTab.waitForTimeout(options.wait);

      const target = join(REPO, DOCS + screen.url, 'screen.png');
      mkdirSync(dirname(target), { recursive: true });
      await pageTab.screenshot({ path: target });
      done.push(screen.url);
      console.log(`  찍음 ${screen.url}`);
    } catch (error) {
      failed.push({ url: screen.url, why: String(error.message ?? error).split('\n')[0] });
      console.log(`  실패 ${screen.url} — ${failed.at(-1).why}`);
    }
  }
} finally {
  await browser.close();
}

console.log(`\n캡처 ${done.length} · 실패 ${failed.length}`);
console.log('이제 사용자 사이트를 다시 만들면 대표 캡처를 쓴다 — node .claude/skills/manual-site/build.mjs');
if (failed.length > 0) {
  console.log('\n실패한 화면은 screen.png 가 없으므로 목업 그림 그대로 나간다.');
}

/**
 * 로그인 — AntD `Form.Item` 의 `name` 이 곧 입력의 `id` 다(`loginId` · `password`).
 *
 * <p>선택자가 <b>깨질 수 있는 자리</b>이며, 깨지면 여기서 멈춘다. 캡처가 통째로 실패하는
 * 것이 <b>로그인 화면 23장을 찍는 것보다 낫다</b> — 뒤엣것은 산출물에 조용히 섞인다.
 */
async function login(tab) {
  await tab.goto(`${options.base}/`, { waitUntil: 'networkidle' });
  const idBox = tab.locator('#loginId');
  if ((await idBox.count()) === 0) {
    throw new Error('로그인 입력(#loginId)을 찾지 못했다 — 앱이 떠 있는지, 선택자가 바뀌었는지 본다.');
  }
  await idBox.fill(options.id);
  await tab.locator('#password').fill(options.pw);
  await tab.locator('button[type=submit]').click();
  await tab.waitForTimeout(options.wait);

  if ((await tab.locator('#loginId').count()) > 0) {
    throw new Error('로그인 뒤에도 로그인 화면이다 — 계정·비밀번호를 확인한다.');
  }
}
