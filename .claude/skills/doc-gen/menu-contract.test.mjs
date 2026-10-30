import{test}from'node:test';import assert from'node:assert/strict';import{parseYaml}from'../../hooks/lib.mjs';import{loadSpecSet}from'../../../aidd-guide/harness/runtime/spec-set.mjs';import{menuContractErrors,menuReviewMarkdown}from'./menu-contract.mjs';
const spec=loadSpecSet({repo:process.cwd(),name:'60-screens',parseYaml}).document;
test('admin 전체 메뉴·상속 이력·차수 목록의 연결',()=>assert.deepEqual(menuContractErrors(spec),[]));
test('메뉴 누락·중복 경로·유예 혼입·system 이력 확대를 거부한다',()=>{
 for(const change of [s=>s.menu_tree.admin_groups[0].screens.pop(),s=>{s.screens.find(x=>x.id==='SCR-004').route=s.screens.find(x=>x.id==='SCR-003').route;},s=>s.roadmap_rollout['RM-P1'].admin.push('SCR-025'),s=>s.screens.push({id:'SCR-999',module:'system',view_kind:'change_history'})]){const s=structuredClone(spec);change(s);assert.ok(menuContractErrors(s).length);}
});
test('목업 미작성과 상속을 구분해 목록에 표시한다',()=>{const text=menuReviewMarkdown(spec,()=>false);assert.ok(text.includes('요건서 작성 전'));assert.ok(text.includes('원 화면 상속'));assert.ok(text.includes('system 모듈은 이번'));});
