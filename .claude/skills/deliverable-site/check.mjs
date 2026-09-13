/** 생성된 오프라인 사이트의 구조와 로컬 자산을 검사한다. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const ROOT = resolve(REPO, 'build/deliverables');
const errors = [];

for (const key of ['design', 'user', 'operations']) {
  const file = resolve(ROOT, key, 'index.html');
  if (!existsSync(file)) {
    errors.push(`${key}: index.html이 없다.`);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  const pages = [...html.matchAll(/\bdata-page(?:\s|>)/g)].length;
  const links = [...html.matchAll(/\bdata-page-link=/g)].length;
  if (pages === 0 || pages !== links) errors.push(`${key}: 본문 ${pages}개와 목차 ${links}개가 다르다.`);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    if (!existsSync(resolve(dirname(file), target))) errors.push(`${key}: 로컬 자산이 없다 — ${target}`);
  }
  console.log(`${key}: 본문 ${pages}장 · 목차 ${links}개`);
}

const manifestPath = resolve(ROOT, 'delivery-manifest.json');
if (!existsSync(manifestPath)) errors.push('delivery-manifest.json이 없다.');
else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (Object.keys(manifest.sites ?? {}).length !== 3) errors.push('manifest에 세 사이트가 모두 없다.');
  if (!(manifest.sources ?? []).some((source) => source.path === 'documents/delivery.yaml')) {
    errors.push('manifest에 제출 구성 정본이 없다.');
  }
  console.log(`manifest: 원본 ${(manifest.sources ?? []).length}개 · 문제 ${(manifest.issues ?? []).length}개`);
}

for (const error of errors) console.log(`오류: ${error}`);
console.log(errors.length ? `빨강 — ${errors.length}건` : '초록 — 세 오프라인 사이트의 구조와 자산이 완결됐다.');
process.exitCode = errors.length ? 1 : 0;
