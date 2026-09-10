/**
 * 커밋의 세 사고를 막는다 — AGENTS.md §9.
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
 */

import { readHookInput, deny, pass, provider, PROVIDER_NAME } from './lib.mjs';

const input = await readHookInput();
const command = String(input?.tool_input?.command ?? '');
if (!command) pass();

/*
  <b>명령의 시작 자리에 있는 `git commit` 만 본다.</b> 문자열 안에 우연히 든 것(`echo
  "git commit"` · 커밋 메시지 본문)까지 세면 훅이 자기 자신의 커밋을 막는다.
*/
const SEGMENT_BREAK = /(?:^|[\n;&|]|&&|\|\|)\s*/g;
const segments = command.split(SEGMENT_BREAK).map((part) => part.trim());
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
