#!/usr/bin/env node
/**
 * 목업 골격 생성기 · 검사기.
 *
 * <p><b>목업은 요건서의 파생물이다</b> — 결정은 `requirements.md` 가 갖고 목업은 그것을
 * 눈으로 확인하는 그림이다. 그래서 기계가 만들 수 있는 것은 기계가 만든다:
 * 공용 스타일 블록 · 개요 바 · 테스트 케이스 표 · 메뉴얼이 요구하는 그림 키 목록.
 * <b>남는 것은 그림 하나이고 그것만 AI 가 그린다.</b>
 *
 * <p>세 갈래로 쓴다:
 * <pre>
 *   node scaffold.mjs --list                 화면 목록과 문서 유무
 *   node scaffold.mjs &lt;화면&gt;                 골격을 stdout 으로 낸다
 *   node scaffold.mjs --check [&lt;화면&gt;]        있는 목업을 요건서·메뉴얼과 대조한다
 * </pre>
 *
 * <p>화면은 페이지 경로(`/log/access`) · 폴더(`log/access`) · 이름(`access`) 아무거나 받는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { declaredFigures, declaredScreen, searchComboScript } from './declared-layout.mjs';

const REPO = path.resolve(import.meta.dirname, '../../..');
const SCREENS = path.join(REPO, 'documents/screen');
const TEMPLATE = path.join(REPO, 'aidd-guide/artifact/template/03-mockup.html');
const MARK = String.fromCharCode(0xe000); // 코드 스팬 자리표시자 — 본문에 나올 수 없는 문자
const MISSING_OK = MARK + 'none';     // 목업 없음 — 정상
const MISSING_NEEDED = MARK + 'need'; // 목업 없음 — 메뉴얼이 그림을 부른다

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

/** documents/screen/ 아래의 화면 폴더 — requirements.md 를 가진 곳이 화면이다. */
function allScreens() {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const p = path.join(d, e.name);
      if (fs.existsSync(path.join(p, 'requirements.md'))) {
        out.push(path.relative(SCREENS, p).split(path.sep).join('/'));
      }
      walk(p);
    }
  })(SCREENS);
  return out.sort();
}

/** 인자 하나를 화면 폴더로 푼다. 여러 개가 걸리면 세우고 묻는다. */
function resolveScreen(arg) {
  const all = allScreens();
  const key = arg.replace(/^\/+/, '').replace(/\/+$/, '');
  if (all.includes(key)) return key;
  const hits = all.filter((s) => s === key || s.endsWith(`/${key}`));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    console.error(`'${arg}' 에 여러 화면이 걸린다 — 하나를 골라 다시 부른다:\n  ${hits.join('\n  ')}`);
    process.exit(2);
  }
  console.error(`'${arg}' 에 해당하는 화면이 없다. --list 로 목록을 본다.`);
  process.exit(2);
}

/** 마크다운 표 → [[칸…]]. 구분선(|---|)은 건너뛴다. */
function mdTable(block) {
  const rows = [];
  for (const line of block.split('\n')) {
    if (!/^\s*\|/.test(line)) continue;
    if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/);
    rows.push(cells.map((c) => c.trim()));
  }
  return rows;
}

/** `## N. 제목` 절의 본문 — 다음 `## ` 까지. */
function section(md, titleRe) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => /^## /.test(l) && titleRe.test(l));
  if (i < 0) return null;
  let j = i + 1;
  while (j < lines.length && !/^## /.test(lines[j])) j++;
  return { head: lines[i], body: lines.slice(i + 1, j).join('\n') };
}

/**
 * 마크다운 인라인 → HTML. 표 칸 안에서만 쓴다.
 *
 * <p><b>코드 스팬을 먼저 빼 둔다.</b> 백틱 안에 별이 든 값이 실제로 있어(마스킹 표시)
 * 코드를 태그로 바꾼 뒤 강조를 매칭하면 그 별이 강조 구분자로 읽히고
 * <code>&lt;b&gt;&lt;code&gt;&lt;/b&gt;</code> 처럼 겹친 태그가 나온다.
 */
