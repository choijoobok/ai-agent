/**
 * 메뉴 트리 — <b>실제 데이터</b>에서 읽는다.
 *
 * <p>`003-init-menu.csv`(생성물 · 원본은 `menu-tree.yaml`)의 부모·자식·URL 과 메시지 시드의
 * `menu.*` 한글 이름. <b>트리를 지어내지 않는 것</b>이 이 파일의 유일한 일이며, 그래서
 * 트리가 바뀌면 다시 돌리는 것만으로 산출물이 따라온다(CLAUDE.md §6.2).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 저장소 뿌리 — 이 파일에서 올라가 찾는다. 작업 디렉터리를 믿지 않는다. */
export const REPO = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, 'CLAUDE.md'))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
})();

export const DOCS = 'documents/generated/menu';
const DATA_DIR = 'sources/backend/bootstrap/src/main/resources/db/changelog/data';
const MENU_CSV = `${DATA_DIR}/003-init-menu.csv`;

export function read(relativePath) {
  try {
    return readFileSync(join(REPO, relativePath), 'utf8');
  } catch {
    return '';
  }
}

/** CSV 한 줄 — 따옴표 안의 쉼표를 값으로 본다. 메시지 값에 쉼표가 흔하다. */
export function csvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      cells.push(cell);
      cell = '';
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}

/** `menu.USER_MGMT` → `사용자 관리`. 값 시드의 한국어 행에서 모은다. */
function menuNames() {
  const names = new Map();
  let files = [];
  try {
    files = readdirSync(join(REPO, DATA_DIR)).filter((f) => f.endsWith('-init-message.csv'));
  } catch {
    return names;
  }
  for (const file of files) {
    /*
      <b>줄끝의 `\r` 을 떼고 나눈다.</b> `.gitattributes` 는 <b>저장소만</b> 지키므로
      체크아웃이 CRLF 인 자리에서는 마지막 칸에 그것이 붙고, 그대로 메뉴 이름이 되어
      <b>생성물의 `<title>` 과 트리에 실린다</b> — 실제로 커밋된 적이 있다(2026-09-03).
      <b>생성기의 출력이 사람의 체크아웃에 따라 달라지면 안 된다.</b>
    */
    for (const line of read(`${DATA_DIR}/${file}`).split(/\r?\n/)) {
      if (!line.startsWith('menu.')) continue;
      const [key, lang, value] = csvLine(line);
      if (lang === 'ko' && value) names.set(key, value);
    }
  }
  return names;
}

/**
 * 트리 — 뿌리들의 배열. 각 노드는 `{code, name, url, parent, children, depth, path}`.
 *
 * <p>`url` 이 있으면 화면이고 없으면 구조 노드다. CSV 의 줄 순서가 곧 형제 순서다
 * (생성기가 `menu-tree.yaml` 의 순서를 지킨다).
 */
export function menuTree() {
  const names = menuNames();
  const nodes = read(MENU_CSV)
    .split('\n')
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const [code, parent, nameKey, url] = csvLine(line.trim());
      return {
        code,
        parent: parent === 'NULL' ? null : parent,
        name: names.get(nameKey) ?? code,
        url: url === 'NULL' || !url ? null : url,
        children: [],
        depth: 0,
        path: [],
      };
    });

  const byCode = new Map(nodes.map((node) => [node.code, node]));
  const roots = [];
  for (const node of nodes) {
    const parent = node.parent ? byCode.get(node.parent) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  /* 조상 경로를 심는다 — 메뉴얼의 *메뉴 위치* 와 분할 단위가 둘 다 이것을 읽는다. */
  const stamp = (node, ancestors) => {
    node.depth = ancestors.length;
    node.path = [...ancestors, node.name];
    for (const child of node.children) stamp(child, node.path);
  };
  for (const root of roots) stamp(root, []);

  return { roots, nodes, byCode };
}

/** 화면만 — `url` 이 있는 노드. 트리 순서를 유지한다. */
export function screensOf(roots) {
  const out = [];
  const walk = (list) => {
    for (const node of list) {
      if (node.url) out.push(node);
      walk(node.children);
    }
  };
  walk(roots);
  return out;
}

/**
 * 분할 단위 — 산출물 파일을 무엇으로 가르나.
 *
 * <table>
 *   <tr><td>{@code all}</td><td>한 파일에 전부</td></tr>
 *   <tr><td>{@code module}</td><td><b>모듈</b> — 최상위 메뉴(시스템 · 샘플 · 대시보드)</td></tr>
 *   <tr><td>{@code menu}</td><td><b>모듈 바로 아래</b> — 사용자 · 메뉴 관리 · 이력·로그 …</td></tr>
 * </table>
 *
 * <p>화면이 그 단위보다 위에 붙어 있으면(대시보드처럼 최상위가 곧 화면) <b>자기 자신이 한
 * 묶음</b>이다 — 묶이지 못한 화면이 산출물에서 빠지는 것이 가장 나쁘다.
 */
export function groupScreens(roots, split) {
  if (split === 'all') {
    return [{ key: 'all', title: '전체', screens: screensOf(roots) }];
  }
  const groups = [];
  const wanted = split === 'module' ? 0 : 1;

  const collect = (node, holder) => {
    let target = holder;
    if (!target && node.depth === wanted) {
      target = { key: node.code, title: node.path.join(' › '), screens: [] };
      groups.push(target);
    }
    if (node.url && target) target.screens.push(node);
    if (node.url && !target) {
      /* 원하는 깊이보다 얕은 화면 — 자기 자신이 묶음이다. */
      groups.push({ key: node.code, title: node.path.join(' › '), screens: [node] });
    }
    for (const child of node.children) collect(child, target);
  };
  for (const root of roots) collect(root, null);

  return groups.filter((group) => group.screens.length > 0);
}

/** 파일 이름 — 페이지 경로를 한 폴더에 담을 수 있게 편다(`/log/access` → `log-access`). */
export function flatName(url) {
  return url.replace(/^\//, '').replace(/\//g, '-') || 'index';
}
