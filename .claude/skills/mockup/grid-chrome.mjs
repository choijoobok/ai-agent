// DataGrid 크롬의 목업 표현. 저장 계약/권한은 각 화면 정본이 갖는다.
export const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const editableColumn = value => /가능|조건부|신규|^Y$/.test(value) && !/불가|읽기/.test(value);
export function chrome({title,count='',read,add='',save='',actions='',tools=''}) {
  return `<div class="tb" data-grid-toolbar style="flex-wrap:wrap;gap:6px"><span class="tb-meta"><span class="ttl">${esc(title)}</span><span class="cnt">${esc(count)}</span></span><span data-grid-actions style="margin-left:auto;display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap">${read}${add}${save}${actions}${tools}</span></div>`;
}
export function standardButton(name,action,locked=false,description='') {
  return `<button type="button" class="btn ghost sm" data-grid-${action}${locked?' disabled':''} title="${esc(description)}">${esc(name)}</button>`;
}
export function stateHeads(editable) {
  return editable ? '<th data-grid-state-column style="width:54px">상태</th><th data-grid-delete-column style="width:46px">삭제</th>' : '';
}
export function stateCells(editable,locked,protectedBy='') {
  return editable ? `<td data-grid-state-cell><span data-row-state></span><button type="button" class="btn ghost sm" data-revert-row hidden title="행의 값을 원본으로 되돌리기">↶</button></td><td><button type="button" class="btn ghost sm" data-grid-delete${locked||protectedBy?' disabled':''} title="${esc(protectedBy?protectedBy+' 용도에서 사용 중 — 참조 해소 후 삭제':'삭제 표시/해제. 실제 반영은 저장 시 수행')}">×</button></td>` : '';
}
