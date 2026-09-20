/** Codex 세션별 훅 승인 게이트 — AIDD와 같은 상태 전이만 공통 runtime에 둔다. */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentCodexHookRevision } from './codex-hook-revision.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const MAINTENANCE = new Set([
  'AGENTS.md', '.codex/hooks.json',
  'aidd-guide/harness/runtime/codex-hook-approval.mjs',
  'aidd-guide/harness/runtime/codex-hook-revision.mjs',
  '.codex/hooks/approval-status.mjs', '.codex/hooks/approval-gate.mjs',
  '.codex/hooks/acknowledge.mjs', '.codex/hooks/self-test.mjs',
  'aidd-guide/harness/hooks-contract.md', 'aidd-guide/harness/providers/codex.md',
]);

function client(env = process.env) {
  const origin = String(env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE ?? '').toLowerCase();
  if (origin === 'codex desktop' || String(env.CODEX_APP_TOOLS_PIPE_PATH ?? '')) return 'desktop';
  if (origin.includes('cli')) return 'cli';
  return 'unknown';
}

function sessionId(input) {
  const value = input?.session_id ?? input?.sessionId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function statePath(repo, env) {
  return join(env.AI_AGENT_HOOK_APPROVAL_DIR || join(repo, 'chat-history/.codex-hook-approvals'), 'hook-state.json');
}

function readState(path) {
  try {
    const state = JSON.parse(readFileSync(path, 'utf8'));
    if (state?.version === 1 && state.sessions && !Array.isArray(state.sessions)) return state;
  } catch { /* 새 상태 */ }
  return { version: 1, current_revision: null, sessions: {} };
}

function writeState(path, state) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state)}\n`, 'utf8');
}

function key(id) { return createHash('sha256').update(id).digest('hex'); }

function prepare(input, repo = REPO, env = process.env) {
  const id = sessionId(input);
  const revision = currentCodexHookRevision(repo);
  const path = statePath(repo, env);
  const state = readState(path);
  let changed = state.current_revision !== revision;
  state.current_revision = revision;
  let session = null;
  if (id) {
    const sessionKey = key(id);
    session = state.sessions[sessionKey];
    if (!session) {
      session = { start_revision: revision, state: 'unconfirmed' };
      state.sessions[sessionKey] = session;
      changed = true;
    }
  }
  if (changed) writeState(path, state);
  return { id, path, state, session, revision };
}

function instruction() {
  return 'Codex 훅을 `/hooks`에서 직접 검토·승인한 뒤 승인 시점을 알려주세요: 1) 이번 세션 시작 전에 이미 승인됨 2) 이번 세션 시작 후 새로 승인함. `1` 또는 `2`만 답해도 됩니다.';
}

function messageKind(message) {
  const text = String(message ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^(?:1|1번)$/.test(text) || /(?:이미|기존|시작 전).*(?:승인|신뢰)/.test(text)) return 'existing';
  if (/^(?:2|2번)$/.test(text) || /(?:새로|방금|시작 후).*(?:승인|신뢰)/.test(text)) return 'new';
  if (/(?:안 했|못 했|모르|\?$)/.test(text)) return null;
  return null;
}

function userMessage(input) {
  for (const source of [input, input?.tool_input, input?.toolInput]) {
    for (const field of ['prompt', 'user_prompt', 'userPrompt', 'message', 'text']) {
      if (typeof source?.[field] === 'string') return source[field];
    }
  }
  return '';
}

export function approvalStatus(input, options = {}) {
  const { id, session, revision } = prepare(input, options.repo, options.env);
  if (!id) return `[Codex 훅 승인] 세션 ID를 확인할 수 없어 승인 상태를 판정할 수 없습니다. ${instruction()}`;
  if (session.start_revision === revision && session.state === 'approved') {
    return `[Codex 훅 승인] 이 세션은 revision=${revision}의 승인 상태입니다.`;
  }
  return `[Codex 훅 승인] 이 세션은 revision=${revision}에 대해 아직 승인되지 않았습니다. ${instruction()}`;
}

export function acknowledge(input, options = {}) {
  const { id, path, state, session, revision } = prepare(input, options.repo, options.env);
  if (!id || !session) return false;
  const kind = messageKind(userMessage(input));
  if (!kind) return false;
  const surface = client(options.env);
  if (kind === 'existing') {
    session.start_revision = revision;
    session.state = 'approved';
  } else if (surface === 'cli') {
    session.start_revision = revision;
    session.state = 'approved';
  } else {
    session.state = 'restart_required';
  }
  writeState(path, state);
  return true;
}

function maintenanceInput(input) {
  const command = String(input?.tool_input?.command ?? '');
  const paths = [...command.matchAll(/^\*\*\* (?:Add|Update|Delete) File:\s*(.+?)\s*$/gm)].map((m) => m[1]);
  if (paths.length) return paths.every((path) => MAINTENANCE.has(path.replace(/\\/g, '/')));
  return /^(?:git\s+(?:status|diff|log|show|rev-parse)\b|rg\b|Get-(?:Content|ChildItem)\b|Test-Path\b|node\s+(?:aidd-guide\/harness\/runtime\/codex-hook-(?:approval|revision)\.mjs|\.codex\/hooks\/self-test\.mjs))/i.test(command.trim());
}

export function approvalGateReason(input, options = {}) {
  const { id, session, revision } = prepare(input, options.repo, options.env);
  if (!id) return `Codex 훅 승인 게이트: 세션 ID를 확인할 수 없어 일반 작업을 차단합니다. ${instruction()}`;
  if (session.start_revision === revision && session.state === 'approved') return null;
  if (maintenanceInput(input)) return null;
  if (session.state === 'restart_required') return 'Codex 데스크톱에서 이번 세션 시작 후 새 훅을 승인했습니다. 최신 훅을 싣는 새 task에서 다시 시작한 뒤 승인 상태를 확인하세요.';
  return `Codex 훅 승인 전에는 일반 작업을 할 수 없습니다. ${instruction()}`;
}
