import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { checkMappings } from './requirements-trace.mjs';

const reqs = new Map([['REQ-001', { title: '등록 조합 선택', source: path.resolve('spec.yaml') }]]);
const doc = `## 관련 요구사항
| 요구사항 | 요구사항명 | 관계 | 이 화면의 반영 범위·위치 | 검수 사례(§9) |
|---|---|---|---|---|
| [REQ-001](spec.yaml) | 등록 조합 선택 | 지원 설정 | §4: 선택지 설정. 실행은 agent 담당 | UI-01 |
## 0. 메타
| 항목 | 값 |
|---|---|
| 상위 요구사항 | REQ-001 |
## 4. 컬럼
선택지
## 9. 테스트 케이스
| 케이스 | 상황 | 기대 |
|---|---|---|
| UI-01 | 다른 사용자 | 같은 선택지 |
## 10. 미결 · 확인 필요
후속 제품 시험
`;
test('정본 요구사항과 실제 본문·검수 사례 연결을 대조한다', () => {
  assert.deepEqual(checkMappings(doc, reqs), { missing: false, errors: [], pending: [], count: 1 });
  for (const changed of [doc.replaceAll('REQ-001', 'REQ-999'), doc.replace('등록 조합 선택 |', '낡은 제목 |'), doc.replace('§4:', '§8:'), doc.replace('§4:', '§4-999:'), doc.replace('§4: 선택지 설정. 실행은 agent 담당', '§4'), doc.replace('(spec.yaml)', '(wrong.yaml)'), doc.replace('UI-01 |', 'UI-99 |'), doc.replace('REQ-001 |\n## 4', 'REQ-001·REQ-002 |\n## 4')]) {
    assert.ok(checkMappings(changed, reqs).errors.length, '연결을 깨뜨린 문서는 실패해야 한다');
  }
});
test('기존 미작성과 명시한 미정 연결은 잘못된 ID와 구분한다', () => {
  assert.equal(checkMappings('## 0. 메타', reqs).missing, true);
  const result = checkMappings(doc.replace('UI-01 |', '미정 — §10 실행 검증 계약 후속 |'), reqs);
  assert.equal(result.pending.length, 1);
  assert.equal(result.errors.length, 0);
});
