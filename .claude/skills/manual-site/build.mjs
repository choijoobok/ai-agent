/**
 * 사용자 메뉴얼 산출물 생성기 — `manual.md` 하나에서 <b>저장소 파생물</b>과
 * <b>고객사 제출 폴더</b>를 만든다.
 *
 * <pre>
 *   node .claude/skills/manual-site/build.mjs [옵션]
 *
 *     --split=module|menu|all   PDF·PPT 를 무엇으로 가르나 (기본 module)
 *     --shots=auto|mockup|png|none  화면 그림의 출처 (기본 auto)
 *     --pptx                    슬라이드(.pptx) 도 만든다
 *     --out=<경로>              제출 폴더 (기본 build/manual)
 *     --no-dist                 제출 폴더를 만들지 않는다(저장소 파생물만)
 * </pre>
 *
 * <h2>둘을 만드는 이유</h2>
 *
 * <p>`documents/screen/{경로}/manual.html` 은 <b>화면 문서의 파생물</b>이다(CLAUDE.md §6.1) — 우리가
 * 소스 옆에서 본다. `build/manual/` 은 <b>제출본</b>이다 — 폴더 하나를 통째로 복사해 고객사에
 * 준다. 같은 원본에서 나오므로 둘이 갈릴 수 없다.
 *
 * <h2>화면 그림은 절마다 놓인다</h2>
 *
 * <p>탭이 다섯인 화면은 <b>탭마다 모습이 다르다</b>. 메뉴얼이 `[설명](mockup.html#키)` 로 자리를
 * 정하고 목업이 `data-manual="키"` 로 그림을 낸다 — 짝이 맞지 않으면 <b>여기서 보고한다</b>.
 *
 * <h2>PDF 는 브라우저가 만든다</h2>
 *
 * <p>`print/*.html` 을 열고 Ctrl+P → <i>PDF 로 저장</i>. 헤드리스 브라우저를 넣지 않기로 한
 * 결과이며(무의존 · 폐쇄망), 대신 <b>페이지가 나뉘는 자리를 인쇄 CSS 가 정한다</b>.
 *
 * <p>의존성이 없다. `node` 하나로 돈다.
 */

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { DOCS, REPO, groupScreens, flatName, menuTree, read, screensOf } from './lib/menu.mjs';
import { FIGURE_LINE, outlineForSlides, plain, renderMarkdown } from './lib/markdown.mjs';
import { MAIN, figureHtml, figuresOf } from './lib/figure.mjs';
import { screenSpec } from './lib/slideshot.mjs';
import {
  GENERATED_NOTE,
  PRINT_STYLE,
  SITE_STYLE,
  THEME_SCRIPT,
  TREE_SCRIPT,
  page,
  screenDoc,
  themeAware,
} from './lib/page.mjs';
import { buildPptx } from './lib/pptx.mjs';

// ── 옵션 ───────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const options = {
  split: flag('split', 'module'),
  shots: flag('shots', 'auto'),
  out: flag('out', 'build/manual'),
  pptx: has('pptx'),
  dist: !has('no-dist'),
};

if (!['module', 'menu', 'all'].includes(options.split)) {
  console.error(`--split 은 module · menu · all 중 하나다 — 받은 값: ${options.split}`);
  process.exit(1);
}
if (!['auto', 'mockup', 'png', 'none'].includes(options.shots)) {
  console.error(`--shots 는 auto · mockup · png · none 중 하나다 — 받은 값: ${options.shots}`);
  process.exit(1);
}

