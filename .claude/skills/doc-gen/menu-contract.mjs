/** admin 메뉴 검토 목록의 누락·중복·범위·상속 연결을 검사한다. */
export function menuContractErrors(spec){
 if(!spec.menu_tree)return[];
 const errors=[],screens=spec.screens??[],byId=new Map(screens.map(s=>[s.id,s]));
 const target=screens.filter(s=>s.module==='admin'&&s.entry==='menu'&&s.roadmap==='RM-P1');
 const listed=(spec.menu_tree.admin_groups??[]).flatMap(g=>g.screens??[]);
 for(const s of target){if(listed.filter(id=>id===s.id).length!==1)errors.push(s.id+': 현재 메뉴는 트리에 한 번 있어야 한다.');if(!s.route?.startsWith('/admin/hub/')||!s.menu_code)errors.push(s.id+': 경로/메뉴 코드가 필요하다.');}
 for(const g of spec.menu_tree.admin_groups??[])for(const id of g.screens??[]){const s=byId.get(id);if(!s||!target.includes(s))errors.push(id+': admin 현재 메뉴 범위를 벗어났다.');else if(s.group!==g.title||s.menu_parent!==g.code)errors.push(id+': 메뉴 그룹 연결이 다르다.');}
 for(const key of ['route','menu_code']){const seen=new Set();for(const s of target){if(seen.has(s[key]))errors.push(s.id+': 중복 '+key);seen.add(s[key]);}}
 for(const s of target){if(s.view_kind==='change_history'){const p=byId.get(s.source_screen);if(!p||p.module!=='admin'||p.view_kind==='change_history'||p.history_view!==s.id)errors.push(s.id+': 같은 admin 원 화면의 이력 연결이 필요하다.');if(s.target_doc||s.current_doc)errors.push(s.id+': 상속 이력의 독립 문서를 만들지 않는다.');}else if(!s.target_doc)errors.push(s.id+': 목업 요건서의 설계 경로가 필요하다.');}
 const rollout=spec.roadmap_rollout?.['RM-P1']?.admin??[];
 for(const s of target)if(!rollout.includes(s.id))errors.push(s.id+': 차수별 목록에 없다.');
 for(const id of rollout)if(!target.some(s=>s.id===id))errors.push(id+': 현재 차수 메뉴 목록에 유예/후속 화면이 섞였다.');
 if(screens.some(s=>s.module==='system'&&s.view_kind==='change_history'))errors.push('system은 새 변경 이력 저장 대상이 아니다.');
 return errors;
}
export function menuReviewMarkdown(spec,exists){
 if(!spec.menu_tree)return'';
 const tree=spec.menu_tree,byId=new Map(spec.screens.map(s=>[s.id,s]));
 const all=tree.admin_groups.flatMap(g=>g.screens.map(id=>byId.get(id))),history=all.filter(s=>s.view_kind==='change_history'),base=all.filter(s=>s.view_kind!=='change_history');
 const ready=base.filter(s=>exists(s.target_doc)&&exists(s.target_doc.replace(/requirements\.md$/,'mockup.html'))).length;
 const lines=['## admin 메뉴 트리와 목업 작성 대상','',tree.scope,'',`검토 상태: ${tree.status}. 메뉴 ${all.length}개 = 원 화면 ${base.length}개 + 상속 이력 ${history.length}개. 원 화면 목업 ${ready}개, 작성 대상 ${base.length-ready}개. 사용자 승인 완료를 뜻하지 않습니다.`,''];
 for(const g of tree.admin_groups){lines.push(`### ${g.title} · ${g.code} (${g.screens.length}개)`,'','| 화면 ID | 메뉴 | 화면 역할 | 설계 경로 | 목업 준비 | 이력 연결 |','|---|---|---|---|---|---|');for(const id of g.screens){const s=byId.get(id),inherited=s.view_kind==='change_history',has=s.target_doc&&exists(s.target_doc),mockup=has&&exists(s.target_doc.replace(/requirements\.md$/,'mockup.html'));lines.push(`| ${id} | ${s.title} | ${s.screen_role} | ${s.route} | ${inherited?'원 화면 상속':mockup?'검토용 목업 있음':has?'목업 생성 전':'요건서 작성 전'} | ${inherited?'원 화면 '+s.source_screen:s.history_view??'업무 기록'} |`);}lines.push('');}
 lines.push('### 이번 대상에서 제외','',...tree.excluded.map(x=>`- ${x.screen}: ${x.reason}`),'','### 적용 규칙','',...tree.rules.map(x=>'- '+x));
 return lines.join('\n');
}
