/**
 * 세 고객 제출 사이트를 하나의 오프라인 폴더로 조립한다.
 * 외부 CDN 없이 file://에서 트리·검색·테마·전체 인쇄가 동작한다.
 */
import {
  copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync,
  rmSync, statSync, writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseYaml } from '../../hooks/lib.mjs';
import { FIGURE_LINE, escapeHtml, renderMarkdown } from '../manual-site/lib/markdown.mjs';
import { MAIN, figuresOf } from '../manual-site/lib/figure.mjs';
import { menuTree, read as readRepo, REPO, screensOf } from '../manual-site/lib/menu.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(REPO, 'build/deliverables');
const ASSET_SOURCE = resolve(REPO, 'aidd-guide/artifact/site-kit/assets');
const args = process.argv.slice(2);
const mode = args.find((arg) => !arg.startsWith('--')) ?? 'all';
const release = args.includes('--release');
const pdf = args.includes('--pdf');
const validModes = new Set(['all', 'design', 'user', 'operations']);
if (!validModes.has(mode)) {
  console.error(`대상은 all · design · user · operations 중 하나다 — 받은 값: ${mode}`);
  process.exit(2);
}

const config = parseYaml(readFileSync(resolve(REPO, 'documents/delivery.yaml'), 'utf8'));
const siteConfig = new Map((config.sites ?? []).map((site) => [site.key, site]));
const screenSpec = parseYaml(readFileSync(resolve(REPO, 'documents/spec/60-screens.yaml'), 'utf8'));
const specScreens = screenSpec.screens ?? [];
const byRoute = new Map(specScreens.filter((screen) => screen.route).map((screen) => [screen.route, screen]));
const byDoc = new Map(specScreens.filter((screen) => screen.current_doc).map((screen) => [norm(screen.current_doc), screen]));
const issues = [];
const sourceFiles = new Set(['documents/delivery.yaml', 'documents/spec/60-screens.yaml']);
const mockups = {};
const captureRows = [];

if (!/^DLV-\d{3}$/.test(config.meta?.id ?? '')) {
  issues.push({ site: 'all', level: 'error', message: `잘못된 제출 구성 ID: ${config.meta?.id ?? '(없음)'}` });
}
const siteIds = new Set();
for (const site of config.sites ?? []) {
  if (!/^SITE-\d{3}$/.test(site.id ?? '')) issues.push({ site: 'all', level: 'error', message: `잘못된 사이트 ID: ${site.id ?? '(없음)'}` });
  if (siteIds.has(site.id)) issues.push({ site: 'all', level: 'error', message: `중복 사이트 ID: ${site.id}` });
  siteIds.add(site.id);
}
for (const key of validModes) {
  if (key !== 'all' && !siteConfig.has(key)) issues.push({ site: 'all', level: 'error', message: `사이트 구성이 없다: ${key}` });
}

