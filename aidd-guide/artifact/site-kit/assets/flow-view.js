/* 단일 페이지의 탐색·SVG·확대·오프라인 Mermaid. 네트워크 요청이나 업무 실행은 없다. */
(() => {
  const data = JSON.parse(document.getElementById('flow-data').textContent);
  const map = document.getElementById('flow-map');
  const inspector = document.getElementById('flow-inspector');
  const originalInspector = inspector.innerHTML;
  const root = document.documentElement;
  const themeButton = document.getElementById('theme-toggle');
  const theme = () => root.dataset.theme === 'light' ? 'light' : 'dark';
  const syncThemeButton = () => {
    const label = theme() === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환';
    themeButton.textContent = theme() === 'dark' ? '☀ 라이트 모드' : '☾ 다크 모드';
    themeButton.setAttribute('aria-label', label);
    themeButton.title = label;
  };
  syncThemeButton();
  const groupByKey = new Map(data.groups.map((g) => [g.key, g]));
  const addText = (parent, tag, value) => { const node=document.createElement(tag);node.textContent=value;parent.append(node);return node; };
  function select(key) {
    const group=groupByKey.get(key);if(!group)return;
    map.classList.add('has-selection');
    map.querySelectorAll('[data-group]').forEach((node)=>node.classList.toggle('selected',node.dataset.group===key));
    map.querySelectorAll('.flow-edge').forEach((edge)=>edge.classList.toggle('selected',edge.dataset.from===key||edge.dataset.to===key));
    inspector.replaceChildren();
    const head=addText(inspector,'div','');head.className='inspector-head';addText(head,'b',group.title);
    const link=addText(head,'a',`${group.sequence} 상세 시퀀스와 설명 ↓`);link.href=`#${group.sequence}`;
    group.labels.forEach((label)=>addText(inspector,'p',label));
    addText(inspector,'h3','정본의 조건별 연결');const list=addText(inspector,'ul','');
    for(const c of data.connections.filter((c)=>c.from===key||c.to===key))for(const e of c.edges)addText(list,'li',`${e.fromLabel} → ${e.toLabel} / ${e.label}`);
  }
  map.querySelectorAll('[data-group]').forEach((node)=>{
    node.addEventListener('click',(event)=>{if(event.target.closest('a'))return;select(node.dataset.group);});
    node.addEventListener('keydown',(event)=>{if(event.target.closest('a'))return;if(event.key==='Enter'||event.key===' '){event.preventDefault();select(node.dataset.group);}});
  });
  document.getElementById('clear-selection').addEventListener('click',()=>{map.classList.remove('has-selection');map.querySelectorAll('.selected').forEach((n)=>n.classList.remove('selected'));inspector.innerHTML=originalInspector;});
  document.getElementById('all-connections').addEventListener('change',(event)=>map.classList.toggle('all-connections',event.target.checked));
  document.getElementById('overview-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await map.parentElement.requestFullscreen();}catch{map.scrollIntoView({block:'start'});}});
  function download(svg, filename) {
    const clone=svg.cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.style.removeProperty('width');clone.style.removeProperty('max-width');clone.dataset.theme=theme();
    if(svg===map){const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent=document.querySelector('style').textContent;clone.prepend(style);}
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.getElementById('save-overview').addEventListener('click',()=>download(map,'agent-overview.svg'));
  document.getElementById('print-all').addEventListener('click',()=>window.print());
  for(const section of document.querySelectorAll('[data-sequence]')){
    section.querySelectorAll('[data-zoom]').forEach((button)=>button.addEventListener('click',()=>{
      const svg=section.querySelector('.mermaid svg');if(!svg)return;
      const original=svg.viewBox.baseVal.width||Number(svg.getAttribute('width'));const box=section.querySelector('.diagram-viewport');
      const current=parseFloat(svg.style.width)||box.clientWidth-34;
      const width=button.dataset.zoom==='fit'?box.clientWidth-34:button.dataset.zoom==='actual'?original:current*(button.dataset.zoom==='in'?1.2:1/1.2);
      svg.style.width=`${Math.min(6000,Math.max(300,width))}px`;
    }));
    section.querySelector('[data-save-svg]').addEventListener('click',()=>{const svg=section.querySelector('.mermaid svg');if(svg)download(svg,`agent-${section.id}.svg`);});
  }
  async function renderDiagrams(preserveView=false) {
    const status=document.getElementById('diagram-status');
    const scroll={x:scrollX,y:scrollY};
    const widths=new Map([...document.querySelectorAll('[data-sequence]')].map((s)=>[s.id,s.querySelector('.mermaid svg')?.style.width]));
    themeButton.disabled=true;
    try{
      if(!window.mermaid)throw new Error('오프라인 다이어그램 라이브러리가 없습니다.');
      const dark=theme()==='dark';
      const palette=dark?{
        darkMode:true,background:'#102131',primaryColor:'#1c3448',primaryTextColor:'#e0ebf4',primaryBorderColor:'#52758e',secondaryColor:'#20384b',tertiaryColor:'#18354a',lineColor:'#8db8d6',textColor:'#e0ebf4',actorBkg:'#1c3448',actorBorder:'#52758e',actorTextColor:'#e0ebf4',actorLineColor:'#6689a2',signalColor:'#c7dfef',signalTextColor:'#e0ebf4',labelBoxBkgColor:'#28465b',labelBoxBorderColor:'#6689a2',labelTextColor:'#e0ebf4',loopTextColor:'#dbeaf4',noteBkgColor:'#473f29',noteBorderColor:'#a4935f',noteTextColor:'#f2dfaa',sequenceNumberColor:'#102131',activationBkgColor:'#2d536d',activationBorderColor:'#85b7d9'
      }:{
        darkMode:false,background:'#fcfdff',primaryColor:'#eaf3f8',primaryTextColor:'#17324a',primaryBorderColor:'#89adbf',lineColor:'#537d96',signalColor:'#294d65',signalTextColor:'#17324a',actorBkg:'#eaf3f8',actorBorder:'#89adbf',actorTextColor:'#17324a',actorLineColor:'#89adbf',labelBoxBkgColor:'#eaf3f8',labelBoxBorderColor:'#89adbf',labelTextColor:'#17324a',loopTextColor:'#17324a',noteBkgColor:'#fff7de',noteBorderColor:'#b6a46d',noteTextColor:'#465768',sequenceNumberColor:'#ffffff',activationBkgColor:'#d6e7f2',activationBorderColor:'#89adbf'
      };
      for(const node of document.querySelectorAll('.mermaid')){node.textContent=decodeURIComponent(node.dataset.mermaidSource);node.removeAttribute('data-processed');}
      mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'base',themeVariables:{fontFamily:'Malgun Gothic, sans-serif',...palette},sequence:{useMaxWidth:false,mirrorActors:false,actorMargin:45,boxMargin:14,messageMargin:28,noteMargin:15,wrap:true,width:180,actorFontSize:16,noteFontSize:15,messageFontSize:15}});
      await mermaid.run({nodes:document.querySelectorAll('.mermaid'),suppressErrors:false});
      for(const section of document.querySelectorAll('[data-sequence]')){
        const svg=section.querySelector('.mermaid svg');
        svg.style.backgroundColor=palette.background;
        if(preserveView&&widths.get(section.id))svg.style.width=widths.get(section.id);
        else section.querySelector('[data-zoom="fit"]').click();
      }
      const count=document.querySelectorAll('[data-sequence] .mermaid svg').length;
      if(count!==data.groups.map((g)=>g.sequence).filter((s,i,a)=>a.indexOf(s)===i).length)throw new Error('상세도 일부를 렌더링하지 못했습니다.');
      status.textContent=`전체 흐름과 상세 시퀀스 ${count}개를 준비했습니다. 아래로 스크롤하거나 단계 바로 이동을 이용하세요.`;
      status.classList.remove('error');status.setAttribute('role','status');
      return {ok:true,sequences:count};
    }catch(error){status.classList.add('error');status.setAttribute('role','alert');status.textContent=`그림 생성 오류: ${error.message}. 원문과 순서 설명은 아래에서 확인할 수 있습니다.`;return {ok:false,error:error.message};}
    finally{themeButton.disabled=false;if(preserveView)window.scrollTo({left:scroll.x,top:scroll.y,behavior:'instant'});}
  }
  themeButton.addEventListener('click',()=>{
    root.dataset.theme=theme()==='dark'?'light':'dark';
    try{localStorage.setItem('delivery-theme',theme());}catch{/* file:// 저장소 제한 시 현재 화면 전환은 유지 */}
    syncThemeButton();window.FLOW_READY=renderDiagrams(true);
  });
  window.FLOW_READY=renderDiagrams();
})();
