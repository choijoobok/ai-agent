/** 도메인 물리 계약 ↔ 활성 Liquibase 스키마의 양방향 검사. */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../.claude/hooks/lib.mjs';
import { loadSpecSet } from './spec-set.mjs';
import { readLiquibase, schemaDifferences } from './liquibase-schema.mjs';

export function domainSchema(repo) {
  const domain = loadSpecSet({ repo, name: '40-domain', parseYaml }).document;
  const config = domain.conventions?.liquibase;
  const catalog = readLiquibase({ repo, config, parseYaml });
  const issues = schemaDifferences(domain.entities ?? [], catalog, config.technical_tables ?? []);
  if (issues.length) throw new Error(`도메인/Liquibase 동기화 오류 ${issues.length}건\n${issues.join('\n')}`);
  return { domain, catalog };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { domain, catalog } = domainSchema(resolve(fileURLToPath(new URL('../../..', import.meta.url))));
    console.log(`도메인/Liquibase 일치: ENT ${domain.entities.length}건 · 활성 테이블 ${catalog.tables.size}개 · 컬럼 ${[...catalog.tables.values()].reduce((n, t) => n + t.attributes.length, 0)}개 · changelog ${catalog.files.length}개`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
