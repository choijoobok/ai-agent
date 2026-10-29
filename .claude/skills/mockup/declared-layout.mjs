/** 요건서에 명시한 상태·상세 폼을 공통 템플릿의 어휘로 렌더링한다. */
import {snapshotView} from './snapshot-view.mjs';
import {readFileSync} from 'node:fs';
import {columnExplanation, actionExplanation, searchExplanation, surfaceOf, surfaceIntroduction} from './presentation.mjs';
const controls = readFileSync(new URL('../../../aidd-guide/artifact/site-kit/assets/mockup-controls.js', import.meta.url), 'utf8');
const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const titleOf = (table) => table.heading.replace(/^\d+(?:-\d+)?\.?\s*/, '').replace(/\s*—\s*(폼|그리드)$/, '');
const tabOf = (table) => titleOf(table).split(' / ')[0];
const cell = (table, row, header) => row[table.header.findIndex((h) => h.replace(/\*/g, '') === header)] ?? '';

function searchCombo(id, label, value, examples, locked, parent = '', mapping = '', multiple = false) {
  const values = [...new Set(examples.split('·').map((s) => s.trim()).filter((s) => s && s !== '—'))];
  const options = ['', ...values].map((v) => `<option value="${escape(v)}"${v === value ? ' selected' : ''}>${escape(v || '미지정')}</option>`).join('');
  const missing = value && !values.includes(value) ? `<option value="${escape(value)}" selected disabled>${escape(value)} (지원 확인 필요)</option>` : '';
  return `<div data-search-combo${parent ? ` data-parent-field="${escape(parent)}" data-candidate-map="${escape(mapping)}"` : ''}><input type="search" aria-label="${escape(label)} 검색" placeholder="검색어로 후보 좁히기" data-combo-filter ${locked ? 'readonly' : ''}>
    <select id="${id}" aria-label="${escape(label)}" size="4" ${multiple?'multiple':''} data-combo-select data-edit-value data-field-name="${escape(label)}" ${locked ? 'disabled' : ''}>${options}${missing}</select>
    <div class="hint" data-combo-value>현재 선택: ${escape(value || '미지정')}</div><div class="hint" data-combo-empty hidden>일치하는 후보가 없습니다.</div></div>`;
}

