/** Codex 세션별 훅 승인 게이트 — AIDD와 같은 client-kind 상태 전이를 공통 runtime에 둔다. */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentCodexHookRevision } from './codex-hook-revision.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const STATE_VERSION = 2;
const REVISION_SCOPE = 'codex-hook-definition';
const MAINTENANCE = new Set([
  'AGENTS.md', '.codex/hooks.json',
  'aidd-guide/harness/runtime/codex-hook-approval.mjs',
  'aidd-guide/harness/runtime/codex-hook-revision.mjs',
  '.codex/hooks/approval-status.mjs', '.codex/hooks/approval-gate.mjs',
  '.codex/hooks/acknowledge.mjs', '.codex/hooks/approved-session.mjs', '.codex/hooks/self-test.mjs',
  'aidd-guide/harness/hooks-contract.md', 'aidd-guide/harness/providers/codex.md',
]);

function client(env = process.env) {
  const origin = String(env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE ?? '').trim().toLowerCase();
  if (origin === 'codex desktop' || String(env.CODEX_APP_TOOLS_PIPE_PATH ?? '').trim()) return 'desktop';
  if (origin === 'codex cli' || !origin) return 'cli';
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
    if (state?.sessions && !Array.isArray(state.sessions)) return state;
  } catch { /* 새 상태 */ }
  return { version: STATE_VERSION, revision_scope: REVISION_SCOPE, current_revision: null, restart_required: null, sessions: {} };
}

function writeState(path, state) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state)}\n`, 'utf8');
}

function key(id) { return createHash('sha256').update(id).digest('hex'); }
function isCurrent(session, revision) { return Boolean(session && session.start_revision === revision); }
function restartAppliesToClient(restart, surface) {
  return Boolean(restart && restart.client === surface && surface !== 'cli');
}

function prepare(input, repo = REPO, env = process.env) {
  const id = sessionId(input);
  const revision = currentCodexHookRevision(repo);
  const path = statePath(repo, env);
  const state = readState(path);
  const now = new Date().toISOString();
  let changed = false;

  /* 기존 실행면 전체 해시는 provider 정의 단독 해시와 호환되지 않는다. 승인 기록을
     승격하지 않고 unconfirmed로 돌려 fail-closed 한다. */
  if (state.version !== STATE_VERSION || state.revision_scope !== REVISION_SCOPE) {
    for (const [sessionKey, session] of Object.entries(state.sessions ?? {})) {
      if (!session || typeof session !== 'object') continue;
      session.session_key = session.session_key || sessionKey;
      session.start_revision = revision;
      session.state = 'unconfirmed';
      delete session.approval_timing;
      delete session.confirmed_at;
    }
    state.version = STATE_VERSION;
    state.revision_scope = REVISION_SCOPE;
    state.revision_scope_migrated_at = now;
    state.current_revision = revision;
    state.restart_required = null;
    changed = true;
  }
  if (state.current_revision !== revision) {
    state.current_revision = revision;
    state.revision_changed_at = now;
    state.restart_required = null;
    changed = true;
  }

  let session = null;
  if (id) {
    const sessionKey = key(id);
    session = state.sessions[sessionKey];
    if (!session || session.session_key !== sessionKey) {
      const source = ['startup', 'resume', 'clear', 'compact'].includes(input?.source) ? input.source : 'startup';
      session = { session_key: sessionKey, start_revision: revision, state: 'unconfirmed', source, started_at: now };
      state.sessions[sessionKey] = session;
      changed = true;
    }
  }
  if (changed) writeState(path, state);
  return { id, path, state, session, revision, surface: client(env) };
}

function instruction() {
  return [
    '브리핑과 일반 작업을 시작하기 전에 Codex 훅을 직접 검토·신뢰해야 합니다.',
    '',
    '해야 할 일:',
    `1. 터미널에서 \`codex -C "${REPO}"\`를 실행합니다.`,
    '2. 열린 Codex 대화에서 `/hooks`를 입력합니다.',
    '3. 표시되는 모든 ai-agent 훅을 직접 검토하고 신뢰합니다.',
    '',
    '승인 시점은 어느 쪽인가요?',
    '',
    '1. 현재 세션 시작 전에 이미 모두 승인됨',
    '2. 현재 세션 시작 후 새로 승인함',
    '',
    '위 절차를 마쳤다면 `1` 또는 `2`로 답해주세요. 숫자 답변은 훅을 직접 검토·신뢰했다는 확인도 뜻합니다.',
    '',
    '이 확인이 끝날 때까지는 브리핑이나 일반 작업을 시작하지 않습니다.',
  ].join('\n');
}

