/**
 * 세션이 열릴 때 원격을 먼저 당긴다 — AGENTS.md §2 · §9.
 *
 * <p><b>왜 훅인가.</b> "오늘 `git pull` 을 안 하고 시작했다" 는 사람이 잊는 종류이고,
 * 잊었다는 사실이 <b>몇 시간 뒤 충돌로만</b> 드러난다. 잊을 수 있는 것을 외우게 하지
 * 않는다(AGENTS.md §8) — 세션이 열릴 때 기계가 한 번 본다.
 *
 * <h2>무엇을 하지 않나 — 여기가 이 훅의 절반이다</h2>
 * <p><b>더러운 트리에서는 당기지 않는다.</b> 미커밋 변경 위로 남의 커밋을 얹는 것은
 * 되돌리기가 비싸고(충돌 해소를 사람이 한다), 그 판단은 사람 몫이다(AGENTS.md §5-2).
 * 당기지 않았다는 사실과 <i>무엇을 하면 당길 수 있는지</i>를 대신 말한다.
 *
 * <p><b>`--ff-only` 만 쓴다.</b> merge·rebase 는 새 커밋을 만들고, 갈라진 이력을 어떻게
 * 합칠지는 사람이 정한다. 거절당하면 거절당했다고 말하고 끝낸다.
 *
 * <p><b>`startup` 에서만 당긴다.</b> `resume`·`clear`·`compact` 는 작업 중간이다 —
 * 그때 파일이 바뀌면 <b>AI 가 방금 읽은 것과 디스크가 어긋난다</b>. 조용히 지나간다.
 *
 * <p><b>푸시하지 않는다.</b> 푸시는 사용자가 말할 때만이다(AGENTS.md §9).
 *
 * <h2>폐쇄망</h2>
 * <p>원격이 없으면 아무 말도 하지 않는다. 원격이 있는데 닿지 못하면 <b>한 줄로</b>
 * 말하고 끝낸다 — 매 세션 도는 훅이라 길게 말하면 그 말이 모든 세션에 쌓인다.
 */

import { execFileSync } from 'node:child_process';
import { readHookInput, REPO, inject, pass, provider } from './lib.mjs';
import {
  codexClientSurface,
  codexHookReentryMessage,
} from '../../aidd-guide/harness/runtime/codex-hook-revision.mjs';

/** 네트워크가 죽어 있을 때 세션 시작을 붙잡지 않는다 — 훅 전체 예산이 60초다. */
const NET_MS = 15_000;
const LOCAL_MS = 5_000;

const input = await readHookInput();

/* 작업 중간의 재주입에서는 파일을 바꾸지 않는다. source 를 모르면 시작으로 본다 —
   모르는 쪽으로 기울일 때 비용이 작은 쪽이 *당기는 것* 이 아니라 *묻는 것* 이지만,
   여기서 물을 상대가 없다. 그래서 실제 변경은 아래 「깨끗한가」 가 한 번 더 막는다. */
const source = String(input?.source ?? '').trim();
if (source && source !== 'startup') pass();

if (!git(['rev-parse', '--is-inside-work-tree'], LOCAL_MS).ok) pass();
if (!git(['remote'], LOCAL_MS).out) pass(); // 원격이 없다 — 당길 것이 없다

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], LOCAL_MS).out || 'HEAD';
const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], LOCAL_MS);
if (!upstream.ok) {
  inject(line(`\`${branch}\` 에 추적 중인 원격 브랜치가 없다 — 당기지 않았다.`));
}

const fetched = git(['fetch', '--quiet'], NET_MS);
if (!fetched.ok) {
  inject(line(`원격에 닿지 못했다 — 당기지 않았다(오프라인일 수 있다). \`${short(fetched.err)}\``));
}

const [ahead, behind] = counts();
const dirty = git(['status', '--porcelain'], LOCAL_MS).out.split('\n').filter(Boolean).length;
const tail = ahead > 0 ? ` 푸시하지 않은 커밋 ${ahead}개가 있다 — 푸시는 사용자가 말할 때만 한다(AGENTS.md §9).` : '';

if (behind === 0) {
  inject(line(
    ahead > 0
      ? `\`${branch}\` 는 \`${upstream.out}\` 보다 ${ahead} 커밋 앞서 있다 — 당길 것은 없고, 푸시는 사용자가 말할 때만 한다(AGENTS.md §9).`
      : `\`${branch}\` 는 \`${upstream.out}\` 와 같다 — 당길 것이 없다.`,
  ));
}

