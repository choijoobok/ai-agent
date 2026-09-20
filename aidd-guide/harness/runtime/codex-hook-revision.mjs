/** Codex 훅 실행면의 revision과 SessionStart 문맥 증명을 계산한다. */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAINS } from './chains.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const MARK = /\s*--hook-revision=([0-9a-f]{64})/g;
export const CODEX_PRETOOL_CANARY_PREFIX = '[Codex PreToolUse 생존 확인]';
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

/** `/hooks`가 실제로 검토하는 provider 정의만의 SHA-256이다. */
export function currentCodexHookRevision(repo = REPO) {
  const hash = createHash('sha256');
  const path = '.codex/hooks.json';
  const body = withoutRevision(read(join(repo, path)));
  hash.update(path).update('\0').update(body.replace(/\r\n/g, '\n')).update('\0');
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

/** 훅 작성자가 한 번 실행한다. `/hooks`에 보이는 정의 변경만 재승인을 요구한다. */
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

/** 새 실행이 현재 PreToolUse 배선을 실제로 싣고 있는지 확인하는 무해한 명령이다. */
export function codexPretoolCanaryCommand(revision = currentCodexHookRevision()) {
  return `node aidd-guide/harness/runtime/codex-hook-revision.mjs --pretool-canary ${revision}`;
}

/** guard-bash가 카나리만 정확히 찾아 실행 전에 막도록 revision을 꺼낸다. */
export function codexPretoolCanaryRevision(command) {
  const match = String(command ?? '').replace(/\\/g, '/').match(
    /(?:^|[\s"'/])codex-hook-revision\.mjs["']?\s+--pretool-canary\s+([0-9a-f]{64})(?:\s|$)/,
  );
  return match?.[1] ?? '';
}

export function codexPretoolCanaryDenial(revision) {
  return `${CODEX_PRETOOL_CANARY_PREFIX} revision=${revision} — 정상적으로 명령 실행 전에 차단했다.`;
}

/** startup 훅처럼 제품 컨텍스트를 직접 받지 못하는 자리의 보조 판정이다. */
export function codexClientSurface(env = process.env) {
  const originator = String(env?.CODEX_INTERNAL_ORIGINATOR_OVERRIDE ?? '').trim().toLowerCase();
  if (String(env?.CODEX_APP_TOOLS_PIPE_PATH ?? '').trim() || originator === 'codex desktop') {
    return 'desktop';
  }
  if (originator.includes('cli') || !originator) return 'cli';
  return 'unknown';
}

/** 낡은 실행을 우회하지 않고 현재 client가 지원하는 방식으로 대화를 잇는 안내다. */
export function codexHookReentryMessage(surface = codexClientSurface()) {
  const common = '현재 실행은 바뀌기 전 hook 배선으로 시작했다. 최신 사전 집행이 필요한 작업을 계속할지 먼저 사용자에게 확인한다.';
  if (surface === 'desktop') {
    return [
      common,
      '새 task 이동을 묻기 전에 변경된 훅의 신뢰 승인을 먼저 끝낸다. 앱에 hook 검토 화면이 보이면 사용자가 현재 정의를 승인한다.',
      '앱에 검토 화면이 보이지 않으면 저장소 루트에서 Codex CLI를 열고, 그 TUI 안의 `/hooks`로 현재 정의를 검토·승인하도록 안내한다. PowerShell에 `/hooks`를 직접 입력하게 하지 않는다.',
      '사용자가 훅 승인 완료를 확인하기 전에는 새 task 이동을 묻거나 만들지 않는다. 완료가 확인되면 **최신 훅 집행이 필요한 작업을 지금 이어갈까요?**라고 묻는다.',
      '사용자가 지금 이어가기를 고르면 현재 턴을 끝낸 뒤 같은 saved project를 직접 쓰는 새 local task를 `thread/start`로 만들고, 완료한 일·남은 일·원본 task를 읽는 방법을 첫 prompt에 인계한 다음 새 task로 이동한다. 지금 필요 없다고 고르면 현재 작업은 읽기·하네스 close-out 범위에서 마치고, 최신 훅 집행이 필요한 작업 전에 다시 이 선택을 한다. 기존 task는 남기며 `thread/fork`는 쓰지 않는다.',
      `새 task에서 현재 revision의 SessionStart 실행 확인 뒤 \`${codexPretoolCanaryCommand('<SessionStart revision>')}\`를 별도 호출한다. ${CODEX_PRETOOL_CANARY_PREFIX} 차단이 오면 자동 사전 차단이 살아 있다. 스크립트가 실행되면 이 도구 경로의 훅 미적용을 사용자에게 한 번 알리고, 문서 규칙을 직접 적용하며 업무를 계속한다.`,
      '앱 사용자에게 CLI를 기본 절차로 요구하지는 않되, 앱에 검토 화면이 없으면 `/hooks` 승인은 새 task를 만들기 전의 필수 차선이다. 사용자 승인은 낡은 훅을 현재 실행에서 우회하는 허가가 아니다.',
    ].join('\n');
  }
  if (surface === 'cli') {
    return [
      common,
      '사용자에게 **최신 훅 집행이 필요한 작업을 대화 기록을 유지한 채 같은 task를 새 실행으로 지금 재개할까요?**라고 묻는다.',
      '사용자가 지금 재개하기를 고르면 Codex CLI(TUI)의 `/hooks`에서 현재 정의를 검토·승인하고 현재 실행을 끝낸 뒤 `codex resume <SESSION_ID>`로 재개한다. 가장 최근 task면 `codex resume --last`를 쓴다. 지금 필요 없다고 고르면 현재 작업은 읽기·하네스 close-out 범위에서 마치고, 최신 훅 집행이 필요한 작업 전에 재개를 다시 묻는다.',
      `재개한 실행에서 현재 revision을 확인하고 PreToolUse 생존 확인 명령 \`${codexPretoolCanaryCommand('<SessionStart revision>')}\`를 별도 호출한다. 카나리만 실패하면 자동 사전 차단의 결손을 사용자에게 한 번 알리고 문서 규칙을 직접 적용하며 계속한다.`,
      '새 빈 task는 사용자가 원할 때만 연다. 사용자 승인은 낡은 훅을 현재 실행에서 우회하는 허가가 아니다.',
    ].join('\n');
  }
  return [
    common,
    '현재 client를 확정할 수 없으므로 사용자에게 **Codex 데스크톱 앱인지 CLI(TUI)인지** 한 번 묻는다.',
    '최신 훅 집행이 지금 필요한 경우에만, 데스크톱 앱이면 작업 맥락을 인계한 새 local task를 만들고 CLI면 `/hooks` 검토·승인 뒤 같은 task를 `codex resume`로 재개한다.',
    'client와 필요 시점을 확정하기 전에는 어느 재연결 경로도 강제하지 않는다. 사용자 승인은 낡은 훅을 현재 실행에서 우회하는 허가가 아니다.',
  ].join('\n');
}

export function codexHookBlockMessage(status, surface = codexClientSurface()) {
  if (status?.reason === 'revision-stale') {
    return [
      '**Codex 훅 revision이 현재 구현과 다르므로 일반 작업을 보류한다.**',
      '훅 작성자는 `node aidd-guide/harness/runtime/codex-hook-revision.mjs --sync` 후 하네스 검증과 커밋을 완료한다.',
      codexHookReentryMessage(surface),
    ].join('\n');
  }
  return [
    '**현재 revision의 Codex SessionStart 실행 확인이 없으므로 일반 작업을 보류한다.**',
    codexHookReentryMessage(surface),
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
  } else if (process.argv.includes('--pretool-canary')) {
    const index = process.argv.indexOf('--pretool-canary');
    const revision = process.argv[index + 1] ?? '(없음)';
    console.error(`[Codex PreToolUse 생존 확인 실패] revision=${revision} — 이 도구 경로가 명령 실행 전 차단을 거치지 않았다. 먼저 hook 신뢰와 새 실행을 확인한다. 이미 승인된 새 실행에서 revision 검사가 통과했다면 같은 재진입을 반복하지 말고 코드 모드 중첩 호출의 제품 결손으로 보고한다. 사용자에게 자동 차단의 결손을 한 번 알리고 문서 규칙을 직접 적용하며 일반 업무를 계속한다.`);
    process.exitCode = 3;
  } else if (process.argv.includes('--check')) {
    const index = process.argv.indexOf('--check');
    const surfaceIndex = process.argv.indexOf('--surface');
    const requestedSurface = surfaceIndex >= 0 ? process.argv[surfaceIndex + 1] : '';
    const surface = ['desktop', 'cli'].includes(requestedSurface)
      ? requestedSurface
      : codexClientSurface();
    const status = checkCodexHookContext(process.argv[index + 1]);
    if (!status.ok) {
      console.error(codexHookBlockMessage(status, surface));
      process.exitCode = 2;
    }
  } else {
    console.log('사용법: node aidd-guide/harness/runtime/codex-hook-revision.mjs --check <SessionStart revision> [--surface desktop|cli]|--pretool-canary <SessionStart revision>|--sync');
  }
}
