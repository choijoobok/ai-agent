/** Claude Code/Codex 하네스의 정본·생성물·배선을 빠르게 대조한다. */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../.claude/hooks/lib.mjs';
import { skillDiffs, sourceSkills } from './sync-skills.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export function checkHarness() {
  const issues = [];
  const manifest = parseYaml(read('aidd-guide/harness/capabilities.yaml'));
  const required = [
    manifest?.constitution?.common,
    manifest?.constitution?.claude_entry,
    manifest?.hooks?.contract,
    manifest?.hooks?.claude_wiring,
    manifest?.hooks?.codex_wiring,
    'aidd-guide/harness/providers/claude.md',
    'aidd-guide/harness/providers/codex.md',
    '.github/workflows/harness.yml',
  ].filter(Boolean);
  for (const path of required) if (!existsSync(join(REPO, path))) issues.push(`필수 파일 없음: ${path}`);
  for (const group of ['pre_file', 'pre_shell', 'post_file', 'session_start', 'conversation']) {
    for (const policy of manifest?.hooks?.[group] ?? []) {
      const path = `${manifest.hooks.shared_policy_engine}${policy}.mjs`;
      if (!existsSync(join(REPO, path))) issues.push(`공통 정책 엔진 없음: ${path}`);
    }
  }

  if (!read('CLAUDE.md').startsWith('@AGENTS.md')) {
    issues.push('CLAUDE.md가 AGENTS.md를 첫 줄에서 가져오지 않는다.');
  }
  issues.push(...skillDiffs());

  const codex = json('.codex/hooks.json', issues);
  const codexText = read('.codex/hooks.json');
  for (const event of ['SessionStart', 'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'Stop']) {
    if (!codex?.hooks?.[event]) issues.push(`Codex 훅 이벤트 없음: ${event}`);
  }
  if (codexText.includes('context-gauge')) {
    issues.push('Codex에 Claude 전용 context-gauge가 연결되어 있다.');
  }
  for (const adapter of ['session-start.mjs', 'session-brief.mjs', 'file-chain.mjs', 'pre-shell.mjs', 'log-raw.mjs']) {
    if (!codexText.includes(adapter)) issues.push(`Codex adapter 배선 없음: ${adapter}`);
  }
  const starts = codex?.hooks?.SessionStart ?? [];
  if (!starts.some((group) => String(group?.matcher ?? '').includes('compact'))) {
    issues.push('Codex SessionStart가 compact 이후 재주입을 보장하지 않는다.');
  }
  if (!starts.some((group) => String(group?.matcher ?? '') === 'startup')) {
    issues.push('Codex SessionStart에 startup 전용 그룹이 없다 — 원격 동기화가 작업 중간에 돈다.');
  }

  const claude = json('.claude/settings.json', issues);
  if (!claude?.hooks?.SessionStart) issues.push('Claude SessionStart 훅이 없다.');
  const claudeText = read('.claude/settings.json');
  for (const adapter of ['session-start.mjs', 'pre-write.mjs', 'post-write.mjs', 'log-raw.mjs', 'context-gauge.mjs']) {
    if (!claudeText.includes(adapter)) issues.push(`Claude adapter 배선 없음: ${adapter}`);
  }
  /* 같은 chain 이 도는데 예산이 다르면 좁은 쪽만 잘린다 — 한 번 갈렸던 자리다. */
  for (const [event, claudeHook] of [['PreToolUse', 'pre-write.mjs'], ['PostToolUse', 'post-write.mjs']]) {
    const mine = timeoutOf(claude, event, claudeHook);
    const theirs = timeoutOf(codex, event, 'file-chain.mjs');
    if (mine !== undefined && theirs !== undefined && mine !== theirs) {
      issues.push(`${event} 파일 chain 의 timeout 이 갈렸다: Claude ${mine}s · Codex ${theirs}s.`);
    }
  }

  if (sourceSkills().length === 0) issues.push('공통 스킬이 0개다.');
  return issues;
}

function read(path) {
  try {
    return readFileSync(join(REPO, path), 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return '';
  }
}

/** 그 이벤트에서 `needle` 을 실행하는 훅의 timeout — 배선 모양이 provider마다 다르다. */
function timeoutOf(cfg, event, needle) {
  for (const group of cfg?.hooks?.[event] ?? []) {
    for (const hook of group?.hooks ?? []) {
      const wiring = `${(hook?.args ?? []).join(' ')} ${hook?.command ?? ''}`;
      if (wiring.includes(needle)) return hook?.timeout;
    }
  }
  return undefined;
}

function json(path, issues) {
  try {
    return JSON.parse(read(path));
  } catch {
    issues.push(`JSON을 읽을 수 없음: ${path}`);
    return {};
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const issues = checkHarness();
  if (issues.length) {
    console.error(['하네스 불일치:', ...issues.map((x) => `- ${x}`)].join('\n'));
    process.exitCode = 1;
  } else if (!process.argv.includes('--quiet')) {
    console.log(`하네스 일치 — 공통 스킬 ${sourceSkills().length}개 · Claude/Codex 배선 확인`);
  }
}
