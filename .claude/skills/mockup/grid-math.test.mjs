import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({});
vm.runInContext(readFileSync(new URL('../../../aidd-guide/artifact/site-kit/assets/mockup-math.js',import.meta.url),'utf8'),context);
const calculate=(rows)=>context.computeMockupGrid([
 {area:'산정',target:'비용',kind:'곱셈',a:'단가',b:'수량',scale:1e-6},
 {area:'요약',target:'총 비용',kind:'합계',a:'산정::비용',scale:1},
 {area:'요약',target:'USD/1M',kind:'비율',a:'산정::비용',b:'산정::수량',scale:1e6},
],{'산정':rows,'요약':[{}]});
test('정규화한 캐시 구성으로 1.56USD/110만 토큰을 계산하며 원 입력은 변경하지 않는다',()=>{
 const rows=[{단가:2,수량:200000},{단가:.2,수량:800000},{단가:10,수량:100000}];
 const result=calculate(rows);
 assert.equal(result.요약[0]['총 비용'],1.56);
 assert.ok(Math.abs(result.요약[0]['USD/1M']-1.4181818181818182)<1e-12);
 assert.equal(rows[0].비용,undefined);
 assert.notEqual(calculate([{단가:2,수량:1000000},...rows.slice(1)]).요약[0]['USD/1M'],result.요약[0]['USD/1M']);
});
test('수동 턴 가정과 동일 구성의 월 합계는 같은 단가이며 가격 변경은 결과에 반영된다',()=>{
 const sample=[{단가:2,수량:8000},{단가:.2,수량:12000},{단가:8,수량:2000}];
 assert.equal(calculate(sample).요약[0]['USD/1M'],calculate(sample.map(row=>({...row,수량:row.수량*1000}))).요약[0]['USD/1M']);
 assert.ok(calculate(sample.map((row,i)=>i?row:{...row,단가:4})).요약[0]['USD/1M']>calculate(sample).요약[0]['USD/1M']);
});
test('미상·음수·비유한 값과 0분모/0비용은 정상 단가로 만들지 않는다',()=>{
 for(const bad of ['',undefined,'미상',-1,Infinity,'NaN'])assert.throws(()=>calculate([{단가:2,수량:bad}]),/미입력|미상/);
 assert.throws(()=>calculate([{단가:2,수량:0}]),/양수/);
 assert.throws(()=>calculate([{단가:0,수량:1}]),/양수/);
 assert.throws(()=>context.computeMockupGrid([{area:'산정',kind:'실행',target:'값',scale:1}],{산정:[{}]}),/지원하지 않는/);
});
