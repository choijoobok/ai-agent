import{test}from'node:test';import assert from'node:assert/strict';
import{parseYaml}from'../../hooks/lib.mjs';import{loadSpecSet}from'../../../aidd-guide/harness/runtime/spec-set.mjs';import{approvalContractErrors}from'./approval-contract.mjs';
const domain=loadSpecSet({repo:process.cwd(),name:'40-domain',parseYaml}).document;
test('전체 승인 복사 명세의 소유·열·마스터 리비전 계약',()=>assert.deepEqual(approvalContractErrors(domain),[]));
test('본문 열 누락·결과 리비전 누락·자식 시각·다른 문맥 부모를 거부한다',()=>{
 for(const change of [d=>{const s=d.entities.find(e=>e.id==='ENT-050');s.attributes=s.attributes.filter(a=>a.physical_name!=='APPLIED_REVISION');},d=>{const s=d.entities.find(e=>e.id==='ENT-050');s.attributes=s.attributes.filter(a=>a.physical_name!=='CATALOG_ID');},d=>d.entities.find(e=>e.id==='ENT-053').attributes.push({physical_name:'HIST_DTM'}),d=>d.entities.find(e=>e.id==='ENT-052').snapshot_parent='ENT-051']){
  const d=structuredClone(domain);change(d);assert.ok(approvalContractErrors(d).length);
 }
});
