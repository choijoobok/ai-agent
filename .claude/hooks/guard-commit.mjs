/**
 * 커밋의 세 사고를 막는다 — AGENTS.md §9.
 *
 * <p>① <b>경로를 지정하지 않은 커밋.</b> 한 트리에서 세션이 둘일 수 있고, 낡은 인덱스가
 * <b>남의 커밋을 되돌린다</b>. 되돌리기 어려운 쪽이라 차단이다.
 *
 * <p>② <b>큰따옴표 커밋 메시지.</b> PowerShell 에서 here-string 인자가 깨져 pathspec 오류로
 * 떨어진다 — 실패가 조용하지는 않지만 <b>원인이 메시지에 안 보여</b> 매번 같은 자리에서
 * 시간을 쓴다.
 *
 * <p>③ <b>누가 만들었는지 없는 커밋.</b> 두 AI 가 한 저장소에 커밋하므로, 표식이 없으면
 * <i>이 줄을 누가 썼나</i> 를 나중에 알 방법이 없다 — 되돌아가 물을 수도 없다.
 * <b>메시지가 명령에 보일 때만</b> 본다(`-F -` · heredoc). 파일로 넘긴 메시지는 훅이
 * 읽을 수 없고, <b>읽지 못한 것을 없다고 말하지 않는다.</b>
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
    here-string 뒤(`<<'EOF'`)는 메시지 본문이다 — 본문에 든 `--` 나 `-m "` 를 인자로 세면
    안 된다. 첫 줄까지만 인자로 본다.
  */
  const args = commit.split('\n')[0];

  if (/-m\s*"/.test(args)) {
    deny(
      [
        '커밋 메시지에 큰따옴표를 쓰지 않는다 — AGENTS.md §9.',
        'PowerShell 에서 here-string 인자가 깨져 pathspec 오류가 난다.',
        "메시지는 heredoc 으로 넘긴다:  git commit -F - -- <경로…> <<'EOF'",
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

  /* 메시지 본문은 첫 줄 다음이다 — heredoc 이 명령에 실려 오는 경우에만 볼 수 있다. */
  const body = commit.slice(commit.indexOf('\n') + 1);
  const hasBody = commit.includes('\n') && body.trim().length > 0;
  if (hasBody && !/^Agent:\s*\S/m.test(body)) {
    deny(
      [
        `커밋에 만든 주체가 없다 — AGENTS.md §9. 메시지 끝에 \`Agent: ${PROVIDER_NAME[provider()]}\` 를 붙인다.`,
        '두 AI 가 한 저장소에 커밋한다. 표식이 없으면 이 줄을 누가 썼는지 나중에 알 방법이 없다.',
        '무엇을 적나는 provider 문서가 갖는다 — `aidd-guide/harness/providers/`.',
      ].join('\n'),
    );
  }
}

pass();
