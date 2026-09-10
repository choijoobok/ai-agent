/**
 * 공통 스킬 원본을 Claude Code와 Codex의 발견 경로에 렌더링한다.
 * 의존성 없이 Node 하나로 실행한다.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SOURCE = join(REPO, 'aidd-guide/harness/skill-src');
const CLAUDE = join(REPO, '.claude/skills');
const CODEX = join(REPO, '.agents/skills');

export function sourceSkills() {
  if (!existsSync(SOURCE)) return [];
  return readdirSync(SOURCE)
    .filter((file) => file.endsWith('.md') && statSync(join(SOURCE, file)).isFile())
    .map((file) => file.replace(/\.md$/, ''))
    .sort();
}

export function renderSkill(name, provider) {
  const source = read(join(SOURCE, `${name}.md`));
  if (!source) return '';
  const declared = source.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  if (declared !== name) throw new Error(`${name}.md의 name은 ${name}이어야 한다.`);

  let body = source;
  if (provider === 'codex') {
    for (const skill of sourceSkills()) {
      const directCall = new RegExp(`(?<![A-Za-z0-9_.-])/${escapeRegex(skill)}(?![A-Za-z0-9/-])`, 'g');
      body = body.replace(directCall, `\$${skill}`);
    }
  }
  return markGenerated(body, name);
}

export function skillDiffs() {
  const issues = [];
  const names = sourceSkills();
  if (names.length === 0) issues.push('공통 스킬 원본이 없다.');
  for (const name of names) {
    for (const [provider, root] of [['claude', CLAUDE], ['codex', CODEX]]) {
      const target = join(root, name, 'SKILL.md');
      if (read(target) !== renderSkill(name, provider)) {
        issues.push(`${provider}: ${name} SKILL.md가 공통 원본과 다르다.`);
      }
    }
  }
  const known = new Set(names);
  for (const [provider, root] of [['claude', CLAUDE], ['codex', CODEX]]) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      if (statSync(join(root, entry)).isDirectory() && !known.has(entry)) {
        issues.push(`${provider}: 원본 없는 스킬 디렉터리 ${entry}가 있다.`);
      }
    }
  }
  return issues;
}

export function writeSkills() {
  const names = sourceSkills();
  const failures = [];
  for (const name of names) {
    for (const [provider, root] of [['claude', CLAUDE], ['codex', CODEX]]) {
      const dir = join(root, name);
      try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'SKILL.md'), renderSkill(name, provider), 'utf8');
      } catch (error) {
        failures.push(`${provider}:${name} (${error?.code ?? 'write failure'})`);
      }
    }
  }
  return { count: names.length, failures };
}

function bootstrap() {
  mkdirSync(SOURCE, { recursive: true });
  const copied = [];
  for (const name of readdirSync(CLAUDE).sort()) {
    const from = join(CLAUDE, name, 'SKILL.md');
    const to = join(SOURCE, `${name}.md`);
    if (!existsSync(from) || existsSync(to)) continue;
    copyFileSync(from, to);
    copied.push(name);
  }
  return copied;
}

function markGenerated(source, name) {
  const marker = `<!-- generated_from: aidd-guide/harness/skill-src/${name}.md; do not edit -->`;
  const end = source.startsWith('---') ? source.indexOf('\n---', 3) : -1;
  if (end < 0) return `${marker}\n${source}`;
  const insert = source.indexOf('\n', end + 1) + 1;
  return `${source.slice(0, insert)}\n${marker}\n${source.slice(insert)}`;
}

function read(path) {
  try {
    return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return '';
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === '--bootstrap') {
    const copied = bootstrap();
    console.log(`공통 스킬 원본 ${copied.length}개 생성${copied.length ? `: ${copied.join(', ')}` : ''}`);
  } else if (mode === '--write') {
    const result = writeSkills();
    console.log(`Claude/Codex 스킬 ${result.count}개 동기화 시도`);
    if (result.failures.length) {
      console.error(`보호 경로 쓰기 실패: ${result.failures.join(', ')}\n권한과 실행 환경을 확인한 뒤 재시도한다.`);
      process.exitCode = 1;
    }
  } else if (mode === '--check') {
    const issues = skillDiffs();
    if (issues.length) {
      console.error(issues.join('\n'));
      process.exitCode = 1;
    } else {
      console.log(`스킬 ${sourceSkills().length}개 — Claude/Codex 일치`);
    }
  } else {
    console.error('사용법: node aidd-guide/harness/runtime/sync-skills.mjs --bootstrap|--write|--check');
    process.exitCode = 2;
  }
}
