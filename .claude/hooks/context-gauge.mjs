/**
 * 컨텍스트 게이지 — 문맥이 차오르면 <b>압축할 여지가 남아 있을 때</b> 알린다.
 *
 * <h2>왜 필요한가</h2>
 * <p>자동 압축이 있지만 <b>거의 꽉 찼을 때 걸린다</b> — 관측된 발동 지점은
 * `preTokens: 1006239` 이며 창의 100% 근처다. 그때의 압축은 <i>무엇을 버릴지 고를 여지가
 * 없는</i> 압축이다. 이 훅은 마지막 안전망을 대신하지 않고 <b>그 앞에 한 번 말한다.</b>
 *
 * <h2>어림하지 않는다 — 실측이다</h2>
 * <p>트랜스크립트의 assistant 메시지마다 `message.usage` 가 실려 있다. 지금 문맥은
 * `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` 다.
 * <b>압축도 자동으로 반영된다</b> — 압축 직후의 assistant 는 줄어든 값을 들고 온다.
 *
 * <h2>`Stop` 이 아니라 `UserPromptSubmit` 인 이유</h2>
 * <p>훅의 stdout 이 모델에게 닿는 이벤트는 넷뿐이고(`UserPromptSubmit` ·
 * `UserPromptExpansion` · `SessionStart` · `PostModelSwitch`) <b>`Stop` 은 그중에 없다</b> —
 * `Stop` 에서 낸 평문은 디버그 로그로만 간다. 재는 값은 <i>직전 턴이 끝난 시점</i>의
 * 것이므로 "턴 종료 시 실측" 과 같고, 말은 다음 턴 첫머리에 나간다.
 *
 * <h2>막지 않는다 · 임계 아래에서는 한 글자도 쓰지 않는다</h2>
 * <p>압축 시점은 판단이다 — 한 작업의 한가운데면 조금 더 가는 편이 낫고, 작업이 끝난
 * 참이면 지금이 가장 싸다. 그래서 권하기만 한다. 그리고 <b>임계 아래면 아무것도 출력하지
 * 않는다</b> — 문맥을 재는 일이 문맥을 갉아먹으면 안 된다.
 *
 * <p>의존성이 없다. fail-open — 못 재면 조용히 지나간다.
 */

import { mkdirSync, openSync, readFileSync, readSync, closeSync, fstatSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readHookInput, pass, inject } from './lib.mjs';

/**
 * 창 크기 — <b>관측값이다.</b>
 *
 * <p>자동 압축이 `preTokens: 1006239` 에서 걸린 기록이 근거이며(2026-09-05 확인),
 * 손으로 친 압축의 최대 903,678 에서는 걸리지 않았다. 둘 사이가 창의 끝이다.
 *
 * <p><b>이 값이 낡으면 다시 재는 방법이 있다</b> — 그래서 상수로 두어도 된다:
 * <pre>grep -oh '"trigger":"auto","preTokens":[0-9]*' ~/.claude/projects/*&#47;*.jsonl</pre>
 * 모델이나 하네스가 바뀌어 값이 달라지면 그 명령이 새 값을 말한다.
 */
const WINDOW = 1_000_000;

/** 넘으면 말한다. 손으로 친 압축 55건의 중앙값이 592,134(59.2%)라 그 습관에 맞춘 값이다. */
const THRESHOLD = 0.6;

/** 한 번 말하고 조용해진다. 다시 말하는 것은 이만큼 더 찼을 때다. */
const STEP = 0.05;

const input = await readHookInput();
if (input?.hook_event_name !== 'UserPromptSubmit') pass();

let used = 0;
try {
  used = measure(input?.transcript_path);
} catch {
  /* 못 재면 말하지 않는다 — 틀린 게이지는 없는 게이지보다 나쁘다. */
}

const ratio = used / WINDOW;
if (!used || ratio < THRESHOLD) pass();

/* 60% 를 넘긴 뒤로는 5%p 마다 한 번씩만 — 매 턴 말하면 그것이 곧 소음이다. */
const band = Math.floor(ratio / STEP);
if (!crossedNewBand(input?.session_id, band)) pass();

inject(
  `[컨텍스트] ${fmt(used)} / ${fmt(WINDOW)} 토큰 · ${Math.round(ratio * 100)}%\n` +
    `자동 압축은 거의 꽉 찼을 때 걸린다 — 지금이 무엇을 남길지 고를 수 있는 때다.\n` +
    `**사용자에게 \`/compact\` 를 권하고, 진행 중인 일이 있으면 그것을 마친 뒤가 낫다고 함께 말한다.**\n`,
);

// ── 재는 것 ───────────────────────────────────────────────────────

/**
 * 트랜스크립트의 <b>마지막 assistant `usage`</b> 를 읽는다.
 *
 * <p>파일이 30MB 를 넘기도 하므로 통째로 읽지 않고 <b>꼬리만</b> 본다. 매 턴 도는 훅이
 * 수십 MB 를 읽으면 게이지가 세션을 느리게 만든다.
 */
function measure(path) {
  if (!path) return 0;
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    /* 마지막 턴 몇 개면 충분하다. 못 찾으면 0 을 돌려 조용히 지나간다. */
    const span = Math.min(size, 512 * 1024);
    const buf = Buffer.alloc(span);
    readSync(fd, buf, 0, span, size - span);
    const lines = buf.toString('utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const u = usageOf(lines[i]);
      if (u) return u;
    }
  } finally {
    closeSync(fd);
  }
  return 0;
}

function usageOf(line) {
  if (!line || !line.includes('"usage"')) return 0;
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    return 0; /* 꼬리를 자르느라 깨진 첫 줄 */
  }
  if (row?.type !== 'assistant') return 0;
  const u = row?.message?.usage;
  if (!u) return 0;
  return (
    (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
  );
}

/**
 * 이 구간에서 아직 말한 적이 없는가. 워터마크는 <b>저장소에 두지 않는다</b> —
 * 기록이 아니라 <i>어디까지 말했나</i> 라서 `log-raw` · `doc-drift` 와 같은 자리를 쓴다.
 */
function crossedNewBand(sessionId, band) {
  if (!sessionId) return true;
  const dir = join(tmpdir(), 'ai-agent-context-gauge');
  const file = join(dir, `${String(sessionId).replace(/[^\w-]/g, '')}.txt`);
  let last = -1;
  try {
    last = Number(readFileSync(file, 'utf8')) || -1;
  } catch {
    last = -1;
  }
  /* 압축하면 값이 내려간다 — 그때는 다시 올라올 때 말해야 하므로 기록을 낮춘다. */
  if (band <= last) {
    if (band < last) remember(dir, file, band);
    return false;
  }
  remember(dir, file, band);
  return true;
}

function remember(dir, file, band) {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, String(band), 'utf8');
  } catch {
    /* 못 적으면 다음 턴에 또 말한다 — 시끄러운 쪽이 조용한 쪽보다 낫다. */
  }
}

function fmt(n) {
  return n.toLocaleString('en-US');
}
