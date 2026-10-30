/** 정본에서 생성한 목업의 탐색·선택 시연. 서버 저장이나 권한 판정을 수행하지 않는다. */
function applyRequestContext(root, query) {
  const params=new URLSearchParams(query), requestNo=params.get('requestNo');
  if(!requestNo||!/^[a-zA-Z0-9_-]+$/.test(requestNo))return;
  root.querySelectorAll('[data-request-number]').forEach(e=>{e.textContent=requestNo;});
  root.querySelectorAll('[data-request-navigation]').forEach(a=>{
    const parts=a.getAttribute('href').split('?'), values=new URLSearchParams((parts[1]??'').split('#')[0]);
    values.set('requestNo',requestNo);a.setAttribute('href',parts[0]+'?'+values.toString()+'#main');
  });
}
function bindDeclaredMockup(root) {
  applyRequestContext(root,location.search);
  // 상세 설명 한 곳을 재사용한다. 문서와 ShadowRoot 모두 같은 탐색/툴팁 동작을 쓴다.
  const doc = root.ownerDocument || root;
  const tip = doc.createElement('div');
  tip.className = 'annotation-tooltip';
  tip.id = 'annotation-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('popover', 'manual');
  tip.hidden = true;
  (root.body || root).append(tip);
  let tipBadge = null, dismissTimer;
  const hideTip = () => {
    clearTimeout(dismissTimer);
    tipBadge?.removeAttribute('aria-describedby');
    tipBadge = null;
    if (tip.matches(':popover-open')) tip.hidePopover();
    tip.hidden = true;
  };
  const showTip = badge => {
    clearTimeout(dismissTimer);
    if (badge === tipBadge) return;
    const source = root.getElementById(`note-${badge.dataset.note}`)?.querySelector('div');
    if (!source) return;
    hideTip();
    const content = source.cloneNode(true);
    // 툴팁은 설명 전용이다. 링크 조작은 원래 상세 설명에서 수행한다.
    content.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
    content.querySelectorAll('a').forEach(a => a.replaceWith(doc.createTextNode(a.textContent)));
    const tipHost = badge.closest('dialog') || root.body || root;
    if (tip.parentNode !== tipHost) tipHost.append(tip);
    tip.replaceChildren(content);
    tipBadge = badge;
    badge.setAttribute('aria-describedby', tip.id);
    tip.hidden = false;
    if (tip.showPopover) tip.showPopover();
    const anchor = badge.getBoundingClientRect(), gap = 8, margin = 12;
    const width = doc.documentElement.clientWidth, height = doc.documentElement.clientHeight;
    tip.style.left = `${Math.max(margin, Math.min(anchor.left, width - tip.offsetWidth - margin))}px`;
    const below = height - anchor.bottom - gap - margin, above = anchor.top - gap - margin;
    const downward = below >= Math.min(tip.scrollHeight, height * .65) || below >= above;
    tip.style.maxHeight = `${Math.max(40, Math.min(height * .65, downward ? below : above))}px`;
    tip.style.top = `${Math.max(margin, downward ? anchor.bottom + gap : anchor.top - tip.offsetHeight - gap)}px`;
  };
  const scheduleDismiss = () => {
    clearTimeout(dismissTimer);
    dismissTimer = setTimeout(() => {
      if (!tip.matches(':hover') && !tipBadge?.matches(':hover') && root.activeElement !== tipBadge) hideTip();
    }, 150);
  };
  root.addEventListener('pointerover', event => {
    const badge = event.target.closest('[data-note]');
    if (badge) showTip(badge);
    else if (tip.contains(event.target)) clearTimeout(dismissTimer);
  });
  root.addEventListener('pointerout', event => {
    if (event.target.closest('[data-note]') || tip.contains(event.target)) scheduleDismiss();
  });
  root.addEventListener('focusin', event => {
    const badge = event.target.closest('[data-note]');
    if (badge) showTip(badge);
  });
  root.addEventListener('focusout', scheduleDismiss);
  doc.addEventListener('keydown', event => { if (event.key === 'Escape' && tipBadge) { event.preventDefault(); hideTip(); } });
  root.addEventListener('scroll', event => { if (!tip.contains(event.target)) hideTip(); }, true);
  if (root.host) doc.addEventListener('scroll', hideTip, true);
  doc.defaultView.addEventListener('resize', hideTip);
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
    if(badge){hideTip();const destination=root.getElementById(`note-${badge.dataset.note}`);if(destination){event.preventDefault();event.stopPropagation();badge.closest('dialog')?.close();reveal(destination);}return;}
    const figureLink = target.closest('[data-open-figure]');
    if(figureLink){hideTip();const destination=root.getElementById(figureLink.dataset.openFigure);if(destination)reveal(destination);return;}
    const command = target.closest('[data-open-command]');
    if (command) {
      hideTip();
      const dialog=[...command.closest('.screen').querySelectorAll('[data-command]')].find(d=>d.dataset.command===command.dataset.openCommand);
      dialog?.showModal(); return;
    }
    if (target.closest('[data-close-command]')) { hideTip(); target.closest('dialog').close(); return; }
    if (target.closest('[data-add-command-target]')) {
      const group=target.closest('form').querySelector('[data-command-targets]');
      const row=group.firstElementChild.cloneNode(true);
      row.querySelectorAll('select').forEach(e=>e.selectedIndex=0);
      group.append(row);
      group.querySelectorAll('[data-remove-command-target]').forEach(e=>e.disabled=false); return;
    }
    if (target.closest('[data-remove-command-target]')) {
      const row=target.closest('[data-command-target]'), group=row.parentElement;
      if(group.children.length>1)row.remove();
      if(group.children.length===1)group.querySelector('[data-remove-command-target]').disabled=true; return;
    }
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
    const remove=target.closest('[data-remove-demo-row]');
    if(remove){
      const grid=remove.closest('[data-grid-view]'),body=grid.querySelector('tbody');
      const selected=body.querySelector('tr.sel')??body.lastElementChild;
      if(selected&&!selected.querySelector('.empty'))selected.remove();
      const count=body.querySelectorAll('tr').length;
      grid.querySelector('.cnt').textContent=`${count}건`;
      grid.querySelector('.pg').textContent='목업 편집 행 제거 — 서버에는 반영하지 않았습니다.';
      return;
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
  root.addEventListener('submit', event => {
    if (!event.target.matches('[data-command-form]')) return;
    event.preventDefault();
    event.target.querySelector('[data-command-result]').textContent='목업 입력 확인 완료 — 서버로 접수하거나 업무 데이터를 변경하지 않았습니다.';
  });
  root.querySelectorAll('[data-command-targets]').forEach(group=>{
    if(group.children.length===1)group.querySelector('[data-remove-command-target]').disabled=true;
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
