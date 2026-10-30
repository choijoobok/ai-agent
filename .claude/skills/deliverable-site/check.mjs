/** 생성된 오프라인 사이트의 구조와 로컬 자산을 검사한다. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseYaml } from '../../hooks/lib.mjs';
import { loadSpecSet } from '../../../aidd-guide/harness/runtime/spec-set.mjs';
import { menuNavigationErrors } from './lib/menu-order.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const rootArg = process.argv.slice(2).find((arg) => arg.startsWith('--root='))?.slice('--root='.length);
const ROOT = resolve(REPO, rootArg || 'build/deliverables');
const errors = [];
const manifestPath = resolve(ROOT, 'delivery-manifest.json');
const buildReadmePath = resolve(REPO, 'build/README.txt');
let manifest = null;

if (!existsSync(manifestPath)) errors.push('delivery-manifest.json이 없다.');
else {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!(manifest.sources ?? []).some((source) => source.path === 'documents/delivery.yaml')) {
    errors.push('manifest에 제출 구성 정본이 없다.');
  }
  console.log(`manifest: 원본 ${(manifest.sources ?? []).length}개 · 문제 ${(manifest.issues ?? []).length}개`);
  for (const source of manifest.sources ?? []) {
    const path = resolve(REPO, source.path);
    if (!existsSync(path) || createHash('sha256').update(readFileSync(path)).digest('hex') !== source.sha256) {
      errors.push(`생성 후 원본 변경/누락: ${source.path} — 문서와 HTML을 재생성한다`);
    }
  }
}
if (!existsSync(buildReadmePath)) errors.push('build/README.txt 생성 안내가 없다.');
else {
  const guide = readFileSync(buildReadmePath, 'utf8');
  for (const token of ['--release', '--standalone', '--pdf', 'AI에게 생성 요청']) {
    if (!guide.includes(token)) errors.push(`build/README.txt에 필수 안내가 없다 — ${token}`);
  }
}

const keys = Object.keys(manifest?.sites ?? {});
if (!keys.length) errors.push('manifest에 사이트가 없다.');
if (!rootArg && keys.length !== 3) errors.push('기본 전체 제출본 manifest에 세 사이트가 모두 없다.');
if (manifest?.standalone && keys.length !== 1) errors.push('독립 제출본에는 사이트가 정확히 하나여야 한다.');
if (manifest?.standalone && keys[0] === 'user') {
  if (existsSync(resolve(ROOT, 'design')) || existsSync(resolve(ROOT, 'operations'))) {
    errors.push('사용자 독립 제출본에 설계 또는 운영 사이트가 섞였다.');
  }
}

const homePath = resolve(ROOT, 'index.html');
if (!existsSync(homePath)) errors.push('첫 화면 index.html이 없다.');
else {
  const home = readFileSync(homePath, 'utf8');
  const cardLinks = [...home.matchAll(/<a\b(?=[^>]*\bclass="[^"]*\bdelivery-home-card\b[^"]*")[^>]*\bhref="([^"]+)"/g)].map((match) => match[1]);
  const expectedLinks = [...keys.map((key) => `${key}/index.html`), ...(manifest?.flowViews ?? []).map((view) => view.path)];
  for (const link of expectedLinks) {
    if (cardLinks.filter((target) => target === link).length !== 1) errors.push(`첫 화면 카드 누락 또는 중복: ${link}`);
  }
  for (const link of cardLinks) {
    if (!expectedLinks.includes(link)) errors.push(`첫 화면에 생성 대상이 아닌 카드가 있다: ${link}`);
    if (!existsSync(resolve(ROOT, link))) errors.push(`첫 화면 카드 연결 파일이 없다: ${link}`);
  }
  console.log(`첫 화면: 카드 ${cardLinks.length}개 · 대상 ${expectedLinks.length}개`);
}

for (const key of keys) {
  const file = resolve(ROOT, key, 'index.html');
  if (!existsSync(file)) {
    errors.push(`${key}: index.html이 없다.`);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  const pages = [...html.matchAll(/\bdata-page(?:\s|>)/g)].length;
  const links = [...html.matchAll(/\bdata-page-link=/g)].length;
  if (pages === 0 || pages !== links) errors.push(`${key}: 본문 ${pages}개와 목차 ${links}개가 다르다.`);
  if (!html.includes('class="icon theme-icon-dark"') || !html.includes('class="icon theme-icon-light"')) {
    errors.push(`${key}: 해·달 테마 아이콘이 없다.`);
  }
  if (!html.includes('data-current-path') || !html.includes('data-page-path=')) errors.push(`${key}: 현재 문서 경로 표시가 없다.`);
  if (!html.includes('data-ui-settings-toggle') || !html.includes('data-ui-width') || !html.includes('data-ui-font') || !html.includes('data-ui-size')) {
    errors.push(`${key}: 너비·글꼴·글자 크기 보기 설정이 없다.`);
  }
  for (const size of ['130', '140', '150']) {
    if (!html.includes(`<option value="${size}">${size}%</option>`)) errors.push(`${key}: 글자 크기 ${size}% 옵션이 없다.`);
  }
  if (!html.includes('data-print-page') || html.includes('data-print-all')) errors.push(`${key}: 현재 페이지만 인쇄하는 제어가 아니다.`);
  if (!html.includes('../assets/mermaid.min.js')) errors.push(`${key}: 오프라인 Mermaid 스크립트를 부르지 않는다.`);
  if (key === 'user' && /data-page-link="[^"]*sample/i.test(html)) errors.push('user: 샘플 화면이 목차에 포함됐다.');
  if (key === 'user' && manifest?.release && html.includes('class="review-note')) errors.push('user: 제출본에 내부 캡처 검토 블록이 남았다.');
  if (key === 'design') {
    const spec = loadSpecSet({ repo: REPO, name: '60-screens', parseYaml }).document;
    errors.push(...menuNavigationErrors(spec, html));
    const tabLists = [...html.matchAll(/\bdata-document-tabs(?:\s|>)/g)].length;
    const requirementTabs = [...html.matchAll(/data-document-tab="requirements"/g)].length;
    const mockupTabs = [...html.matchAll(/data-document-tab="mockup"/g)].length;
    if (tabLists === 0 || tabLists !== requirementTabs || tabLists !== mockupTabs) {
      errors.push(`design: 화면 문서 탭 ${tabLists}개와 요건 ${requirementTabs}개·목업 ${mockupTabs}개가 다르다.`);
    }
    if (/data-page-link="[^"]*sample/i.test(html)) errors.push('design: 샘플 화면이 목차에 포함됐다.');
    if (!html.includes('data-tree-depth="1"')) errors.push('design: 실제 메뉴 중간 노드 계층이 없다.');
    if (![...html.matchAll(/class="mermaid" data-mermaid-source=/g)].length) errors.push('design: Mermaid 원문 블록이 없다.');
  }
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    if (!existsSync(resolve(dirname(file), target))) errors.push(`${key}: 로컬 자산이 없다 — ${target}`);
  }
  console.log(`${key}: 본문 ${pages}장 · 목차 ${links}개`);
}

for (const asset of ['assets/guide.css', 'assets/delivery.css', 'assets/delivery.js', 'assets/icons.js', 'assets/mermaid.min.js']) {
  if (!existsSync(resolve(ROOT, asset))) errors.push(`공통 로컬 자산이 없다 — ${asset}`);
}

for (const view of manifest?.flowViews ?? []) {
  const file = resolve(ROOT, view.path);
  if (!existsSync(file)) { errors.push(`연속 보기 없음: ${view.path}`); continue; }
  const html = readFileSync(file, 'utf8');
  if (createHash('sha256').update(html).digest('hex') !== view.sha256) errors.push(`연속 보기 생성 후 변경: ${view.path}`);
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) errors.push(`연속 보기 ID 중복: ${view.path}`);
  for (const key of view.sequences) {
    if (!idSet.has(key) || !idSet.has(`${key}-steps`)) errors.push(`연속 보기 상세/설명 누락: ${key}`);
  }
  const diagrams = [...markup.matchAll(/class="mermaid" data-mermaid-source=/g)].length;
  if (diagrams !== view.sequences.length) errors.push(`연속 보기 Mermaid 수 불일치: ${diagrams}`);
  for (const match of markup.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const target = match[1];
    if (target.startsWith('#') && !idSet.has(target.slice(1))) errors.push(`연속 보기 앵커 누락: ${target}`);
    if (!/^(?:#|https?:)/.test(target)) errors.push(`단일 HTML의 외부 파일 의존: ${target}`);
  }
  if (!html.includes('window.FLOW_READY')) errors.push('연속 보기 렌더링 완료 신호가 없다.');
  console.log(`${view.path}: 전체 노드 ${view.overviewNodes} · 상세도 ${diagrams} · 단일 파일`);
}

for (const error of errors) console.log(`오류: ${error}`);
console.log(errors.length ? `빨강 — ${errors.length}건` : `초록 — ${keys.join(' · ')} 오프라인 사이트의 구조와 자산이 완결됐다.`);
process.exitCode = errors.length ? 1 : 0;
