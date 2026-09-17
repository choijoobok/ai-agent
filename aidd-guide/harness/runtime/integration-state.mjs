/** 단일 main 병행 작업의 현재 재검증과 최근 충돌 통합 이력을 읽는다. */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readState, REPO } from '../../../.claude/hooks/lib.mjs';

const KEY = /^(?:SLICE-\d+|[a-z][a-z0-9:_-]*\.P[0-6])$/;
const KINDS = new Set(['code_test', 'document_review']);
const SHA = /^[0-9a-f]{7,40}$/i;

export function pendingRecheckIssues(state) {
  const issues = [];
  const mode = state?.collaboration?.integration_mode;
  if (mode !== undefined && mode !== 'shared_main') {
    issues.push(`collaboration.integration_mode는 shared_main이어야 한다: ${String(mode)}`);
  }

  const pending = state?.pending_rechecks;
  if (pending === undefined || pending === null || Array.isArray(pending) || typeof pending !== 'object') {
    return [...issues, 'pending_rechecks는 객체여야 한다.'];
  }

  for (const [key, value] of Object.entries(pending)) {
    if (!KEY.test(key)) issues.push(`pending_rechecks 키가 추적 ID가 아니다: ${key}`);
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      issues.push(`pending_rechecks.${key}는 객체여야 한다.`);
      continue;
    }
    if (!KINDS.has(value.kind)) issues.push(`pending_rechecks.${key}.kind가 잘못됐다: ${String(value.kind)}`);
    if (!SHA.test(String(value.introduced_by ?? ''))) {
      issues.push(`pending_rechecks.${key}.introduced_by는 7~40자리 commit SHA여야 한다.`);
    }
    if (!Array.isArray(value.affected) || value.affected.length === 0 || value.affected.some((x) => typeof x !== 'string' || !x.trim())) {
      issues.push(`pending_rechecks.${key}.affected는 비어 있지 않은 문자열 배열이어야 한다.`);
    }
    if (typeof value.reason !== 'string' || !value.reason.trim()) {
      issues.push(`pending_rechecks.${key}.reason이 비어 있다.`);
    }
  }
  return issues;
}

export function parseConflictIntegrations(raw, limit = 3) {
  const entries = [];
  for (const record of String(raw).split('\x1e')) {
    const [sha = '', date = '', ...bodyParts] = record.trim().split('\x1f');
    const body = bodyParts.join('\x1f').trim();
    if (!body.includes('[충돌 통합]')) continue;
    entries.push({
      sha,
      date,
      subject: body.split(/\r?\n/, 1)[0] ?? '',
      affected: field(body, '영향'),
      confirmation: field(body, '확인'),
      verification: field(body, '검증'),
    });
    if (entries.length >= limit) break;
  }
  return entries;
}

export function conflictHistoryIssues(entries = recentConflictIntegrations()) {
  const issues = [];
  for (const item of entries) {
    for (const [key, value] of [['영향', item.affected], ['확인', item.confirmation], ['검증', item.verification]]) {
      if (!value) issues.push(`충돌 통합 ${item.sha.slice(0, 7)}의 ${key} 기록이 비어 있다.`);
    }
  }
  return issues;
}

export function recentConflictIntegrations(limit = 3) {
  try {
    const raw = execFileSync('git', ['log', '-n', String(limit), '--grep=\\[충돌 통합\\]', '--format=%H%x1f%cs%x1f%B%x1e'], {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    return parseConflictIntegrations(raw, limit);
  } catch {
    return [];
  }
}

export function integrationBrief(state = readState(), limit = 3) {
  const pending = Object.entries(state?.pending_rechecks ?? {});
  const conflicts = recentConflictIntegrations(limit);
  if (pending.length === 0 && conflicts.length === 0) return [];

  const lines = ['[통합 상태]'];
  lines.push(`후속 검증 필요: ${pending.length}건`);
  for (const [key, value] of pending) {
    const affected = Array.isArray(value?.affected) ? value.affected.join(', ') : '(영향 미기록)';
    lines.push(`- ${key} · ${value?.kind ?? '종류 미기록'} · ${affected}`);
  }
  lines.push(`최근 충돌 통합: ${conflicts.length}건`);
  for (const item of conflicts) {
    lines.push(`- ${item.sha.slice(0, 7)} · 영향 ${item.affected || '(기록 없음)'} · 검증 ${item.verification || '(기록 없음)'}`);
  }
  return lines;
}

export function conflictIntegrationBlockProblem(body) {
  if (!String(body).includes('[충돌 통합]')) return '`[충돌 통합]` 블록이 없다.';
  for (const name of ['영향', '확인', '검증']) {
    if (!field(body, name)) return `[충돌 통합] 블록의 \`${name}:\` 값이 비어 있다.`;
  }
  return '';
}

function field(body, name) {
  return String(body).match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '';
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const state = readState();
  if (process.argv.includes('--brief')) {
    const lines = integrationBrief(state);
    console.log(lines.length ? lines.join('\n') : '[통합 상태]\n후속 검증 필요: 0건\n최근 충돌 통합: 0건');
  } else {
    const issues = [...pendingRecheckIssues(state), ...conflictHistoryIssues()];
    if (issues.length) {
      console.error(['통합 상태 오류:', ...issues.map((x) => `- ${x}`)].join('\n'));
      process.exitCode = 1;
    } else if (!process.argv.includes('--quiet')) {
      console.log('통합 상태 정상');
    }
  }
}
