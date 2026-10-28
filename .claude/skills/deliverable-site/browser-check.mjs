/** 실제 Chromium에서 탐색·설정·목업 격리·Mermaid 렌더링을 검사한다. */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO } from '../manual-site/lib/menu.mjs';
import { parseYaml } from '../../hooks/lib.mjs';
import { loadSpecSet } from '../../../aidd-guide/harness/runtime/spec-set.mjs';

const rootArg = process.argv.slice(2).find((arg) => arg.startsWith('--root='))?.slice('--root='.length);
const site = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? 'design';
const root = resolve(REPO, rootArg || 'build/deliverables');
const requireFrontend = createRequire(resolve(REPO, 'sources/frontend/package.json'));
const { chromium } = requireFrontend('playwright');
const channel = process.argv.slice(2).find((arg) => arg.startsWith('--browser='))?.slice(10);
if (channel && !['chrome', 'msedge'].includes(channel)) throw new Error('--browser는 chrome 또는 msedge다.');
const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
const errors = [];

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(pathToFileURL(resolve(root, site, 'index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => window.DELIVERY_READY);
  const openHash = async (id) => {
    await page.evaluate((value) => { location.hash = value; }, id);
    await page.locator(`[data-page-link="${id}"][aria-current="page"]`).waitFor({ state: 'visible' });
  };
  if (site === 'design') {
    const target = await page.locator('[data-page-link]').evaluateAll((nodes) => {
      const link = nodes.find((node) => node.closest('.collapsed'));
      return link ? { id: link.dataset.pageLink, title: link.textContent.trim(), path: link.dataset.pagePath } : null;
    });
    if (!target) errors.push('설계 목차의 하위 그룹이 처음부터 모두 펼쳐져 있다.');
    else {
      const targetLink = page.locator(`[data-page-link="${target.id}"]`);
      const search = page.locator('[data-tree-filter]');
      await search.fill(target.title);
      if (!await targetLink.isVisible()) errors.push('검색 결과의 접힌 상위 경로가 펼쳐지지 않는다.');
      await search.fill('');
      if (await targetLink.isVisible()) errors.push('검색을 지워도 이전 접힘 상태로 돌아가지 않는다.');
      await openHash(target.id);
      if (await page.locator('[data-current-path]').textContent() !== target.path) errors.push('해시 링크의 현재 경로가 새 목차와 다르다.');
      const group = targetLink.locator('xpath=ancestor::li[contains(@class,"tree-branch")][1]').locator(':scope > [data-tree-group]');
      await group.click();
      if (await targetLink.isVisible()) errors.push('목차 그룹 접기가 동작하지 않는다.');
      await group.click();
      if (!await targetLink.isVisible()) errors.push('목차 그룹 펼치기가 동작하지 않는다.');
    }
    const plannedTables = loadSpecSet({ repo: REPO, name: '40-domain', parseYaml }).document.entities
      .filter((entity) => entity.implementation === 'planned' && entity.design_stage === 'physical')
      .map((entity) => entity.table);
    const tablePages = await page.locator('[data-page-link]').evaluateAll((nodes, planned) => nodes
      .filter((node) => node.dataset.pagePath?.includes('테이블 목록·명세서') && / — /.test(node.textContent))
      .map((node) => ({ id: node.dataset.pageLink, path: node.dataset.pagePath,
        logical: node.textContent.includes('물리명 미정'),
        planned: planned.includes(node.textContent.split(' — ')[0].trim()),
      })), plannedTables);
    const physicalPage = tablePages.find((entry) => !entry.logical && !entry.planned);
    const plannedPages = tablePages.filter((entry) => entry.planned);
    const logicalPages = tablePages.filter((entry) => entry.logical);
    if (!physicalPage) errors.push('물리 테이블 상세 명세의 모듈별 목차가 없다.');
    if (plannedPages.length !== plannedTables.length) errors.push('미구현 물리 설계의 테이블 목차 수가 정본과 다르다.');
    for (const tablePage of [...(physicalPage ? [physicalPage] : []), ...plannedPages, ...logicalPages]) {
      await openHash(tablePage.id);
      const text = await page.locator(`[data-page][id="${tablePage.id}"]`).innerText();
      const labels = tablePage.logical
        ? ['논리 설계 · 물리명 미정', '논리 속성', '업무 모델 연결', '아직 설계하지 않았다']
        : ['NULL 허용', '기본값', '키·제약', tablePage.planned ? '설계 초안 · 미구현' : 'Liquibase 변경 근거'];
      for (const label of labels) if (!text.includes(label)) errors.push(`${tablePage.path} 명세 항목 누락: ${label}`);
      if (await page.locator('[data-current-path]').textContent() !== tablePage.path) errors.push('테이블 명세의 현재 경로가 다르다.');
    }
    console.log(`데이터 모델 표시: 구현 명세 ${physicalPage ? 1 : 0}개 · 물리 초안 ${plannedPages.length}개 · 논리 초안 ${logicalPages.length}개`);
    const mockupPage = await page.locator('[data-mockup$="/__design__"]').first().evaluate((node) => node.closest('[data-page]')?.id);
    if (mockupPage) await openHash(mockupPage);
  }
  const state = await page.evaluate(() => ({
    pages: document.querySelectorAll('[data-page]').length,
    visiblePages: [...document.querySelectorAll('[data-page]')].filter((node) => !node.hidden).length,
    currentPath: document.querySelector('[data-current-path]')?.textContent?.trim(),
    mermaids: document.querySelectorAll('.mermaid[data-mermaid-source]').length,
    diagrams: document.querySelectorAll('.mermaid svg').length,
    designMockups: document.querySelectorAll('[data-mockup$="/__design__"]').length,
    describedMockups: [...document.querySelectorAll('[data-mockup$="/__design__"]')].filter((node) => {
      const shadow = node.querySelector('[data-mockup-body]')?.shadowRoot;
      return shadow?.querySelector('[data-note]') && shadow?.querySelector('[id^="note-"]') && shadow?.textContent.includes('테스트 케이스');
    }).length,
  }));
  if (state.visiblePages !== 1) errors.push(`현재 문서가 하나가 아니다: ${state.visiblePages}`);
  if (!state.currentPath) errors.push('상단 현재 문서 경로가 비었다.');
  if (state.mermaids !== state.diagrams) errors.push(`Mermaid ${state.mermaids}개 중 SVG ${state.diagrams}개만 렌더링됐다.`);
  if (site === 'design' && (state.designMockups === 0 || state.describedMockups !== 1)) {
    errors.push(`현재 문서의 상세 목업이 완결되지 않았다: 전체 자리 ${state.designMockups} · 주입 완료 ${state.describedMockups}`);
  }
  await page.locator('[data-ui-settings-toggle]').click();
  await page.locator('select[data-ui-width]').selectOption('full');
  await page.locator('select[data-ui-font]').selectOption('serif');
  await page.locator('select[data-ui-size]').selectOption('150');
  const settings = await page.evaluate(() => ({
    width: document.documentElement.dataset.contentWidth,
    font: document.documentElement.dataset.uiFont,
    scale: document.documentElement.style.getPropertyValue('--ui-scale'),
  }));
  if (settings.width !== 'full' || settings.font !== 'serif' || settings.scale !== '1.5') errors.push('보기 설정이 문서 루트에 반영되지 않았다.');
  await page.locator('[data-theme-toggle]').click();
  await page.evaluate(() => window.DELIVERY_READY);
  await page.emulateMedia({ media: 'print' });
  const printVisible = await page.evaluate(() => [...document.querySelectorAll('[data-page]')]
    .filter((node) => getComputedStyle(node).display !== 'none').length);
  if (printVisible !== 1) errors.push(`인쇄 매체에서 현재 문서 외 ${printVisible - 1}개가 더 보인다.`);
  console.log(`${site}: 문서 ${state.pages} · Mermaid SVG ${state.diagrams} · 상세 목업 ${state.describedMockups} · 인쇄 문서 ${printVisible}`);
} finally {
  await browser.close();
}

for (const error of errors) console.log(`오류: ${error}`);
console.log(errors.length ? `빨강 — ${errors.length}건` : '초록 — 실제 브라우저 동작이 완결됐다.');
process.exitCode = errors.length ? 1 : 0;
