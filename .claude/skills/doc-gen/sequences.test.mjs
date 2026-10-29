import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import {blocks, renderSequenceDocuments, checkSequenceDocuments} from './gen.mjs';

const fixture=()=>({id:'UC-900',name:'직접 변경',workstream:'admin',design_status:'draft',reqs:['REQ-900'],feature_contract:'FEAT-900',
  sequence_design:{contracts_from:['FEAT-900.shared_write_contract'],scope:'원자성 검토',diagrams:[{key:'save',title:'저장',
    transaction_boundary:'현재값·이력의 COMMIT/ROLLBACK',reading_order:['권한 확인','최종 상태와 이력 동시 저장'],
    mermaid:'sequenceDiagram\n    participant S as 서비스\n    participant D as DB\n    alt 성공\n        S->>D: COMMIT\n    else 이력 실패\n        S->>D: ROLLBACK\n    end\n'}]}});

test('기존 요구사항의 sequence_design 문서 연결 배열을 UC 파생 링크로 바꾸지 않는다',()=>{
  const content=blocks([{id:'REQ-010',title:'전체 흐름',sequence_design:[{document:'documents/design/agent-request-sequences.md',scope:'접수·폴링·실행 전체 연결 설명'}]}]);
  assert.match(content,/documents\/design\/agent-request-sequences\.md/);
  assert.match(content,/접수·폴링·실행 전체 연결 설명/);
  assert.doesNotMatch(content,/33-시퀀스\/REQ-/);
});

test('UC별 모듈·상위 연결·Mermaid와 순서/후속 필드를 빠짐없이 생성한다',()=>{
  const uc=fixture();uc.sequence_design.diagrams[0].future_check='추가된 장문 검증 조건도 누락 없이 출력한다';
  const docs=renderSequenceDocuments([uc,{id:'UC-901',name:'미작성'}]);
  assert.equal(docs.size,2);
  const content=docs.get('documents/generated/33-시퀀스/UC-900.md');
  for(const text of ['module: admin','UC-900, REQ-900, FEAT-900','```mermaid\nsequenceDiagram','<a id="save">','최종 상태와 이력 동시 저장','추가된 장문 검증 조건도 누락 없이 출력한다'])assert.ok(content.includes(text),text);
  assert.match(docs.get('documents/generated/33-시퀀스/_index.md'),/UC-900\.md/);
  assert.doesNotMatch(docs.get('documents/generated/33-시퀀스/_index.md'),/UC-901\.md/);
});

test('범위·근거·순서/예외·트랜잭션 경계 누락과 그림 키 중복/경로 이탈을 거부한다',()=>{
  for(const mutate of [
    uc=>{delete uc.sequence_design.contracts_from;},
    uc=>{uc.sequence_design.contracts_from=[];},
    uc=>{uc.sequence_design.scope='  ';},
    uc=>{delete uc.sequence_design.diagrams[0].reading_order;},
    uc=>{uc.sequence_design.diagrams[0].reading_order=[];},
    uc=>{uc.sequence_design.diagrams[0].mermaid='sequenceDiagram\nS->>D: 성공만 표시';},
    uc=>{delete uc.sequence_design.diagrams[0].transaction_boundary;},
    uc=>{uc.sequence_design.diagrams[0].transaction_boundary='  ';},
    uc=>{uc.sequence_design.diagrams.push({...uc.sequence_design.diagrams[0]});},
    uc=>{uc.id='UC-900/../../outside';},
  ]){const uc=fixture();mutate(uc);assert.throws(()=>renderSequenceDocuments([uc]));}
});

test('Note 설명의 세미콜론 구문 오류를 생성 전에 잡고 이스케이프는 허용한다',()=>{
  const uc=fixture();
  uc.sequence_design.diagrams[0].mermaid+='    Note over S,D: 새 읽기로 확인; replay 그림 참조\n';
  assert.throws(()=>renderSequenceDocuments([uc]),/세미콜론/);
  uc.sequence_design.diagrams[0].mermaid=uc.sequence_design.diagrams[0].mermaid.replace('; replay','#59; replay');
  assert.doesNotThrow(()=>renderSequenceDocuments([uc]));
});

test('생성된 순서/예외 삭제와 폐기 문서 잔존을 검사하고 날짜 변경만 허용한다',()=>{
  const prefix=join(tmpdir(),'ai-agent-sequence-'),root=mkdtempSync(prefix),uc=fixture();
  try{
    const docs=renderSequenceDocuments([uc]);
    for(const [file,content]of docs){mkdirSync(dirname(join(root,file)),{recursive:true});writeFileSync(join(root,file),content);}
    assert.doesNotThrow(()=>checkSequenceDocuments(root,[uc]));
    const file=join(root,'documents/generated/33-시퀀스/UC-900.md'),original=readFileSync(file,'utf8');
    writeFileSync(file,original.replace(/^last_sync: .*$/m,'last_sync: 2000-01-01'));
    assert.doesNotThrow(()=>checkSequenceDocuments(root,[uc]));
    for(const token of ['최종 상태와 이력 동시 저장','else 이력 실패']){
      writeFileSync(file,original.replace(token,''));assert.throws(()=>checkSequenceDocuments(root,[uc]),/누락\/노후화/);
    }
    writeFileSync(file,original);
    writeFileSync(join(dirname(file),'UC-999.md'),'폐기 문서');
    assert.throws(()=>checkSequenceDocuments(root,[uc]),/폐기된 시퀀스 잔존/);
  }finally{
    assert.equal(dirname(resolve(root)),resolve(tmpdir()));
    assert.ok(resolve(root).startsWith(resolve(prefix)));
    rmSync(root,{recursive:true});
  }
});