/** 검색 문자열은 선택값을 변경하지 않으며 실제 선택 이벤트만 현재 값을 표시한다. */
export function searchComboScript() {
  return `<script>${controls}\nbindDeclaredMockup(document);
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

export function declaredScreen(title, model, figure, { annotator, plain, searchControl, manualKey, compact = false }) {
  if ((figure.emptyGrids ?? []).some(name=>!model.columns.some(t=>titleOf(t)===name&&!/—\s*폼$/.test(t.heading)))) throw new Error('목업 상태의 빈 그리드 이름이 §4에 없다');
  const n = annotator(figure.key);
  const interactive = model.interactive && !compact;
  const supportsValueMode = scope => {
    const required = scope==='코드 값'?'INLINE':scope==='코드 조건'?'CODE':null;
    if(!required)return true;
    const columns=(model.rowExamples?.rows??[]).filter(r=>plain(r[0])==='컬럼 정의').map(r=>JSON.parse(r[1]));
    return columns.some(r=>(figure.examples['컬럼명']===r['컬럼명']&&figure.examples['값 방식']?figure.examples['값 방식']:r['값 방식'])===required);
  };
  const badge = (label, detail = '', key = label) => n.badge(`<b>${escape(label)}</b> — ${escape(detail || label)}`, key);
  const button = (name, scope = '화면') => {
    const actionTable = model.actionTables?.find(t=>t.rows.some(r=>plain(r[0])===name));
    const row = actionTable?.rows.find(r=>plain(r[0])===name) ?? model.actions.find((r) => plain(r[0]) === name);
    if (!row) throw new Error(`목업 상태 ${figure.key}의 버튼 '${name}'이 §5에 없다`);
    const surface = surfaceOf(model,scope);
    const read = /조회|목록|열람|확인|상세|사용처|검증 결과|관리측 후보 열기/.test(name);
    const locked = ['saving','unknown','conflict','denied'].includes(figure.key);
    const modeLocked=/추가|제거/.test(name)&&!supportsValueMode(scope);
    const disabled = modeLocked || (locked && !figure.buttons.includes(name)) || (!figure.editable && !read && !figure.buttons.includes(name)) || surface?.disabled?.includes(name) || name === '수동 샘플';
    const add = !disabled && /추가$/.test(name) && (model.addRowTabs??[]).includes(scope);
    const description = actionTable ? actionExplanation(actionTable,row,title) : `<b>${escape(name)}</b> — ${escape(plain(row[5]))}`;
    const locations=model.surfaces?.filter(s=>s.buttons.includes(name))??[];
    const saveScopes=[...new Set(locations.map(s=>s.save))];
    const note=n.badge(description+(locations.length?`<p>배치: ${escape(locations.map(s=>s.name).join(' · '))}</p><p>저장 범위: ${escape(saveScopes.join(' / '))}</p>`:''),`action:${name}`);
    return `<span class="control-annotation"><button type="button" class="btn ghost sm"${disabled?' disabled':''}${modeLocked?' title="해당 값 방식의 등록 컬럼이 없어 사용할 수 없습니다"':''}${add?' data-add-demo-row':''}>${escape(name)}</button>${note}</span>`;
  };
  const buttons = () => compact ? '' : figure.buttons.filter((name) => name !== '엑셀 다운로드').map(name=>button(name)).join('');
  const details = model.columns.slice(1);
  const selected = details.filter((t) => tabOf(t) === figure.detail);
  if (figure.detail !== '없음' && !selected.length) throw new Error(`목업 상태 ${figure.key}의 상세 영역 '${figure.detail}'이 §4에 없다`);
  const showData = figure.detail !== '없음';
  if (!showData && figure.buttons.length === 0) {
    return `<div class="screen leaf" id="${escape(figure.key)}"${manualKey ? ` data-manual="${escape(figure.key)}"` : ''}><div class="bar">${escape(title)} · ${escape(figure.caption)}</div><div class="body"><div class="notes">${escape(figure.notice)}</div></div></div>\n${n.render()}`;
  }
  const example = (table, row) => Object.hasOwn(figure.examples, plain(row[0])) ? figure.examples[plain(row[0])] : plain(cell(table, row, '예시'));
  const configured = (table) => (model.rowExamples?.rows ?? []).filter(r => plain(r[0]) === titleOf(table)).map(r => JSON.parse(r[1]));
  const popup = (name, id, locked) => (model.popups?.rows ?? []).filter(r => plain(r[0]) === name).map((r, i) => {
    const label = plain(r[1]), mode = plain(r[2]), value = plain(r[3]), candidates = plain(r[4]);
    const parent = plain(r[5]) === '—' ? '' : plain(r[5]);
    if (parent) JSON.parse(r[6]);
    const control = /검색콤보|팝업 선택|선택/.test(mode) ? searchCombo(`${id}-popup-${i}`, label, value, candidates, locked, parent, r[6])
      : `<input data-edit-value aria-label="${escape(label)}" value="${escape(value)}" ${locked ? 'readonly' : ''}>`;
    return `<label>${escape(label)}${badge(label,`설정 창: ${name}. ${mode}. 선택 후보: ${candidates}. ${parent?parent+' 선택 후 그 대상의 후보만 선택한다.':'입력은 선택 적용 후 편집본에 반영한다.'}`,`popup:${name}:${label}`)}</label>${control}`;
  }).join('');
  const tableView = (table, empty = false) => {
    const label = titleOf(table);
    const contextEmpty = figure.emptyGrids?.includes(label);
    empty = empty || contextEmpty;
    const gridId = `${figure.key}-grid-${model.columns.indexOf(table)}`;
    const optional = (r) => plain(cell(table,r,'기본 표시')) === '선택 표시';
    const hidden = (r) => optional(r) ? ' hidden' : '';
    const width = r => Number.parseInt(cell(table, r, '폭/정렬'), 10) || 120;
    const heads = table.rows.map((r,i) => `<th data-grid-col="${i}"${hidden(r)} style="white-space:normal;width:${width(r)}px">${escape(plain(r[0]))}${n.badge(columnExplanation(table,r),`column:${label}:${plain(r[0])}`)}</th>`).join('');
    const examples = configured(table);
    const rows = examples.length ? examples : [{}];
    const renderRow = (record, rowIndex) => {
    const valueOf = r => record['컬럼명'] && figure.examples['컬럼명'] === record['컬럼명'] && Object.hasOwn(figure.examples, plain(r[0])) ? figure.examples[plain(r[0])] : Object.hasOwn(record, plain(r[0])) ? String(record[plain(r[0])]) : example(table, r);
    const vals = table.rows.map((r,i) => {
      const editable = figure.editable && /가능|조건부/.test(plain(cell(table, r, '편집')));
      const value = valueOf(r) || '—';
      const mode=plain(cell(table,r,'입력방식'));
      let content=escape(value);
      const isSnapshot=/스냅샷 뷰어/.test(mode);
      if(editable || /장문/.test(mode) || isSnapshot) {
        const controlId=`${gridId}-row-${rowIndex}-cell-${i}`;
        const labels=Object.fromEntries(model.columns.flatMap(t=>t.rows.map(row=>[plain(cell(t,row,'필드명')).replace(/^snapshot\s*의\s*|^snapshot\.|^values\./,'').replace(/\[\]$/,''),plain(row[0]).replace(/^반영 후 /,'')])).filter(([key])=>/^[a-zA-Z]\w*$/.test(key)));
        const formatRow=table.rows.find(row=>plain(cell(table,row,'필드명'))==='snapshotVersion');
        const control=isSnapshot?snapshotView(valueOf(r)||'',Number(formatRow?valueOf(formatRow):0),labels)
          : /설정 팝업/.test(mode) ? popup(plain(r[0]), controlId, !editable)
          : /검색콤보|팝업 선택/.test(mode) ? searchCombo(controlId,plain(r[0]),valueOf(r)||'',plain(cell(table,r,'후보 예시')),!editable,'','',/다중/.test(mode))
          : /장문/.test(mode) ? `<textarea data-edit-value id="${controlId}" rows="5" ${editable?'':'readonly'}>${escape(valueOf(r)||'')}</textarea>`
          : /선택|셀렉트/.test(mode) ? `<select data-edit-value id="${controlId}">${[...new Set([value, ...plain(cell(table,r,'후보 예시')).split('·').filter(v=>v&&v!=='—')])].map(v=>`<option>${escape(v)}</option>`).join('')}</select>`
          : `<input data-edit-value id="${controlId}" value="${escape(valueOf(r)||'')}" ${editable?'':'readonly'}>`;
        content=`<details data-cell-editor${isSnapshot?' data-snapshot-viewer':''}${figure.cellEditor===plain(r[0])&&rowIndex===0?' data-auto-editor':''}><summary title="${isSnapshot?'전체 스냅샷 보기':escape(value)}" style="overflow:hidden;text-overflow:ellipsis">${isSnapshot?'보기':escape(value)+(editable?' ✎':' 보기')}</summary><div class="modal" style="position:fixed;top:8%;left:50%;transform:translateX(-50%);width:min(${isSnapshot?'800':'520'}px,90vw);z-index:20;white-space:normal"><div class="mh">${escape(plain(r[0]))}<button type="button" class="btn ghost sm" data-close-editor>닫기${badge('닫기','셀 상세/설정 창을 닫는다. 후보 전체 저장은 수행하지 않는다.','common:close-editor')}</button></div><div class="mb${isSnapshot?'':' f'}" style="max-height:75vh;overflow:auto">${control}${editable?`<button type="button" class="btn sm" data-apply-cell>선택 적용${badge('선택 적용','설정 창의 입력을 로컬 후보 셀에 반영한다. 서버 저장은 별도 저장 버튼으로 수행한다.','common:apply-cell')}</button>`:''}</div></div></details>`;
      }
      const target = plain(cell(table, r, '이동 탭'));
      if (target && target !== '—' && value !== '미확인') {
        if (!details.some(t=>tabOf(t)===target)) throw new Error('이동 탭이 §4에 없다');
        const context = record['컬럼명'] || record['문맥'] || '';
        content = `<button type="button" class="btn ghost sm" data-open-tab="${escape(target)}" data-context="${escape(context)}">${escape(value)}</button>`;
      }
      return `<td data-grid-col="${i}"${hidden(r)}${editable ? ' class="edit"' : ''} style="overflow:hidden;text-overflow:ellipsis" title="${isSnapshot?'전체 스냅샷 보기':escape(value)}">${content}</td>`;
    }).join('');
    return `<tr class="${rowIndex===0?'sel':''}" data-row-context="${escape(JSON.stringify(String(record['문맥'] || record['컬럼명'] || '').split(',')))}">${vals}</tr>`;
    };
    const body = empty ? `<tr><td class="empty" colspan="${table.rows.length}">${escape(contextEmpty?'선택한 문맥에 해당하지 않는 목록입니다.':figure.notice)}</td></tr>` : rows.map(renderRow).join('');
    const excel=figure.buttons.includes('엑셀 다운로드')?`<details data-excel-menu><summary>엑셀 다운로드 ▾${badge('엑셀 다운로드','현재 페이지 또는 전체를 선택한다. 현재 표시한 열과 순서, 반출 권한을 적용하며 숨긴 열은 자동 포함하지 않는다.','common:excel')}</summary><span>현재 페이지 · 전체</span></details>`:'';
    const settings=`<details data-grid-settings><summary>그리드 설정${badge('그리드 설정','표시할 열을 선택한다. 선택 표시 열도 여기에서 켜며 저장 데이터 자체는 변경하지 않는다.','common:grid-settings')}</summary><div class="notes">${table.rows.map((r,i)=>`<label style="display:block"><input type="checkbox" data-grid-column="${i}" ${optional(r)?'':'checked'}>${escape(plain(r[0]))}</label>`).join('')}</div></details>`;
    const canAdd=figure.editable&&supportsValueMode(label)&&(model.addRowTabs??[]).includes(label)&&table.rows.some(r=>/가능|조건부/.test(plain(cell(table,r,'편집'))));
    const surface=surfaceOf(model,label);
    const rowControls=surface?surface.buttons.map(name=>button(name,label)).join(''):canAdd?`<button type="button" class="btn ghost sm" data-add-demo-row>행 추가${badge('행 추가','저장 전 편집본에 빈 행을 추가한다.',`action:${label}:행 추가`)}</button>`:'';
    return `<div data-grid-view="${gridId}" data-grid-role="${table===model.columns[0]?'master':'detail'}"><div class="tb"><span class="ttl">${escape(label)}</span><span class="cnt">${empty ? '0' : rows.length}건</span>${rowControls}${excel}${settings}</div>${canAdd?`<template data-row-template>${renderRow({},rows.length)}</template>`:''}
      <div class="grid" style="overflow:auto"><table style="width:100%;table-layout:fixed;min-width:${table.rows.filter(r=>!optional(r)).reduce((n,r)=>n+width(r),0)}px"><thead><tr>${heads}</tr></thead><tbody>${body}</tbody></table></div>
      <div class="pg">총 ${empty ? '0' : rows.length}건 · 1 페이지</div></div>`;
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
    return `<div class="f${ro ? ' ro' : ''}"><label for="${fieldId}" data-field-label="${escape(label)}">${escape(label)}${n.badge(columnExplanation(table,r),`column:${titleOf(table)}:${label}`)}</label>${control}</div>`;
  }).join('');
  const tabNames = [...new Set(details.map(tabOf))];
  const tabs = () => tabNames.map((name) => {const note=badge(name,surfaceOf(model,name)?.purpose||'선택한 대상의 이 영역을 확인한다.',`tab:${name}`);return interactive ? `<button type="button" role="tab" aria-selected="${name === figure.detail}" data-detail-tab="${escape(name)}" class="btn ghost sm ${name === figure.detail ? 'on' : ''}">${escape(name)}${note}</button>` : `<span class="${name === figure.detail ? 'on' : ''}">${escape(name)}${note}</span>`;}).join('');
  const extraSearch = model.detailSearchTables?.find((t) => titleOf(t) === figure.detail);
  const detailSearch = extraSearch ? `<div class="sf" style="grid-template-columns:max-content minmax(0,1fr)">${extraSearch.rows.map((r) => `<label>${escape(plain(r[0]))}${badge(plain(r[0]),plain(cell(extraSearch,r,'기본값')))}</label><input aria-label="${escape(plain(r[0]))}" placeholder="${escape(plain(r[0]))}">`).join('')}</div>` : '';
  const detail = () => interactive && showData ? '' : selected.length ? detailSearch + selected.map((t) => /—\s*폼$/.test(t.heading) ? `<h3>${escape(titleOf(t))}</h3>${formView(t)}` : tableView(t)).join('') : `<p>${escape(figure.notice)}</p>`;
  const search = compact ? '' : model.search.map((r) => {
    if (!model.searchTable) return searchControl(r, n);
    const label = plain(r[0]);
    const locked = !figure.buttons.includes('조회');
    const mode = plain(cell(model.searchTable, r, '입력방식'));
    const choices = plain(cell(model.searchTable, r, '선택 출처')).replace(/^상수\s*/, '').split('·');
    const control = /셀렉트|선택/.test(mode)
      ? `<select aria-label="${escape(label)}" ${locked ? 'disabled' : ''}><option>전체</option>${choices.map((x) => `<option>${escape(x.includes('=') ? x.slice(x.indexOf('=')+1) : x)}</option>`).join('')}</select>`
      : `<input aria-label="${escape(label)}" placeholder="${escape(label)}" ${locked ? 'readonly' : ''}>`;
    return `<label>${escape(label)}${n.badge(searchExplanation(model.searchTable,r),`search:${label}`)}</label>${control}`;
  }).join('');
  const topButtons=buttons();
  const master = compact ? '' : tableView(model.columns[0],!showData);
  const tabMarkup=compact?'':tabs();
  const panels = interactive && showData ? tabNames.map(name=>`<div data-detail-panel="${escape(name)}"${name===figure.detail?'':' hidden'}>${surfaceIntroduction(surfaceOf(model,name))}<div class="hint" data-context-label hidden>현재 컬럼: <span></span> <button type="button" class="btn ghost sm" data-clear-context>전체 보기${badge('전체 보기','건수 셀에서 전달한 컬럼 문맥 필터를 해제하고 같은 대상의 전체 목록을 표시한다.','common:clear-context')}</button></div>${details.filter(t=>tabOf(t)===name).map(t=>tableView(t)).join('')}</div>`).join('') : compact?'':detail();
  const lower = `<div class="tabs" style="flex-wrap:wrap"${interactive?' role="tablist"':''}>${tabMarkup}</div>${panels}`;
  const panes = model.vertical!==false
    ? `<div data-layout="top-bottom" style="margin-top:12px"><section data-pane="master">${master}</section><div class="split"><span class="hnd">⋮⋮⋮</span></div><section data-pane="detail">${lower}</section></div>`
    : `<div class="splitrow" data-layout="left-right" style="margin-top:12px"><div class="pane">${master}</div><div class="split v"><span class="hnd">⋮</span></div><div class="pane">${lower}</div></div>`;
  const selectedLabel = model.columns[0].rows.filter(r=>/현재 객체명|현재 업무명/.test(plain(r[0]))).map(r=>example(model.columns[0],r)).join(' / ');
  const main = compact ? `<div class="hint">${escape(figure.detail)} · 같은 상위 행의 상세 영역</div><div class="notes" role="status">${escape(figure.notice)}</div><div data-detail-panel="${escape(figure.detail)}"><div class="hint" data-context-label hidden>현재 컬럼: <span></span> <button type="button" class="btn ghost sm" data-clear-context>전체 보기${badge('전체 보기','건수 셀에서 전달한 컬럼 문맥 필터를 해제하고 같은 대상의 전체 목록을 표시한다.','common:clear-context')}</button></div>${detail()}</div>` : `<div class="sf">${search}</div><div class="row" style="flex-wrap:wrap;margin:10px 0">${topButtons}${interactive?`<button type="button" class="btn ghost sm" data-toggle-master>테이블 목록 접기${badge('테이블 목록 접기/펼치기','선택 대상과 하단 편집본을 유지하면서 상단 목록의 표시만 전환한다.','common:toggle-master')}</button>`:''}</div>${interactive&&showData?`<div class="hint">선택 테이블: ${escape(selectedLabel)}</div>`:''}
       <div class="notes" role="status">${escape(figure.notice)}</div>${panes}`;
  return `<div class="screen leaf" id="${escape(figure.key)}"${interactive?' data-interactive-tabs':''}${manualKey ? ` data-manual="${escape(figure.key)}"` : ''}>
    <div class="bar">${escape(title)} · ${escape(figure.caption)} · 검토용 예시</div><div class="body">${main}</div></div>\n${n.render()}`;
}
