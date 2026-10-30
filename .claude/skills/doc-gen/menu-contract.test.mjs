import{test}from'node:test';import assert from'node:assert/strict';import{parseYaml}from'../../hooks/lib.mjs';import{loadSpecSet}from'../../../aidd-guide/harness/runtime/spec-set.mjs';import{menuContractErrors,menuReviewMarkdown}from'./menu-contract.mjs';
const spec=loadSpecSet({repo:process.cwd(),name:'60-screens',parseYaml}).document;
test('admin 전체 메뉴·상속 이력·차수 목록의 연결',()=>assert.deepEqual(menuContractErrors(spec),[]));
test('메뉴 누락·중복 경로·유예 혼입·system 이력 확대를 거부한다',()=>{
 for(const change of [s=>s.menu_tree.admin_groups[0].screens.pop(),s=>{s.screens.find(x=>x.id==='SCR-004').route=s.screens.find(x=>x.id==='SCR-003').route;},s=>s.roadmap_rollout['RM-P1'].admin.push('SCR-025'),s=>s.screens.push({id:'SCR-999',module:'system',view_kind:'change_history'})]){const s=structuredClone(spec);change(s);assert.ok(menuContractErrors(s).length);}
});
test('목업 미작성과 상속을 구분해 목록에 표시한다',()=>{const text=menuReviewMarkdown(spec,()=>false);assert.ok(text.includes('요건서 작성 전'));assert.ok(text.includes('원 화면 상속'));assert.ok(text.includes('system 모듈은 이번'));});

test('자산별 요청 원 화면·공유 편집면과 통합 조회 역할을 검증한다',()=>{
 const requests=spec.screens.filter(s=>s.view_kind==='change_request');assert.equal(requests.length,6);
 for(const change of [s=>{s.screens.find(x=>x.id==='SCR-056').source_screen='SCR-004';},s=>{s.screens.find(x=>x.id==='SCR-003').request_view='SCR-057';},s=>{s.screens.find(x=>x.id==='SCR-039').request_view='SCR-058';},s=>{s.screens.find(x=>x.id==='SCR-036').allowed_actions.push('APPROVE');},s=>{s.screens.find(x=>x.id==='SCR-056').request_index='SCR-037';}]){const s=structuredClone(spec);change(s);assert.ok(menuContractErrors(s).length);}
 const text=menuReviewMarkdown(spec,()=>false);assert.ok(text.includes('자산별 변경 요청 처리 메뉴'));assert.ok(text.includes('SCR-060 지식 변경 요청'));
});