function norm(value) { return String(value).replace(/\\/g, '/').replace(/^\.\//, ''); }
function repoPath(path) { return resolve(REPO, path); }
function read(path) { sourceFiles.add(norm(path)); return readFileSync(repoPath(path), 'utf8'); }
function exists(path) { return existsSync(repoPath(path)); }
function ensure(path) { mkdirSync(path, { recursive: true }); }
function write(path, content) { ensure(dirname(path)); writeFileSync(path, content, 'utf8'); }
function slug(value) {
  return String(value).normalize('NFKD').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
}
function walk(path, suffix = '.md') {
  const root = repoPath(path);
  if (!existsSync(root)) return [];
  const out = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith(suffix)) out.push(norm(relative(REPO, full)));
    }
  };
  visit(root);
  return out.sort((a, b) => a.localeCompare(b, 'ko'));
}
function stripFrontmatter(markdown) {
  return markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '').replace(/<!--\s*이 문서는 생성물입니다[\s\S]*?-->/, '');
}
function titleOf(markdown, fallback) {
  return stripFrontmatter(markdown).match(/^#\s+(.+)$/m)?.[1]?.replace(/[*`]/g, '') ?? fallback;
}
function sourceMeta(path, extra = []) {
  if (release) return '';
  return `<div class="source-meta review-only"><span>원본 ${escapeHtml(path)}</span>${extra.map((v) => `<span>${escapeHtml(v)}</span>`).join('')}</div>`;
}
function screenFor(doc, route) { return byDoc.get(norm(doc)) ?? byRoute.get(route) ?? null; }
function screenIdentity(meta, menu) { return meta?.id ?? `UNMAPPED-${menu?.code ?? slug(menu?.url ?? 'screen')}`; }
function captureName(key) { return key === MAIN ? 'screen.png' : `screen-${key}.png`; }
function captureSource(url, key) { return `documents/screen${url}/${captureName(key)}`; }

function collectSharedMockups() {
  for (const file of walk('documents/screen', 'mockup.html')) {
    const folder = norm(dirname(file)).replace(/^documents\/screen/, '');
    const req = `${norm(dirname(file))}/requirements.md`;
    const meta = byDoc.get(req) ?? byRoute.get(folder) ?? null;
    const screenId = screenIdentity(meta, { url: folder, code: slug(folder) });
    const { figures, style } = figuresOf(folder, 'mockup');
    for (const [key, figure] of figures) mockups[`${screenId}/${key}`] = { html: figure.html, style };
  }
}

function copyShot(screenId, key, file) {
  const extension = extname(file).toLowerCase();
  const relativeTarget = `assets/screens/${screenId}/${key}${extension}`;
  const target = resolve(OUT, relativeTarget);
  ensure(dirname(target));
  copyFileSync(repoPath(file), target);
  return `../${norm(relativeTarget)}`;
}

function figureMarkup({ site, screenId, screenTitle, url, key, caption, figure, index, total }) {
  const expected = captureSource(url, key);
  const state = figure?.kind === 'png' ? '실제 캡처' : '목업';
  captureRows.push({ site, screenId, screenTitle, key, expected, actual: figure?.kind === 'png' });
  if (!figure) {
    issues.push({ site, level: 'error', message: `${screenId}/${key}: 목업과 캡처가 모두 없다.` });
    return `<div class="delivery-empty">${escapeHtml(caption)} — 화면 그림이 없습니다.</div>`;
  }
  if (figure.file) sourceFiles.add(norm(figure.file));
  if (release && site === 'user' && figure.kind !== 'png') {
    issues.push({ site, level: 'error', message: `${screenId}/${key}: 제출 모드인데 실제 캡처 ${expected}가 없다.` });
  }
  const visual = figure.kind === 'png'
    ? `<img src="${escapeHtml(copyShot(screenId, key, figure.file))}" alt="${escapeHtml(caption)}">`
    : `<div class="mockwrap" data-mockup-body></div>`;
  const mockupAttr = figure.kind === 'mockup' ? ` data-mockup="${escapeHtml(`${screenId}/${key}`)}"` : '';
  const note = release ? '' : `<div class="review-note review-only">
<b>${escapeHtml(screenId)} · 그림 ${index}/${total} · ${escapeHtml(key)}</b><br>
현재 출처: <span class="${figure.kind === 'png' ? 'capture-ok' : 'capture-pending'}">${state}</span><br>
대체 파일: <code>${escapeHtml(expected)}</code>
</div>`;
  return `<figure class="shot ${figure.kind === 'mockup' ? 'mock' : 'capture'}"${mockupAttr}>
${visual}
<figcaption>${escapeHtml(caption)}${figure.kind === 'mockup' ? ' — 배치를 보이는 목업입니다.' : ''}</figcaption>
${note}
</figure>`;
}

function markdownChapter({ id, group, path, title, extraHtml = '', markdown }) {
  const source = markdown ?? read(path);
  return { id, group, path, title: title ?? titleOf(source, path), markdown: source, extraHtml };
}

function designChapters() {
  const chapters = [];
  for (const path of walk('documents/generated')) {
    if (path.endsWith('/_index.md') || path.includes('/80-운영런북') || path.endsWith('80-운영런북.md')) continue;
    chapters.push(markdownChapter({ id: `design-${slug(path)}`, group: '생성 설계·검증 문서', path }));
  }
  for (const path of walk('documents/design')) {
    chapters.push(markdownChapter({ id: `detail-${slug(path)}`, group: '상세 설계', path }));
  }
  for (const path of walk('documents/screen').filter((value) => value.endsWith('/requirements.md'))) {
    if (release && path.includes('/sample/')) continue;
    const meta = byDoc.get(norm(path));
    const folder = norm(dirname(path)).replace(/^documents\/screen/, '');
    const screenId = screenIdentity(meta, { url: folder, code: slug(folder) });
    const { figures } = figuresOf(folder, 'mockup');
    const visuals = [...figures].map(([key, figure], index) => figureMarkup({
      site: 'design', screenId, screenTitle: meta?.title ?? titleOf(read(path), path), url: folder,
      key, caption: `${meta?.title ?? screenId} — ${key}`, figure, index: index + 1, total: figures.size,
    })).join('\n');
    chapters.push(markdownChapter({
      id: `screen-${slug(screenId)}`, group: `화면 요건·목업 · ${meta?.module ?? '기타'}`, path,
      title: `${screenId} ${meta?.title ?? titleOf(read(path), '')}`,
      extraHtml: `<h2>화면 목업</h2>${visuals || '<div class="delivery-empty">생성된 목업이 없습니다.</div>'}`,
    }));
  }
  return chapters;
}

function userChapters() {
  for (const path of walk('sources/backend/bootstrap/src/main/resources/db/changelog/data', '.csv')) {
    if (path.endsWith('/003-init-menu.csv') || path.endsWith('-init-message.csv')) sourceFiles.add(path);
  }
  const { roots } = menuTree();
  const chapters = [];
  for (const menu of screensOf(roots)) {
    if (release && menu.url.startsWith('/sample')) continue;
    const path = `documents/screen${menu.url}/manual.md`;
    if (!exists(path)) {
      issues.push({ site: 'user', level: release ? 'error' : 'warning', message: `${menu.url}: manual.md가 없다.` });
      continue;
    }
    const meta = byRoute.get(menu.url) ?? byDoc.get(`documents/screen${menu.url}/requirements.md`);
    const screenId = screenIdentity(meta, menu);
    const source = read(path);
    const mockupOnly = figuresOf(menu.url, 'mockup').figures;
    const actual = figuresOf(menu.url, 'auto').figures;
    const requested = [...source.matchAll(new RegExp(FIGURE_LINE.source, 'gm'))].map((match) => ({ caption: match[1], key: match[2] }));
    const slots = requested.length ? requested : [{ caption: menu.name, key: MAIN }];
    let slot = 0;
    const html = renderMarkdown(stripFrontmatter(source), {
      figure: (key, caption) => {
        slot += 1;
        return figureMarkup({ site: 'user', screenId, screenTitle: menu.name, url: menu.url, key, caption,
          figure: actual.get(key) ?? mockupOnly.get(key), index: slot, total: slots.length });
      },
    });
    let body = html;
    if (requested.length === 0) {
      const figure = actual.get(MAIN) ?? mockupOnly.get(MAIN);
      const visual = figureMarkup({ site: 'user', screenId, screenTitle: menu.name, url: menu.url, key: MAIN,
        caption: menu.name, figure, index: 1, total: 1 });
      body = `${visual}\n${html}`;
    }
    const declared = new Set(requested.map((item) => item.key));
    for (const key of mockupOnly.keys()) {
      if (requested.length && !declared.has(key)) issues.push({ site: 'user', level: 'warning', message: `${screenId}/${key}: 목업 그림을 manual.md가 부르지 않는다.` });
    }
    chapters.push({
      id: `manual-${slug(screenId)}`, group: menu.path.slice(0, -1).join(' › ') || '사용자 메뉴얼', path,
      title: `${screenId} ${menu.name}`, markdown: null, rendered: body,
    });
  }
  if (!release && captureRows.length) {
    const rows = captureRows.filter((row) => row.site === 'user').map((row) =>
      `<tr><td>${row.actual ? '✅' : '◇'}</td><td>${escapeHtml(row.screenId)}</td><td>${escapeHtml(row.screenTitle)}</td><td><code>${escapeHtml(row.key)}</code></td><td><code>${escapeHtml(row.expected)}</code></td></tr>`).join('');
    chapters.unshift({ id: 'capture-status', group: '검토', path: 'generated:capture-status', title: '실제 화면 캡처 현황', markdown: null,
      rendered: `<h1>실제 화면 캡처 현황</h1><p>◇는 현재 목업이며 표시된 파일을 넣고 다시 생성하면 같은 자리가 실제 화면으로 바뀝니다.</p><table class="capture-summary"><thead><tr><th>상태</th><th>화면 ID</th><th>화면</th><th>그림 키</th><th>대체 파일</th></tr></thead><tbody>${rows}</tbody></table>` });
  }
  return chapters;
}

function operationsChapters() {
  const chapters = [];
  const runbook = 'documents/generated/80-운영런북.md';
  if (exists(runbook)) chapters.push(markdownChapter({ id: 'operations-runbook', group: '고객 환경 운영 런북', path: runbook }));
  for (const path of walk('developer-guide')) {
    chapters.push(markdownChapter({ id: `developer-${slug(path)}`, group: '구축·개발·배포·운영 안내', path }));
  }
  return chapters;
}

function rewriteLinks(markdown, from, mapping) {
  return stripFrontmatter(markdown).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (whole, label, target) => {
    if (/^(https?:|mailto:|#)/.test(target) || /mockup\.html#/.test(target)) return whole;
    const [file] = target.split('#');
    const resolved = norm(relative(REPO, resolve(dirname(repoPath(from)), file)));
    if (mapping.has(resolved)) return `[${label}](#${mapping.get(resolved)})`;
    return `${label} (\`${target}\`)`;
  });
}

function renderSite(key, chapters) {
  const cfg = siteConfig.get(key) ?? { title: key, description: '' };
  const mapping = new Map(chapters.filter((chapter) => !chapter.path.startsWith('generated:')).map((chapter) => [norm(chapter.path), chapter.id]));
  const groups = new Map();
  for (const chapter of chapters) {
    if (!groups.has(chapter.group)) groups.set(chapter.group, []);
    groups.get(chapter.group).push(chapter);
  }
  const tree = [...groups].map(([group, items]) => `<li><button class="tnode group" data-tree-group type="button" aria-expanded="true"><svg class="icon chev"><use href="#i-chevron-down"/></svg><span class="label">${escapeHtml(group)}</span></button><ul>${items.map((chapter) => `<li><button class="tnode empty-chev" data-page-link="${chapter.id}" type="button"><span class="label">${escapeHtml(chapter.title)}</span></button></li>`).join('')}</ul></li>`).join('');
  const bodies = chapters.map((chapter) => {
    const body = chapter.rendered ?? renderMarkdown(rewriteLinks(chapter.markdown, chapter.path, mapping));
    return `<section class="delivery-page" data-page id="${chapter.id}" hidden><article>${sourceMeta(chapter.path)}${body}${chapter.extraHtml ?? ''}</article></section>`;
  }).join('\n');
  const html = `<!doctype html>
<html lang="ko"${release ? ' class="release"' : ''}>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escapeHtml(cfg.title)}</title>
<link rel="stylesheet" href="../assets/guide.css"><link rel="stylesheet" href="../assets/delivery.css">
<script src="../assets/icons.js" defer></script><script src="../assets/mockups.js" defer></script><script src="../assets/delivery.js" defer></script></head>
<body class="${release ? 'release' : 'review'}"><header class="topbar"><button class="icon-btn menu-toggle" data-menu-toggle type="button" aria-label="목차 열기" aria-expanded="false"><svg class="icon"><use href="#i-menu"/></svg></button><a class="brand" href="../index.html"><span class="logo"><svg class="icon sm"><use href="#i-book-open"/></svg></span><span>${escapeHtml(cfg.title)}</span></a><div class="spacer"></div><div class="site-actions"><button data-print-all type="button">전체 인쇄·PDF</button><button data-theme-toggle type="button" aria-label="밝은 테마와 어두운 테마 전환">테마</button></div></header>
<div class="sidebar-backdrop"></div><div class="layout"><aside class="sidebar" id="sidebar"><div class="sb-head">목차</div><div class="sb-filter"><input data-tree-filter type="search" placeholder="제목·본문 검색"></div><nav class="tree"><ul>${tree}</ul></nav></aside><div class="main-wrap"><main class="content">${bodies || '<div class="delivery-empty">표시할 문서가 없습니다.</div>'}</main></div></div></body></html>`;
  write(resolve(OUT, key, 'index.html'), html);
}

function rootPage() {
  const cards = [...siteConfig.values()].map((site) => `<a class="delivery-home-card" href="${site.key}/index.html"><h2>${escapeHtml(site.title)}</h2><p>${escapeHtml(site.description)}</p></a>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>고객 제출 산출물</title><link rel="stylesheet" href="assets/guide.css"><link rel="stylesheet" href="assets/delivery.css"></head><body><main class="content"><article><h1>고객 제출 산출물</h1><p>인터넷 연결 없이 아래 세 사이트를 열람할 수 있습니다.</p><div class="delivery-home-grid">${cards}</div></article></main></body></html>`;
}

async function makePdf(keys) {
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch { throw new Error('--pdf는 선택 의존성 playwright와 chromium이 필요하다. HTML 제출본은 정상 생성됐다.'); }
  const browser = await chromium.launch({ headless: true });
  try {
    ensure(resolve(OUT, 'pdf'));
    for (const key of keys) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await page.goto(`${pathToFileURL(resolve(OUT, key, 'index.html')).href}?print=all`, { waitUntil: 'networkidle' });
      await page.pdf({ path: resolve(OUT, 'pdf', `${key}.pdf`), format: 'A4', printBackground: true });
      await page.close();
    }
  } finally { await browser.close(); }
}

const expectedRoot = `${resolve(REPO, 'build')}${sep}`;
if (!OUT.startsWith(expectedRoot)) throw new Error(`제출 폴더가 build 밖이다: ${OUT}`);
if (mode === 'all') rmSync(OUT, { recursive: true, force: true });
else rmSync(resolve(OUT, mode), { recursive: true, force: true });
ensure(resolve(OUT, 'assets'));
for (const asset of ['guide.css', 'icons.js', 'delivery.css', 'delivery.js']) copyFileSync(resolve(ASSET_SOURCE, asset), resolve(OUT, 'assets', asset));

collectSharedMockups();
write(resolve(OUT, 'assets/mockups.js'), `window.DELIVERY_MOCKUPS=${JSON.stringify(mockups).replace(/<\//g, '<\\/')};\n`);

const keys = mode === 'all' ? ['design', 'user', 'operations'] : [mode];
const makers = { design: designChapters, user: userChapters, operations: operationsChapters };
const allChapters = Object.fromEntries(keys.map((key) => [key, makers[key]()]));
for (const key of keys) renderSite(key, allChapters[key]);
write(resolve(OUT, 'index.html'), rootPage());

if (pdf) {
  try { await makePdf(keys); }
  catch (error) { issues.push({ site: 'all', level: 'error', message: error.message }); console.error(error.message); }
}

const selectedIssues = issues.filter((issue) => issue.site === 'all' || keys.includes(issue.site));
const manifest = {
  id: config.meta?.id ?? 'DLV-001', generatedAt: new Date().toISOString(), mode, release,
  sites: Object.fromEntries(keys.map((key) => [key, { chapters: allChapters[key].length }])),
  sources: [...sourceFiles].sort().map((path) => ({ path, sha256: createHash('sha256').update(readFileSync(repoPath(path))).digest('hex') })),
  issues: selectedIssues,
};
write(resolve(OUT, 'delivery-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
write(resolve(OUT, 'README.txt'), '고객 제출 산출물\r\n==================\r\nindex.html을 열면 인터넷 연결 없이 세 사이트를 볼 수 있습니다.\r\n각 사이트의 전체 인쇄·PDF 버튼으로 브라우저 PDF 저장을 사용할 수 있습니다.\r\n');

for (const issue of selectedIssues) console.log(`${issue.level === 'error' ? '오류' : '경고'}: ${issue.message}`);
console.log(`제출 사이트 ${keys.join(' · ')} — ${OUT}`);
for (const key of keys) console.log(`  ${key}: ${allChapters[key].length}장`);
const errors = issues.filter((issue) => issue.level === 'error' && (issue.site === 'all' || keys.includes(issue.site)));
if (errors.length) process.exitCode = 1;
