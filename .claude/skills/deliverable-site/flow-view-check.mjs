/** 연속 보기의 실제 SVG·탐색·확대·인쇄·오프라인 경계를 Chromium에서 검사한다. */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO } from '../manual-site/lib/menu.mjs';

const rootArg=process.argv.slice(2).find((arg)=>arg.startsWith('--root='))?.slice(7);
const root=resolve(REPO,rootArg||'build/deliverables');
const manifest=JSON.parse(readFileSync(resolve(root,'delivery-manifest.json'),'utf8'));
const {chromium}=createRequire(resolve(REPO,'sources/frontend/package.json'))('playwright');
const channel=process.argv.slice(2).find((arg)=>arg.startsWith('--browser='))?.slice(10);
if(channel&&!['chrome','msedge'].includes(channel))throw new Error('--browser는 chrome 또는 msedge다.');
const browser=await chromium.launch({headless:true,...(channel?{channel}:{})});
const errors=[];
const qa=resolve(root,'qa');mkdirSync(qa,{recursive:true});
try{
  if(!manifest.flowViews?.length)errors.push('검사할 연속 보기가 없다.');
  for(const view of manifest.flowViews||[]){
    const page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true,colorScheme:'light'});
    page.on('pageerror',(error)=>errors.push(error.message));
    page.on('request',(request)=>{if(/^https?:/.test(request.url()))errors.push(`외부 요청: ${request.url()}`);});
    await page.goto(pathToFileURL(resolve(root,view.path)).href,{waitUntil:'load'});
    const ready=await page.evaluate(()=>window.FLOW_READY);
    if(!ready?.ok)errors.push(`렌더링 실패: ${JSON.stringify(ready)}`);
    const colors=()=>page.evaluate(()=>({theme:document.documentElement.dataset.theme,body:getComputedStyle(document.body).backgroundColor,map:getComputedStyle(document.querySelector('#flow-map>rect')).fill,actor:getComputedStyle(document.querySelector('#S1 .mermaid svg rect.actor')).fill}));
    const dark=await colors();
    if(dark.theme!=='dark')errors.push('새 문서의 기본 테마가 다크가 아니다.');
    await page.locator('#flow-map').screenshot({path:resolve(qa,`${view.key}-dark.png`)});
    await page.locator('#theme-toggle').click();
    if(!(await page.evaluate(()=>window.FLOW_READY))?.ok)errors.push('라이트 전환 후 상세도 렌더 실패');
    const light=await colors();
    if(light.theme!=='light'||light.body===dark.body||light.map===dark.map||light.actor===dark.actor)errors.push('본문·전체 흐름·상세도 중 테마가 함께 바뀌지 않은 것이 있다.');
    await page.locator('#flow-map').screenshot({path:resolve(qa,`${view.key}-light.png`)});
    await page.reload({waitUntil:'load'});await page.evaluate(()=>window.FLOW_READY);
    if((await colors()).theme!=='light')errors.push('저장한 라이트 선택이 새로고침 후 유지되지 않는다.');
    await page.locator('#S3 [data-zoom="in"]').click();
    const zoomBefore=await page.locator('#S3 .mermaid svg').evaluate((s)=>s.style.width);
    await page.locator('#theme-toggle').click();await page.evaluate(()=>window.FLOW_READY);
    if((await colors()).theme!=='dark')errors.push('다크로 다시 전환되지 않는다.');
    if(await page.locator('#S3 .mermaid svg').evaluate((s)=>s.style.width)!==zoomBefore)errors.push('테마 전환으로 확대 상태가 초기화됐다.');
    await page.locator('#S3 [data-zoom="fit"]').click();
    const state=await page.evaluate(()=>({
      sequences:[...document.querySelectorAll('[data-sequence]')].map((s)=>({key:s.id,svg:s.querySelectorAll('.mermaid svg').length,steps:s.querySelectorAll('ol>li').length,visible:getComputedStyle(s).display!=='none',explanationOutside:!s.querySelector('.diagram-viewport ol')})),
      ids:[...document.querySelectorAll('[id]')].map((e)=>e.id),
      nodes:document.querySelectorAll('#flow-map [data-group]').length,
      documentOverflow:document.documentElement.scrollWidth>innerWidth,
    }));
    if(state.sequences.length!==view.sequences.length||state.sequences.some((s)=>s.svg!==1||!s.steps||!s.visible||!s.explanationOutside))errors.push(`그림/설명 연결 불완전: ${JSON.stringify(state.sequences)}`);
    if(new Set(state.ids).size!==state.ids.length)errors.push('렌더링 뒤 DOM ID가 중복된다.');
    if(state.documentOverflow)errors.push('데스크톱 페이지 전체에 가로 넘침이 있다.');
    await page.locator('#flow-map [data-group="plan"]').click();
    if(!await page.locator('#flow-map .flow-edge.selected').count())errors.push('노드 선택 시 연결을 강조하지 않는다.');
    if(!await page.locator('#flow-inspector').textContent().then((s)=>s.includes('정본의 조건별 연결')))errors.push('노드 연결의 정본 설명이 없다.');
    await page.locator('#clear-selection').click();
    await page.locator('.overview-canvas').screenshot({path:resolve(qa,`${view.key}-overview.png`)});
    await page.locator('.sequence-nav a[href="#S3"]').click();
    if(!page.url().endsWith('#S3'))errors.push('S3 바로 이동 실패');
    const width=await page.locator('#S3 .mermaid svg').evaluate((s)=>s.getBoundingClientRect().width);
    await page.locator('#S3 [data-zoom="in"]').click();
    const enlarged=await page.locator('#S3 .mermaid svg').evaluate((s)=>s.getBoundingClientRect().width);
    if(enlarged<=width)errors.push('상세도 확대가 적용되지 않는다.');
    await page.locator('#S3 [data-zoom="fit"]').click();
    await page.locator('#S3 .diagram-tools a').click();
    if(!page.url().endsWith('#S3-steps'))errors.push('S3 설명 바로 이동 실패');
    await page.locator('#S3 .section-head').scrollIntoViewIfNeeded();
    await page.screenshot({path:resolve(qa,`${view.key}-sequence.png`)});
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#save-overview').click();
    const download=await downloadPromise;
    if(!download.suggestedFilename().endsWith('.svg'))errors.push('한 장 SVG 저장 형식 오류');
    const exported=readFileSync(await download.path(),'utf8');
    if(!exported.includes('data-theme="dark"'))errors.push('내보낸 SVG에 선택 테마가 없다.');
    await page.emulateMedia({media:'print'});
    const printed=await page.evaluate(()=>[...document.querySelectorAll('[data-sequence]')].filter((s)=>getComputedStyle(s).display!=='none').length);
    if(printed!==view.sequences.length)errors.push('전체 인쇄에서 상세도 누락');
    if(await page.evaluate(()=>getComputedStyle(document.body).color)!=='rgb(23, 50, 74)')errors.push('인쇄에서 본문이 밝은 글자로 남았다.');
    await page.emulateMedia({media:'screen'});
    await page.setViewportSize({width:390,height:844});
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)){
      const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter((e)=>e.getBoundingClientRect().right>innerWidth+1&&!e.closest('.diagram-viewport,.overview-canvas,.table-wrap,.table-scroll')).slice(0,8).map((e)=>`${e.tagName}.${e.className}`));
      const sizes=await page.evaluate(()=>({viewport:innerWidth,root:document.documentElement.scrollWidth,body:document.body.scrollWidth,x:scrollX,wide:[...document.querySelectorAll('main,main>section,.topbar,.sequence-nav,.diagram-viewport,.overview-canvas,.table-wrap')].filter((e)=>e.scrollWidth>e.clientWidth+1).slice(0,10).map((e)=>({tag:e.tagName,cls:e.className,w:e.clientWidth,scroll:e.scrollWidth,overflow:getComputedStyle(e).overflowX}))}));
      errors.push(`모바일에서 도표 밖 페이지 가로 넘침: ${overflow.join(', ')} ${JSON.stringify(sizes)}`);
      await page.screenshot({path:resolve(qa,`${view.key}-mobile.png`)});
    }
    console.log(`${view.path}: SVG ${state.sequences.reduce((n,s)=>n+s.svg,0)+1} · 상세 설명 ${state.sequences.length} · 노드 묶음 ${state.nodes} · 인쇄 ${printed} · 기본 다크/양방향 전환/선택 기억 통과`);
    await page.close();
  }
}finally{await browser.close();}
for(const error of errors)console.log(`오류: ${error}`);
console.log(errors.length?`빨강 — ${errors.length}건`:'초록 — 단일 HTML의 렌더링·연결·확대·인쇄·오프라인 검사 통과');
process.exitCode=errors.length?1:0;