function html(s) {
  const spans = [];
  // ① 코드 스팬을 자리표시자로 치운다 — 그 안의 * 는 강조가 아니다.
  //    구분자는 사용자 영역 문자다. 본문에 나올 수 없어야 실제 값과 겹치지 않는다.
  let t = s.replace(/`([^`]+)`/g, (_, x) => {
    spans.push(x);
    return MARK + (spans.length - 1) + MARK;
  });
  t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // ② 강조 — 자리표시자에는 * 가 없으므로 겹치지 않는다
  t = t.replace(/\*\*\*([^*]+)\*\*\*/g, (_, x) => `<b><i>${x}</i></b>`);
  // 굵기와 기울기가 한쪽에서만 겹치는 둘 — **가 *나*** · ***가* 나**
  t = t.replace(/\*\*([^*]*)\*([^*]+)\*\*\*/g, (_, a, b) => `<b>${a}<i>${b}</i></b>`);
  t = t.replace(/\*\*\*([^*]+)\*([^*]*)\*\*/g, (_, a, b) => `<b><i>${a}</i>${b}</b>`);
  t = t.replace(/\*\*([\s\S]+?)\*\*/g, (_, x) => `<b>${x}</b>`);
  t = t.replace(/\*([^*]+)\*/g, (_, x) => `<i>${x}</i>`);
  // ③ 코드 스팬을 되돌린다 — 이때 이스케이프한다
  t = t.replace(new RegExp(MARK + '(\\d+)' + MARK, 'g'), (_, i) => {
    const x = spans[+i].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<code>${x}</code>`;
  });
  return t.split('\\|').join('|');
}

