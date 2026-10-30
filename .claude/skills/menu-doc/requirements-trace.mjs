// 화면 요건서의 요구사항 매핑을 정본과 대조한다. 제품 충족 여부는 판정하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../hooks/lib.mjs';
import { loadSpecSet } from '../../../aidd-guide/harness/runtime/spec-set.mjs';

const plain = value => value.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*]/g, '').trim();
const section = (md, heading) => md.match(new RegExp(`^## ${heading}[^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'))?.[1];
const rows = (block, clean = true) => (block ?? '').split('\n').filter(line => /^\|/.test(line) && !/^\|[\s:|-]+\|\s*$/.test(line)).map(line => line.trim().slice(1, -1).split('|').map(value => clean ? plain(value) : value.trim()));

export function checkMappings(md, requirements, documentPath = path.resolve('requirements.md')) {
  const errors = [], pending = [];
  const block = section(md, '관련 요구사항');
  if (block === undefined) return { missing: true, errors, pending, count: 0 };
  const table = rows(block);
  const expected = ['요구사항', '요구사항명', '관계', '이 화면의 반영 범위·위치', '검수 사례(§9)'];
  if (table[0]?.join('|') !== expected.join('|')) errors.push('관련 요구사항 표의 다섯 열이 공통 서식과 다름');
  const localCases = new Set(rows(section(md, '9\\. 테스트 케이스')).slice(1).map(row => row[0]));
  const sections = new Set([...md.matchAll(/^#{2,6} (\d+(?:-\d+)*)(?:\.\s|\s)/gm)].map(match => match[1]));
  const rawRows = rows(block, false);
  const seen = new Set();
  for (const [index, [id, title, relation, scope = '', cases = '']] of table.slice(1).entries()) {
    const req = requirements.get(id);
    if (!req) errors.push(`${id}: 요구사항 정본에 없음`);
    else if (title !== req.title) errors.push(`${id}: 정본 제목과 다름 (${req.title})`);
    const link = rawRows[index + 1]?.[0].match(/^\[REQ-\d+\]\(([^)]+)\)$/)?.[1];
    if (!link || (req?.source && path.resolve(path.dirname(documentPath), link) !== req.source)) errors.push(`${id}: 해당 요구사항의 정본 파일 링크가 아님`);
    if (seen.has(id)) errors.push(`${id}: 중복 매핑`);
    seen.add(id);
    if (!['직접 담당', '지원 설정', '공통 제약', '연계·경계'].includes(relation)) errors.push(`${id}: 관계를 명시해야 함`);
    const references = [...scope.matchAll(/§(\d+(?:-\d+)*)/g)];
    if (!references.length || references.some(match => !sections.has(match[1]))) errors.push(`${id}: 반영 위치가 실제 본문 절에 연결되지 않음`);
    if (scope.replace(/§\d+(?:-\d+)*/g, '').replace(/[\s·:.,—-]/g, '').length < 4) errors.push(`${id}: 담당 범위 설명이 없음`);
    if (/^미정\s*—\s*§10\s+\S/.test(cases)) pending.push(`${id}: ${cases}`);
    else {
      const ids = cases.split(/[·,\s]+/).filter(Boolean);
      if (!ids.length || ids.some(value => !localCases.has(value))) errors.push(`${id}: §9에 없는 검수 사례 (${cases || '빈 값'})`);
    }
  }
  if (!seen.size) errors.push('요구사항 매핑 행 없음');
  const upper = rows(section(md, '0\\. 메타')).find(row => row[0] === '상위 요구사항')?.[1] ?? '';
  for (const id of upper.match(/REQ-\d+/g) ?? []) if (!seen.has(id)) errors.push(`${id}: 상위 요구사항에 있으나 담당 범위 매핑 없음`);
  return { missing: false, errors, pending, count: seen.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = path.resolve(import.meta.dirname, '../../..');
  const root = path.join(repo, 'documents/screen');
  const inventory = process.argv.includes('--inventory');
  const target = process.argv.slice(2).find(arg => !arg.startsWith('--'));
  if (!target) throw new Error('페이지 경로 또는 --inventory admin을 지정하세요.');
  const start = path.resolve(root, target.replace(/^[/\\]+/, ''));
  if (!start.startsWith(root + path.sep) || !fs.existsSync(start)) throw new Error('등록된 화면 문서 경로가 아닙니다.');
  const set = loadSpecSet({ repo, name: '10-requirements', parseYaml });
  const requirements = new Map(set.files.flatMap(file => {
    const source = path.resolve(repo, file);
    return (parseYaml(fs.readFileSync(source, 'utf8')).requirements ?? []).map(req => [req.id, {...req, source}]);
  }));
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name === 'requirements.md') files.push(file);
    }
  }
  walk(start);
  let errors = 0, missing = 0, mapped = 0, pending = 0;
  for (const file of files) {
    const result = checkMappings(fs.readFileSync(file, 'utf8'), requirements, file);
    const label = path.relative(root, path.dirname(file)).replaceAll('\\', '/');
    if (result.missing) { missing++; console.log(`미작성: ${label}`); }
    else { mapped++; pending += result.pending.length; }
    for (const error of result.errors) console.error(`오류: ${label}: ${error}`);
    for (const item of result.pending) console.log(`후속: ${label}: ${item}`);
    errors += result.errors.length;
  }
  console.log(`요구사항 매핑: ${files.length}개 / 작성 ${mapped} / 미작성 ${missing} / 미정 연결 ${pending} / 오류 ${errors}`);
  if (errors || (!inventory && (missing || !files.length))) process.exitCode = 1;
}
