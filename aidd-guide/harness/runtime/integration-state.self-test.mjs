import assert from 'node:assert/strict';
import {
  conflictHistoryIssues,
  conflictIntegrationBlockProblem,
  parseConflictIntegrations,
  pendingRecheckIssues,
} from './integration-state.mjs';

const state = {
  collaboration: { integration_mode: 'shared_main' },
  pending_rechecks: {
    'SLICE-510': {
      kind: 'code_test',
      introduced_by: 'abc1234',
      affected: ['FEAT-507', 'TC-5076'],
      reason: '공통 오류 처리 충돌 통합',
    },
    'admin.P3': {
      kind: 'document_review',
      introduced_by: '1234567890abcdef',
      affected: ['REQ-501'],
      reason: '요건 문장 충돌 통합',
    },
  },
};
assert.deepEqual(pendingRecheckIssues(state), []);
assert.equal(pendingRecheckIssues({ pending_rechecks: [] }).length > 0, true);
assert.equal(pendingRecheckIssues({ pending_rechecks: { x: {} } }).length >= 5, true);

const good = 'fix: 충돌이 났다 — 합쳤다\n\n[충돌 통합]\n영향: FEAT-507\n확인: 개발자 A 오프라인 확인\n검증: 후속 필요\n\nAgent: Codex';
assert.equal(conflictIntegrationBlockProblem(good), '');
assert.match(conflictIntegrationBlockProblem('[충돌 통합]\n영향: FEAT-507'), /확인/);

const raw = `aaaaaaaa\x1f2026-09-17\x1f${good}\x1ebbbbbbbb\x1f2026-09-16\x1fdocs: 보통 문서 — 수정\x1e`;
const parsed = parseConflictIntegrations(raw);
assert.equal(parsed.length, 1);
assert.equal(parsed[0].affected, 'FEAT-507');
assert.equal(parsed[0].verification, '후속 필요');
assert.deepEqual(conflictHistoryIssues(parsed), []);
assert.equal(conflictHistoryIssues([{ sha: 'abcdef0', affected: '', confirmation: '', verification: '' }]).length, 3);

console.log('통합 상태 self-test 통과');
