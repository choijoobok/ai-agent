/**
 * HTML 조립 — 모양과 페이지 뼈대.
 *
 * <p>스타일이 여기 <b>한 곳</b>에 있다. 화면별 메뉴얼 · 열람 페이지 · 인쇄본이 같은 모양을
 * 써야 고객사가 <i>세 벌의 다른 문서</i> 를 받았다고 느끼지 않는다.
 *
 * <h2>테마는 세 상태다</h2>
 *
 * <p>라이트 · 다크 · <b>시스템</b>. 고른 값은 `data-theme` 로 뿌리에 박히고, 고르지 않은
 * 상태(시스템)에서는 아무것도 박히지 않아 `prefers-color-scheme` 이 정한다.
 *
 * <p>그래서 다크 규칙을 <b>두 번</b> 적는다 — 미디어 쿼리 안(단, 라이트를 고른 사람은 빼고)과
 * `[data-theme="dark"]` 로 한 번씩. 한쪽만 적으면 <i>시스템이 다크인데 라이트를 골랐다</i> 나
 * 그 반대에서 토글이 지지 않는다.
 */

import { escapeHtml } from './markdown.mjs';

/** 색 토큰 — 라이트가 기본이고 다크는 {@link themeAware} 가 두 벌로 편다. */
const TOKENS = `
:root{--ink:#1a1a1a;--muted:#6b6b6b;--line:#c9c9c9;--line2:#e4e4e4;--bg:#fff;--panel:#f7f7f7;
      --note:#1f4e79;--note-bg:#eef4fa;--sel:#eaf1f9}
@media (prefers-color-scheme:dark){
  :root{--ink:#e6e6e6;--muted:#9a9a9a;--line:#4a4a4a;--line2:#333;--bg:#161616;--panel:#1e1e1e;
        --note:#8fb8dd;--note-bg:#1c2833;--sel:#1a2b3a}
}
`;

/** 본문 — 화면별 메뉴얼과 인쇄본이 함께 쓴다. */
export const DOC_STYLE = `
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
     font:15px/1.75 "Malgun Gothic","Apple SD Gothic Neo",sans-serif}
.doc{padding:28px 32px;max-width:900px}
.doc h1{font-size:24px;margin:0 0 6px}
.doc h2{font-size:17px;margin:30px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.doc h3{font-size:15px;margin:20px 0 8px}
.doc p{margin:9px 0}
.doc ul,.doc ol{margin:9px 0;padding-left:22px}
.doc li{margin:4px 0}
.doc blockquote{margin:12px 0;padding:9px 14px;border-left:3px solid var(--note);
                background:var(--note-bg)}
.doc code{font-family:Consolas,monospace;font-size:.9em;background:var(--panel);padding:1px 5px}
.doc pre{background:var(--panel);padding:12px 14px;overflow:auto;font-family:Consolas,monospace;
         font-size:12.5px;line-height:1.6}
.doc table{border-collapse:collapse;width:100%;font-size:13.5px;margin:12px 0}
.doc th,.doc td{border:1px solid var(--line2);padding:7px 10px;text-align:left;vertical-align:top}
.doc th{background:var(--panel);font-weight:600;white-space:nowrap}
.doc hr{border:none;border-top:1px solid var(--line2);margin:26px 0}
.doc a{color:var(--note)}
.gen{font-size:11.5px;color:var(--muted);border:1px dashed var(--line);padding:7px 11px;margin-bottom:20px}

/* 화면 그림 — 목업을 오려 온 것과 캡처 PNG 가 같은 액자를 쓴다 */
.shot{margin:16px 0 22px;padding:0}
.shot img{display:block;width:100%;border:1px solid var(--line)}
.shot figcaption{font-size:11.5px;color:var(--muted);margin-top:6px}
.shot .mockwrap{border:1px solid var(--line);padding:10px;background:var(--bg);overflow:auto}
/* 오려 온 목업이 자기 여백을 다시 그리지 않게 한다 */
.shot .mockwrap .screen{border:none;margin:0}
.shot .mockwrap .screen .body{padding:10px 8px}
`;

/**
 * 인쇄 — <b>PDF 는 브라우저가 만든다</b>(Ctrl+P → PDF 로 저장).
 *
 * <p>헤드리스 브라우저를 넣지 않기로 한 결과이며(무의존 · 폐쇄망), 대신 <b>나뉘는 자리를
 * CSS 가 정한다</b> — 표가 페이지 경계에서 잘리거나 제목만 남고 본문이 넘어가는 것을 막는다.
 *
 * <p><b>인쇄는 늘 흰 종이다.</b> 다크로 보던 사람이 그대로 인쇄하면 검은 바탕이 통째로
 * 찍힌다 — 잉크의 문제이기 전에 <b>읽을 수 없는 문서</b>가 된다.
 */
