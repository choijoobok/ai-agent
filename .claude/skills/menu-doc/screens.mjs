/**
 * 화면 목록과 문서 현황 — `/menu-doc` 의 첫 걸음.
 *
 * <p>세 원본을 한 표로 겹친다: `screenRegistry.ts`(페이지 경로 ↔ 기능 폴더) ·
 * `menu-tree.yaml`(메뉴코드 ↔ url) · `documents/screen/`(정본 둘). <b>목록을 만들지 않고
 * 겹치기만 한다</b> — 목록의 주인은 소스이고, 이 스크립트가 화면을 발명하면 그 순간
 * 문서가 운영 데이터를 앞지른다(CLAUDE.md §6.1).
 *
 * <p>의존성이 없다. `node .claude/skills/menu-doc/screens.mjs` 로 돈다.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'CLAUDE.md'))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
})();

const read = (rel) => {
  try {
    return readFileSync(join(REPO, rel), 'utf8');
  } catch {
    return '';
  }
};

// ── 원본 셋 ────────────────────────────────────────────────────────

/** 페이지 경로 → 기능 폴더. 정적 맵이라 파싱할 수 있다. */
const screens = [
  ...read('sources/frontend/src/shared/routes/screenRegistry.ts').matchAll(
    /'(\/[^']*)':[\s\S]{0,200}?await import\('@\/features\/(.+?)\/pages\//g,
  ),
].map((m) => ({ url: m[1], feature: m[2] }));

/** 메뉴코드 → url. `url` 이 있는 줄만 화면이다(없으면 구조 노드다). */
const menuByUrl = new Map();
{
  const yaml = read('sources/backend/bootstrap/src/main/resources/menu/menu-tree.yaml');
  let code = null;
  for (const line of yaml.split('\n')) {
    const codeMatch = line.match(/^\s*-\s*code:\s*(\S+)/);
    if (codeMatch) code = codeMatch[1];
    const urlMatch = line.match(/^\s*url:\s*(\S+)/);
    if (urlMatch && code) menuByUrl.set(urlMatch[1], code);
  }
}

const DOCS = 'documents/screen';
// 정본 둘만 센다 — mockup.html 은 파생물이라 없는 것이 정상이다(CLAUDE.md §4-5).
const SET = ['requirements.md', 'manual.md'];

/** `documents/screen/` 아래의 실제 문서 폴더 — `_` 로 시작하는 것은 문서 대상이 아니다(§6.1). */
function docFolders(base = DOCS) {
  const found = [];
  let entries = [];
  try {
    entries = readdirSync(join(REPO, base), { withFileTypes: true });
  } catch {
    return found;
  }
  const hasSet = SET.some((name) => existsSync(join(REPO, base, name)));
  if (base !== DOCS && hasSet) found.push(base.slice(DOCS.length));
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('_')) {
      found.push(...docFolders(`${base}/${entry.name}`));
    }
  }
  return found;
}

// ── 표 ─────────────────────────────────────────────────────────────

const rows = screens
  .map(({ url, feature }) => {
    const have = SET.filter((name) => existsSync(join(REPO, DOCS + url, name)));
    return {
      url,
      code: menuByUrl.get(url) ?? '(menu-tree 없음)',
      feature,
      have,
      state: have.length === SET.length ? '완' : have.length === 0 ? '없음' : `부분(${have.length}/${SET.length})`,
    };
  })
  .sort((a, b) => a.url.localeCompare(b.url));

const pad = (text, width) => {
  const w = [...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2000 ? 2 : 1), 0);
  return text + ' '.repeat(Math.max(0, width - w));
};

console.log(`화면 ${rows.length} · 문서 완 ${rows.filter((r) => r.state === '완').length}\n`);
console.log(
  `${pad('페이지 경로', 24)}${pad('메뉴코드', 22)}${pad('기능 폴더', 24)}${pad('문서', 12)}빠진 것`,
);
console.log('-'.repeat(100));
for (const row of rows) {
  const missing = SET.filter((name) => !row.have.includes(name));
  console.log(
    pad(row.url, 24) +
      pad(row.code, 22) +
      pad(row.feature, 24) +
      pad(row.state, 12) +
      (missing.length === 3 ? '전부' : missing.join(' · ')),
  );
}

/*
  <b>고아 폴더</b> — 문서는 있는데 화면이 없다. 경로를 바꾸면서 폴더를 같은 커밋에서 옮기지
  않은 것이며(§6.1), `git mv` 대상이다. 지우는 것이 답인 경우도 있으므로 <b>여기서 판단하지
  않고 이름만 낸다</b>.
*/
const orphans = docFolders().filter((path) => !screens.some((s) => s.url === path));
if (orphans.length > 0) {
  console.log(`\n고아 폴더 ${orphans.length} — screenRegistry 에 없는 문서 폴더 (§6.1):`);
  for (const path of orphans) console.log(`  ${DOCS}${path}`);
}
