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
  L.push('<!-- ══════════════════════════════════════════════════════════════');
  L.push('     여기서부터 그림이다 — AI 가 그린다. 아래 지시를 지운 뒤 채운다.');
  L.push('');
  L.push('     ① 요건서 §1 화면 구성의 배치를 그대로 옮긴다.');
  L.push('     ② 상태가 갈리는 자리를 각각 그린다 — 빈 · 잠긴 · 편집 중 · 검증 실패 · 권한 없음.');
  L.push('     ③ 그리드 어휘 다섯만 쓴다 — .sf .tb .grid .pg .split');
  L.push('     ④ 외부 CSS·JS·이미지·프레임워크를 쓰지 않는다. 한 파일로 완결된다.');
  if (keys.length) {
    L.push('');
    L.push('     ⑤ 메뉴얼이 부르는 그림에 data-manual 키를 단다. 아래가 그 전부이며');
    L.push('        하나라도 없으면 /manual-site 가 보고한다. 키 없는 블록은 그림이 아니다:');
    for (const { key, caption } of keys) L.push(`          data-manual="${key}"   ← ${caption}`);
  } else {
    L.push('');
    L.push('     ⑤ 메뉴얼이 부르는 그림이 없다 — data-manual 키를 달지 않는다.');
  }
  L.push('     ══════════════════════════════════════════════════════════════ -->');
  L.push('');
  L.push('<h2>1. 기본 상태</h2>');
  L.push('');
  L.push('<h2>2. 상태가 갈리는 자리</h2>');
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

  // ① 메뉴얼이 부르는 그림 키와 짝이 맞나
  const want = manualKeys(dir).map((k) => k.key);
  const have = [...mock.matchAll(/data-manual="([\w-]+)"/g)].map((m) => m[1]);
  for (const k of want) if (!have.includes(k)) problems.push(`메뉴얼이 #${k} 를 부르는데 그 그림이 없다`);
  for (const k of have) if (!want.includes(k)) problems.push(`data-manual="${k}" 를 부르는 메뉴얼 줄이 없다`);

  // ② 테스트 케이스가 요건서와 같은가 — 목업이 케이스를 몰래 늘리지 못하게 한다
  const tc = md ? testcases(md) : null;
  const wantIds = (tc?.groups ?? []).flatMap((g) => g.rows.map((r) => r[0].replace(/`/g, '')));
  const haveIds = [...mock.matchAll(/<td class="c">([^<]+)<\/td>/g)].map((m) => m[1].trim());
  const missing = wantIds.filter((x) => !haveIds.includes(x));
  const extra = haveIds.filter((x) => !wantIds.includes(x));
  if (missing.length) problems.push(`요건서에 있고 목업에 없는 케이스 ${missing.length}건: ${missing.slice(0, 8).join(' ')}`);
  if (extra.length) problems.push(`목업에만 있는 케이스 ${extra.length}건: ${extra.slice(0, 8).join(' ')} — 요건서로 옮긴다`);

  // ③ 한 파일로 완결되나
  if (/<link[^>]+rel=["']?stylesheet/i.test(mock)) problems.push('외부 스타일시트를 부른다 — 한 파일로 완결해야 한다');
  if (/<script[^>]+src=/i.test(mock)) problems.push('외부 스크립트를 부른다 — 한 파일로 완결해야 한다');
  if (/<img[^>]+src=["']?https?:/i.test(mock)) problems.push('외부 이미지를 부른다 — 한 파일로 완결해야 한다');

  // ④ 생성물임을 밝히나
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

if (!args.length) {
  console.error('화면을 하나 받는다. --list 로 목록을, --check 로 검사를 한다.');
  process.exit(2);
}
process.stdout.write(scaffold(resolveScreen(args[0])));