export const PRINT_STYLE = `
@media print{
  :root,:root[data-theme="dark"]{--ink:#1a1a1a;--muted:#555;--line:#999;--line2:#ccc;--bg:#fff;
        --panel:#f2f2f2;--note:#1f4e79;--note-bg:#eef4fa;--sel:#fff}
  @page{size:A4;margin:16mm 14mm}
  body{font-size:10.5pt;line-height:1.6;background:#fff;color:#1a1a1a}
  .doc{padding:0;max-width:none}
  .noprint{display:none !important}
  .screen-doc{break-after:page}
  .screen-doc:last-child{break-after:auto}
  .doc h1{font-size:17pt}
  .doc h2{font-size:12.5pt;break-after:avoid}
  .doc h3{font-size:11pt;break-after:avoid}
  .doc table{font-size:9pt;break-inside:avoid}
  .doc tr{break-inside:avoid}
  .doc blockquote,.shot,.gen{break-inside:avoid}
  .doc pre{white-space:pre-wrap}
  a{color:inherit;text-decoration:none}
}
`;

/** 열람 페이지 — 좌 트리 · 우 본문 · 테마 고르개. */
export const SITE_STYLE = `
body{display:flex;height:100vh;overflow:hidden}
nav{width:300px;flex:none;overflow:auto;border-right:1px solid var(--line);background:var(--panel);
    padding:16px 0 40px;font-size:13.5px}
nav .brand{padding:0 16px 12px;font-weight:700;font-size:15px;border-bottom:1px solid var(--line2)}
nav .brand small{display:block;font-weight:400;font-size:11.5px;color:var(--muted);margin-top:3px}
nav .theme{display:flex;gap:4px;padding:10px 16px 12px;border-bottom:1px solid var(--line2);
           margin-bottom:8px}
nav .theme button{flex:1;padding:4px 0;font:inherit;font-size:11.5px;cursor:pointer;
                  border:1px solid var(--line);background:var(--bg);color:var(--muted)}
nav .theme button.on{background:var(--sel);color:var(--ink);font-weight:600;border-color:var(--note)}
nav .tools{display:flex;justify-content:flex-end;padding:0 12px 8px}
nav .tools button{padding:3px 9px;font:inherit;font-size:11.5px;cursor:pointer;
                  border:1px solid var(--line);background:var(--bg);color:var(--muted)}
nav ul{list-style:none;margin:0;padding:0}
/* 그룹은 눌러서 접는 단추다 — 겉모습은 제목이고 키보드로도 열린다 */
nav .grp{display:flex;align-items:center;gap:5px;width:100%;
         padding:9px 16px 3px;color:var(--muted);font:inherit;font-size:12px;font-weight:600;
         background:none;border:none;text-align:left;cursor:pointer}
nav .grp.sub{padding-left:28px;font-weight:400}
nav .grp:hover{color:var(--ink)}
nav .grp .caret{display:inline-block;width:9px;font-size:9px;line-height:1;
                transition:transform .12s ease}
nav li[data-collapsed] > .grp .caret{transform:rotate(-90deg)}
nav li[data-collapsed] > ul{display:none}
nav a{display:block;padding:5px 16px 5px 40px;color:var(--ink);text-decoration:none;cursor:pointer}
nav a:hover{background:var(--sel)}
nav a.on{background:var(--sel);font-weight:600;box-shadow:inset 3px 0 0 var(--note)}
nav a.none{color:var(--muted);cursor:default}
nav a.none:hover{background:transparent}
nav a .why{font-size:11px;color:var(--muted);margin-left:6px}
main{flex:1;overflow:auto}
main .empty{padding:60px 32px;color:var(--muted)}
`;

/**
 * 다크 규칙을 <b>토글이 이길 수 있는 형태</b>로 편다.
 *
 * <p>목업이 지고 온 스타일에도 그대로 건다 — 안 그러면 <b>본문만 라이트가 되고 그림은
 * 다크로 남는다</b>. 목업은 자기 파일에서 혼자 살 때를 기준으로 쓰였으므로 이쪽에서 맞춘다.
 */
