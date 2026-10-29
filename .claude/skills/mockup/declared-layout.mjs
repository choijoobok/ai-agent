/** 요건서에 명시한 상태·상세 폼을 공통 템플릿의 어휘로 렌더링한다. */
import {snapshotView} from './snapshot-view.mjs';
const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const titleOf = (table) => table.heading.replace(/^\d+(?:-\d+)?\.?\s*/, '').replace(/\s*—\s*(폼|그리드)$/, '');
const tabOf = (table) => titleOf(table).split(' / ')[0];
const cell = (table, row, header) => row[table.header.findIndex((h) => h.replace(/\*/g, '') === header)] ?? '';

function searchCombo(id, label, value, examples, locked) {
  const values = [...new Set(examples.split('·').map((s) => s.trim()).filter((s) => s && s !== '—'))];
  const options = ['', ...values].map((v) => `<option value="${escape(v)}"${v === value ? ' selected' : ''}>${escape(v || '미지정')}</option>`).join('');
  const missing = value && !values.includes(value) ? `<option value="${escape(value)}" selected disabled>${escape(value)} (지원 확인 필요)</option>` : '';
  return `<div data-search-combo><input type="search" aria-label="${escape(label)} 검색" placeholder="검색어로 후보 좁히기" data-combo-filter ${locked ? 'readonly' : ''}>
    <select id="${id}" size="4" data-combo-select ${locked ? 'disabled' : ''}>${options}${missing}</select>
    <div class="hint" data-combo-value>현재 선택: ${escape(value || '미지정')}</div><div class="hint" data-combo-empty hidden>일치하는 후보가 없습니다.</div></div>`;
}

/** 검색 문자열은 선택값을 변경하지 않으며 실제 선택 이벤트만 현재 값을 표시한다. */
export function searchComboScript() {
  return `<script>
document.addEventListener('input', function(event) {
  if (!event.target.matches('[data-combo-filter]') || event.target.readOnly) return;
  var box = event.target.closest('[data-search-combo]');
  var query = event.target.value.toLowerCase();
  var matched = 0;
  Array.from(box.querySelector('select').options).forEach(function(option) {
    option.hidden = option.value !== '' && !option.textContent.toLowerCase().includes(query);
    if (option.value !== '' && !option.hidden && !option.disabled) matched++;
  });
  box.querySelector('[data-combo-empty]').hidden = matched !== 0;
});
document.addEventListener('change', function(event) {
  if (event.target.matches('[data-grid-column]')) {
    var view=event.target.closest('[data-grid-view]');
    view.querySelectorAll('[data-grid-col="'+event.target.dataset.gridColumn+'"]').forEach(function(cell){cell.hidden=!event.target.checked;});
    return;
  }
  if (!event.target.matches('[data-combo-select]') || event.target.disabled) return;
  event.target.closest('[data-search-combo]').querySelector('[data-combo-value]').textContent = '현재 선택: ' + (event.target.value || '미지정');
});
document.addEventListener('click', function(event) {
  if(event.target.matches('[data-close-editor]')) event.target.closest('details[data-cell-editor]').open=false;
});
function openDeclaredCell() {
  document.querySelectorAll('[data-auto-editor]').forEach(function(editor){editor.open=editor.closest('.screen').id===location.hash.slice(1);});
}
window.addEventListener('hashchange',openDeclaredCell);
openDeclaredCell();
</script>`;
}

