/** 정본에서 생성한 목업의 탐색·선택 시연. 서버 저장이나 권한 판정을 수행하지 않는다. */
function bindDeclaredMockup(root) {
  const reveal = destination => {
    for(let p=destination.parentElement;p;p=p.parentElement)if(p.matches('details'))p.open=true;
    destination.setAttribute('tabindex','-1');
    destination.focus({preventScroll:true});
    destination.scrollIntoView({block:'start'});
  };
  const activate = (screen, name, context) => {
    screen.querySelectorAll('[data-detail-tab]').forEach(b => {
      const active = b.dataset.detailTab === name;
      b.classList.toggle('on', active);
      b.setAttribute('aria-selected', String(active));
    });
    screen.querySelectorAll('[data-detail-panel]').forEach(p => {
      p.hidden = p.dataset.detailPanel !== name;
      if (!p.hidden && context !== undefined) {
        p.querySelectorAll('tbody tr[data-row-context]').forEach(row => {
          row.hidden = Boolean(context) && !JSON.parse(row.dataset.rowContext).includes(context);
        });
        const chip = p.querySelector('[data-context-label]');
        if (chip) { chip.hidden = !context; chip.querySelector('span').textContent = context || ''; }
        p.querySelectorAll('[data-grid-view]').forEach(grid => {
          const all = [...grid.querySelectorAll('tbody tr[data-row-context]')];
          const shown = all.filter(row=>!row.hidden).length;
          grid.querySelector('.cnt').textContent = context ? `${shown}건 / 전체 ${all.length}건` : `${all.length}건`;
          grid.querySelector('.pg').textContent = context ? `${context} 관련 ${shown}건 · 전체 보기로 해제` : `총 ${all.length}건 · 1 페이지`;
        });
      }
    });
  };
  root.addEventListener('click', event => {
    const target = event.target;
    const badge=target.closest('[data-note]');
    if(badge){const destination=root.getElementById(`note-${badge.dataset.note}`);if(destination){event.preventDefault();event.stopPropagation();reveal(destination);}return;}
    const localLink = target.closest('a[href^="#"]');
    if (localLink) {
      let key;
      try { key = decodeURIComponent(localLink.getAttribute('href').slice(1)); } catch { return; }
      const destination = root.getElementById(key);
      if (destination) {
        event.preventDefault();
        reveal(destination);
        destination.querySelectorAll('[data-auto-editor]').forEach(editor=>editor.open=true);
        return;
      }
    }
    const add = target.closest('[data-add-demo-row]');
    if (add) {
      const grid = add.closest('[data-grid-view]');
      const row = grid.querySelector('template[data-row-template]').content.firstElementChild.cloneNode(true);
      const number = grid.querySelectorAll('tbody tr').length + 1;
      row.querySelectorAll('[id]').forEach(e=>e.id+=`-new-${number}`);
      row.querySelectorAll('[data-auto-editor]').forEach(e=>{e.removeAttribute('data-auto-editor');e.open=false;});
      row.querySelectorAll('[data-edit-value]').forEach(e=>e.value='');
      row.querySelectorAll('[data-combo-value]').forEach(e=>e.textContent='현재 선택: 미지정');
      row.querySelectorAll('[data-cell-editor] summary').forEach(e=>e.textContent='선택/입력 ✎');
      grid.querySelector('tbody .empty')?.closest('tr').remove();
      grid.querySelector('tbody').append(row);
      const count = grid.querySelectorAll('tbody tr').length;
      grid.querySelector('.cnt').textContent=`${count}건`;
      grid.querySelector('.pg').textContent='목업 새 행 — 컬럼 이름을 선택하세요. 서버 저장은 하지 않습니다.';
      return;
    }
    const close = target.closest('[data-close-editor]');
    if (close) { close.closest('[data-cell-editor]').open = false; return; }
    const tab = target.closest('[data-detail-tab],[data-open-tab]');
    if (tab) {
      event.preventDefault();
      const screen=tab.closest('.screen'), name=tab.dataset.detailTab || tab.dataset.openTab;
      if(!screen.matches('[data-interactive-tabs]')){
        const area=[...root.querySelectorAll('[data-walkthrough-area]')].find(e=>e.dataset.walkthroughArea===name);
        if(area){activate(area.querySelector('.screen'),name,tab.dataset.context);reveal(area);}
      }else activate(screen, name, tab.dataset.context);
      return;
    }
    const reset = target.closest('[data-clear-context]');
    if (reset) { activate(reset.closest('.screen'), reset.closest('[data-detail-panel]').dataset.detailPanel, ''); return; }
    const collapse = target.closest('[data-toggle-master]');
    if (collapse) {
      const pane = collapse.closest('.screen').querySelector('[data-pane="master"]');
      pane.hidden = !pane.hidden;
      collapse.textContent = pane.hidden ? '테이블 목록 펼치기' : '테이블 목록 접기';
      return;
    }
    const apply = target.closest('[data-apply-cell]');
    if (apply) {
      const editor = apply.closest('[data-cell-editor]');
      const values = [...editor.querySelectorAll('[data-edit-value]')].flatMap(e => e.multiple ? [...e.selectedOptions].map(o=>o.value) : [e.value]).filter(Boolean);
      editor.querySelector('summary').textContent = (values.join(' / ') || '미지정') + ' ✎';
      editor.open = false;
    }
  });
  root.addEventListener('keydown', event=>{
    if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-note]')){event.preventDefault();event.target.click();}
  });
  if(!root.host){
    const openHash=()=>{const destination=root.getElementById(location.hash.slice(1));if(destination)reveal(destination);};
    window.addEventListener('hashchange',openHash);if(location.hash)openHash();
  }
  root.addEventListener('input', event => {
    if (!event.target.matches('[data-combo-filter]') || event.target.readOnly) return;
    const box = event.target.closest('[data-search-combo]');
    const query = event.target.value.toLowerCase();
    let matches = 0;
    [...box.querySelector('select').options].forEach(o => {
      o.hidden = o.value !== '' && !o.textContent.toLowerCase().includes(query);
      if (o.value && !o.hidden && !o.disabled) matches++;
    });
    box.querySelector('[data-combo-empty]').hidden = matches !== 0;
  });
  root.addEventListener('change', event => {
    const input = event.target;
    if (input.matches('[data-grid-column]')) {
      input.closest('[data-grid-view]').querySelectorAll('[data-grid-col]').forEach(c => {
        if (c.dataset.gridCol === input.dataset.gridColumn) c.hidden = !input.checked;
      });
    }
    if (!input.matches('[data-combo-select]') || input.disabled) return;
    input.closest('[data-search-combo]').querySelector('[data-combo-value]').textContent = '현재 선택: ' + ([...input.selectedOptions].map(o=>o.value).filter(Boolean).join(', ') || '미지정');
    const editor = input.closest('[data-cell-editor]');
    if (!editor) return;
    editor.querySelectorAll('[data-parent-field]').forEach(box => {
      if (box.dataset.parentField !== input.dataset.fieldName) return;
      const values = JSON.parse(box.dataset.candidateMap || '{}')[input.value] || [];
      const select = box.querySelector('select');
      select.replaceChildren();
      ['', ...values].forEach(value => {
        const option = document.createElement('option');
        option.value = value; option.textContent = value || '미지정'; select.append(option);
      });
      select.value = '';
      box.querySelector('[data-combo-filter]').value = '';
      box.querySelector('[data-combo-value]').textContent = '현재 선택: 미지정';
      box.querySelector('[data-combo-empty]').hidden = values.length !== 0;
    });
  });
}
