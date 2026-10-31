import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { preparedMockups, preparedMockupErrors } from './prepared-mockups.mjs';

const declared = '### 1-2. 목업 상태\n\n| 그림 키 | 상태 |\n|---|---|\n| main | 현재값 |\n\n### 다음 절\n';
const screen = { id: 'SCR-015', route: '/admin/hub/model', target_doc: 'documents/screen/admin/hub/model/requirements.md' };
function fixture(t) {
  const repo = mkdtempSync(join(tmpdir(), 'prepared-mockups-'));
  t.after(() => {
    assert.ok(resolve(repo).startsWith(resolve(tmpdir()) + sep + 'prepared-mockups-'));
    rmSync(repo, { recursive: true, force: true });
  });
  const write = (file, text) => { const dest = join(repo, file); mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, text); };
  return { repo, write };
}
test('요건서가 있어도 목업 상태 미작성·상속 이력·샘플은 생성 필수로 추정하지 않는다', t => {
  const { repo, write } = fixture(t);
  write(screen.target_doc, '# 초안\n목업 상태는 후속이다.');
  assert.deepEqual(preparedMockups({ repo, screens: [screen] }), []);
  write(screen.target_doc, declared);
  assert.deepEqual(preparedMockups({ repo, screens: [{ ...screen, view_kind: 'change_history' }, { ...screen, route: '/sample/model' }] }), []);
  assert.equal(preparedMockups({ repo, screens: [screen] }).length, 1);
});
test('준비된 목업 원본이 없으면 HTML 생성 전 실패하며 기존 산출물을 건드리지 않는다', t => {
  const { repo, write } = fixture(t);
  write(screen.target_doc, declared);
  write('build/deliverables/design/index.html', '기존 검토본');
  const errors = preparedMockupErrors({ repo, screens: [screen] });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /SCR-015.*--write admin\/hub\/model/);
  assert.ok(existsSync(join(repo, 'build/deliverables/design/index.html')));
  write('documents/screen/admin/hub/model/mockup.html', '<main>목업</main>');
  assert.deepEqual(preparedMockupErrors({ repo, screens: [screen] }), []);
});
test('원본이 있어도 최종 HTML의 빈 안내문은 실패하고 해당 화면 목업 표식이 있어야 통과한다', t => {
  const { repo, write } = fixture(t);
  write(screen.target_doc, declared);
  write('documents/screen/admin/hub/model/mockup.html', '<main>목업</main>');
  assert.equal(preparedMockupErrors({ repo, screens: [screen], html: '<div>생성된 목업이 없습니다.</div>' }).length, 1);
  assert.equal(preparedMockupErrors({ repo, screens: [screen], html: '<div data-mockup="SCR-016/__design__"></div>' }).length, 1);
  assert.deepEqual(preparedMockupErrors({ repo, screens: [screen], html: '<div data-mockup="SCR-015/__design__"></div>' }), []);
});
