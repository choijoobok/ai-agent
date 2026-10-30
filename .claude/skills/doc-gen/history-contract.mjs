/** 관리 이력 복사 규칙을 명세에서 검사한다. 제품 저장 코드의 실행 검증은 별도다. */
export function historyContractErrors(domain) {
  const entities=domain.entities??[],byId=new Map(entities.map(e=>[e.id,e])),errors=[];
  for(const history of entities.filter(e=>e.history_copy_of)){
    const source=byId.get(history.history_copy_of),fail=message=>errors.push(`${history.id}: ${message}`);
    if(!source){fail('원본 엔티티가 없다.');continue;}
    if(history.module!==source.module)fail('원본과 이력의 쓰기 소유 모듈이 다르다.');
    if(!history.physical)continue;
    if(!source.physical){fail('원본 물리 계약 없이 이력 물리를 추정했다.');continue;}
    if(history.table!==source.table+'_HIST')fail('이력 테이블명은 원본명 + _HIST여야 한다.');
    const attrs=new Map(history.physical.attributes.map(a=>[a.name,a]));
    const pk=history.physical.constraints.filter(c=>/^PRIMARY KEY\s*\(/i.test(c.definition));
    if(pk.length!==1||!/^PRIMARY KEY\s*\(HIST_ID\)$/i.test(pk[0].definition))fail('PK는 HIST_ID 단일 서로게이트 키여야 한다.');
    const isChild=Boolean(history.history_parent);
    for(const name of ['HIST_ID','HISTORY_NO',...isChild?[]:['HIST_DTM']]){
      const a=attrs.get(name);
      if(!a||a.nullable!==false||a.default!==null)fail(`${name}은 명시 전달하는 필수 이력 컬럼이어야 한다.`);
    }
    if(attrs.get('HIST_ID')?.type!=='bigint'||attrs.get('HISTORY_NO')?.type!=='bigint')fail('행/세트 키는 bigint여야 한다.');
    if(isChild&&attrs.has('HIST_DTM'))fail('자식은 저장일시를 중복하지 않고 부모 이력 시각을 참조해야 한다.');
    if(!isChild&&attrs.get('HIST_DTM')?.type!=='timestamp with time zone')fail('이력 저장일시는 UTC 시각 계약이어야 한다.');
    for(const original of source.physical.attributes){
      const copy=attrs.get(original.name);
      if(!copy||copy.type!==original.type||copy.nullable!==original.nullable)fail(`원본 ${original.name}의 컬럼/자료형/NULL 계약을 보존해야 한다.`);
    }
    if(attrs.has('SNAPSHOT'))fail('전체 관리 데이터를 JSON 스냅샷 한 열로 대체하지 않는다.');
    const parents=isChild?[byId.get(history.history_parent)]:[];
    for(const parent of parents){
      if(!parent?.physical){fail('부모 이력의 물리 계약이 필요하다.');continue;}
      const fk=history.physical.constraints.some(c=>c.definition.includes('FOREIGN KEY (HISTORY_NO,')&&!c.definition.includes('HIST_DTM')&&c.definition.includes('REFERENCES '+parent.table+' (HISTORY_NO,'));
      if(!fk)fail('부모 이력과 세트 번호·원 부모 키를 함께 검증하는 FK가 필요하다.');
    }
  }
  return errors;
}
export function assertHistoryContract(domain){
  const errors=historyContractErrors(domain);
  if(errors.length)throw new Error('관리 이력 계약 오류:\n'+errors.join('\n'));
}