/** 메뉴얼이 요구하는 그림 키 — `[설명](mockup.html#키)` 한 줄 표기. */
function manualKeys(dir) {
  const md = read(path.join(SCREENS, dir, 'manual.md'));
  if (!md) return [];
  const out = [];
  for (const m of md.matchAll(/^\[(.*)\]\(\.?\/?mockup\.html#([\w-]+)\)$/gm)) {
    out.push({ key: m[2], caption: m[1] });
  }
  return out;
}

/** 요건서 §테스트 케이스 → { groups: [{title, rows}] } */
function testcases(md) {
  const sec = section(md, /테스트 케이스/);
  if (!sec) return null;
  const groups = [];
  let title = null;
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    const rows = mdTable(buf.join('\n'));
    // 첫 행은 머리(# / 조작 · 상황 / 기대)
    const body = rows.slice(1).filter((r) => r.length >= 3);
    if (body.length) groups.push({ title: title || '케이스', rows: body });
    buf = [];
  };
  for (const line of sec.body.split('\n')) {
    if (/^### /.test(line)) {
      flush();
      title = line.replace(/^###\s*/, '').trim();
      continue;
    }
    if (/^\s*\|/.test(line)) buf.push(line);
    else flush();
  }
  flush();
  return { number: sec.head.match(/^## (\d+)\./)?.[1] ?? '?', groups };
}

/** 요건서 §0 메타 표 → [[항목, 값]] (머리 제외) */
function meta(md) {
  const sec = section(md, /메타/);
  if (!sec) return [];
  return mdTable(sec.body).slice(1).filter((r) => r.length >= 2);
}

/** 공용 스타일 블록 — 서식이 원본이다. 여기에 색을 적지 않는다. */
function styleBlock() {
  const t = read(TEMPLATE);
  if (!t) {
    console.error(`서식을 찾지 못했다: ${path.relative(REPO, TEMPLATE)}`);
    process.exit(2);
  }
  const m = t.match(/<style>[\s\S]*?<\/style>/i);
  if (!m) {
    console.error('서식에 <style> 블록이 없다.');
    process.exit(2);
  }
  return m[0];
}

/** 한 절 안의 표와 바로 앞 소제목을 함께 보존한다. */
function tablesIn(body) {
  const out = [];
  let heading = '';
  let lines = [];
  const flush = () => {
    const rows = mdTable(lines.join('\n'));
    if (rows.length >= 2) out.push({ heading, header: rows[0], rows: rows.slice(1) });
    lines = [];
  };
  for (const line of body.split('\n')) {
    if (/^#{2,6}\s+/.test(line)) {
      flush();
      heading = line.replace(/^#+\s*/, '').trim();
    } else if (/^\s*\|/.test(line)) {
      lines.push(line);
    } else {
      flush();
    }
  }
  flush();
  return out;
}

/** 마크다운 장식 없이 사람이 보는 표제어. 비교와 예시 값에만 쓴다. */
function plain(s = '') {
  return String(s)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findTable(sec, firstHeader) {
  return sec ? tablesIn(sec.body).find((t) => firstHeader.test(plain(t.header[0]))) : null;
}

/** 요건서의 화면·조회·컬럼·버튼 표를 한 번만 읽어 화면 모델로 만든다. */
function screenModel(md, type) {
  const composition = section(md, /화면 구성/);
  const search = findTable(section(md, /조회조건/), /조건|검색/);
  const columns = (section(md, /^컬럼$|컬럼/) ? tablesIn(section(md, /^컬럼$|컬럼/).body) : [])
    .filter((t) => /컬럼/.test(plain(t.header[0])));
  const actions = findTable(section(md, /버튼.*액션|액션.*버튼/), /버튼|액션/);
  const text = `${type}\n${composition?.body ?? ''}`;
  return {
    figures: declaredFigures(findTable(composition, /그림 키/), plain),
    searchTable: search,
    detailSearchTables: tablesIn(section(md, /조회조건/)?.body ?? '').filter((t) => /조건|검색/.test(plain(t.header[0]))).slice(1),
    search: search?.rows ?? [],
    columns,
    actions: actions?.rows ?? [],
    masterDetail: /마스터.?디테일/.test(text) || columns.length > 1,
    vertical: /(상하|위.*아래|상·하)/.test(text),
  };
}

function annotator(key) {
  const notes = [];
  return {
    badge(description) {
      const number = notes.length + 1;
      const id = `${key}-${number}`;
      notes.push({ id, number, description });
      return `<span class="n anchor" data-note="${id}" role="link" tabindex="0" aria-label="설명 ${number} 보기">${number}</span>`;
    },
    render() {
      if (!notes.length) return '';
      return `<div class="notes"><ol>${notes.map((note) => `<li id="note-${note.id}"><span class="n">${note.number}</span>${note.description}</li>`).join('')}</ol></div>`;
    },
  };
}

function searchControl(row, annotations) {
  const label = row[0] || '조회 조건';
  const input = row[2] || '';
  const select = /셀렉트|선택|코드|날짜/.test(input);
  const description = `<b>${html(plain(label))}</b> — 요건서 §조회조건에 정의된 조건이다. ${html(plain(row.slice(1).filter(Boolean).join(' · ')) || '입력값으로 목록을 조회한다.')}`;
  return `<label>${html(label)}${annotations.badge(description)}</label>${select ? '<select><option>전체</option></select>' : `<input placeholder="${html(plain(label))}" />`}`;
}

function columnLabel(row) {
  return plain(row[0] || '컬럼');
}

function grid(title, table, annotations, { empty = '', selected = false } = {}) {
  const cols = table?.rows ?? [];
  if (!cols.length) return '';
  const titleBadge = annotations.badge(`<b>${html(title)}</b> 영역 — 조회 결과와 건수를 함께 확인한다.`);
  const heads = cols.map((row) => {
    const detail = plain(row.slice(1).filter(Boolean).join(' · ')) || '요건서 §컬럼에 정의된 표시 항목이다.';
    return `<th class="roh">${html(row[0])}${annotations.badge(`<b>${html(columnLabel(row))}</b> 컬럼 — ${html(detail)}`)}<span class="mn">☰</span></th>`;
  }).join('');
  const values = cols.map((row, i) => {
    const label = columnLabel(row);
    if (/수$|건수|count/i.test(label)) return '<td>0</td>';
    if (/사용|여부|YN|상태/.test(label)) return '<td>Y</td>';
    return `<td>${i === 0 ? '예시 값' : '—'}</td>`;
  }).join('');
  const body = empty
    ? `<tbody><tr><td colspan="${cols.length}" class="empty">${html(empty)}</td></tr></tbody>`
    : `<tbody><tr${selected ? ' class="sel"' : ''}>${values}</tr></tbody>`;
  return `<div class="tb"><span class="ttl">${html(title)}${titleBadge}</span><span class="cnt">${empty ? '0건' : '1건'}</span></div>
    <div class="grid"><table><thead><tr>${heads}</tr></thead>${body}</table></div>
    <div class="pg"><span>총 <b>${empty ? '0' : '1'}</b>건</span><span class="nav">‹ 1 ›</span><span class="size">50건</span></div>`;
}

function actionButtons(rows, annotations) {
  const names = rows.map((r) => plain(r[0])).filter((x) => x && !/^\(/.test(x));
  const shown = names.length ? names.slice(0, 4) : ['조회'];
  return shown.map((name, i) => {
    const row = rows.find((candidate) => plain(candidate[0]) === name) ?? [];
    const detail = plain(row.slice(1).filter(Boolean).join(' · ')) || '현재 조건으로 업무 동작을 수행한다.';
    return `<button class="btn ${i === 0 ? 'sm' : 'ghost sm'}">${html(name)}${annotations.badge(`<b>${html(name)}</b> 버튼 — ${html(detail)}`)}</button>`;
  }).join('');
}

function detailTitle(table, fallback) {
  return plain(table?.heading || '').replace(/^\d+(?:-\d+)?\.?\s*/, '') || fallback;
}

/** 메뉴얼 그림의 캡션이 특정 탭·상세를 말하면 그 표를 고른다. */
function detailFor(columns, caption) {
  const details = columns.slice(1);
  const words = plain(caption).split(/\s+/).filter((w) => w.length >= 2);
  const scored = details.map((table) => {
    const heading = detailTitle(table, '');
    return { table, score: words.filter((word) => heading.includes(word)).length };
  });
  return scored.sort((a, b) => b.score - a.score)[0]?.table ?? details[0];
}

/**
 * 요건서의 표를 화면 구조로 옮긴다.
 *
 * 컬럼 목록을 일반적인 "이름·상태"로 바꾸면 목업이 가장 중요한 계약을 잃는다. 그래서
 * §2 조회조건·§4 컬럼·§5 버튼을 그대로 읽고, 마스터-디테일이면 두 표와 스플리터를 낸다.
 */
function screenSketch(title, type, model, key, caption, manualKey) {
  const attrs = ` id="${key}"${manualKey ? ` data-manual="${key}"` : ''}`;
  const captionLine = caption ? ` · ${html(caption)}` : '';
  const isEmpty = /0건|없|미등록|미매핑|빈/.test(caption);
  const emptyMessage = isEmpty ? caption : '';
  const annotations = annotator(key);
  const described = (screen) => `${screen}\n${annotations.render()}`;
  if (/대시보드/.test(type) && !model.columns.length) {
    return described(`<div class="screen leaf"${attrs}>
  <div class="bar">${html(title)}${captionLine} — 요건서 기반 화면 배치</div>
  <div class="body">
    <div class="bc"><span class="path"><b>${html(title)}</b></span><button class="btn ghost">기간${annotations.badge('<b>기간</b> — 대시보드 집계 기준 기간을 선택한다.')}</button></div>
    <div class="row" style="margin-bottom:12px"><div class="grp" style="flex:1"><b>요약${annotations.badge('<b>요약</b> — 현재 업무 상태의 핵심 지표를 보여준다.')}</b><div class="item"><span>현재 상태</span><b>—</b></div></div><div class="grp" style="flex:1"><b>집계</b><div class="item"><span>조회 결과</span><b>—</b></div></div></div>
    <div class="tb"><span class="ttl">현황</span><span class="cnt">요건서의 데이터가 여기에 표시됩니다</span></div>
    <div class="grid"><table><thead><tr><th>구분</th><th>값</th><th>기준 시각</th></tr></thead><tbody><tr><td>표시 데이터</td><td>—</td><td>—</td></tr></tbody></table></div>
  </div>
</div>`);
  }
  if (/폼|로그인|팝업|모달|설정/.test(type) && !model.columns.length) {
    return described(`<div class="screen shell"${attrs}>
  <div class="body"><div class="modal"><div class="mh">${html(title)}<span class="x">×</span></div><div class="mb">
    <div class="f"><label>입력 항목${annotations.badge('<b>입력 항목</b> — 요건서의 입력·검증 규칙을 적용한다.')}</label><input value="" placeholder="요건서에 정의한 값을 입력합니다" /></div>
    <div class="f ro"><label>조회 항목</label><input value="읽기 전용 값" readonly /></div>
  </div><div class="mf"><span>${caption ? html(caption) : '기본 상태'}</span><span class="row"><button class="btn ghost sm">취소</button><button class="btn sm">확인${annotations.badge('<b>확인</b> — 입력값을 검증한 뒤 저장하거나 다음 단계로 진행한다.')}</button></span></div></div></div>
</div>`);
  }
  const first = model.columns[0];
  const second = detailFor(model.columns, caption);
  if (first) {
    const search = model.search.length
      ? model.search.map((row) => searchControl(row, annotations)).join('')
      : `<label>조회 조건${annotations.badge('<b>조회 조건</b> — 입력값으로 목록을 다시 조회한다.')}</label><input placeholder="검색어" />`;
    const actions = actionButtons(model.actions, annotations);
    const master = grid(detailTitle(first, `${title} 목록`), first, annotations, { empty: emptyMessage, selected: model.masterDetail && !isEmpty });
    const tabs = model.columns.length > 2
      ? `<div class="tabs">${model.columns.slice(1).map((table) => `<span class="${table === second ? 'on' : ''}">${html(detailTitle(table, '상세'))}${annotations.badge(`<b>${html(detailTitle(table, '상세'))}</b> 탭 — 선택한 상위 행의 상세 데이터를 표시한다.`)}</span>`).join('')}</div>`
      : '';
    const detail = second
      ? `${model.vertical ? '<div class="split"><span class="arw">⌃</span><span class="hnd">⋮⋮⋮</span><span class="arw">⌄</span></div>' : ''}${tabs}${grid(detailTitle(second, '상세'), second, annotations, { empty: model.masterDetail ? '위 목록에서 행을 선택하면 상세가 표시됩니다' : '' })}`
      : '';
    return described(`<div class="screen leaf"${attrs}>
  <div class="bar">${html(title)}${captionLine} — 요건서의 조회조건·컬럼·버튼을 반영한 화면</div>
  <div class="body">
    <div class="bc"><span class="path"><b>${html(title)}</b></span></div>
    <div class="sf">${search}<span class="act">${actions}</span></div>
    ${master}
    ${detail}
  </div>
</div>`);
  }
  return described(`<div class="screen leaf"${attrs}>
  <div class="bar">${html(title)}${captionLine} — 요건서 기반 화면 배치</div>
  <div class="body">
    <div class="bc"><span class="path"><b>${html(title)}</b></span></div>
    <div class="sf"><label>조회 조건${annotations.badge('<b>조회 조건</b> — 입력값으로 목록을 조회한다.')}</label><input placeholder="검색어" /><label>상태</label><select><option>전체</option></select><span class="act"><button class="btn sm">조회${annotations.badge('<b>조회</b> — 현재 조건으로 데이터를 조회한다.')}</button></span></div>
    <div class="tb"><span class="ttl">${html(title)} 목록</span><span class="cnt">0건</span><button class="btn ghost sm">새로고침</button></div>
    <div class="grid"><table><thead><tr><th>이름</th><th>상태</th><th>변경일시</th></tr></thead><tbody><tr><td>표시 데이터</td><td>—</td><td>—</td></tr></tbody></table></div>
    <div class="pg"><span>총 <b>0</b>건</span><span class="nav">‹ 1 ›</span><span class="size">50건</span></div>
  </div>
</div>`);
}

// ── 골격 ────────────────────────────────────────────────────────────
function scaffold(dir) {
  const md = read(path.join(SCREENS, dir, 'requirements.md'));
  if (!md) {
    console.error(`요건서가 없다: documents/screen/${dir}/requirements.md`);
    process.exit(2);
  }
  const title = (md.match(/^#\s*요건 정의서\s*—\s*(.+)$/m) || [, dir])[1].trim();
  const rows = meta(md);
  const pathRow = rows.find((r) => /페이지 경로|라우트|자리/.test(r[0]));
  const where = pathRow ? pathRow[1] : `/${dir}`;
  const typeRow = rows.find((r) => /화면 유형/.test(r[0]));
  const type = typeRow ? typeRow[1] : '';
  const model = screenModel(md, type);
  const tc = testcases(md);
  const keys = manualKeys(dir);
  const open = section(md, /미결/);

  const L = [];
  L.push('<!doctype html>');
  L.push('<meta charset="utf-8">');
  L.push(`<title>목업 · ${title} (${where.replace(/[`]/g, '')})</title>`);
  L.push(styleBlock());
  L.push('');
  L.push('<main>');
  L.push('');
  L.push('<!--');
  L.push('  이 파일은 생성물이다 — `/mockup` 이 requirements.md 에서 만든다.');
  L.push('  결정도 테스트 케이스도 요건서가 갖는다. 여기서 고치면 다음 생성에서 사라진다.');
  L.push('-->');
  L.push('');
  L.push(`<h1>${html(title)}</h1>`);
  L.push('<div class="head">');
  L.push('  <dl>');
  for (const [k, v] of rows) L.push(`    <dt>${html(k)}</dt><dd>${html(v)}</dd>`);
  L.push('    <dt>요건서</dt><dd><a href="requirements.md">requirements.md</a></dd>');
  if (read(path.join(SCREENS, dir, 'manual.md'))) {
    L.push('    <dt>메뉴얼</dt><dd><a href="manual.md">manual.md</a></dd>');
  }
  L.push('  </dl>');
  L.push('</div>');
  L.push('');
  const figures = model.figures.length ? model.figures : keys.length ? keys : [{ key: 'main', caption: '기본 상태' }];
  const renderFigure = (figure) => model.figures.length
    ? declaredScreen(title, model, figure, { annotator, plain, searchControl, manualKey: keys.some((k) => k.key === figure.key) })
    : screenSketch(title, type, model, figure.key, figure.caption, keys.length > 0);
  if (model.figures.length) L.push(`<nav>${figures.map((f) => `<a href="#${f.key}">${html(f.caption)}</a>`).join(' · ')}</nav>`);
  L.push('<h2>1. 기본 상태</h2>');
  L.push(renderFigure(figures[0]));
  L.push('');
  L.push('<h2>2. 상태가 갈리는 자리</h2>');
  for (const figure of figures.slice(1)) {
    L.push(`<h3>${html(figure.caption)}</h3>`);
    L.push(renderFigure(figure));
    L.push('');
  }
  if (figures.length === 1) L.push('<p class="notes">추가 상태는 요건서의 예외·검증 규칙을 구체화한 뒤 이 자리에 그린다.</p>');
  L.push('');

  // ── 테스트 케이스 — 요건서에서 그대로 옮긴다 ──
  const n = 3;
  L.push(`<h2>${n}. 테스트 케이스 — 위 화면들의 주장을 전부 덮는다</h2>`);
  L.push('');
  L.push('<p style="font-size:12.5px;margin:0 0 10px">');
  L.push(`  <b>이 표는 요건서 §${tc?.number ?? '?'} 를 그대로 옮긴 것이다</b> — 고칠 곳은 요건서다.`);
  L.push('  <b>화면은 <i>"왜 이렇게 그렸는가"</i> 를 말하고 여기는 <i>"그것이 지켜졌는가"</i> 를 묻는다.</b>');
  L.push('</p>');
  L.push('');
  for (const g of tc?.groups ?? []) {
    L.push(`<h3>${html(g.title)}</h3>`);
    L.push('<table>');
    L.push('  <thead><tr><th>#</th><th>조작 · 상황</th><th>기대</th></tr></thead>');
    L.push('  <tbody>');
    for (const r of g.rows) {
      L.push(`    <tr><td class="c">${html(r[0]).replace(/<\/?code>/g, '')}</td><td>${html(r[1])}</td><td>${html(r[2])}</td></tr>`);
    }
    L.push('  </tbody>');
    L.push('</table>');
    L.push('');
  }

  // ── 확인 목록 — 요건서의 미결을 그대로 보인다 ──
  L.push(`<h2>${n + 1}. 이 목업으로 확인할 것</h2>`);
  L.push('');
  L.push('<div class="todo">');
  L.push('  <b>결정하면 요건서에 적는다. 이 파일이 아니라.</b>');
  const items = (open?.body ?? '').split('\n').filter((l) => /^[-*] /.test(l));
  if (items.length) {
    L.push('  <ul>');
    for (const it of items) L.push(`    <li>${html(it.replace(/^[-*]\s*/, ''))}</li>`);
    L.push('  </ul>');
  } else {
    L.push('  <p style="margin:6px 0 0">요건서의 미결이 없다 — 확인할 갈림이 남아 있지 않다.</p>');
  }
  L.push('</div>');
  L.push('');
  L.push('<footer>');
  L.push('  <b>이 파일은 생성물이다</b> — <code>/mockup</code> 이 <code>requirements.md</code> 에서 만든다.');
  L.push('  결정과 테스트 케이스는 요건서가 갖고 여기는 확인용이다. 손으로 고치면 다음 생성에서 사라진다.<br>');
  L.push('  정적 HTML, 프레임워크 없음, 픽셀 충실도는 목표가 아니다.');
  L.push('</footer>');
  L.push('');
  L.push('</main>');
  if (model.figures.length || model.columns.some((t) => t.rows.some((r) => r.includes('검색콤보')))) L.push(searchComboScript());
  L.push('');
  return L.join('\n');
}

// ── 검사 ────────────────────────────────────────────────────────────
function check(dir) {
  const problems = [];
  const mockPath = path.join(SCREENS, dir, 'mockup.html');
  const mock = read(mockPath);
  const md = read(path.join(SCREENS, dir, 'requirements.md'));
  if (!mock) {
    // 목업이 없는 것은 결손이 아니다 — 파생물이라 없는 것이 정상이다(CLAUDE.md §4-5).
    // 다만 메뉴얼이 그림을 부르고 있으면 그때는 만들어야 한다.
    const want = manualKeys(dir);
    return want.length
      ? [MISSING_NEEDED, `메뉴얼이 그림 ${want.length}장을 부른다 — /mockup 으로 먼저 만든다`]
      : [MISSING_OK];
  }

  if (!/<div\b[^>]*class="[^"]*\bscreen\b[^"]*"/i.test(mock)) {
    problems.push('화면 블록이 없다 — 공용 스타일·테스트 표만으로는 목업이 아니다');
  }

  // 화면 안의 번호 배지와 하단 상세 설명은 정확히 1:1이어야 한다.
  const badgeIds = [...mock.matchAll(/data-note="([\w-]+)"/g)].map((m) => m[1]);
  const noteIds = [...mock.matchAll(/\bid="note-([\w-]+)"/g)].map((m) => m[1]);
  if (!badgeIds.length) problems.push('화면 요소를 설명하는 번호 배지가 없다');
  for (const id of badgeIds) if (!noteIds.includes(id)) problems.push(`번호 배지 ${id}의 하단 설명이 없다`);
  for (const id of noteIds) if (!badgeIds.includes(id)) problems.push(`하단 설명 ${id}을 가리키는 화면 번호 배지가 없다`);
  if (new Set(badgeIds).size !== badgeIds.length) problems.push('같은 data-note 번호 배지가 중복됐다');
  if (new Set(noteIds).size !== noteIds.length) problems.push('같은 하단 설명 id가 중복됐다');

  // ① 화면 계약의 핵심인 컬럼 이름은 목업에서도 그대로 보여야 한다. 일반적인
  // "이름·상태" 헤더로 바뀌면 화면 구조가 맞아 보여도 실제 업무 화면은 틀린다.
  if (md) {
    const type = meta(md).find((r) => /화면 유형/.test(r[0]))?.[1] ?? '';
    const model = screenModel(md, type);
    const expected = model.columns.flatMap((t) => t.rows.map(columnLabel));
    const shown = [...mock.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)]
      .map((m) => plain(m[1].replace(/<[^>]+>/g, '')));
    shown.push(...[...mock.matchAll(/data-field-label="([^"]+)"/g)].map((m) => m[1]));
    for (const figure of model.figures) {
      if (!mock.includes(`id="${figure.key}"`)) problems.push(`요건서의 목업 상태 ${figure.key}가 없다`);
    }
    if (model.figures.length && !mock.includes(styleBlock())) problems.push('공통 목업 스타일이 서식과 다르다 — 재생성한다');
    const missingColumns = expected.filter((label) => !shown.some((head) => head.includes(label)));
    if (missingColumns.length) {
      problems.push(`요건서 컬럼이 목업 헤더에 없다 ${missingColumns.length}건: ${missingColumns.slice(0, 8).join(' · ')}`);
    }
  }

  // ② 메뉴얼이 부르는 그림 키와 짝이 맞나
  const want = manualKeys(dir).map((k) => k.key);
  const have = [...mock.matchAll(/data-manual="([\w-]+)"/g)].map((m) => m[1]);
  for (const k of want) if (!have.includes(k)) problems.push(`메뉴얼이 #${k} 를 부르는데 그 그림이 없다`);
  for (const k of have) if (!want.includes(k)) problems.push(`data-manual="${k}" 를 부르는 메뉴얼 줄이 없다`);

  // ③ 테스트 케이스가 요건서와 같은가 — 목업이 케이스를 몰래 늘리지 못하게 한다
  const tc = md ? testcases(md) : null;
  const wantIds = (tc?.groups ?? []).flatMap((g) => g.rows.map((r) => r[0].replace(/`/g, '')));
  const haveIds = [...mock.matchAll(/<td class="c">([^<]+)<\/td>/g)].map((m) => m[1].trim());
  const missing = wantIds.filter((x) => !haveIds.includes(x));
  const extra = haveIds.filter((x) => !wantIds.includes(x));
  if (missing.length) problems.push(`요건서에 있고 목업에 없는 케이스 ${missing.length}건: ${missing.slice(0, 8).join(' ')}`);
  if (extra.length) problems.push(`목업에만 있는 케이스 ${extra.length}건: ${extra.slice(0, 8).join(' ')} — 요건서로 옮긴다`);

  // ④ 한 파일로 완결되나
  if (/<link[^>]+rel=["']?stylesheet/i.test(mock)) problems.push('외부 스타일시트를 부른다 — 한 파일로 완결해야 한다');
  if (/<script[^>]+src=/i.test(mock)) problems.push('외부 스크립트를 부른다 — 한 파일로 완결해야 한다');
  if (/<img[^>]+src=["']?https?:/i.test(mock)) problems.push('외부 이미지를 부른다 — 한 파일로 완결해야 한다');

  // ⑤ 생성물임을 밝히나
  if (!/생성물이다/.test(mock)) problems.push('생성물 표식이 없다 — 손편집을 부른다');
  return problems;
}

// ── 진입 ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--list')) {
  const all = allScreens();
  console.log(`${'화면'.padEnd(34)} 요건서  목업  메뉴얼  그림키`);
  for (const s of all) {
    const has = (f) => (fs.existsSync(path.join(SCREENS, s, f)) ? '  ●  ' : '  ·  ');
    console.log(`${s.padEnd(34)}${has('requirements.md')}${has('mockup.html')}${has('manual.md')}   ${manualKeys(s).length || '·'}`);
  }
  console.log(`\n화면 ${all.length}`);
  process.exit(0);
}

if (args.includes('--check')) {
  const rest = args.filter((a) => a !== '--check');
  const targets = rest.length ? rest.map(resolveScreen) : allScreens();
  let bad = 0;
  let none = 0;
  const needed = [];
  for (const s of targets) {
    const ps = check(s);
    if (ps[0] === MISSING_OK) {
      none++;
      if (rest.length) console.log(`· ${s} — 목업이 없다. 파생물이라 정상이며 메뉴얼도 그림을 부르지 않는다`);
      continue;
    }
    if (ps[0] === MISSING_NEEDED) {
      none++;
      needed.push(s);
      console.log(`△ ${s} — ${ps[1]}`);
      continue;
    }
    if (!ps.length) {
      if (rest.length) console.log(`● ${s} — 이상 없다`);
      continue;
    }
    bad++;
    console.log(`★ ${s}`);
    for (const p of ps) console.log(`    ${p}`);
  }
  const have = targets.length - none;
  console.log(`
화면 ${targets.length} — 목업 있음 ${have}(어긋남 ${bad}) · 없음 ${none}`);
  if (needed.length) {
    console.log(`△ 메뉴얼이 그림을 부르는데 목업이 없는 화면 ${needed.length} — /manual-site 앞에 만든다`);
  }
  console.log('목업이 없는 것은 결손이 아니다 — 요건서에서 언제든 만든다(CLAUDE.md §4-5).');
  process.exit(bad ? 1 : 0);
}

if (args.includes('--write')) {
  const rest = args.filter((a) => a !== '--write');
  if (rest.length !== 1) {
    console.error('--write 는 화면 하나만 받는다. 생성 내용을 확인한 뒤 화면별로 기록한다.');
    process.exit(2);
  }
  const dir = resolveScreen(rest[0]);
  fs.writeFileSync(path.join(SCREENS, dir, 'mockup.html'), scaffold(dir), 'utf8');
  console.log(`목업 생성 — documents/screen/${dir}/mockup.html`);
  process.exit(0);
}

if (!args.length) {
  console.error('화면을 하나 받는다. --list 로 목록을, --check 로 검사를 한다.');
  process.exit(2);
}
process.stdout.write(scaffold(resolveScreen(args[0])));