const write = (relativePath, data) => {
  const target = join(REPO, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
};

// ── 화면을 모은다 ──────────────────────────────────────────────────

const { roots } = menuTree();
const screens = screensOf(roots);
const problems = [];

/** 메뉴얼이 있는 화면만 — 없는 것은 산출물에 담기지 않고 목록으로 보고된다. */
const docs = [];
for (const screen of screens) {
  const source = read(`${DOCS}${screen.url}/manual.md`);
  if (!source.trim()) continue;

  const { figures, style } = figuresOf(screen.url, options.shots);

  docs.push({
    screen,
    source,
    figures,
    /* 목업이 지고 온 스타일도 테마를 따르게 바꾼다 — 안 그러면 그림만 다크로 남는다. */
    style: themeAware(style),
    flat: flatName(screen.url),
    outline: outlineForSlides(source),
    captions: figureCaptions(source),
    /** 그림의 상대 경로가 폴더마다 다르므로 <b>낼 때마다 그린다</b>. */
    render: (hrefOf) => renderDoc({ screen, source, figures, hrefOf }),
  });
}

const mockStyles = [...new Set(docs.map((doc) => doc.style).filter(Boolean))].join('\n');

/**
 * 한 화면의 본문 — 그림 자리를 메뉴얼이 정한다.
 *
 * <p>그림 자리가 하나도 없으면 <b>대표 그림을 첫 구분선 앞에 넣는다</b>. 그림 자리를
 * 아직 안 적은 메뉴얼이 그림 없이 나가지 않게 하는 자리이며, 자리를 적는 순간 이 되돌림은 꺼진다.
 */
function renderDoc({ screen, source, figures, hrefOf }) {
  const used = new Set();

  const body = renderMarkdown(source, {
    figure: (key, caption) => {
      used.add(key);
      const figure = figures.get(key);
      if (!figure) {
        problems.push(
          `${screen.url} — 메뉴얼이 mockup.html#${key} 를 부르는데 그 그림이 없다` +
            `\n    목업이 아예 없으면 파생물이라 그렇다(CLAUDE.md §4-5) — 먼저 만든다:` +
            `\n    node .claude/skills/mockup/scaffold.mjs --write ${screen.url.replace(/^\//, '')}`,
        );
        return '';
      }
      return figureHtml(figure, caption || screen.name, hrefOf(figure));
    },
  });

  if (used.size > 0) {
    for (const key of figures.keys()) {
      if (!used.has(key)) {
        problems.push(`${screen.url} — 목업의 그림 ${key} 를 메뉴얼이 부르지 않는다`);
      }
    }
    return body;
  }

  const main = figures.get(MAIN);
  if (!main) return body;
  return insertBeforeFirstRule(body, figureHtml(main, screen.name, hrefOf(main)));
}

/** `[설명](mockup.html#키)` 의 설명들 — 슬라이드가 그 그림의 제목으로 쓴다. */
function figureCaptions(source) {
  const captions = new Map();
  for (const match of source.matchAll(new RegExp(FIGURE_LINE.source, 'gm'))) {
    captions.set(match[2], match[1]);
  }
  return captions;
}

function insertBeforeFirstRule(html, block) {
  const at = html.indexOf('<hr>');
  return at < 0 ? `${html}\n${block}` : `${html.slice(0, at)}\n${block}\n${html.slice(at)}`;
}

/**
 * 제출 폴더에서의 이미지 이름 — 대표는 `{화면}.png`, 나머지는 `{화면}-{키}.png`.
 *
 * <p>목업 그림에는 파일이 없다. 그림 경로를 <b>종류를 가리지 않고</b> 묻기 때문에 여기서
 * 빈 값을 돌려준다 — `figureHtml` 이 목업일 때 경로를 쓰지 않으므로 그것으로 충분하다.
 */
const assetName = (doc, figure) =>
  figure.file
    ? `${doc.flat}${figure.key === MAIN ? '' : `-${figure.key}`}${figure.file.slice(figure.file.lastIndexOf('.'))}`
    : '';

// ── ① 저장소 파생물 — documents/screen/ ───────────────────────────────────

for (const doc of docs) {
  write(
    `${DOCS}${doc.screen.url}/manual.html`,
    page({
      title: `${doc.screen.name} — 사용자 메뉴얼`,
      style: PRINT_STYLE + doc.style,
      body:
        `<div class="doc">${GENERATED_NOTE}</div>\n` +
        screenDoc({ bodyHtml: doc.render((figure) => basename(figure.file ?? '')) }),
    }),
  );
}

write(
  `${DOCS}/index.html`,
  page({
    title: '사용자 메뉴얼',
    style: SITE_STYLE + PRINT_STYLE + mockStyles,
    body: viewer(
      (url) => flatName(url),
      (doc) => (figure) => `${doc.screen.url.slice(1)}/${basename(figure.file ?? '')}`,
    ),
  }),
);

// ── ② 제출 폴더 — build/manual/ ────────────────────────────────────

const made = { screens: docs.length, print: 0, slides: 0, shots: 0 };

if (options.dist) {
  const out = options.out.replace(/\/+$/, '');
  rmSync(join(REPO, out), { recursive: true, force: true });

  /* 캡처 PNG 를 제출 폴더로 옮긴다 — 폴더 하나만 복사하면 되어야 한다. */
  for (const doc of docs) {
    for (const figure of doc.figures.values()) {
      if (figure.kind !== 'png') continue;
      const target = join(REPO, out, 'assets', assetName(doc, figure));
      mkdirSync(dirname(target), { recursive: true });
      cpSync(join(REPO, figure.file), target);
      made.shots += 1;
    }
  }

  const inAssets = (prefix) => (doc) => (figure) => `${prefix}assets/${assetName(doc, figure)}`;

  // 열람 페이지
  write(
    `${out}/index.html`,
    page({
      title: '사용자 메뉴얼',
      style: SITE_STYLE + PRINT_STYLE + mockStyles,
      body: viewer((url) => flatName(url), inAssets('')),
    }),
  );

  // 화면별 한 장
  for (const doc of docs) {
    write(
      `${out}/screens/${doc.flat}.html`,
      page({
        title: `${doc.screen.name} — 사용자 메뉴얼`,
        style: PRINT_STYLE + doc.style,
        body: screenDoc({ bodyHtml: doc.render(inAssets('../')(doc)) }),
      }),
    );
  }

  // 인쇄본 — 열어서 Ctrl+P
  const groups = groupScreens(roots, options.split);
  /* 실제로 파일이 나온 묶음만 README 에 적는다 — 없는 파일을 목록에 올리면 받는 사람이 찾는다. */
  const produced = [];

  for (const group of groups) {
    const inGroup = group.screens
      .map((screen) => docs.find((doc) => doc.screen.url === screen.url))
      .filter(Boolean);
    if (inGroup.length === 0) continue;

    const sections = inGroup
      .map((doc) => screenDoc({ bodyHtml: doc.render(inAssets('../')(doc)), anchor: doc.flat }))
      .join('\n');

    write(
      `${out}/print/${slug(group.key)}.html`,
      page({
        title: `${group.title} — 사용자 메뉴얼`,
        style: PRINT_STYLE + mockStyles,
        body: `${cover(group, inGroup)}\n${sections}`,
      }),
    );
    made.print += 1;
    produced.push({ ...group, made: inGroup.length });

    if (options.pptx) {
      const slides = [];
      for (const doc of inGroup) {
        /*
          <b>화면 그림이 먼저다.</b> 발표에서 첫 물음이 *어느 화면인가* 이고, 글 몇 줄로는
          그 답이 안 된다. 캡처가 있으면 캡처를, 없으면 목업의 뼈대를 파워포인트 도형으로
          다시 그린다 — 브라우저 없이 HTML 을 이미지로 굽지 못하기 때문이다.
        */
        for (const [key, figure] of doc.figures) {
          const isMain = key === MAIN;
          slides.push({
            title: isMain ? doc.screen.name : doc.captions.get(key) || doc.screen.name,
            subtitle: isMain ? doc.screen.path.join(' › ') : doc.screen.name,
            bullets: isMain ? [{ text: firstLine(doc.source) }] : [],
            png: figure.kind === 'png' ? readFileSync(join(REPO, figure.file)) : null,
            screen: figure.kind === 'mockup' ? screenSpec(figure.html) : null,
          });
        }
        for (const section of doc.outline) {
          slides.push({
            title: section.title,
            subtitle: doc.screen.name,
            bullets: section.bullets,
            png: null,
          });
        }
      }
      write(`${out}/slides/${slug(group.key)}.pptx`, buildPptx(slides));
      made.slides += 1;
    }
  }

  write(`${out}/README.txt`, readme(produced));
}

// ── 보고 ───────────────────────────────────────────────────────────

const missing = screens.filter((screen) => !docs.some((doc) => doc.screen.url === screen.url));
const figureCount = docs.reduce((sum, doc) => sum + doc.figures.size, 0);

console.log(
  `메뉴얼 ${made.screens} 개 · 화면 그림 ${figureCount} 장 — ${DOCS}/{경로}/manual.html · ${DOCS}/index.html`,
);
if (options.dist) {
  console.log(`제출 폴더 ${options.out}/`);
  console.log(
    `  index.html · screens/ ${made.screens} · print/ ${made.print}` +
      (options.pptx ? ` · slides/ ${made.slides}` : '') +
      (made.shots > 0 ? ` · assets/ ${made.shots}` : ''),
  );
  console.log(
    `  분할 ${options.split} · 화면 그림 ${options.shots}` +
      (made.shots > 0 ? ` (캡처 ${made.shots} · 나머지는 목업)` : ' (전부 목업)'),
  );
}

/* 어긋남을 보고 없이 지나가지 않는다 — CLAUDE.md §2. 같은 말이 여러 벌 나오므로 줄인다. */
const uniqueProblems = [...new Set(problems)];
if (uniqueProblems.length > 0) {
  console.log(`\n그림 짝이 맞지 않는 곳 ${uniqueProblems.length}:`);
  for (const problem of uniqueProblems) console.log(`  ${problem}`);
}

if (missing.length > 0) {
  console.log(`\nmanual.md 가 없어 담기지 못한 화면 ${missing.length}:`);
  for (const screen of missing) console.log(`  ${screen.url}  (${screen.code} · ${screen.name})`);
}

// ── 조각 ───────────────────────────────────────────────────────────

/** 좌 트리 + 본문 + 테마 토글. 링크 대상과 그림 경로만 폴더마다 다르다. */
function viewer(anchorOf, hrefFactory) {
  const panes = docs
    .map((doc) =>
      screenDoc({ bodyHtml: doc.render(hrefFactory(doc)) }).replace(
        '<section class="doc screen-doc"',
        `<section class="doc screen-doc" data-pane="${anchorOf(doc.screen.url)}" hidden`,
      ),
    )
    .join('\n');

  return `<nav class="noprint">
  <div class="brand">사용자 메뉴얼<small>메뉴를 고르면 오른쪽에 나옵니다</small></div>
  <div class="theme" role="group" aria-label="화면 테마">
    <button type="button" data-theme-set="light">라이트</button>
    <button type="button" data-theme-set="dark">다크</button>
    <button type="button" data-theme-set="system">시스템</button>
  </div>
  <div class="tools"><button type="button" id="tree-toggle">모두 접기</button></div>
  ${tree(roots, anchorOf)}
</nav>
<main>
  <div class="empty" id="empty">왼쪽에서 메뉴를 고르세요. <b>메뉴얼이 있는 메뉴만</b> 열립니다.</div>
  ${panes}
</main>
<script>
${THEME_SCRIPT}
${TREE_SCRIPT}

/* 트리는 실제 메뉴 데이터에서 왔다 — 트리가 바뀌면 다시 만드는 것만으로 따라온다. */
var panes = document.querySelectorAll('[data-pane]');
var empty = document.getElementById('empty');
function show(key) {
  var found = false;
  panes.forEach(function (pane) {
    var on = pane.dataset.pane === key;
    pane.hidden = !on;
    if (on) found = true;
  });
  empty.hidden = found;
  document.querySelectorAll('nav a').forEach(function (a) {
    var on = a.dataset.key === key;
    a.classList.toggle('on', on);
    if (on && window.expandAncestors) window.expandAncestors(a);
  });
  if (found) { location.hash = key; document.querySelector('main').scrollTop = 0; }
}
document.querySelectorAll('nav a[data-key]').forEach(function (a) {
  a.addEventListener('click', function () { show(a.dataset.key); });
});
if (location.hash) show(location.hash.slice(1));
</script>`;
}

function tree(list, anchorOf, depth = 0) {
  const out = ['<ul>'];
  for (const node of list) {
    if (node.url) {
      const owned = docs.some((doc) => doc.screen.url === node.url);
      out.push(
        owned
          ? `<li><a data-key="${anchorOf(node.url)}">${esc(node.name)}</a></li>`
          : `<li><a class="none">${esc(node.name)}<span class="why">메뉴얼 없음</span></a></li>`,
      );
    } else {
      out.push(`<li data-group>`);
      out.push(
        `<button type="button" class="grp${depth > 0 ? ' sub' : ''}" ` +
          `data-toggle="${esc(node.code)}" aria-expanded="true">` +
          `<span class="caret" aria-hidden="true">&#9662;</span>${esc(node.name)}</button>`,
      );
      if (node.children.length > 0) out.push(tree(node.children, anchorOf, depth + 1));
      out.push('</li>');
    }
  }
  out.push('</ul>');
  return out.join('\n');
}

/** 인쇄본의 첫 장 — 무엇을 담은 문서인지와 <b>차례</b>. */
function cover(group, inGroup) {
  const items = inGroup.map((doc) => `<li>${esc(doc.screen.path.join(' › '))}</li>`).join('\n');
  return `<section class="doc screen-doc">
<h1>${esc(group.title)} — 사용자 메뉴얼</h1>
<p>이 문서는 아래 화면의 사용 방법을 담습니다.</p>
<ol>${items}</ol>
<hr>
<p style="font-size:12px;color:#6b6b6b">화면 그림은 배치를 보이기 위한 것이며 실제 데이터·글꼴·색은 다를 수 있습니다.</p>
</section>`;
}

function readme(groups) {
  const lines = [
    '사용자 메뉴얼 — 전달본',
    '='.repeat(40),
    '',
    '이 폴더를 통째로 복사해 전달하면 됩니다. 인터넷 연결이 필요 없습니다.',
    '',
    '[ 무엇이 들었나 ]',
    '  index.html    메뉴 트리를 보며 읽는 페이지. 여기서 시작하세요.',
    '                왼쪽 위에서 라이트 / 다크 화면을 고를 수 있습니다.',
    '  screens/      화면 하나짜리 메뉴얼. 한 화면만 전달할 때 이 파일을 보냅니다.',
    '  print/        인쇄용. 열고 Ctrl+P → "PDF 로 저장" 하면 PDF 가 됩니다.',
  ];
  if (options.pptx) {
    lines.push('  slides/       요약 슬라이드(.pptx). 자세한 내용은 print/ 의 PDF 가 갖습니다.');
  }
  if (made.shots > 0) lines.push('  assets/       화면 이미지.');
  lines.push(
    '',
    `[ 담긴 묶음 — ${options.split === 'module' ? '모듈' : options.split === 'menu' ? '메뉴 그룹' : '전체'} 단위 ]`,
    ...groups.map(
      (group) =>
        `  ${slug(group.key)}  ${group.title} — ${group.made} 화면` +
        (group.made < group.screens.length
          ? ` (이 묶음의 ${group.screens.length} 화면 중 ${group.made} 개만 메뉴얼이 있습니다)`
          : ''),
    ),
    '',
    '[ PDF 만드는 법 ]',
    '  1. print/ 의 파일을 브라우저로 엽니다.',
    '  2. Ctrl+P (Mac 은 Cmd+P).',
    '  3. 대상을 "PDF 로 저장" 으로 바꿉니다.',
    '  4. 배경 그래픽을 켜면 표의 머리 색이 함께 나옵니다.',
    '  ※ 인쇄는 화면 테마와 무관하게 늘 흰 종이로 나갑니다.',
    '',
  );
  return lines.join('\r\n');
}

/** 메뉴얼 첫 줄의 한 문장 — `> ` 로 시작하는 요약. 슬라이드의 머리말이 된다. */
function firstLine(source) {
  const quote = source.split('\n').find((line) => line.startsWith('> '));
  return quote ? plain(quote.slice(2)) : '';
}

/* 선언문으로 둔다 — 화살표 상수로 두면 위에서 부르는 tree()·cover() 가 TDZ 에 걸린다. */
function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
