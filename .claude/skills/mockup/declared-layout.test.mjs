import assert from 'node:assert/strict';
import { test } from 'node:test';
import { declaredFigures, declaredScreen } from './declared-layout.mjs';

const plain = (x) => String(x ?? '').replace(/`|\*/g, '').trim();

test('상태별 명시 비활성은 편집 가능한 초안과 조회 이름에도 우선한다',()=>{
  const table={header:[...stateTable([]).header,'비활성 버튼'],rows:[['draft','초안','상세','','저장·코드 결과 조회','가능','없음','저장·코드 결과 조회']]};
  const [figure]=declaredFigures(table,plain);
  const fixture={...model,actions:[...model.actions,['코드 결과 조회','','','','','코드 실행']]};
  const html=render(figure,fixture);
  assert.match(html, /<button[^>]*disabled[^>]*>저장<\/button>/);
  assert.match(html, /<button[^>]*disabled[^>]*>코드 결과 조회<\/button>/);
  assert.doesNotMatch(render({...figure,disabledButtons:[]},fixture),/<button[^>]*disabled[^>]*>저장<\/button>/);
});

const stateTable = (rows) => ({ header: ['그림 키','상태','상세 영역','안내','허용 버튼','편집','예시 변경'], rows });
const columns = (heading, rows) => ({ heading, header: ['컬럼','입력방식','편집','검증','예시'], rows });
const model = {
  columns: [columns('목록', [['이름','텍스트','읽기전용','','목록 예시']]), columns('상세 — 폼', [['상세값','텍스트','가능','필수','기존 값']])],
  actions: [['조회','','','','','목록 조회'],['저장','','','','','전체 저장']], search: [],
};

test('조회 표시명을 통일해도 원천 비교 명령과 내부 동작을 합치지 않는다', () => {
  const actionTable={header:['버튼','동작','표시명'],rows:[['불일치 새로고침','저장 목록 조회','조회'],['원천 구조 비교','새 관측 실행','원천 구조 비교']]};
  const fixture={...model,actions:actionTable.rows,actionTables:[actionTable],figureNavigation:{rows:[['원천 구조 비교','comparison']]}};
  const [figure]=declaredFigures(stateTable([['main','기본','상세','','불일치 새로고침·원천 구조 비교','가능','없음']]),plain);
  const html=render(figure,fixture);
  assert.match(html, />조회<\/button>/);
  assert.doesNotMatch(html, />불일치 새로고침<\/button>/);
  assert.match(html, /data-open-figure="comparison">원천 구조 비교<\/button>/);
});

test('READ 새로고침은 조회 전용 비교 그리드에서도 조회로 활성화된다', () => {
  const actionTable={header:['버튼','액션','표시명'],rows:[['불일치 새로고침','READ','조회']]};
  const fixture={...model,columns:[model.columns[0],columns('상세',[['값','텍스트','읽기전용','','예시']])],actions:actionTable.rows,actionTables:[actionTable],surfaces:[{name:'상세',buttons:['불일치 새로고침'],disabled:[]}]};
  const [figure]=declaredFigures(stateTable([['comparison','비교','상세','','','잠금','없음']]),plain);
  const html=render(figure,fixture);
  assert.match(html, />조회<\/button>/);
  assert.doesNotMatch(html, /disabled[^>]*>조회<\/button>/);
});
function render(figure, fixture = model) {
  return declaredScreen('검증 화면', fixture, figure, {
    plain, searchControl: () => '', manualKey: false,
    annotator: (key) => {
      let count = 0;
      return { badge: () => `<span data-note="${key}-${++count}"></span>`, render: () => Array.from({length:count}, (_,i) => `<div id="note-${key}-${i+1}"></div>`).join('') };
    },
  });
}
test('명시 상태만 생성하고 중복/잘못된 그림 키를 거부한다', () => {
  assert.equal(declaredFigures(null, plain).length, 0);
  assert.throws(() => declaredFigures(stateTable([['bad key'],['bad key']]), plain), /그림 키/);
  assert.throws(() => declaredFigures(stateTable([['same'],['same']]), plain), /그림 키/);
});
test('조회 전용 상태가 저장 버튼이나 편집 입력을 노출하지 않는다', () => {
  const [figure] = declaredFigures(stateTable([['readonly','조회만','상세','읽기 전용','조회','잠금','없음']]), plain);
  const html = render(figure);
  assert.match(html, /readonly/);
  assert.doesNotMatch(html, />저장</);
  assert.match(html, /data-field-label="상세값"/);
});
test('권한 거부는 조회값과 숨은 입력 및 고아 설명을 남기지 않는다', () => {
  const [figure] = declaredFigures(stateTable([['denied','거부','없음','권한 없음','없음','잠금','없음']]), plain);
  const html = render(figure);
  assert.doesNotMatch(html, /목록 예시|기존 값|<input|<button/);
  assert.equal([...html.matchAll(/data-note=/g)].length, [...html.matchAll(/id="note-/g)].length);
});
test('불명 상태 버튼을 선언대로 제한하며 존재하지 않는 버튼/탭을 거부한다', () => {
  const [figure] = declaredFigures(stateTable([['unknown','불명','상세','결과 확인','조회','잠금','없음']]), plain);
  assert.doesNotMatch(render(figure), />저장</);
  assert.throws(() => render({...figure, buttons:['임의 실행']}), /§5/);
  assert.throws(() => render({...figure, detail:'임의 탭'}), /§4/);
});
test('상태별 예시를 적용하고 HTML 및 속성 삽입을 이스케이프한다', () => {
  const [figure] = declaredFigures(stateTable([['invalid','오류','상세','<script>alert(1)</script>','저장','가능','상세값=" onfocus="alert(1)']]), plain);
  const html = render(figure);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /value="&quot; onfocus=&quot;alert\(1\)"/);
  assert.doesNotMatch(html, /value="기존 값"|<script>/);
  assert.doesNotMatch(html, / readonly/);
});
test('조회 입력방식은 열 이름으로 읽고 결과 불명 중 조회 입력을 잠근다', () => {
  const searchTable = {header:['조건','대상 컬럼','필드명','입력방식','연산','선택 출처'], rows:[['상태','USE_YN','useYn','셀렉트','eq','상수 Y=사용·N=미사용']]};
  const fixture = {...model, searchTable, search:searchTable.rows};
  const [figure] = declaredFigures(stateTable([['main','기본','상세','','조회','가능','없음']]), plain);
  assert.match(render(figure, fixture), /<select aria-label="상태" ><option>전체<\/option><option>사용<\/option><option>미사용/);
  assert.match(render({...figure, buttons:[]}, fixture), /<select aria-label="상태" disabled/);
});
test('이력 직접 조회와 과거 구성은 같은 탭에 남고 입력 ID가 겹치지 않는다', () => {
  const fixture = {...model, columns:[...model.columns, columns('상세 / 이전 값 — 폼',[['과거값','텍스트','읽기전용','','과거 예시']])],
    detailSearchTables:[{heading:'2-1. 상세',header:['조건','기본값'],rows:[['원 대상 ID','직접 입력']]}]};
  const [figure] = declaredFigures(stateTable([['history','과거','상세','이력','조회','잠금','없음']]), plain);
  const html = render(figure, fixture);
  assert.match(html, /aria-label="원 대상 ID"/);
  assert.match(html, /과거 예시/);
  assert.equal((html.match(/<span class="on">/g) || []).length,1);
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size);
});
test('검색콤보는 미지정·중복 제거·조회 전용·목록 밖 기존값 보존을 표현한다', () => {
  const table={heading:'상세 — 폼',header:['컬럼','입력방식','편집','검증','예시','후보 예시'],rows:[['시간대','검색콤보','가능','','','Asia/Seoul·Asia/Tokyo·Asia/Seoul']]};
  const fixture={...model,columns:[model.columns[0],table]};
  const [figure]=declaredFigures(stateTable([['main','시간대','상세','','조회','가능','없음']]),plain);
  const html=render(figure,fixture);
  assert.match(html, /value="" selected>미지정/);
  assert.equal((html.match(/value="Asia\/Seoul"/g)||[]).length,1);
  assert.match(render({...figure,editable:false},fixture), /data-combo-filter readonly/);
  assert.match(render({...figure,editable:false},fixture), /data-combo-select[^>]* disabled/);
  assert.match(render({...figure,examples:{시간대:'Legacy/Zone'}},fixture), /value="Legacy\/Zone" selected disabled/);
});
test('기본 상하 배치와 좌우 예외를 구분하고 반출은 허용 상태에만 표시한다', () => {
  const [figure]=declaredFigures(stateTable([['main','기본','상세','','조회','가능','없음']]),plain);
  const top=render(figure);
  assert.match(top,/data-layout="top-bottom"/);
  assert.ok(top.indexOf('data-pane="master"')<top.indexOf('data-pane="detail"'));
  assert.doesNotMatch(top,/data-excel-menu/);
  assert.match(render({...figure,buttons:['조회','엑셀 다운로드']}),/data-excel-menu/);
  assert.match(render(figure,{...model,vertical:false}),/data-layout="left-right"/);
});
test('마스터 셀에서 편집하고 선택 표시 열은 설정 가능한 그리드 컬럼으로 보존한다', () => {
  const main={heading:'현재값',header:['컬럼','입력방식','편집','검증','예시','기본 표시'],rows:[['이름','텍스트','가능','','현재값','표시'],['설명','장문 셀','가능','','전체 설명','선택 표시']]};
  const history={heading:'변경 이력',header:main.header,rows:[['이전 이름','텍스트','읽기전용','','이전값','표시']]};
  const [figure]=declaredFigures(stateTable([['history','이력','변경 이력','','조회','가능','없음']]),plain);
  const html=render(figure,{...model,columns:[main,history]});
  assert.match(html,/data-cell-editor/);
  assert.match(html,/data-grid-col="1" hidden/);
  assert.match(html,/data-grid-column="1"/);
  const lower=html.split('data-pane="detail"')[1];
  assert.doesNotMatch(lower,/data-field-label|class="sf"/);
});
test('고정 판의 장문 셀도 편집 없는 전체 내용 뷰어로 읽는다', () => {
  const columns=[{heading:'현재값',header:['컬럼','입력방식','편집','검증','예시','기본 표시'],rows:[['이름','텍스트','읽기전용','','주문','표시']]},
    {heading:'상세',header:['컬럼','입력방식','편집','검증','예시','기본 표시'],rows:[['검수 근거','장문 셀','조건부','','전체 검수 근거','표시']]}];
  const [figure]=declaredFigures(stateTable([['frozen','고정 판','상세','','조회','잠금','없음']]),plain);
  const html=render(figure,{...model,columns});
  assert.match(html,/<textarea[^>]+readonly>전체 검수 근거<\/textarea>/);
  assert.doesNotMatch(html,/전체 검수 근거 ✎/);
});
test('문맥 밖 하위 목록은 예시 행을 넣지 않고 이름 오류를 거부한다',()=>{
  const [figure]=declaredFigures(stateTable([['main','기본','상세','','조회','잠금','없음']]),plain);
  const fixture={...model,columns:model.columns.map((t,i)=>i?{...t,heading:'상세 — 그리드'}:t)};
  const html=render({...figure,emptyGrids:['상세']},fixture);
  const lower=html.split('data-pane="detail"')[1];
  assert.match(lower,/선택한 문맥에 해당하지 않는 목록/);
  assert.doesNotMatch(lower,/<tr class="sel">/);
  assert.throws(()=>render({...figure,emptyGrids:['없는 목록']}),/§4/);
});

test('건수 탐색은 선언 탭과 컬럼 문맥을 보존하고 숨긴 패널도 하나의 편집본에 남긴다',()=>{
  const main={heading:'목록',header:['컬럼','입력방식','편집','검증','예시'],rows:[['테이블','텍스트','읽기전용','','orders']]};
  const detail={heading:'컬럼 정의',header:[...main.header,'이동 탭'],rows:[['컬럼명','텍스트','읽기전용','','customer_id','—'],['관계','탭 이동','읽기전용','','1건','관계']]};
  const relations={heading:'관계',header:main.header,rows:[['참조','텍스트','조건부','','customers']]};
  const [figure]=declaredFigures(stateTable([['main','기본','컬럼 정의','','조회','가능','없음']]),plain);
  const fixture={...model,interactive:true,columns:[main,detail,relations],rowExamples:{rows:[['컬럼 정의','{"컬럼명":"customer_id"}']]}};
  const html=render(figure,fixture);
  assert.match(html,/data-open-tab="관계" data-context="customer_id"/);
  assert.match(html,/data-detail-panel="관계" hidden/);
  assert.equal([...html.matchAll(/data-note=/g)].length,[...html.matchAll(/id="note-/g)].length);
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size);
  assert.throws(()=>render(figure,{...fixture,columns:[main,detail]}),/이동 탭/);
});

test('상호작용 탭은 각 탭의 검색과 폼을 유지하고 목록 접기를 임의 추가하지 않는다',()=>{
  const [figure]=declaredFigures(stateTable([['main','기본','상세','','조회','가능','없음']]),plain);
  const other=columns('이력',[['이력값','텍스트','읽기전용','','기록']]);
  const fixture={...model,interactive:true,columns:[...model.columns,other],detailSearchTables:[
    {heading:'상세',header:['조건','기본값'],rows:[['상세 검색','전체']]},
    {heading:'이력',header:['조건','기본값'],rows:[['이력 검색','전체']]},
  ]};
  const html=render(figure,fixture);
  assert.match(html,/data-interactive-tabs/);
  assert.match(html,/aria-selected="true" data-detail-tab="상세"/);
  assert.match(html,/data-detail-panel="상세"[\s\S]*data-field-label="상세값"/);
  assert.match(html,/data-detail-panel="이력" hidden[\s\S]*aria-label="이력 검색"/);
  assert.doesNotMatch(html,/data-toggle-master|선택 테이블:/);
  const compact=declaredScreen('검증 화면',fixture,figure,{plain,annotator:()=>({badge:()=>'',render:()=>''}),compact:true});
  assert.doesNotMatch(compact,/data-interactive-tabs|data-detail-tab=/);
  assert.doesNotMatch(render({...figure,detail:'없음',buttons:[]},fixture),/data-interactive-tabs|data-detail-tab=/);
});

test('초안 편집 가능이어도 상태에 없는 최종 승인 버튼은 잠긴다',()=>{
 const fixture={...model,columns:[model.columns[0],columns('상세',[['상세값','텍스트','가능','','값']])],strictButtons:true,actions:[...model.actions,['최종 승인','','','','','전체 판정']],surfaces:[{name:'상세',buttons:['최종 승인'],disabled:[]}]};
 const figure={key:'draft',caption:'초안',detail:'상세',notice:'',buttons:['저장'],editable:true,examples:{}};
 const html=render(figure,fixture);
 assert.match(html,/<button[^>]*disabled[^>]*>최종 승인<\/button>/);
 assert.doesNotMatch(render({...figure,buttons:['저장','최종 승인']},fixture),/<button[^>]*disabled[^>]*>최종 승인<\/button>/);
});

test('완료 상태의 대상별 결과는 공통 미적용 행을 대체하고 다른 상태에 누출되지 않는다',()=>{
 const detail=columns('상세',[['상세값','텍스트','읽기전용','','기본']]);
 const fixture={...model,columns:[model.columns[0],detail],rowExamples:{rows:[
   ['상세','{"상세값":"미적용"}','—'],
   ['상세','{"상세값":"카탈로그 리비전 13"}','applied·delegated'],
   ['상세','{"상세값":"도구 리비전 3"}','applied·delegated'],
 ]}};
 const figure={key:'submitted',caption:'제출',detail:'상세',notice:'',buttons:[],editable:false,examples:{}};
 assert.match(render(figure,fixture),/미적용/);
 assert.doesNotMatch(render(figure,fixture),/리비전 13/);
 const result=render({...figure,key:'walkthrough-2',stateKey:'applied'},fixture);
 assert.match(result,/리비전 13/);assert.match(result,/리비전 3/);assert.doesNotMatch(result,/미적용/);
});

test('요청 초안은 선언된 지역 행 작업만 허용하고 검토·반려는 차단한다',()=>{
 const fixture={...model,columns:[model.columns[0],{...model.columns[1],heading:'상세 — 그리드'}],requestScreen:true,strictButtons:true,addRowTabs:['상세'],
 actions:[...model.actions,['행 추가','','','','','지역 추가'],['행 제거','','','','','지역 제거'],['반려','','','','','전체 반려']],
 surfaces:[{name:'상세',buttons:['행 추가','행 제거','반려'],disabled:[]}]};
 const figure={key:'draft',caption:'초안',detail:'상세',notice:'',buttons:['저장'],editable:true,examples:{}};
 const html=render(figure,fixture);
 assert.match(html,/data-grid-add(?! disabled)/);assert.match(html,/data-grid-delete(?! disabled)/);
 assert.match(html,/<button[^>]*disabled[^>]*>반려<\/button>/);
 assert.match(render({...figure,key:'submitted',editable:false},fixture),/data-grid-add disabled/);
 assert.match(render({...figure,key:'submitted',editable:false},fixture),/data-grid-delete disabled/);
});


test('단일 그리드는 상세 탭 없이 등록 행을 표시하고 빈 목록·권한 없음은 구분한다',()=>{
 const fixture={...model,columns:[columns('모델 조합',[['공급사','선택','가능','','OpenAI'],['모델','선택','가능','','등록 모델']])],rowExamples:{rows:[['모델 조합','{"공급사":"Google Gemini","모델":"모델 A"}','—'],['모델 조합','{"공급사":"OpenAI","모델":"모델 B"}','—']]}};
 const figure={key:'main',caption:'적용본',detail:'없음',notice:'조합 목록',buttons:['조회'],editable:false,examples:{}};
 const html=render(figure,fixture);
 assert.match(html,/data-layout="single-grid"/);assert.match(html,/Google Gemini/);assert.match(html,/모델 B/);
 assert.doesNotMatch(html,/data-pane="detail"|role="tablist"|class="split"/);
 const empty=render({...figure,key:'empty',emptyGrids:['모델 조합']},fixture);
 assert.match(empty,/총 0건/);assert.doesNotMatch(empty,/모델 B/);
 const denied=render({...figure,key:'denied',buttons:[]},fixture);
 assert.doesNotMatch(denied,/<table|모델 B/);
});


test('행별 조건과 복수 허용값으로 우선순위 편집을 구분한다',()=>{
  const fixture={...model,columns:[{heading:'모델 조합',header:['컬럼','입력방식','편집','예시','후보 예시','편집 조건'],rows:[['용도','선택','가능','주 추론','주 추론·요약·분류','—'],['우선순위','숫자','조건부','—','—','용도=요약·분류']]}],rowExamples:{rows:[['모델 조합','{"용도":"주 추론","우선순위":"—"}','—'],['모델 조합','{"용도":"요약","우선순위":"1"}','—'],['모델 조합','{"용도":"분류","우선순위":"2"}','—']]}};
  const [figure]=declaredFigures(stateTable([['edit','편집','없음','','저장','가능','없음']]),plain);
  const html=render(figure,fixture).replace(/<template[\s\S]*?<\/template>/g,'');
  assert.equal((html.match(/data-edit-rule=/g)||[]).length,3);
  assert.equal((html.match(/<details hidden data-cell-editor/g)||[]).length,1);
  assert.match(html,/data-row-value="요약"/);
});


test('모델별 effort 후보를 구분하고 상위 선택 누락을 거부한다',()=>{
 const fixture={...model,columns:[{heading:'용도 설정',header:['컬럼','입력방식','편집','예시','후보 예시','상위 선택','후보 매핑'],rows:[['모델','검색콤보','가능','A','A·B','—','—'],['effort','검색콤보','가능','낮음','낮음·높음','모델','{"A":["낮음"],"B":["높음"]}']]}]};
 const [figure]=declaredFigures(stateTable([['edit','편집','없음','','저장','가능','없음']]),plain);
 const html=render(figure,fixture);
 assert.match(html,/data-parent-field="모델"/);
 assert.match(html,/<option value="낮음" selected>/);
 assert.doesNotMatch(html,/<option value="높음"/);
 const invalid=structuredClone(fixture);invalid.columns[0].rows[1][5]='없는 모델';
 assert.throws(()=>render(figure,invalid),/상위 선택 필드/);
});


test('사용 중인 행은 제거 보호 근거를 갖고 신규 미참조 행과 구분한다',()=>{
 const fixture={...model,removeGuardField:'사용 용도',columns:[columns('모델',[['이름','텍스트','가능','','A'],['사용 용도','텍스트','읽기전용','','—']])],rowExamples:{rows:[['모델','{"이름":"A","사용 용도":"주 추론"}','—'],['모델','{"이름":"B","사용 용도":"없음"}','—']]}};
 const [figure]=declaredFigures(stateTable([['edit','편집','없음','','저장','가능','없음']]),plain);
 const html=render(figure,fixture);
 assert.equal((html.match(/data-remove-blocked=/g)||[]).length,1);
 assert.match(html,/data-remove-blocked="주 추론"/);
});


test('조회조건 밖 버튼 띠를 만들지 않고 그리드별 조회·편집 크롬을 둔다',()=>{
 const fixture={...model,columns:[columns('목록',[['이름','텍스트','가능','','기존']]),columns('세부',[['값','텍스트','읽기전용','','조회값']])],interactive:true};
 const [figure]=declaredFigures(stateTable([['edit','편집','세부','','조회·저장','가능','없음']]),plain);
 const html=render(figure,fixture);
 assert.equal((html.match(/data-grid-read/g)||[]).length,2);
 assert.equal((html.match(/data-grid-add/g)||[]).length,1);
 assert.equal((html.match(/data-grid-save/g)||[]).length,1);
 assert.equal((html.match(/data-grid-state-column/g)||[]).length,1);
 assert.equal((html.match(/data-grid-delete-column/g)||[]).length,1);
 assert.doesNotMatch(html,/<div class="row actions"/);
 assert.match(html,/data-grid-actions[^>]*>[\s\S]*data-grid-read[\s\S]*data-grid-add[\s\S]*data-grid-save/);
});


test('판정 입력이 편집 가능해도 제출된 업무 스냅샷의 추가·저장·삭제는 잠근다',()=>{
 const fixture={...model,columns:[{heading:'제출 업무',header:['컬럼','입력방식','편집','예시','편집 조건'],rows:[['업무값','텍스트','가능','제출값','draft']]},model.columns[1]],interactive:true,requestScreen:true};
 const [figure]=declaredFigures(stateTable([['approval','판정','상세','','조회·저장','가능','없음']]),plain);
 const html=render(figure,fixture).split('<section data-pane="detail">')[0];
 assert.match(html,/data-grid-add disabled/);
 assert.match(html,/data-grid-save disabled/);
 assert.match(html,/data-grid-delete disabled/);
 assert.doesNotMatch(html,/class="edit"/);
});


test('외부 모델 콤보는 표시 문자열과 저장 식별값을 구분한다',()=>{
 const fixture={...model,columns:[{heading:'용도',header:['컬럼','입력방식','편집','예시','후보 예시','후보 값 매핑'],rows:[['외부 모델','검색콤보','가능','공급사 - 모델 - effort','공급사 - 모델 - effort','{"공급사 - 모델 - effort":"EXT-01"}']]}]};
 const [figure]=declaredFigures(stateTable([['edit','편집','없음','','저장','가능','없음']]),plain);
 const html=render(figure,fixture);
 assert.match(html,/<option value="EXT-01" selected>공급사 - 모델 - effort<\/option>/);
 assert.match(html,/data-row-value="EXT-01"/);
 assert.doesNotMatch(html,/<option value="공급사 - 모델 - effort"/);
});


test('승인 사용 화면은 저장 슬롯에서 승인 요청을 한 번 제공한다',()=>{
 const fixture={...model,columns:[columns('자산',[['값','텍스트','가능','','기존']])],actions:[['승인 요청','','','','','전체 후보 제출']],addRowTabs:['자산']};
 const [figure]=declaredFigures(stateTable([['edit','편집','없음','','승인 요청','가능','없음']]),plain);
 const html=render(figure,fixture);
 assert.equal((html.match(/>승인 요청<\/button>/g)||[]).length,1);
 assert.match(html,/data-grid-save data-native-save/);
 assert.doesNotMatch(html,/>저장<\/button>/);
});