function normalized(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[`'"“”‘’()[\]{}<>]/g, ' ')
    .replace(/[.,!?。…·:;/\\|*_~#>-]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function messageKind(message, state) {
  const raw = String(message ?? '').normalize('NFKC');
  const text = normalized(message);
  if (!text) return null;
  const negated = /(?:안|못)\s*(?:검토|확인|승인|신뢰|했|됐|되)|(?:검토|확인|승인|신뢰).{0,10}(?:안\s*했|못\s*했|하지\s*않|되지\s*않|아니|전(?:입니다|이다|임)?)/.test(text);
  const uncertain = /[?？]\s*$/.test(raw) || /(?:모르|기억나지|확실하지|아마|인\s*것\s*같|한\s*것\s*같|인가요|나요|까요|맞나요|말하면|쓰면|입력하면|예시)/.test(text);
  if (negated || uncertain) return null;
  const approved = /(?:승인|신뢰)(?:을|를|은|는|이|가)?\s*(?:했|함|완료|마쳤|됐|된|되어|되었|받았|상태)/.test(text);
  if (state === 'unconfirmed' || state === 'declared') {
    if (/^(?:1|1번|첫\s*번째|첫째)$/.test(text)) return 'existing';
    if (/^(?:2|2번|두\s*번째|둘째)$/.test(text)) return 'new';
    const existing = /(?:이번\s*(?:codex\s*)?세션\s*(?:시작\s*)?전|세션\s*시작\s*전|이미|기존|예전|사전|원래).{0,18}(?:승인|신뢰)|(?:승인|신뢰).{0,18}(?:되어\s*있|돼\s*있|된\s*상태|했었)/.test(text);
    const current = /(?:이번|현재|이)\s*(?:codex\s*)?(?:세션|창)\s*(?:(?:시작\s*)?(?:후|뒤)|에서|중에).{0,18}(?:승인|신뢰)|(?:새로|방금|지금).{0,18}(?:승인|신뢰)|(?:승인|신뢰).{0,18}(?:새로|방금|지금)/.test(text);
    if (approved && existing && !current) return 'existing';
    if (approved && current && !existing) return 'new';
    return state === 'unconfirmed' && approved ? 'declared' : null;
  }
  if (state === 'restart') {
    const newSession = /(?:새|다른)\s*(?:(?:codex|앱)\s*)?(?:창|세션)/.test(text);
    const restarted = /(?:다시\s*시작|재시작|새로\s*(?:열|시작)|열었|시작했)/.test(text);
    return approved && newSession && restarted ? 'restarted' : null;
  }
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

function lockedReason(session, revision, restart, surface) {
  if (!isCurrent(session, revision)) {
    return surface === 'cli'
      ? 'Codex 훅 정의가 이 CLI 세션 시작 뒤 변경됐습니다. 일반 작업은 최신 훅 승인 전까지 금지됩니다. /hooks에서 최신 ai-agent 훅을 직접 검토·승인한 뒤 승인 질문에 `2`로 답하면 현재 CLI 세션에서 계속할 수 있습니다.'
      : 'Codex 훅 정의가 이 앱 세션 시작 뒤 변경됐습니다. 일반 작업은 금지됩니다. 최신 훅을 승인한 새 Codex 앱 창에서 다시 시작하세요.';
  }
  if (session?.state === 'restart_required') {
    return 'Windows Codex 앱에서 이번 세션 시작 후 새 훅을 승인했으므로 이 창에서는 일반 작업이 금지됩니다. 새 Codex 앱 창에서 같은 프로젝트를 다시 시작한 뒤, 새 창에서 재시작했고 훅이 승인된 상태라는 뜻을 명확히 알려주세요.';
  }
  if (restartAppliesToClient(restart, surface)) {
    return 'Windows Codex 앱에서 새 훅을 승인한 뒤 열린 새 세션입니다. 일반 작업 전에 새 앱 창에서 재시작했고 훅이 승인된 상태라는 뜻을 명확히 알려주세요.';
  }
  if (session?.state === 'declared') {
    return `훅을 검토·신뢰했다는 선언은 받았지만 승인 시점이 빠졌습니다. 아래 절차를 확인한 뒤 \`1\` 또는 \`2\`로 답해주세요.\n\n${instruction()}`;
  }
  return `Codex 훅 승인 전에는 일반 작업을 할 수 없습니다.\n\n${instruction()}`;
}