export function declaredFigures(table, plain) {
  if (!table) return [];
  const figures = table.rows.map((r) => ({
    key: plain(cell(table, r, '그림 키')), caption: plain(cell(table, r, '상태')),
    detail: plain(cell(table, r, '상세 영역')), notice: plain(cell(table, r, '안내')),
    buttons: plain(cell(table, r, '허용 버튼')).split('·').filter((x) => x && x !== '없음'),
    editable: plain(cell(table, r, '편집')) === '가능',
    examples: Object.fromEntries(plain(cell(table, r, '예시 변경')).split(';').filter((p) => p.includes('=')).map((p) => {
      const at = p.indexOf('=');
      return [p.slice(0, at).trim(), p.slice(at + 1).trim()];
    })),
    cellEditor: plain(cell(table, r, '셀 편집')),
    emptyGrids: plain(cell(table,r,'빈 그리드')).split(';').map(x=>x.trim()).filter(x=>x&&x!=='없음'),
  }));
  if (figures.some((f) => !/^[a-z0-9][\w-]*$/.test(f.key)) || new Set(figures.map((f) => f.key)).size !== figures.length) {
    throw new Error('목업 상태의 그림 키는 중복 없는 영문·숫자·하이픈이어야 한다');
  }
  return figures;
}

export function declaredScreen(title, model, figure, { annotator, plain, searchControl, manualKey }) {
  if ((figure.emptyGrids ?? []).some(name=>!model.columns.some(t=>titleOf(t)===name&&!/—\s*폼$/.test(t.heading)))) throw new Error('목업 상태의 빈 그리드 이름이 §4에 없다');
  const n = annotator(figure.key);
  const badge = (label, detail = '') => n.badge(`<b>${escape(label)}</b> — ${escape(detail || label)}`);
  const buttons = figure.buttons.filter((name) => name !== '엑셀 다운로드').map((name) => {
    const row = model.actions.find((r) => plain(r[0]) === name);
    if (!row) throw new Error(`목업 상태 ${figure.key}의 버튼 '${name}'이 §5에 없다`);
    return `<button type="button" class="btn ghost sm">${escape(name)}${badge(name, plain(row[5]))}</button>`;
  }).join('');
  const details = model.columns.slice(1);
  const selected = details.filter((t) => tabOf(t) === figure.detail);
  if (figure.detail !== '없음' && !selected.length) throw new Error(`목업 상태 ${figure.key}의 상세 영역 '${figure.detail}'이 §4에 없다`);
  const showData = figure.detail !== '없음';
  if (!showData && figure.buttons.length === 0) {
    return `<div class="screen leaf" id="${escape(figure.key)}"${manualKey ? ` data-manual="${escape(figure.key)}"` : ''}><div class="bar">${escape(title)} · ${escape(figure.caption)}</div><div class="body"><div class="notes">${escape(figure.notice)}${badge('권한 안내', figure.notice)}</div></div></div>\n${n.render()}`;
  }
  const example = (table, row) => Object.hasOwn(figure.examples, plain(row[0])) ? figure.examples[plain(row[0])] : plain(cell(table, row, '예시'));
  const tableView = (table, empty = false) => {
    const label = titleOf(table);
    const contextEmpty = figure.emptyGrids?.includes(label);
    empty = empty || contextEmpty;
    const gridId = `${figure.key}-grid-${model.columns.indexOf(table)}`;
    const optional = (r) => plain(cell(table,r,'기본 표시')) === '선택 표시';
    const hidden = (r) => optional(r) ? ' hidden' : '';
    const heads = table.rows.map((r,i) => `<th data-grid-col="${i}"${hidden(r)} style="white-space:normal">${escape(plain(r[0]))}${badge(plain(r[0]), plain(cell(table, r, '검증')))}</th>`).join('');
    const vals = table.rows.map((r,i) => {
      const editable = figure.editable && /가능|조건부/.test(plain(cell(table, r, '편집')));
      const value = example(table, r) || '—';
      const mode=plain(cell(table,r,'입력방식'));
      let content=escape(value);
      const isSnapshot=/스냅샷 뷰어/.test(mode);
      if(editable || /장문/.test(mode) || isSnapshot) {
        const controlId=`${gridId}-cell-${i}`;
        const labels=Object.fromEntries(model.columns.flatMap(t=>t.rows.map(row=>[plain(cell(t,row,'필드명')).replace(/^snapshot\s*의\s*|^snapshot\.|^values\./,'').replace(/\[\]$/,''),plain(row[0]).replace(/^반영 후 /,'')])).filter(([key])=>/^[a-zA-Z]\w*$/.test(key)));
        const formatRow=table.rows.find(row=>plain(cell(table,row,'필드명'))==='snapshotVersion');
        const control=isSnapshot?snapshotView(example(table,r)||'',Number(formatRow?example(table,formatRow):0),labels)
          : /검색콤보/.test(mode) ? searchCombo(controlId,plain(r[0]),example(table,r)||'',plain(cell(table,r,'후보 예시')),!editable)
          : /장문/.test(mode) ? `<textarea id="${controlId}" rows="5" ${editable?'':'readonly'}>${escape(example(table,r)||'')}</textarea>`
          : /선택|셀렉트/.test(mode) ? `<select id="${controlId}"><option>${escape(value)}</option></select>`
          : `<input id="${controlId}" value="${escape(example(table,r)||'')}" ${editable?'':'readonly'}>`;
        content=`<details data-cell-editor${isSnapshot?' data-snapshot-viewer':''}${figure.cellEditor===plain(r[0])?' data-auto-editor':''}><summary title="${isSnapshot?'전체 스냅샷 보기':escape(value)}" style="overflow:hidden;text-overflow:ellipsis">${isSnapshot?'보기':escape(value)+(editable?' ✎':' 보기')}</summary><div class="modal" style="position:fixed;top:12%;left:50%;transform:translateX(-50%);width:min(${isSnapshot?'800':'520'}px,90vw);z-index:20;white-space:normal"><div class="mh">${escape(plain(r[0]))}<button type="button" class="btn ghost sm" data-close-editor>닫기</button></div><div class="mb${isSnapshot?'':' f'}" style="max-height:70vh;overflow:auto">${control}</div></div></details>`;
      }
      return `<td data-grid-col="${i}"${hidden(r)}${editable ? ' class="edit"' : ''} style="overflow:hidden;text-overflow:ellipsis" title="${isSnapshot?'전체 스냅샷 보기':escape(value)}">${content}</td>`;
    }).join('');
    const body = empty ? `<tr><td class="empty" colspan="${table.rows.length}">${escape(contextEmpty?'선택한 문맥에 해당하지 않는 목록입니다.':figure.notice)}</td></tr>` : `<tr class="sel">${vals}</tr>`;
    const excel=figure.buttons.includes('엑셀 다운로드')?'<details data-excel-menu><summary>엑셀 다운로드 ▾</summary><span>현재 페이지 · 전체</span></details>':'';
    const settings=`<details data-grid-settings><summary>그리드 설정</summary><div class="notes">${table.rows.map((r,i)=>`<label style="display:block"><input type="checkbox" data-grid-column="${i}" ${optional(r)?'':'checked'}>${escape(plain(r[0]))}</label>`).join('')}</div></details>`;
    return `<div data-grid-view="${gridId}" data-grid-role="${table===model.columns[0]?'master':'detail'}"><div class="tb"><span class="ttl">${escape(label)}${badge(label)}</span><span class="cnt">${empty ? '0' : '1'}건</span>${excel}${settings}</div>
      <div class="grid" style="overflow:auto"><table style="width:100%;table-layout:fixed"><thead><tr>${heads}</tr></thead><tbody>${body}</tbody></table></div>
      <div class="pg">총 ${empty ? '0' : '1'}건 · 1 페이지</div></div>`;
  };
  const formView = (table) => table.rows.map((r, i) => {
    const label = plain(r[0]);
    const ro = !figure.editable || plain(cell(table, r, '편집')) === '읽기전용';
    const input = plain(cell(table, r, '입력방식'));
    const value = example(table, r) || '';
    const fieldId = `${figure.key}-table-${model.columns.indexOf(table)}-field-${i}`;
    const control = /검색콤보/.test(input)
      ? searchCombo(fieldId, label, value, plain(cell(table, r, '후보 예시')), ro)
      : /장문/.test(input)
      ? `<textarea id="${fieldId}" rows="2" ${ro ? 'readonly' : ''}>${escape(value)}</textarea>`
      : /선택|셀렉트/.test(input)
        ? `<select id="${fieldId}" ${ro ? 'disabled' : ''}><option>${escape(value || '미지정')}</option></select>`
        : `<input id="${fieldId}" value="${escape(value)}" ${ro ? 'readonly' : ''}>`;
    return `<div class="f${ro ? ' ro' : ''}"><label for="${fieldId}" data-field-label="${escape(label)}">${escape(label)}${badge(label, plain(cell(table, r, '검증')))}</label>${control}</div>`;
  }).join('');
  const tabs = [...new Set(details.map(tabOf))].map((name) => `<span class="${name === figure.detail ? 'on' : ''}">${escape(name)}${badge(name, '선택한 대상의 이 영역을 확인합니다.')}</span>`).join('');
  const extraSearch = model.detailSearchTables?.find((t) => titleOf(t) === figure.detail);
  const detailSearch = extraSearch ? `<div class="sf" style="grid-template-columns:max-content minmax(0,1fr)">${extraSearch.rows.map((r) => `<label>${escape(plain(r[0]))}${badge(plain(r[0]),plain(cell(extraSearch,r,'기본값')))}</label><input aria-label="${escape(plain(r[0]))}" placeholder="${escape(plain(r[0]))}">`).join('')}</div>` : '';
  const detail = selected.length ? detailSearch + selected.map((t) => /—\s*폼$/.test(t.heading) ? `<h3>${escape(titleOf(t))}</h3>${formView(t)}` : tableView(t)).join('') : `<p>${escape(figure.notice)}</p>`;
  const search = model.search.map((r) => {
    if (!model.searchTable) return searchControl(r, n);
    const label = plain(r[0]);
    const locked = !figure.buttons.includes('조회');
    const mode = plain(cell(model.searchTable, r, '입력방식'));
    const choices = plain(cell(model.searchTable, r, '선택 출처')).replace(/^상수\s*/, '').split('·');
    const control = /셀렉트|선택/.test(mode)
      ? `<select aria-label="${escape(label)}" ${locked ? 'disabled' : ''}><option>전체</option>${choices.map((x) => `<option>${escape(x.includes('=') ? x.slice(x.indexOf('=')+1) : x)}</option>`).join('')}</select>`
      : `<input aria-label="${escape(label)}" placeholder="${escape(label)}" ${locked ? 'readonly' : ''}>`;
    return `<label>${escape(label)}${badge(label, plain(cell(model.searchTable, r, '연산')))}</label>${control}`;
  }).join('');
  const master = tableView(model.columns[0],!showData);
  const lower = `<div class="tabs" style="flex-wrap:wrap">${tabs}</div>${detail}`;
  const panes = model.vertical!==false
    ? `<div data-layout="top-bottom" style="margin-top:12px"><section data-pane="master">${master}</section><div class="split"><span class="hnd">⋮⋮⋮</span></div><section data-pane="detail">${lower}</section></div>`
    : `<div class="splitrow" data-layout="left-right" style="margin-top:12px"><div class="pane">${master}</div><div class="split v"><span class="hnd">⋮</span></div><div class="pane">${lower}</div></div>`;
  const main = `<div class="sf">${search}</div><div class="row" style="flex-wrap:wrap;margin:10px 0">${buttons}</div>
       <div class="notes" role="status">${escape(figure.notice)}${badge('상태 안내', figure.notice)}</div>
       ${panes}`;
  return `<div class="screen leaf" id="${escape(figure.key)}"${manualKey ? ` data-manual="${escape(figure.key)}"` : ''}>
    <div class="bar">${escape(title)} · ${escape(figure.caption)} · 검토용 예시</div><div class="body">${main}</div></div>\n${n.render()}`;
}
