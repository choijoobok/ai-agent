/** 목업의 버전 있는 JSON 스냅샷을 읽기 전용 프로퍼티/값으로 표시한다. */
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const auditLabels={id:'대상 ID',managementVersion:'반영 버전',deleted:'삭제 여부',regId:'최초 등록자',regDtm:'최초 등록 시각',modId:'최종 변경자',modDtm:'반영 시각',changeReason:'변경 사유',commandKey:'작업 식별자',lastCorrectionEvidence:'최종 정정 근거'};
function valueHtml(value,depth=0){
 if(value===null)return '<span>미지정</span>';
 if(typeof value==='boolean')return value?'예':'아니오';
 if(Array.isArray(value))return `<div data-snapshot-array-count="${value.length}">목록 ${value.length}개<ol>${value.map(v=>`<li>${valueHtml(v,depth+1)}</li>`).join('')}</ol></div>`;
 if(typeof value==='object'&&depth<4)return `<table>${Object.entries(value).map(([k,v])=>`<tr><th style="white-space:normal">${escape(k)}</th><td style="white-space:pre-wrap">${valueHtml(v,depth+1)}</td></tr>`).join('')}</table>`;
 return escape(typeof value==='object'?JSON.stringify(value):value);
}
export function snapshotView(raw,version,labels={}){
 const hasRaw=typeof raw==='string'&&raw.trim().length>0;
 let data,problem='';
 if(!hasRaw)problem='스냅샷 원문이 없습니다.';
 else if(version!==1)problem='지원하지 않는 스냅샷 형식입니다. 원문을 확인하세요.';
 else {
  try {data=JSON.parse(raw);}
  catch {problem='스냅샷 JSON을 해석할 수 없습니다. 원문을 확인하세요.';}
  if(!problem&&(!data||Array.isArray(data)||typeof data!=='object'||typeof data.deleted!=='boolean'||!/^\d+$/.test(String(data.managementVersion))))problem='스냅샷 구성 확인이 필요합니다. 원문을 확인하세요.';
 }
 const properties=problem?`<p role="alert">${escape(problem)}</p>`:
 `<div data-snapshot-state="${data.deleted?'deleted':'active'}" class="notes">${data.deleted?'삭제된 대상의 마지막 구성':'반영 후 확정된 구성'} · 버전 ${escape(data.managementVersion)}</div>
 <table data-snapshot-properties><thead><tr><th style="white-space:normal">프로퍼티</th><th>값</th></tr></thead><tbody>${Object.entries(data).map(([key,value])=>`<tr><th style="white-space:normal;position:static">${escape(labels[key]||auditLabels[key]||key)}</th><td style="white-space:pre-wrap">${valueHtml(value)}</td></tr>`).join('')}</tbody></table>`;
 return properties+(hasRaw?`<details data-snapshot-raw><summary>JSON 원문 보기</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(raw)}</pre></details>`:'');
}