export function themeAware(css) {
  if (!css) return '';
  let out = '';
  let rest = css;

  for (;;) {
    const at = rest.search(/@media[^{]*prefers-color-scheme\s*:\s*dark[^{]*\{/);
    if (at < 0) {
      out += rest;
      break;
    }
    const open = rest.indexOf('{', at);
    const end = matchBrace(rest, open);
    if (end < 0) {
      out += rest;
      break;
    }
    const head = rest.slice(at, open + 1);
    const inner = rest.slice(open + 1, end);

    out += rest.slice(0, at);
    /* ① 시스템이 다크일 때 — 단, 라이트를 고른 사람은 뺀다. */
    out += `${head}${inner.replace(/(^|[,}\s])(:root)\b/g, '$1:root:not([data-theme="light"])')}}`;
    /* ② 다크를 고른 사람 — 시스템이 라이트여도 적용된다. */
    out += `\n${inner.replace(/(^|[,}\s])(:root)\b/g, '$1:root[data-theme="dark"]')}\n`;

    rest = rest.slice(end + 1);
  }
  return out;
}

function matchBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 고른 테마를 <b>그리기 전에</b> 박는다 — 뒤에 박으면 한 번 번쩍인다. */
const THEME_BOOTSTRAP = `
try {
  var saved = localStorage.getItem('manual-theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch (e) { /* 파일에서 열면 저장소가 막힐 수 있다 — 그때는 시스템을 따른다 */ }
`;

/** 고르개의 동작 — 열람 페이지에만 붙는다. */
export const THEME_SCRIPT = `
(function () {
  var root = document.documentElement;
  var buttons = document.querySelectorAll('[data-theme-set]');
  function apply(value) {
    if (value === 'system') delete root.dataset.theme;
    else root.dataset.theme = value;
    buttons.forEach(function (button) {
      button.classList.toggle('on', button.dataset.themeSet === value);
    });
  }
  var saved = 'system';
  try { saved = localStorage.getItem('manual-theme') || 'system'; } catch (e) { /* 무시 */ }
  apply(saved);
  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      var value = button.dataset.themeSet;
      apply(value);
      try { localStorage.setItem('manual-theme', value); } catch (e) { /* 무시 */ }
    });
  });
})();
`;

/**
 * 트리 접기 — 그룹 단추와 <b>모두 접기</b>.
 *
 * <p>접은 상태를 기억한다. 메뉴얼은 한 번에 다 읽는 문서가 아니라 <b>필요할 때 그 절만
 * 여는</b> 문서이고, 열 때마다 자기 자리를 다시 찾아야 하면 트리가 짐이 된다.
 *
 * <p><b>고른 화면의 조상은 강제로 편다.</b> 접힌 가지 안의 메뉴를 주소(`#키`)로 열었을 때
 * 본문만 바뀌고 트리에서는 아무 데도 표시되지 않으면 <i>내가 어디를 보고 있나</i> 를 잃는다.
 */
export const TREE_SCRIPT = `
(function () {
  var KEY = 'manual-tree-collapsed';
  var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { /* 무시 */ }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 무시 */ }
  }

  function setCollapsed(li, collapsed) {
    var button = li.querySelector('.grp');
    if (collapsed) li.setAttribute('data-collapsed', '');
    else li.removeAttribute('data-collapsed');
    if (button) {
      button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      state[button.dataset.toggle] = collapsed ? 1 : 0;
    }
  }

  var groups = document.querySelectorAll('nav li[data-group]');
  groups.forEach(function (li) {
    var button = li.querySelector('.grp');
    if (!button) return;
    if (state[button.dataset.toggle]) setCollapsed(li, true);
    button.addEventListener('click', function () {
      setCollapsed(li, !li.hasAttribute('data-collapsed'));
      persist();
    });
  });

  var all = document.getElementById('tree-toggle');
  function label() {
    var open = document.querySelector('nav li[data-group]:not([data-collapsed])');
    if (all) all.textContent = open ? '모두 접기' : '모두 펼치기';
    return open;
  }
  if (all) {
    all.addEventListener('click', function () {
      var collapse = Boolean(label());
      groups.forEach(function (li) { setCollapsed(li, collapse); });
      persist();
      label();
    });
  }
  label();

  /* 트리에서 지금 보는 화면이 보이게 한다 — 조상이 접혀 있으면 편다. */
  window.expandAncestors = function (element) {
    var li = element.closest('li[data-group]');
    while (li) {
      setCollapsed(li, false);
      li = li.parentElement ? li.parentElement.closest('li[data-group]') : null;
    }
    persist();
    label();
  };
})();
`;

export function page({ title, style = '', body, lang = 'ko' }) {
  return `<!doctype html>
<html lang="${lang}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)}</title>
<script>${THEME_BOOTSTRAP}</script>
<style>${themeAware(TOKENS)}${DOC_STYLE}${style}</style>
${body}
</html>
`;
}

/**
 * 화면 하나의 본문 — 그림 자리는 <b>메뉴얼이 정한다</b>(`[설명](mockup.html#키)`).
 *
 * <p>자리를 적지 않은 메뉴얼에서는 부르는 쪽이 대표 그림을 첫 구분선 앞에 넣는다 —
 * 메뉴얼을 여는 사람의 첫 물음이 <i>이게 어느 화면이지</i> 이기 때문이다.
 */
export function screenDoc({ bodyHtml, anchor }) {
  return `<section class="doc screen-doc"${anchor ? ` id="${escapeHtml(anchor)}"` : ''}>
${bodyHtml}
</section>`;
}

/** 생성물 표시 — 저장소 안의 파생물에만 붙인다(고객사에 나가는 것에는 붙이지 않는다). */
export const GENERATED_NOTE = `<div class="gen noprint"><b>생성물이다 — 손으로 고치지 않는다.</b>
원본은 <code>manual.md</code> 이고 이 파일은 <code>/manual-site</code> 가 만든다(CLAUDE.md §6.2).
여기서 고친 것은 다음 생성에서 사라진다.</div>`;
