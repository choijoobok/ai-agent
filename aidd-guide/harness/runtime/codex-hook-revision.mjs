/** Codex 훅 실행면의 revision과 SessionStart 문맥 증명을 계산한다. */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAINS } from './chains.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const MARK = /\s*--hook-revision=([0-9a-f]{64})/g;
const DATA_FILES = [
  '.claude/hooks/commons-ids.txt',
  '.claude/hooks/feat-baseline.txt',
  '.claude/hooks/log-mask.patterns',
];

/** Codex adapter, 공통 chain과 그 정적 import를 안정된 순서로 돌려준다. */
export function codexHookSurface(repo = REPO) {
  const files = new Set();
  const config = join(repo, '.codex/hooks.json');
  add(config);

  for (const match of read(config).replace(/\\/g, '/').matchAll(
    /(?:\.codex\/hooks|aidd-guide\/harness\/runtime)\/[A-Za-z0-9-]+\.mjs/g,
  )) add(join(repo, ...match[0].split('/')));

  /* hook-chain은 정책 이름을 문자열로 받아 동적 import한다. 정적 import 탐색만으로는
     빠지므로 공통 chain의 실행 파일을 시작점에 명시한다. */
  for (const script of Object.values(CHAINS).flat()) add(join(repo, '.claude/hooks', script));
  for (const path of DATA_FILES) add(join(repo, ...path.split('/')));

  const queue = [...files];
  while (queue.length) {
    const file = queue.shift();
    if (!file?.endsWith('.mjs')) continue;
    for (const specifier of imports(read(file))) {
      if (!specifier.startsWith('.')) continue;
      const dependency = resolve(dirname(file), specifier);
      if (!inside(repo, dependency) || files.has(dependency) || !existsSync(dependency)) continue;
      files.add(dependency);
      queue.push(dependency);
    }
  }

  return [...files]
    .filter((file) => existsSync(file) && statSync(file).isFile())
    .sort((a, b) => rel(repo, a).localeCompare(rel(repo, b)));

  function add(file) {
    if (inside(repo, file) && existsSync(file)) files.add(resolve(file));
  }
}

/** revision 표식 자체를 제외한 현재 Codex 훅 실행면의 SHA-256이다. */
export function currentCodexHookRevision(repo = REPO) {
  const hash = createHash('sha256');
  for (const file of codexHookSurface(repo)) {
    const path = rel(repo, file);
    const body = path === '.codex/hooks.json' ? withoutRevision(read(file)) : read(file);
    hash.update(path).update('\0').update(body.replace(/\r\n/g, '\n')).update('\0');
  }
  return hash.digest('hex');
}

/** `.codex/hooks.json`의 startup 실행 명령 둘에 고정한 revision이다. */
export function configuredCodexHookRevision(repo = REPO) {
  try {
    const config = JSON.parse(read(join(repo, '.codex/hooks.json')));
    const hook = startupHook(config);
    const revisions = ['command', 'commandWindows'].map((field) => {
      const match = String(hook?.[field] ?? '').match(/--hook-revision=([0-9a-f]{64})/);
      return match?.[1] ?? '';
    });
    return revisions[0] && revisions[0] === revisions[1] ? revisions[0] : '';
  } catch {
    return '';
  }
}

/** 훅 작성자가 한 번 실행한다. 공통 훅 변경도 Codex 설정 hash 변경으로 이어진다. */
export function syncCodexHookRevision(repo = REPO) {
  const path = join(repo, '.codex/hooks.json');
  const config = JSON.parse(read(path));
  const hook = startupHook(config);
  if (!hook) throw new Error('Codex startup 훅을 찾지 못했다.');

  const revision = currentCodexHookRevision(repo);
  const command = withRevision(hook.command, revision);
  const commandWindows = withRevision(hook.commandWindows, revision, true);
  if (hook.command === command && hook.commandWindows === commandWindows) {
    return { changed: false, revision };
  }

  hook.command = command;
  hook.commandWindows = commandWindows;
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return { changed: true, revision };
}

/** SessionStart가 넣은 revision과 현재 디스크·설정이 모두 같은지 확인한다. */
export function checkCodexHookContext(attestedRevision, repo = REPO) {
  const current = currentCodexHookRevision(repo);
  const configured = configuredCodexHookRevision(repo);
  if (!configured || configured !== current) {
    return { ok: false, reason: 'revision-stale', current, configured };
  }
  if (String(attestedRevision ?? '').trim() !== current) {
    return { ok: false, reason: 'attestation-missing', current, configured };
  }
  return { ok: true, current, configured };
}

export function codexHookAttestationLine(revision = currentCodexHookRevision()) {
  return `[Codex 훅 실행 확인] revision=${revision}`;
}

export function codexHookBlockMessage(status) {
  if (status?.reason === 'revision-stale') {
    return [
      '**Codex 훅 revision이 현재 구현과 다르므로 일반 작업을 보류한다.**',
      '훅 작성자는 `node aidd-guide/harness/runtime/codex-hook-revision.mjs --sync` 후 하네스 검증과 커밋을 완료한다.',
      '그다음 **Codex CLI(TUI)의 `/hooks`에서 현재 정의를 검토·승인하고 새 task를 연다.**',
    ].join('\n');
  }
  return [
    '**현재 revision의 Codex SessionStart 실행 확인이 없으므로 일반 작업을 보류한다.**',
    '**Codex CLI(TUI)의 `/hooks`에서 현재 정의를 검토·승인하고 새 task를 연다.**',
    '사용자 메시지에 적힌 revision은 실행 확인으로 인정하지 않는다.',
  ].join('\n');
}

function imports(source) {
  const found = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*)['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) found.push(match[1]);
  return found;
}

function withoutRevision(text) {
  return String(text).replace(MARK, '');
}

function startupHook(config) {
  const group = (config?.hooks?.SessionStart ?? []).find((item) => item?.matcher === 'startup');
  return group?.hooks?.[0];
}

function withRevision(command, revision, windows = false) {
  const base = withoutRevision(String(command ?? '')).trim();
  if (windows && base.endsWith('"')) {
    return `${base.slice(0, -1)} --hook-revision=${revision}"`;
  }
  return `${base} --hook-revision=${revision}`;
}

function inside(repo, path) {
  const pathFromRepo = relative(resolve(repo), resolve(path));
  return pathFromRepo === '' || (!pathFromRepo.startsWith('..') && !isAbsolute(pathFromRepo));
}

function rel(repo, path) {
  return relative(repo, path).split(sep).join('/');
}

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--sync')) {
    const result = syncCodexHookRevision();
    console.log(result.changed
      ? `Codex hook revision 갱신 — ${result.revision}`
      : `Codex hook revision 일치 — ${result.revision}`);
  } else if (process.argv.includes('--check')) {
    const index = process.argv.indexOf('--check');
    const status = checkCodexHookContext(process.argv[index + 1]);
    if (!status.ok) {
      console.error(codexHookBlockMessage(status));
      process.exitCode = 2;
    }
  } else {
    console.log('사용법: node aidd-guide/harness/runtime/codex-hook-revision.mjs --check <SessionStart revision>|--sync');
  }
}
