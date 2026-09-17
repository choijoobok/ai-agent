/** Claude Code/Codex 하네스의 정본·생성물·배선을 빠르게 대조한다. */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../.claude/hooks/lib.mjs';
import { skillDiffs, sourceSkills } from './sync-skills.mjs';
import { CHAINS } from './chains.mjs';
import {
  configuredCodexHookRevision,
  currentCodexHookRevision,
} from './codex-hook-revision.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export function checkHarness() {
  const issues = [];
  const manifest = parseYaml(read('aidd-guide/harness/capabilities.yaml'));
  const required = [
    manifest?.constitution?.common,
    manifest?.constitution?.claude_entry,
    manifest?.hooks?.contract,
    manifest?.hooks?.chain_source,
    manifest?.hooks?.pretool_bootstrap,
    manifest?.hooks?.codex_revision,
    manifest?.hooks?.spec_loader,
    manifest?.hooks?.spec_loader_test,
    manifest?.hooks?.integration_state,
    manifest?.hooks?.integration_state_test,
    manifest?.hooks?.claude_wiring,
    manifest?.hooks?.codex_wiring,
    'aidd-guide/harness/providers/claude-code.md',
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
  for (const group of ['pre_file', 'pre_shell', 'post_file', 'session_start']) {
    const declared = manifest?.hooks?.[group] ?? [];
    const running = (CHAINS[group] ?? []).map((name) => name.replace(/\.mjs$/, ''));
    if (JSON.stringify(declared) !== JSON.stringify(running)) {
      issues.push(`${group} chain이 capabilities.yaml과 다르다: manifest [${declared}] · runtime [${running}]`);
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
  const currentRevision = currentCodexHookRevision(REPO);
  const configuredRevision = configuredCodexHookRevision(REPO);
  if (!configuredRevision || configuredRevision !== currentRevision) {
    issues.push(`Codex hook revision이 실행면과 다르다: 설정 ${configuredRevision || '(없음)'} · 현재 ${currentRevision}`);
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
  if (claudeText.includes('codex-hook-revision') || claudeText.includes('Codex 훅 실행 확인')) {
    issues.push('Claude 배선에 Codex 전용 훅 승인 검사가 연결되어 있다.');
  }
  for (const adapter of ['session-start.mjs', 'pre-write.mjs', 'pre-shell.mjs', 'post-write.mjs', 'log-raw.mjs', 'context-gauge.mjs']) {
    if (!claudeText.includes(adapter)) issues.push(`Claude adapter 배선 없음: ${adapter}`);
  }
  if (!claudeText.includes('pretool-bootstrap.mjs')) issues.push('Claude 파일 사전 훅이 bootstrap을 거치지 않는다.');
  if (!codexText.includes('pretool-bootstrap.mjs')) issues.push('Codex 파일 사전 훅이 bootstrap을 거치지 않는다.');
  const agentsText = read('AGENTS.md');
  if (!agentsText.includes('codex-hook-revision.mjs --check')) {
    issues.push('AGENTS.md에 Codex hook revision preflight가 없다.');
  }
  for (const [name, cfg] of [['Claude', claude], ['Codex', codex]]) {
    for (const group of cfg?.hooks?.PreToolUse ?? []) {
      for (const hook of group?.hooks ?? []) {
        const command = String(hook?.commandWindows ?? hook?.command ?? '');
        /* 진입 실패를 deny 로 바꾸는 길은 둘이다 — 셸 wrapper 가 `exit 2` 를 내거나,
           셸 없이(exec form) `pretool-bootstrap` 이 구조화된 deny 를 내거나.
           exec form 은 셸 자체가 없는 기계에서 훅이 <b>시작도 못 해 통과되는</b> 것을
           없애므로, wrapper 와 같은 보장으로 친다. */
        const execForm = Array.isArray(hook?.args) && hook.args.length > 0;
        const viaBootstrap = `${(hook?.args ?? []).join(' ')} ${command}`.includes('pretool-bootstrap.mjs');
        const wrapped = command.includes('exit 2') || command.includes('permissionDecision');
        if (!wrapped && !(execForm && viaBootstrap)) {
          issues.push(`${name} PreToolUse 진입 실패를 명시적 deny로 바꾸는 wrapper가 없다: ${group?.matcher ?? '*'}`);
        }
        if (name === 'Claude' && execForm && viaBootstrap) {
          const bootstrap = String(hook.args[0] ?? '');
          const projectAbsolute = bootstrap.startsWith('${CLAUDE_PROJECT_DIR}/') || isAbsolute(bootstrap);
          if (!projectAbsolute) {
            issues.push(`Claude PreToolUse bootstrap이 현재 cwd 기준 상대 경로다 — 하위 디렉터리에서 exit 1로 열릴 수 있다: ${bootstrap}`);
          }
        }
        if (name === 'Codex' && hook?.commandWindows && !command.includes('ConvertTo-Json -Compress')) {
          issues.push(`Codex Windows deny wrapper가 객체 직렬화를 쓰지 않는다 — inline JSON은 cmd.exe에서 따옴표가 깨진다: ${group?.matcher ?? '*'}`);
        }
      }
    }
  }

  const chainAdapters = [
    '.claude/hooks/session-start.mjs',
    '.claude/hooks/pre-write.mjs',
    '.claude/hooks/pre-shell.mjs',
    '.claude/hooks/post-write.mjs',
    '.codex/hooks/session-start.mjs',
    '.codex/hooks/file-chain.mjs',
    '.codex/hooks/pre-shell.mjs',
  ];
  for (const adapter of chainAdapters) {
    if (!read(adapter).includes('harness/runtime/chains.mjs')) {
      issues.push(`공통 chain 원본을 쓰지 않는 adapter: ${adapter}`);
    }
  }
  /* `lib.mjs` 의 provider() 는 adapter 진입 경로나 bootstrap의 명시값으로 판정한다. */
  for (const [event, groups] of Object.entries(codex?.hooks ?? {})) {
    for (const group of groups) {
      for (const hook of group?.hooks ?? []) {
        const wiring = `${hook?.command ?? ''} ${hook?.commandWindows ?? ''}`;
        const adapter = wiring.includes('.codex/hooks/');
        const bootstrap = wiring.includes('pretool-bootstrap.mjs') && /\bcodex\b/.test(wiring);
        if (!adapter && !bootstrap) {
          issues.push(`Codex ${event} 배선에 .codex adapter나 codex bootstrap 표식이 없다 — provider 판정이 틀어진다.`);
        }
      }
    }
  }

  /* 같은 chain 이 도는데 예산이 다르면 좁은 쪽만 잘린다 — 한 번 갈렸던 자리다. */
  for (const [event, claudeHook] of [['PreToolUse', 'pre-write.mjs'], ['PostToolUse', 'post-write.mjs']]) {
    const mine = timeoutOf(claude, event, claudeHook);
    const theirs = timeoutOf(codex, event, 'file-chain.mjs');
    if (mine !== undefined && theirs !== undefined && mine !== theirs) {
      issues.push(`${event} 파일 chain 의 timeout 이 갈렸다: Claude ${mine}s · Codex ${theirs}s.`);
    }
  }

  issues.push(...coverageIssues('Claude', claude));
  issues.push(...coverageIssues('Codex', codex));

  if (sourceSkills().length === 0) issues.push('공통 스킬이 0개다.');
  return issues;
}

/**
 * <b>배선이 있는가</b> 가 아니라 <b>무엇을 덮는가</b> 를 센다.
 *
 * <p>2026-09-14 실측: `Write` 로 막히는 경로가 `Bash` 의 `printf > …` 와 MCP 쓰기 도구로는
 * 그대로 만들어졌다. 게이트가 <b>도구 이름으로</b> 서 있으면 도구를 바꾸는 것만으로 게이트가
 * 사라지는데, 그때까지 이 검사는 내내 초록이었다 — 어댑터가 배선돼 있기는 했으므로.
 * 그래서 대표 도구 이름을 matcher 정규식에 <b>실제로 먹여 본다.</b>
 */
const MUST_SEE = {
  Claude: [
    { event: 'PreToolUse', adapter: 'pre-write.mjs', tools: ['Write', 'Edit', 'NotebookEdit', 'mcp__server__write_file', 'mcp__server__edit_block'] },
    /* MCP 셸 도구를 빼면 `Bash` 로 막히는 명령이 `start_process` 로 그대로 돈다 —
       2026-09-14 에 실측했다. 파일 쪽만 MCP 를 덮고 셸 쪽은 두면 같은 구멍이 남는다. */
    { event: 'PreToolUse', adapter: 'pre-shell.mjs', tools: ['Bash', 'PowerShell', 'mcp__server__start_process', 'mcp__server__execute_command'] },
    { event: 'PostToolUse', adapter: 'post-write.mjs', tools: ['Write', 'Edit', 'mcp__server__write_file', 'mcp__server__edit_block'] },
  ],
  Codex: [
    { event: 'PreToolUse', adapter: 'file-chain.mjs', tools: ['apply_patch', 'Edit', 'Write', 'mcp__server__write_file', 'mcp__server__edit_block'] },
    { event: 'PreToolUse', adapter: 'pre-shell.mjs', tools: ['Bash', 'PowerShell', 'mcp__server__start_process', 'mcp__server__execute_command'] },
    { event: 'PostToolUse', adapter: 'file-chain.mjs', tools: ['apply_patch', 'Edit', 'Write', 'mcp__server__write_file', 'mcp__server__edit_block'] },
  ],
};

function coverageIssues(name, config) {
  const issues = [];
  for (const { event, adapter, tools } of MUST_SEE[name] ?? []) {
    const patterns = [];
    for (const group of config?.hooks?.[event] ?? []) {
      for (const hook of group?.hooks ?? []) {
        const wiring = `${(hook?.args ?? []).join(' ')} ${hook?.command ?? ''}`;
        if (wiring.includes(adapter)) patterns.push(String(group?.matcher ?? ''));
      }
    }
    if (patterns.length === 0) {
      issues.push(`${name} ${event} 에 ${adapter} 배선이 없다.`);
      continue;
    }
    const missed = tools.filter((tool) => !patterns.some((pattern) => matches(pattern, tool)));
    if (missed.length) {
      issues.push(`${name} ${event} matcher가 ${adapter} 로 보내지 않는 도구가 있다: ${missed.join(', ')}`);
    }
  }
  return issues;
}

function matches(pattern, tool) {
  try {
    return new RegExp(pattern).test(tool);
  } catch {
    return false;
  }
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
