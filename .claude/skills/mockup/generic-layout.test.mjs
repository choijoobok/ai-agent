import assert from 'node:assert/strict';
import {test} from 'node:test';
import {genericScreen} from './generic-layout.mjs';

const columns=(heading,value)=>({heading,header:['컬럼','입력방식','편집','예시'],rows:[['값','텍스트','가능',value]]});
const surfaces=[{name:'목록',kind:'목록',buttons:[]},{name:'역할',kind:'탭',buttons:[]},{name:'설정',kind:'탭 폼',buttons:[]}];
const model={columns:[columns('목록','사용자'),columns('역할','운영자'),columns('설정','유지할 입력')],surfaces,search:[],actions:[],actionTables:[],vertical:true};
const options={annotator:()=>({badge:()=>''})};
const render=(fixture=model,extra={})=>genericScreen('사용자',fixture,{key:'main',caption:'초기 화면'},{...options,...extra});

test('일반 목업도 초기 화면의 모든 탭 패널과 실제 버튼을 생성한다',()=>{
  const html=render();
  assert.match(html,/data-interactive-tabs/);
  assert.match(html,/role="tablist"/);
  assert.match(html,/aria-selected="true" data-detail-tab="역할"/);
  assert.match(html,/data-detail-panel="역할"><div/);
  assert.match(html,/data-detail-panel="설정" hidden[\s\S]*value="유지할 입력"/);
  assert.equal([...html.matchAll(/data-detail-panel=/g)].length,2);
  assert.equal([...html.matchAll(/<th(?:\s|>)/g)].length,2);
});

test('탭별 설명 그림에는 탭바를 반복하지 않고 지정한 영역만 보여준다',()=>{
  const html=render(model,{compact:true,surfaceName:'설정'});
  assert.match(html,/value="유지할 입력"/);
  assert.doesNotMatch(html,/data-interactive-tabs|data-detail-tab=|운영자/);
});

test('최상단이 탭인 화면과 탭 없는 단일 목록을 구분한다',()=>{
  const tabOnly={...model,columns:model.columns.slice(1),surfaces:surfaces.slice(1)};
  const html=render(tabOnly);
  assert.match(html,/data-detail-panel="역할"/);
  assert.equal([...html.matchAll(/data-detail-panel=/g)].length,2);
  assert.doesNotMatch(render({...model,columns:model.columns.slice(0,1),surfaces:surfaces.slice(0,1)}),/data-interactive-tabs|role="tablist"/);
  assert.throws(()=>render({...model,columns:model.columns.slice(0,2)}),/컬럼 표가 §4에 없다/);
});
