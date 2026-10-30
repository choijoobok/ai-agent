import {test} from 'node:test';
import assert from 'node:assert/strict';
import {annotationBook,visibleNoteIds,annotationIssues,columnExplanation} from './presentation.mjs';
import {declaredScreen} from './declared-layout.mjs';
const plain=s=>String(s??'');
test('같은 컬럼은 상태가 달라도 같은 번호와 설명 하나를 사용한다',()=>{
 const book=annotationBook();
 assert.equal(book.badge('설명','column:이름'),book.badge('설명','column:이름'));
 book.badge('다른 설명','column:다른 이름');
 assert.equal([...book.render().matchAll(/id="note-/g)].length,2);
 assert.equal([...book.render().matchAll(/data-annotation-catalog/g)].length,1);
});
test('필수 시점·검증·출처를 별도 표시하고 조회 전용은 사용자 필수 입력으로 오해하지 않게 한다',()=>{
 const table={heading:'컬럼 정의',header:['컬럼','설명','필수','편집','선택 출처','검증']};
 const html=columnExplanation(table,['업무명','값의 업무 의미','검수 전','조건부','직접 입력','200자, 초안 null 허용']);
 assert.match(html,/필수 입력<\/dt><dd>검수 전/);
 assert.match(html,/검증·거부 조건<\/dt><dd>200자, 초안 null 허용/);
 assert.match(columnExplanation(table,['등록일시','최초 저장 시각','필수','읽기전용','서버','']),/입력 대상 아님/);
});
const grid=(heading,editable='가능')=>({heading,header:['컬럼','입력방식','편집','예시'],rows:[['대상 컬럼','텍스트',editable,'order_status']]});
const model={columns:[grid('목록','읽기전용'),grid('코드 값'),grid('코드 조건')],actions:[['최신 상세 조회','','','','','전체 재조회'],['코드 값 추가','','','','','INLINE 행 추가'],['코드 조건 추가','','','','','CODE 조건 행 추가']],search:[],rowExamples:{rows:[['컬럼 정의',JSON.stringify({'컬럼명':'order_status','값 방식':'CODE'})]]},surfaces:[{name:'코드 값',buttons:['최신 상세 조회','코드 값 추가']},{name:'코드 조건',buttons:['코드 조건 추가']}],addRowTabs:['코드 값','코드 조건'],interactive:true};
const figure={key:'main',detail:'코드 값',caption:'후보',editable:true,buttons:[],examples:{},emptyGrids:[]};
function render(f,m=model){const b=annotationBook();return declaredScreen('목업',m,f,{plain,annotator:()=>({badge:(...a)=>b.badge(...a),render:()=>''})});}
test('저장 중·결과 불명에는 로컬 재조회도 잠근다',()=>{
 for(const key of ['saving','unknown','conflict']){
  assert.match(render({...figure,key,editable:false}),/<button[^>]+disabled[^>]*>최신 상세 조회/);
 }
});
test('CODE 컬럼에는 INLINE 행을, INLINE 컬럼에는 CODE 조건을 추가할 수 없다',()=>{
 const grid=(html,id)=>html.split('data-grid-view="'+id+'"')[1].split('<div data-grid-view=')[0];
 assert.match(grid(render(figure),'main-grid-1'),/data-grid-add disabled/);
 assert.doesNotMatch(grid(render(figure),'main-grid-2'),/data-grid-add disabled/);
 const inline=render({...figure,examples:{'컬럼명':'order_status','값 방식':'INLINE'}});
 assert.doesNotMatch(grid(inline,'main-grid-1'),/data-grid-add disabled/);
 assert.match(grid(inline,'main-grid-2'),/data-grid-add disabled/);
});


test('초기 표시 요소를 먼저 연속 배정하고 숨김/닫힌 창은 추가 설명으로 묶는다',()=>{
 const book=annotationBook();
 const hidden=book.badge('<b>숨김 코드</b>','hidden');
 const search=book.badge('<b>조회 조건</b>','search');
 const settings=book.badge('<b>그리드 설정</b>','settings');
 const close=book.badge('<b>편집창 닫기</b>','close');
 const initial=`<div hidden>${hidden}</div><label>${search}</label><details><summary>${settings}</summary>${close}</details>`;
 const rewrite=book.prioritize(initial),view=rewrite(initial),catalog=book.render();
 assert.deepEqual(visibleNoteIds(view),['item-1','item-2']);
 assert.match(view,/data-note="item-1"[^>]*>1<\/span>/);
 const [base,extra]=catalog.split('<details data-extra-annotations>');
 assert.match(base,/id="note-item-1"[\s\S]*조회 조건/);
 assert.match(base,/id="note-item-2"[\s\S]*그리드 설정/);
 assert.doesNotMatch(base,/숨김 코드|편집창 닫기/);
 assert.match(extra,/id="note-item-3"[\s\S]*숨김 코드/);
 assert.match(extra,/id="note-item-4"[\s\S]*편집창 닫기/);
 assert.deepEqual(annotationIssues(view+catalog),[]);
 assert.ok(annotationIssues(view.replace('>1</span>','>99</span>')+catalog).length);
 assert.throws(()=>book.badge('나중 요소'),/번호를 확정/);
});
test('숨김 탭/템플릿/닫힌 대화상자는 제외하고 열린 details의 번호는 유지한다',()=>{
 const badge=id=>`<span data-note="${id}">1</span>`;
 const html=`<section hidden><div>${badge('hidden')}</div></section><template>${badge('template')}</template><dialog>${badge('dialog')}</dialog><details open><summary>${badge('summary')}</summary><div>${badge('body')}</div></details><details><summary>${badge('closed-summary')}</summary><div>${badge('closed-body')}</div></details>`;
 assert.deepEqual(visibleNoteIds(html),['summary','body','closed-summary']);
});