if (dirty > 0) {
  inject(
    line(
      [
        `**당기지 않았다** — \`${upstream.out}\` 가 ${behind} 커밋 앞서 있는데 작업 트리에 변경 ${dirty}건이 있다.`,
        '미커밋 변경 위로 남의 커밋을 얹지 않는다 — 충돌을 푸는 것은 사람의 판단이다(AGENTS.md §5-2).',
        '커밋하거나 `git stash` 한 뒤 `git pull --ff-only` 를 돌린다. **작업 전에 먼저 정리한다.**' + tail,
      ].join('\n'),
    ),
  );
}

const before = git(['rev-parse', '--short', 'HEAD'], LOCAL_MS).out;
const pulled = git(['pull', '--ff-only'], NET_MS);
if (!pulled.ok) {
  inject(
    line(
      [
        `**당기지 못했다** — \`--ff-only\` 가 거절됐다(이력이 갈라져 있다). \`${short(pulled.err)}\``,
        `${upstream.out}와 함께 갈라진 이력이다 — ${provider() === 'codex' ? '$integrate-main' : '/integrate-main'} 절차로 \`git merge --no-commit\` 통합한다.`,
      ].join('\n'),
    ),
  );
}

const files = changed();
const reload = files.filter(needsRestart);
const reentry = provider() === 'codex'
  ? [
      `**현재 실행을 끝내고 client에 맞는 방식으로 대화를 잇는다** — 진입 문서·하네스 ${reload.length}건이 바뀌었지만 현재 실행은 이미 이전 것을 읽었다.`,
      ...codexHookReentryMessage(codexClientSurface()).split('\n').slice(1),
    ]
  : [
      `**새 세션을 연다** — 진입 문서·하네스 ${reload.length}건이 바뀌었지만 현재 세션은 이미 이전 것을 읽었다.`,
      '이 세션에서 작업을 계속하면 디스크의 규칙과 AI가 따르는 규칙이 갈린다.',
    ];
inject(
  line(
    [
      `\`${upstream.out}\` 에서 **${behind} 커밋을 당겼다** (\`${before}\` → \`${git(['rev-parse', '--short', 'HEAD'], LOCAL_MS).out}\`).`,
      '**방금 바뀐 파일 위에서 일한다** — 문서·훅·가이드가 달라졌을 수 있으니 기억이 아니라 실물을 읽는다(AGENTS.md §3).',
      ...(files.length > 0
        ? [`바뀐 것 ${files.length}건: ${files.slice(0, 8).join(' · ')}${files.length > 8 ? ' …' : ''}`]
        : []),
      ...(reload.length > 0
        ? reentry
        : []),
    ].join('\n') + tail,
  ),
);

// ── 재료 ──────────────────────────────────────────────────────────

/** `git` 한 번. <b>던지지 않는다</b> — 세션 시작을 막는 훅은 없는 훅보다 나쁘다. */
function git(args, timeout) {
  try {
    const out = execFileSync('git', args, {
      cwd: REPO,
      timeout,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    return { ok: true, out: String(out).trim(), err: '' };
  } catch (error) {
    return { ok: false, out: '', err: String(error?.stderr || error?.message || '').trim() };
  }
}

/** `HEAD` 가 원격보다 몇 개 앞서고 몇 개 뒤처졌나. */
function counts() {
  const r = git(['rev-list', '--left-right', '--count', 'HEAD...@{u}'], LOCAL_MS);
  const [a, b] = r.out.split(/\s+/).map((n) => Number.parseInt(n, 10));
  return [Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0];
}

/** 당긴 뒤 바뀐 파일 — 무엇을 다시 읽어야 하는지 알려면 이름이 필요하다. */
function changed() {
  return git(['diff', '--name-only', 'ORIG_HEAD..HEAD'], LOCAL_MS).out.split('\n').filter(Boolean);
}

function needsRestart(path) {
  return /^(?:AGENTS\.md|CLAUDE\.md|\.claude\/|\.agents\/|\.codex\/|aidd-guide\/harness\/)/.test(path);
}

/** 한 줄짜리 stderr 로 줄인다 — 세션 문맥에 git 의 여러 줄을 그대로 붓지 않는다. */
function short(text) {
  return String(text).split('\n').filter(Boolean)[0]?.slice(0, 120) ?? '';
}

function line(body) {
  return `[원격 동기화] ${body}\n`;
}
