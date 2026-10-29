import assert from 'node:assert/strict';
import { test } from 'node:test';
import { declaredFigures, declaredScreen } from './declared-layout.mjs';

const plain = (x) => String(x ?? '').replace(/`|\*/g, '').trim();
const stateTable = (rows) => ({ header: ['그림 키','상태','상세 영역','안내','허용 버튼','편집','예시 변경'], rows });
const columns = (heading, rows) => ({ heading, header: ['컬럼','입력방식','편집','검증','예시'], rows });
const model = {
  columns: [columns('목록', [['이름','텍스트','읽기전용','','목록 예시']]), columns('상세 — 폼', [['상세값','텍스트','가능','필수','기존 값']])],
  actions: [['조회','','','','','목록 조회'],['저장','','','','','전체 저장']], search: [],
};
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
  assert.match(render({...figure,editable:false},fixture), /data-combo-select disabled/);
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
