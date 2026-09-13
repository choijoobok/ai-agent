/** 생성된 오프라인 사이트의 구조와 로컬 자산을 검사한다. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const rootArg = process.argv.slice(2).find((arg) => arg.startsWith('--root='))?.slice('--root='.length);
const ROOT = resolve(REPO, rootArg || 'build/deliverables');
const errors = [];
const manifestPath = resolve(ROOT, 'delivery-manifest.json');
let manifest = null;

if (!existsSync(manifestPath)) errors.push('delivery-manifest.json이 없다.');
else {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!(manifest.sources ?? []).some((source) => source.path === 'documents/delivery.yaml')) {
    errors.push('manifest에 제출 구성 정본이 없다.');
  }
  console.log(`manifest: 원본 ${(manifest.sources ?? []).length}개 · 문제 ${(manifest.issues ?? []).length}개`);
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
  if (!html.includes('data-print-page') || html.includes('data-print-all')) errors.push(`${key}: 현재 페이지만 인쇄하는 제어가 아니다.`);
  if (!html.includes('../assets/mermaid.min.js')) errors.push(`${key}: 오프라인 Mermaid 스크립트를 부르지 않는다.`);
  if (key === 'user' && /data-page-link="[^"]*sample/i.test(html)) errors.push('user: 샘플 화면이 목차에 포함됐다.');
  if (key === 'user' && manifest?.release && html.includes('class="review-note')) errors.push('user: 제출본에 내부 캡처 검토 블록이 남았다.');
  if (key === 'design') {
    const tabLists = [...html.matchAll(/\bdata-document-tabs(?:\s|>)/g)].length;
    const requirementTabs = [...html.matchAll(/data-document-tab="requirements"/g)].length;
    const mockupTabs = [...html.matchAll(/data-document-tab="mockup"/g)].length;
    if (tabLists === 0 || tabLists !== requirementTabs || tabLists !== mockupTabs) {
      errors.push(`design: 화면 문서 탭 ${tabLists}개와 요건 ${requirementTabs}개·목업 ${mockupTabs}개가 다르다.`);
    }
    if (/data-page-link="[^"]*sample/i.test(html)) errors.push('design: 샘플 화면이 목차에 포함됐다.');
    if (!html.includes('data-tree-depth="1"')) errors.push('design: 실제 메뉴 중간 노드 계층이 없다.');
    const designMockups = [...html.matchAll(/data-mockup="[^"]+\/__design__"/g)].length;
    if (designMockups !== mockupTabs) errors.push(`design: 전체 목업 ${designMockups}개와 목업 탭 ${mockupTabs}개가 다르다.`);
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

for (const error of errors) console.log(`오류: ${error}`);
console.log(errors.length ? `빨강 — ${errors.length}건` : `초록 — ${keys.join(' · ')} 오프라인 사이트의 구조와 자산이 완결됐다.`);
process.exitCode = errors.length ? 1 : 0;
