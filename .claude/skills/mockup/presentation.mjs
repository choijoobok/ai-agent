/** 목업 전체에서 같은 요소는 같은 번호와 한 번의 상세 설명을 사용한다. */
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const plain = value => String(value ?? '').replace(/`([^`]+)`/g,'$1').replace(/\*+/g,'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
export const tableCell = (table,row,...names) => {
  for(const name of names){const index=table?.header.findIndex(h=>plain(h)===name);if(index>=0&&row[index]!==undefined)return plain(row[index]);}
  return '';
};
const facts = values => `<dl class="explanation-facts">${values.filter(([,v])=>v&&v!=='—').map(([k,v])=>`<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>`;
export function columnExplanation(table,row){
  const name=plain(row[0]);
  const editable=table.readonly?'읽기전용':tableCell(table,row,'편집').replace(/^불가$/,'읽기전용');
  return `<b>${escapeHtml(table.heading)} › ${escapeHtml(name)}</b>${facts([
    ['설명',tableCell(table,row,'설명','업무 설명','의미','무엇')],
    ['필수 입력',editable==='읽기전용'?'입력 대상 아님 (조회 전용)':(tableCell(table,row,'필수').replace(/^—$/,'선택') || '개별 필수 조건은 공통 규칙 참조')],
    ['입력 방식',tableCell(table,row,'입력방식')], ['편집 조건',editable],
    ['선택·값 출처',tableCell(table,row,'선택 출처','기본값/원천')],
    ['선택 코드',tableCell(table,row,'코드그룹','코드 그룹')],
    ['검증·거부 조건',tableCell(table,row,'검증').replace(/^—$/,'') || (editable==='읽기전용'?'직접 입력하지 않는다. 서버가 반환한 허용 범위의 값을 표시한다.':'아래 공통 검증·실행 규칙을 적용한다. 개별 길이/범위는 임의로 추정하지 않는다.')],
    ['기본값',tableCell(table,row,'기본값')],['표시 예시',tableCell(table,row,'예시')],
    ['연결 동작',tableCell(table,row,'이동 탭')],
  ])}${!tableCell(table,row,'검증')?'<p><a href="#shared-rules">공통 검증·실행 규칙 보기</a></p>':''}`;
}
export function actionExplanation(table,row,scope='화면'){
  return `<b>${escapeHtml(scope)} › ${escapeHtml(plain(row[0]))} 버튼</b>${facts([
    ['하는 일',tableCell(table,row,'동작','무엇','비고')],
    ['사용 조건',tableCell(table,row,'활성 조건','사용 조건')],
    ['필요 권한',tableCell(table,row,'권한','액션')],
    ['저장·조회 범위',tableCell(table,row,'저장 범위','범위')],
    ['확인',tableCell(table,row,'확인 문구','확인 문구 키')],
  ])}`;
}
export function searchExplanation(table,row){
  return `<b>조회 조건 › ${escapeHtml(plain(row[0]))}</b>${facts([
    ['설명',tableCell(table,row,'설명')],['입력 방식',tableCell(table,row,'입력방식')],
    ['필수 입력',tableCell(table,row,'필수')||'선택'],['비교 방식',tableCell(table,row,'연산')],
    ['기본값',tableCell(table,row,'기본값')],['선택 출처',tableCell(table,row,'선택 출처')],
    ['검증',tableCell(table,row,'검증')],
  ])}`;
}
export function annotationBook(){
  const notes=[];const byKey=new Map();
  return {
    badge(description,key=description){
      let note=byKey.get(key);
      if(!note){note={id:`item-${notes.length+1}`,number:notes.length+1,description};notes.push(note);byKey.set(key,note);}
      return `<span class="n anchor" data-note="${note.id}" role="link" tabindex="0" aria-label="설명 ${note.number} 보기">${note.number}</span>`;
    },
    render(){return `<section class="annotation-catalog" id="element-descriptions" data-annotation-catalog><h2>화면 요소 상세 설명</h2><p>같은 번호는 같은 항목입니다. 화면의 번호를 누르면 해당 설명으로 이동합니다.</p><ol>${notes.map(n=>`<li id="note-${n.id}"><span class="n">${n.number}</span><div>${n.description}</div></li>`).join('')}</ol></section>`;},
  };
}
export function surfaceRows(table){
  return (table?.rows??[]).map(row=>({
    name:tableCell(table,row,'영역'), kind:tableCell(table,row,'종류')||'영역',
    purpose:tableCell(table,row,'관리 대상·목적'), workflow:tableCell(table,row,'작업 설명'),
    buttons:tableCell(table,row,'버튼').split('·').map(s=>s.trim()).filter(s=>s&&s!=='없음'),
    disabled:tableCell(table,row,'비활성 버튼').split('·').map(s=>s.trim()).filter(s=>s&&s!=='없음'),
    trigger:tableCell(table,row,'조회 방식'), save:tableCell(table,row,'저장 범위'),
  }));
}
export function surfaceIntroduction(surface){
  if(!surface)return '';
  return `<div class="surface-guide"><p><b>관리 대상:</b> ${escapeHtml(surface.purpose)}</p><p><b>작업:</b> ${escapeHtml(surface.workflow)}</p>${facts([['조회',surface.trigger],['저장 범위',surface.save]])}</div>`;
}
export const surfaceOf = (model,name) => model.surfaces?.find(s=>s.name===name);
