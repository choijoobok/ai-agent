/**
 * 대화 원문을 `chat-history/` 에 append 한다 — AGENTS.md §10 · aidd-guide/harness/memory/logs.md.
 *
 * <p><b>아무 말도 하지 않는다.</b> 매 턴 도는 훅이라 한 마디라도 내면 그 말이 모든 턴에
 * 쌓인다. 특히 `UserPromptSubmit` 의 표준 출력은 <b>모델의 문맥에 그대로 들어가므로</b>,
 * 로그를 남기는 일이 문맥을 갉아먹는 일이 되어서는 안 된다.
 *
 * <p><b>조용히 실패한다.</b> 로그를 못 남기는 것보다 나쁜 것은 로그 때문에 작업이 멈추는
 * 것이다 — 기록은 작업의 부산물이지 작업이 아니다.
 *
 * <p>두 이벤트가 한 파일을 나눠 쓴다: `UserPromptSubmit` 이 USER 를, `Stop` 이 AI 를.
 * 사람의 말은 훅 입력에 그대로 온다. Claude의 `Stop`은 transcript를 읽고, Codex는 안정된
 * `last_assistant_message` 필드를 먼저 쓴다.
 */

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { REPO, readHookInput, readText, pass } from './lib.mjs';

/* 마스킹 규칙의 memo. **선언이 실행보다 위에 있어야 한다** — 아래 두면 첫 턴이 TDZ 로
   죽고, 훅이 조용히 실패하도록 만들어 두었기에 그 죽음이 보이지 않는다(2026-09-03 실물). */
let cached = null;

const input = await readHookInput();
const event = input?.hook_event_name ?? '';

try {
  if (event === 'UserPromptSubmit') appendUser(input);
  else if (event === 'Stop') appendAssistant(input);
} catch {
  /* 기록이 작업을 멈추게 하지 않는다. */
}
pass();

// ── 남기는 것 ─────────────────────────────────────────────────────

function appendUser(hook) {
  const prompt = String(hook?.prompt ?? '').trim();
  if (!prompt) return;
  append(`## [${stamp()}]\n\n### USER\n\n${mask(prompt)}\n\n`);
}

/**
 * `Stop` 이 AI 의 말을 남긴다 — transcript 에서 <b>아직 안 남긴 것만</b>.
 *
 * <p>워터마크(마지막으로 남긴 assistant uuid)를 임시 디렉터리에 세션별로 둔다. `Stop` 은
 * 한 턴에 두 번 이상 설 수 있고(이어가기), 워터마크가 없으면 <b>같은 말이 두 벌 남는다</b>.
 * 저장소에 두지 않는 것은 워터마크가 기록이 아니라 <i>어디까지 적었나</i> 이기 때문이다.
 */
function appendAssistant(hook) {
  const direct = String(hook?.last_assistant_message ?? '').trim();
  if (direct) {
    const mark = watermark(hook?.session_id);
    const id = String(hook?.turn_id ?? direct);
    if (mark.read() === id) return;
    mark.write(id);
    append(`### AI\n\n${mask(direct)}\n\n---\n\n`);
    return;
  }

  const rows = transcript(hook?.transcript_path);
  if (rows.length === 0) return;

  const said = rows.filter((row) => row?.type === 'assistant' && row?.isSidechain !== true);
  const mark = watermark(hook?.session_id);
  const last = said.findIndex((row) => row?.uuid === mark.read());
  const fresh = last >= 0 ? said.slice(last + 1) : said;
  if (fresh.length === 0) return;

  /* thinking 과 tool_use 는 남기지 않는다 — 원문은 대화이지 작업 내역이 아니고,
     tool_use 의 인자에는 파일 내용이 통째로 실려 로그가 저장소 사본이 된다. */
  const text = fresh
    .flatMap((row) => row?.message?.content ?? [])
    .filter((block) => block?.type === 'text' && block?.text)
    .map((block) => block.text.trim())
    .join('\n\n')
    .trim();

  mark.write(fresh[fresh.length - 1]?.uuid);
  if (!text) return;
  append(`### AI\n\n${mask(text)}\n\n---\n\n`);
}

function append(chunk) {
  const now = new Date();
  const file = join(
    REPO,
    'chat-history',
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
    'raw',
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.md`,
  );
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, chunk, 'utf8');
}

// ── 가리는 것 ─────────────────────────────────────────────────────

/**
 * 규칙 파일의 정규식에 걸린 <b>줄을 통째로</b> 가린다 — 값만 지우면 앞뒤 문맥이 그 값을
 * 되살린다(`DB 비밀번호는 ***** 야` 같은 줄).
 *
 * <p><b>이것으로 충분하지 않다.</b> 패턴은 아는 모양만 잡는다 — 애초에 넣지 않는 것이
 * 유일하게 확실하다(aidd-guide/harness/memory/logs.md).
 */
function mask(text) {
  const rules = patterns();
  if (rules.length === 0) return text;
  return text
    .split('\n')
    .map((line) => (rules.some((rule) => rule.test(line)) ? '***MASKED***' : line))
    .join('\n');
}

function patterns() {
  if (cached) return cached;
  cached = readText(join(REPO, '.claude/hooks/log-mask.patterns'))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .flatMap((line) => {
      try {
        return [new RegExp(line, 'i')];
      } catch {
        return []; /* 못 읽는 규칙 하나가 나머지를 무르게 하지 않는다. */
      }
    });
  return cached;
}

// ── 거들기 ────────────────────────────────────────────────────────

function transcript(path) {
  if (!path) return [];
  return readText(path)
    .split('\n')
    .flatMap((line) => {
      if (!line.trim()) return [];
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function watermark(sessionId) {
  const file = join(
    tmpdir(),
    'ai-agent-log-raw',
    `${String(sessionId ?? 'none').replace(/[^\w-]/g, '')}.txt`,
  );
  return {
    read() {
      try {
        return readFileSync(file, 'utf8').trim();
      } catch {
        return '';
      }
    },
    write(uuid) {
      if (!uuid) return;
      try {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, uuid, 'utf8');
      } catch {
        /* 못 적으면 다음 Stop 이 겹쳐 적는다 — 조용히 지는 쪽이 멈추는 쪽보다 낫다. */
      }
    },
  };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
