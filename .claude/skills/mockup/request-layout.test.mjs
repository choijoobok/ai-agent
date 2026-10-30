import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestDeclaration,inheritRequest} from './request-layout.mjs';
const t=(heading,label)=>({heading,header:['컬럼','편집'],rows:[[label,'가능']]});
const source={columns:[t('자산 목록','업무명'),t('소유 구성','입력'),t('현재 관측','실시간 값')],surfaces:[]};
const request={columns:[t('요청 목록','요청번호'),t('전체 변경 대상','대상')],surfaces:[]};
test('명시 소유 영역만 상속하고 현재 관측/관리 명령을 포함하지 않는다',()=>{
 const m=inheritRequest(request,source,['자산 목록','소유 구성']);
 assert.deepEqual(m.columns.map(t=>t.heading),['요청 목록','소유 구성','전체 변경 대상']);
 assert.deepEqual(m.columns[0].rows.map(r=>r[0]),['요청번호','업무명']);
 assert.deepEqual(m.surfaces[0].buttons,[]);
 assert.equal(source.columns[0].rows.length,1);
});
test('누락 영역·마스터 누락·컬럼 충돌·경로 이탈을 거부한다',()=>{
 assert.throws(()=>inheritRequest(request,source,['없는 영역']),/원 요건서/);
 assert.throws(()=>inheritRequest(request,source,['소유 구성']),/마스터/);
 assert.throws(()=>inheritRequest(request,{...source,columns:[t('자산 목록','요청번호')]},['자산 목록']),/중복/);
 assert.throws(()=>requestDeclaration('| 요청 원 화면 | ../../outside |\n| 요청 상속 영역 | a |'),/경로/);
 assert.equal(requestDeclaration('일반 화면'),null);
});

test('요청 메타 잠금과 초안 업무 편집을 분리하고 제출본은 초안 조건으로 보호한다',()=>{
 const req={...request,columns:[{...request.columns[0],readonly:true},request.columns[1]]};
 const m=inheritRequest(req,source,['자산 목록','소유 구성']);
 assert.equal(m.columns[0].readonly,false);
 assert.equal(m.columns[0].rows[1][m.columns[0].header.indexOf('편집 조건')],'draft');
});
