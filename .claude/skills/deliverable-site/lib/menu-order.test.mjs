import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderByAdminMenu } from '../../doc-gen/menu-contract.mjs';
import { menuNavigationErrors } from './menu-order.mjs';
const spec = { menu_tree: { admin_groups: [
 { title: '공통 기반', screens: ['SCR-018', 'SCR-053', 'SCR-015'] },
 { title: '연동 관리', screens: ['SCR-003', 'SCR-056', 'SCR-042'] },
] } };
const rows = ['DOC', 'SCR-501', 'SCR-003', 'SCR-015', 'SCR-018', 'SCR-502', 'SCR-042', 'SCR-053', 'SCR-056'].map((id) => ({ id }));
const ordered = ['DOC', 'SCR-501', 'SCR-018', 'SCR-053', 'SCR-015', 'SCR-502', 'SCR-003', 'SCR-056', 'SCR-042'];
function nav(items) { return items.map(({ id, group }) => `<button data-page-link="screen-${id.toLowerCase()}" data-page-path="화면 요건·목업 › admin › ${group} › ${id}"></button>`).join(''); }
const entries = spec.menu_tree.admin_groups.flatMap((g) => g.screens.map((id) => ({ id, group: g.title })));
test('파일 순서와 떨어진 상속 이력을 메뉴 순서로 모으고 system·일반 문서 위치는 보존한다', () => {
 assert.deepEqual(orderByAdminMenu(spec, rows).map((x) => x.id), ordered);
 assert.equal(rows[2].id, 'SCR-003');
 assert.deepEqual(orderByAdminMenu({}, rows), rows);
 assert.deepEqual(orderByAdminMenu(spec, rows.map((x) => ({ screenId: x.id })), (x) => x.screenId).map((x) => x.screenId), ordered);
});
test('목차의 순서 역전·누락·중복·잘못된 영역은 검사에서 실패한다', () => {
 assert.deepEqual(menuNavigationErrors(spec, nav(entries)), []);
 const swapped = [...entries]; [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
 for (const bad of [swapped, entries.slice(1), [...entries, entries[0]], entries.map((x, i) => i ? x : { ...x, group: '다른 영역' })]) {
  assert.ok(menuNavigationErrors(spec, nav(bad)).length);
 }
});
