/** 도메인 물리 계약 ↔ 활성 Liquibase 스키마의 양방향 검사. */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { parseYaml } from '../../../.claude/hooks/lib.mjs';
import { loadSpecSet } from './spec-set.mjs';
import { readLiquibase, schemaDifferences } from './liquibase-schema.mjs';

export function recoveryMessage(issues, { entityFiles = new Map(), entities = [], root } = {}) {
  const files = new Set();
  for (const issue of issues) {
    for (const id of issue.match(/ENT-\d+/g) ?? []) {
      if (entityFiles.has(id)) files.add(entityFiles.get(id));
      for (const path of entities.find((e) => e.id === id)?.sources ?? []) files.add(path);
    }
  }
  if (!files.size && root) files.add(root);
  return [
    `생성 보류 — 데이터 모델/명세 검사 ${issues.length}건`, ...issues.map((s) => `- ${s}`),
    '먼저 확인할 원본:', ...(files.size ? [...files].map((s) => `- ${s}`) : ['- documents/spec/40-domain/ 및 오류에 표시한 changelog']),
    '후속 조치:',
    '1. AI가 원본과 변경 의도를 대조한다. 이미 합의된 범위의 문서 누락·소스 연결·재생성은 AI가 보완한다.',
    '2. 구조 불일치는 설계 오류인지 미구현 변경인지 판정한다. 구현 변경이면 소유 게이트/CR을 확인하고 모델·새 changeset·include를 함께 보완한다. 적재 파일을 덮어쓰지 않는다.',
    '3. 미지원 구문은 AI가 판독기와 회귀 검증을 보완한다. 업무 의미·명명 충돌·파괴적 변경의 판단이 필요할 때만 근거·권장안·영향을 제시해 사용자 결정을 요청한다.',
    '4. 보완 후 domain-schema.mjs → doc-gen 생성/--check → deliverable-site build/check를 다시 실행한다.',
    '사용자는 파일을 직접 고칠 필요 없이 “표시한 불일치를 보완하고 HTML을 다시 생성해줘”라고 요청할 수 있다. AI가 생성 작업 중이면 이 후속 작업을 이어서 수행한다.',
    '기존 HTML은 보존되지만 현재 원본을 반영한 최신 검증본으로 제출하지 않는다. 출력물은 직접 수정하지 않는다.',
  ].join('\n');
}

export function domainSchema(repo) {
  const loaded = loadSpecSet({ repo, name: '40-domain', parseYaml });
  const domain = loaded.document;
  const config = domain.conventions?.liquibase;
  const entityFiles = new Map();
  for (const file of loaded.files) for (const m of readFileSync(resolve(repo, file), 'utf8').matchAll(/^\s*- id: (ENT-\d+)/gm)) entityFiles.set(m[1], file);
  const context = { entityFiles, entities: domain.entities ?? [], root: config?.root };
  let catalog;
  try { catalog = readLiquibase({ repo, config, parseYaml }); }
  catch (error) { throw new Error(recoveryMessage([error.message], context)); }
  const issues = schemaDifferences(domain.entities ?? [], catalog, config.technical_tables ?? []);
  if (issues.length) throw new Error(recoveryMessage(issues, context));
  return { domain, catalog };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { domain, catalog } = domainSchema(resolve(fileURLToPath(new URL('../../..', import.meta.url))));
    console.log(`도메인/Liquibase 일치: ENT ${domain.entities.length}건 · 활성 테이블 ${catalog.tables.size}개 · 컬럼 ${[...catalog.tables.values()].reduce((n, t) => n + t.attributes.length, 0)}개 · changelog ${catalog.files.length}개`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
