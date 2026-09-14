/**
 * 커밋의 네 사고를 막는다 — AGENTS.md §5-3 · §9.
 *
 * <p>① <b>경로를 지정하지 않은 커밋.</b> 한 트리에서 세션이 둘일 수 있고, 낡은 인덱스가
 * <b>남의 커밋을 되돌린다</b>. 되돌리기 어려운 쪽이라 차단이다.
 *
 * <p>② <b>본문을 확인할 수 없는 커밋 메시지.</b> `-m`·`-F <파일>`은 provider 표식을
 * 확인할 수 없다. POSIX heredoc 또는 PowerShell here-string을 stdin(`-F -`)으로 넘긴다.
 *
 * <p>③ <b>누가 만들었는지 없는 커밋.</b> 두 AI 가 한 저장소에 커밋하므로, 표식이 없으면
 * <i>이 줄을 누가 썼나</i> 를 나중에 알 방법이 없다 — 되돌아가 물을 수도 없다.
 * <b>메시지가 명령에 보여야</b> 통과한다. 파일로 넘긴 메시지는 훅이 읽을 수 없으므로
 * stdin(`-F -`) 형태로 다시 시도하게 한다.
 *
 * <p>④ <b>형식과 언어가 어긋난 제목.</b> `<타입>: <현상> — <조치>` 이고 <b>한국어</b>다
 * (AGENTS.md §5-3). 형식은 <i>무엇이 잘못됐고 무엇을 했나</i> 를 제목 한 줄에 세우게
 * 하고, 언어는 <b>읽는 사람이 한국어 운영자</b>라서다 — 이 저장소의 이력이 두 언어로
 * 갈리면 나중에 <b>같은 사실을 두 말로 찾아야</b> 한다.
 */

import { readHookInput, deny, pass, provider, PROVIDER_NAME } from './lib.mjs';
import { maskQuoted } from '../../aidd-guide/harness/runtime/shell-parse.mjs';

/**
 * 허용 타입 — **원본은 AGENTS.md §5-3 이다.** 여기는 집행만 한다.
 *
 * <p>2026-09-14 까지 이 목록은 <b>이 코드에만</b> 있었다. 그래서 `state:` 로 적은 커밋 넷이
 * 이미 저장소에 있는데도 무엇이 허용되는지 문서에서 알 길이 없었고, 사람은 <i>막히고 나서야</i>
 * 규칙을 알았다. 훅이 정책의 원본이 되면 안 된다(hooks-contract.md).
 *
 * <p>`state` 는 `documents/project.state.yaml` 의 게이트 전이·검증 기록처럼
 * <b>지금 어디인가만 바꾸는 커밋</b>이다. `chore` 에 섞으면 상태 이력을 로그에서 고를 수 없다.
 */
const TYPES = new Set([
  'feat', 'fix', 'docs', 'refactor', 'chore', 'style', 'test', 'perf', 'build', 'ci', 'state',
]);
const HANGUL = /[가-힣]/;

const input = await readHookInput();
const command = String(input?.tool_input?.command ?? '');
if (!command) pass();

/*
  <b>명령의 시작 자리에 있는 `git commit` 만 본다.</b> 문자열 안에 우연히 든 것(`echo
  "git commit"` · 커밋 메시지 본문)까지 세면 훅이 자기 자신의 커밋을 막는다.
*/
const SEGMENT_BREAK = /(?:^|[\n;&|]|&&|\|\|)\s*/g;
/* **따옴표 안을 먼저 가린다.** 안 가리면 `node -e "…\ngit commit …"` 처럼 인용부에 든
   줄바꿈이 구분자로 읽혀 **없는 커밋 명령**이 생기고, 커밋과 무관한 스크립트가 커밋 규약으로
   막힌다(2026-09-14 실측). 가린 자리에는 구분자 없는 한 낱말만 남으므로 아래 플래그 검사
   (`-m` · `-F -` · `-a` · `--`)는 그대로 돈다 — 그 셋은 따옴표 밖에 있다. */
const segments = maskQuoted(command).split(SEGMENT_BREAK).map((part) => part.trim());
const commits = segments.filter((part) => /^git\s+(-\S+\s+)*commit\b/.test(part));
if (commits.length === 0) pass();

for (const commit of commits) {
  /*
    heredoc 뒤(`<<'EOF'`)는 메시지 본문이다 — 본문에 든 `--` 나 `-m "` 를 인자로 세면
    안 된다. 첫 줄까지만 인자로 본다.
  */
  const args = commit.split('\n')[0];

  if (/(?:^|\s)(?:-m|--message)(?:\s|=)/.test(args)) {
    deny(
      [
        '커밋 메시지를 `-m`으로 넘기면 provider trailer를 확정할 수 없다 — AGENTS.md §9.',
        '메시지는 stdin으로 넘긴다: POSIX heredoc 또는 PowerShell here-string | git commit -F - -- <경로…>',
      ].join('\n'),
    );
  }

  if (!/(?:^|\s)(?:-F|--file)(?:\s+|=)-(?=\s|$)/.test(args)) {
    deny(
      [
        '커밋 메시지 본문이 훅에 보이지 않는다 — AGENTS.md §9.',
        '`-F <파일>`은 쓰지 않고 stdin(`-F -`)으로 본문과 provider trailer를 함께 넘긴다.',
      ].join('\n'),
    );
  }

  if (/\s(-a|--all)(\s|$)/.test(args)) {
    deny(
      [
        'git commit -a 는 추적 중인 모든 변경을 담는다 — 경로를 지정해 커밋한다(AGENTS.md §9).',
        '한 트리에서 세션이 둘일 수 있고, 낡은 인덱스가 남의 커밋을 되돌린다.',
        "형태:  git commit -F - -- <경로…> <<'EOF'",
      ].join('\n'),
    );
  }

  if (!/\s--(\s|$)/.test(args)) {
    deny(
      [
        '경로를 지정하지 않은 커밋이다 — AGENTS.md §9.',
        '한 트리에서 세션이 둘일 수 있고, 낡은 인덱스가 남의 커밋을 되돌린다.',
        "형태:  git commit -F - -- <경로…> <<'EOF'",
        '한 커밋은 한 가지 일이다(§5-3) — 담을 경로를 세는 것이 그 규칙을 지키는 자리이기도 하다.',
      ].join('\n'),
    );
  }

}

