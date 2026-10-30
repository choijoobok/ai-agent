/** 요청 화면은 명시한 소유 업무 영역만 상속한다. 실시간 사용처/관측을 추정 복사하지 않는다. */
import {areaTitle} from './generic-layout.mjs';
const plain=x=>String(x??'').replace(/`|\*/g,'').trim();
export function requestDeclaration(md,extra=false){
  const value=key=>plain(md.split('\n').find(l=>l.startsWith(`| ${key} |`))?.split('|')[2]);
  const prefix=extra?'요청 추가 ':'요청 ';
  const path=value(prefix+'원 화면');
  if(!path)return null;
  if(!/^admin\/hub\/[a-z0-9/-]+$/.test(path)||path.includes('..'))throw new Error('요청 원 화면 경로가 허용 범위 밖이다');
  const areas=value(prefix+'상속 영역').split(';').map(plain).filter(Boolean);
  if(!areas.length||new Set(areas).size!==areas.length)throw new Error('요청 상속 영역은 중복 없는 명시 목록이어야 한다');
  return {path,areas};
}
function mergedTable(target,source){
  const header=[...new Set([...target.header,...source.header])];
  const align=t=>t.rows.map(r=>header.map(h=>r[t.header.indexOf(h)]??''));
  const rows=[...align(target),...align(source)];
  if(new Set(rows.map(r=>plain(r[0]))).size!==rows.length)throw new Error('요청 정보와 원 업무 컬럼이 중복됐다');
  return {...target,readonly:false,header,rows};
}
export function inheritRequest(model,source,areas,{mergeMaster=true}={}){
  const tables=areas.map(name=>{
    const t=source.columns.find(t=>areaTitle(t)===name);
    if(!t)throw new Error(`요청 상속 영역 '${name}'이 원 요건서에 없다`);
    const header=[...t.header]; if(!header.includes('편집 조건'))header.push('편집 조건');
    const rows=t.rows.map(r=>{const row=[...r];if(t===source.columns[0]){row[0]=String(row[0]).replace(/^현재 /,'요청 당시 ').replace(/^적용 리비전$/,'요청 당시 적용 리비전');for(const name of ['설명','검증','기본값/원천']){const at=header.indexOf(name);if(at>=0)row[at]=String(row[at]??'').replace(/현재 적용본|현재 운영 버전|현재 운영본/g,'요청 당시 적용본');}}if(/가능|조건부|신규/.test(r[t.header.indexOf('편집')]??''))row[header.indexOf('편집 조건')]=['draft',row[header.indexOf('편집 조건')]].filter(v=>v&&v!=='—').join(' && ');return row;});
    return {...t,header,rows};
  });
  const primary=source.columns[0];
  const ownsMaster=areas.includes(areaTitle(primary));
  if(mergeMaster&&!ownsMaster)throw new Error('요청 상속에는 원 마스터 업무 컬럼이 필요하다');
  const additions=tables.filter(t=>!mergeMaster||areaTitle(t)!==areaTitle(primary));
  const columns=[mergeMaster?mergedTable(model.columns[0],tables.find(t=>areaTitle(t)===areaTitle(primary))):model.columns[0],...additions,...model.columns.slice(1)];
  const names=columns.map(areaTitle);
  if(new Set(names).size!==names.length)throw new Error('요청 상속 영역이 요청 고유 영역과 중복됐다');
  // 생략한 현재 관측 탭으로의 셀 이동은 요청 스냅샷에 남기지 않는다.
  for(const t of additions){const at=t.header.indexOf('이동 탭');if(at>=0)for(const r of t.rows)if(!names.includes(plain(r[at])))r[at]='—';}
  const inheritedSurfaces=additions.map(t=>{
    return {name:areaTitle(t),kind:'탭',purpose:`선택 요청의 ${areaTitle(t)} 업무 스냅샷`,workflow:'같은 요청번호의 소유 구성이다. 초안에서만 보완하고 제출 이후 읽기 전용으로 확인한다.',buttons:[],disabled:[],trigger:'같은 요청의 전체 구성 조회',save:'요청 전체 구성; 제출본은 읽기 전용',...model.surfaces.find(x=>x.name===areaTitle(t))};
  });
  const inheritedNames=additions.map(areaTitle);
  const rows=[...(source.rowExamples?.rows??[]).filter(r=>areas.includes(plain(r[0]))&&!(mergeMaster&&plain(r[0])===areaTitle(primary))),...(model.rowExamples?.rows??[])];
  return {...model,columns,surfaces:[...model.surfaces.filter(s=>!inheritedNames.includes(s.name)),...inheritedSurfaces],interactive:columns.length>1,rowExamples:{header:['그리드 예시','행 값'],rows},popups:source.popups??model.popups};
}
