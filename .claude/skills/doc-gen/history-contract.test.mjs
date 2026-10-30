import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseYaml} from '../../hooks/lib.mjs';
import {loadSpecSet} from '../../../aidd-guide/harness/runtime/spec-set.mjs';
import {historyContractErrors} from './history-contract.mjs';
const domain=loadSpecSet({repo:process.cwd(),name:'40-domain',parseYaml}).document;
const find=(d,id)=>d.entities.find(e=>e.id===id);
test('현재 이력 명세는 동형 복사·별도 키·단일 시각 계약을 충족한다',()=>{
 assert.deepEqual(historyContractErrors(domain),[]);
 assert.ok(domain.entities.filter(e=>e.history_copy_of).length>=7);
});
test('원본 복사 열/자료형을 누락하거나 변경하면 실패한다',()=>{
 const d=structuredClone(domain);find(d,'ENT-003').physical.attributes.find(a=>a.name==='SYSTEM_NM').type='text';
 assert.ok(historyContractErrors(d).some(e=>e.includes('SYSTEM_NM')));
});
test('원본명 접미·서로게이트 PK·시각 기본값을 뒤집으면 실패한다',()=>{
 for(const mutate of [h=>h.table='OTHER_HIST',h=>h.physical.constraints.find(c=>c.definition.startsWith('PRIMARY KEY')).definition='PRIMARY KEY (HISTORY_NO, TARGET_SYSTEM_ID)',h=>h.physical.attributes.find(a=>a.name==='HIST_DTM').default='CURRENT_TIMESTAMP']){
  const d=structuredClone(domain);mutate(find(d,'ENT-003'));assert.ok(historyContractErrors(d).length);
 }
});
test('부모 참조가 없거나 자식이 시각을 중복하면 실패한다',()=>{
 const d=structuredClone(domain),h=find(d,'ENT-044');h.physical.constraints=h.physical.constraints.filter(c=>!c.definition.startsWith('FOREIGN KEY'));
 assert.ok(historyContractErrors(d).some(e=>e.includes('원 부모 키')));
 const d2=structuredClone(domain);find(d2,'ENT-044').physical.attributes.push({name:'HIST_DTM',type:'timestamp with time zone',nullable:false,default:null});
 assert.ok(historyContractErrors(d2).some(e=>e.includes('중복')));
});
