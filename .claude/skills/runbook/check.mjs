import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../hooks/lib.mjs';
import { loadSpecSet } from '../../../aidd-guide/harness/runtime/spec-set.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const release = process.argv.includes('--release');
const requiredSections = [
  'system_overview', 'daily_checks', 'incidents', 'backup_restore',
  'monitoring', 'periodic_tasks', 'escalation',
];

const data = loadSpecSet({ repo: REPO, name: '80-operations', parseYaml }).document;
const errors = [];
const warnings = [];
const seen = new Set();
let count = 0;

for (const section of requiredSections) {
  const items = data[section];
  if (!Array.isArray(items)) {
    errors.push(`${section}: 배열이 아니다.`);
    continue;
  }
  if (items.length === 0) {
    (release ? errors : warnings).push(`${section}: 등록된 절차가 없다.`);
  }
  for (const item of items) {
    count += 1;
    if (!/^RUN-\d{3}$/.test(item.id ?? '')) errors.push(`${section}: 잘못된 ID ${item.id ?? '(없음)'}`);
    else if (seen.has(item.id)) errors.push(`${section}: 중복 ID ${item.id}`);
    else seen.add(item.id);
    if (!item.title) errors.push(`${item.id ?? section}: title이 없다.`);
    if (!Array.isArray(item.traces_to) || item.traces_to.length === 0) warnings.push(`${item.id}: traces_to가 없다.`);
    const serialized = JSON.stringify(item);
    if (serialized.includes('@defer')) (release ? errors : warnings).push(`${item.id}: @defer가 남아 있다.`);
    if (item.status === 'verified' && !item.verify) errors.push(`${item.id}: verified인데 verify가 없다.`);
  }
}

console.log(`운영 런북 ${count}개 절차 · 오류 ${errors.length} · 경고 ${warnings.length}`);
for (const error of errors) console.log(`오류: ${error}`);
for (const warning of warnings) console.log(`경고: ${warning}`);
process.exitCode = errors.length ? 1 : 0;