export function approvalStatus(input, options = {}) {
  const { id, state, session, revision, surface } = prepare(input, options.repo, options.env);
  if (!id) return `[Codex 훅 승인] 세션 ID를 확인할 수 없어 승인 상태를 판정할 수 없습니다.\n\n${instruction()}`;
  if (isCurrent(session, revision) && session.state === 'approved' && !restartAppliesToClient(state.restart_required, surface)) {
    return `[Codex 훅 승인] 이 ${surface === 'desktop' ? 'Windows Codex 앱' : 'Codex CLI'} 세션은 revision=${revision}의 승인 상태입니다.`;
  }
  return `[Codex 훅 승인]\n\n${lockedReason(session, revision, state.restart_required, surface)}`;
}

/** 마지막 SessionStart의 종류를 보존해, 승인 뒤 startup만 원격 동기화를 하게 한다. */
export function approvalEntrySource(input, options = {}) {
  const { session } = prepare(input, options.repo, options.env);
  return ['startup', 'resume', 'clear', 'compact'].includes(session?.source) ? session.source : 'startup';
}

export function acknowledge(input, options = {}) {
  const { id, path, state, session, revision, surface } = prepare(input, options.repo, options.env);
  if (!id || !session) return false;
  const now = new Date().toISOString();
  const text = userMessage(input);

  if (!isCurrent(session, revision)) {
    if (surface === 'cli' && messageKind(text, 'unconfirmed') === 'new' && !restartAppliesToClient(state.restart_required, surface)) {
      session.start_revision = revision;
      session.state = 'approved';
      session.confirmed_at = now;
      session.approval_timing = 'new_after_revision';
      session.client = surface;
      session.revision_reapproved_at = now;
      writeState(path, state);
      return true;
    }
    return false;
  }

  const restartApplies = restartAppliesToClient(state.restart_required, surface);
  const expectedState = restartApplies && state.restart_required?.revision === revision
    && state.restart_required.origin_session_key !== session.session_key ? 'restart' : session.state;
  const kind = messageKind(text, expectedState);
  if (kind === 'declared' && session.state === 'unconfirmed') {
    session.state = 'declared';
    session.declared_at = now;
  } else if (kind === 'existing' && ['unconfirmed', 'declared'].includes(session.state) && !restartApplies) {
    session.state = 'approved';
    session.confirmed_at = now;
    session.approval_timing = 'existing';
    session.client = surface;
  } else if (kind === 'new' && ['unconfirmed', 'declared'].includes(session.state) && !restartApplies) {
    session.state = surface === 'cli' ? 'approved' : 'restart_required';
    session.confirmed_at = now;
    session.approval_timing = 'new';
    session.client = surface;
    if (surface !== 'cli') state.restart_required = { revision, origin_session_key: session.session_key, client: surface, created_at: now };
  } else if (kind === 'restarted' && restartApplies && state.restart_required?.revision === revision
      && state.restart_required.origin_session_key !== session.session_key) {
    session.state = 'approved';
    session.confirmed_at = now;
    session.approval_timing = 'restarted';
    session.client = surface;
    state.restart_required = null;
  } else {
    return false;
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
  const { id, state, session, revision, surface } = prepare(input, options.repo, options.env);
  if (!id) return `Codex 훅 승인 게이트: 세션 ID를 확인할 수 없어 일반 작업을 차단합니다.\n\n${instruction()}`;
  if (isCurrent(session, revision) && session.state === 'approved' && !restartAppliesToClient(state.restart_required, surface)) return null;
  if (maintenanceInput(input)) return null;
  return lockedReason(session, revision, state.restart_required, surface);
}