const who = provider();
const bodies = visibleMessageBodies(command);
if (who === 'unknown' || bodies.length < commits.length) {
  deny(
    [
      '커밋 메시지 본문이나 실행 provider를 확정할 수 없다 — AGENTS.md §9.',
      'POSIX heredoc 또는 PowerShell here-string으로 `git commit -F - -- <경로…>`에 본문을 넘긴다.',
    ].join('\n'),
  );
}

for (const body of bodies.slice(-commits.length)) {
  const format = subjectProblem(body);
  if (format) {
    deny(
      [
        format,
        '형태: `<타입>: <현상> — <조치>` · **왜** 는 본문에 · **한국어로 쓴다**(AGENTS.md §5-3).',
        `타입: ${[...TYPES].join(' · ')}`,
      ].join('\n'),
    );
  }

  const problem = trailerProblem(body, who);
  if (problem) {
    deny(
      [
        problem,
        `마지막 trailer 묶음은 provider 문서대로 \`Agent: ${PROVIDER_NAME[who]}\`를 포함해야 한다.`,
        '값과 순서: `aidd-guide/harness/providers/`.',
      ].join('\n'),
    );
  }
}

pass();

function visibleMessageBodies(source) {
  const bodies = [];
  for (const pattern of [/@'\r?\n([\s\S]*?)\r?\n'@/g, /@"\r?\n([\s\S]*?)\r?\n"@/g]) {
    for (const match of source.matchAll(pattern)) bodies.push(match[1]);
  }

  const starts = /<<-?\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))[^\r\n]*\r?\n/g;
  for (const match of source.matchAll(starts)) {
    const tag = match[1] ?? match[2] ?? match[3];
    const rest = source.slice((match.index ?? 0) + match[0].length);
    const end = rest.match(new RegExp(`^${escapeRegex(tag)}\\s*$`, 'm'));
    if (end?.index !== undefined) bodies.push(rest.slice(0, end.index).replace(/\r?\n$/, ''));
  }
  return bodies;
}

/** 제목 한 줄과 본문의 언어 — 형식이 맞아도 영어로 적으면 이력이 두 언어로 갈린다. */
function subjectProblem(body) {
  const lines = String(body).replace(/\r\n/g, '\n').trimEnd().split('\n');
  const subject = (lines[0] ?? '').trim();
  if (!subject) return '커밋 메시지의 첫 줄이 비어 있다.';

  const head = subject.match(/^([a-z]+):\s+(.+)$/);
  if (!head) return `제목에 타입이 없다: \`${subject.slice(0, 60)}\``;
  if (!TYPES.has(head[1])) return `모르는 타입이다: \`${head[1]}\``;

  const [phenomenon, ...rest] = head[2].split(' — ');
  if (rest.length === 0 || !phenomenon.trim() || !rest.join(' — ').trim()) {
    return '제목이 **현상 — 조치** 로 갈려 있지 않다. `—`(em dash) 앞뒤에 각각 내용이 있어야 한다.';
  }

  if (!HANGUL.test(subject)) return '제목에 한국어가 없다.';

  /* 본문은 trailer 묶음 앞까지다 — trailer 는 영문 키라서 언어를 묻지 않는다. */
  const at = lines.findIndex((line) => /^Agent:\s*/.test(line.trim()));
  const prose = lines.slice(1, at < 0 ? lines.length : at).join('\n');
  if (prose.trim() && !HANGUL.test(prose)) return '본문에 한국어가 없다.';
  return '';
}

function trailerProblem(body, who) {
  const lines = String(body).replace(/\r\n/g, '\n').trimEnd().split('\n');
  const agentLines = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => /^Agent:\s*/.test(line));
  const expected = `Agent: ${PROVIDER_NAME[who]}`;
  if (agentLines.length !== 1) return '커밋에는 `Agent:` trailer가 정확히 한 줄 있어야 한다.';
  if (agentLines[0].line !== expected) return `provider 표식이 틀렸다: 기대값은 \`${expected}\`다.`;

  const at = agentLines[0].index;
  if (at > 0 && lines[at - 1].trim()) return '`Agent:` 앞에는 빈 줄을 두어 trailer 묶음을 분리한다.';
  const after = lines.slice(at + 1).map((line) => line.trim()).filter(Boolean);
  if (who === 'claude') {
    const coauthor = 'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>';
    if (after.length !== 1 || after[0] !== coauthor) return `Claude trailer의 마지막 줄은 \`${coauthor}\`다.`;
  } else if (after.length) {
    return '`Agent: Codex` 뒤에는 다른 본문을 두지 않는다.';
  }
  return '';
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
