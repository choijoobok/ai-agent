/**
 * 셸 명령에서 <b>따옴표 안은 데이터다</b> — 그 사실을 아는 유일한 원본.
 *
 * <p><b>왜 있나.</b> `guard-bash` 와 `guard-commit` 은 명령을 <i>정규식으로</i> 본다. 그런데
 * 정규식은 따옴표를 모른다. 2026-09-14 에 둘 다 같은 이유로 오탐했다:
 *
 * <ul>
 *   <li>`rg -n "DROP DATABASE" developer-guide/` — 검색어가 파괴적 SQL 로 읽혀 <b>순수 검색이
 *       차단</b>됐다.</li>
 *   <li>`node -e "…\ngit commit …"` — 따옴표 안의 줄바꿈이 구분자로 읽혀 <b>없는 커밋 명령</b>이
 *       생기고 커밋 규약 검사가 걸렸다.</li>
 * </ul>
 *
 * <p><b>따옴표를 통째로 무시하면 안 된다.</b> `psql -c "DROP DATABASE bo"` 는 따옴표 안이
 * 진짜 실행되는 SQL 이다. 가르는 것은 따옴표가 아니라 <b>그 앞에 선 명령의 이름</b>이다 —
 * 검색·읽기 도구의 인자는 데이터이고, 그 밖은 명령일 수 있다. 그래서 {@link maskQuoted} 는
 * <i>무엇을 가릴지</i>를 호출자가 정하게 한다.
 *
 * <p>파이프 건너편은 가리지 않는다. `echo "DROP TABLE x" | psql` 에서 `echo` 를 읽기 도구로
 * 치면 파괴적 파이프라인이 통째로 열리므로, `echo`·`printf` 는 아래 목록에 <b>넣지 않는다.</b>
 */

/** 구획을 끊는 연산자 — 여기서 명령 이름이 새로 시작한다. */
const SEPARATORS = new Set([';', '&', '&&', '|', '||', '\n']);

/**
 * 인자가 <b>데이터일 뿐인</b> 읽기·검색 도구.
 *
 * <p>좁게 잡는다. 여기에 든 이름은 따옴표 안의 무엇도 실행하지 않는다는 뜻이므로,
 * 하나라도 잘못 넣으면 그 도구로 가드를 우회할 수 있다.
 */
export const READ_ONLY_COMMANDS = new Set([
  'rg', 'ripgrep', 'grep', 'egrep', 'fgrep', 'ag', 'ack',
  'find', 'cat', 'head', 'tail', 'less', 'more',
  'wc', 'sort', 'uniq', 'diff', 'comm',
  'select-string', 'get-content', 'get-childitem',
]);

/**
 * 따옴표 안을 가린다 — <b>가릴지 말지는 호출자가 정한다.</b>
 *
 * <p>가린 자리에는 구분자도 연산자도 없는 한 낱말(`Q`)만 남는다. 그래서 뒤에 오는 정규식이
 * 거기서 명령을 보지도, 구획을 끊지도 못한다. 따옴표 <i>바깥</i>은 한 글자도 건드리지 않으므로
 * 리다이렉션·플래그·경로 판정은 그대로다.
 *
 * @param command 원본 명령
 * @param shouldMask 현재 구획의 명령 이름(소문자 basename)을 받아 가릴지 정한다
 */
export function maskQuoted(command, shouldMask = () => true) {
  const text = String(command ?? '');
  let out = '';
  let quote = '';
  let buffer = '';
  /* 이 구획에서 아직 명령 이름을 못 봤으면 빈 문자열이다. */
  let name = '';
  let word = '';
  let sawWord = false;

  const endWord = () => {
    if (sawWord && !name && word && !word.startsWith('-')) {
      name = word.split(/[\\/]/).pop().toLowerCase().replace(/\.exe$/, '');
    }
    word = '';
    sawWord = false;
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quote) {
      if (ch === quote) {
        /* 이름을 아직 못 봤으면 이 따옴표가 명령 이름 자리다 — 가리지 않는다. */
        out += name && shouldMask(name) ? `${quote}Q${quote}` : `${quote}${buffer}${quote}`;
        buffer = '';
        quote = '';
        sawWord = true;
      } else {
        buffer += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      out += '';
      continue;
    }

    out += ch;

    if (ch === '\n' || SEPARATORS.has(ch)) {
      endWord();
      name = '';
      continue;
    }
    if (/\s/.test(ch)) {
      endWord();
      continue;
    }
    word += ch;
    sawWord = true;
  }

  /* 닫히지 않은 따옴표는 원문 그대로 돌려준다 — 임의로 고쳐 읽지 않는다. */
  if (quote) return text;
  return out;
}

/**
 * 검색·읽기 도구의 인자만 가린다 — `guard-bash` 가 쓰는 형태.
 *
 * <p>`rg "DROP TABLE" f` 는 통과하고 `psql -c "DROP TABLE x"` 는 그대로 걸린다.
 * 따옴표 밖은 손대지 않으므로 `cat x > /dev/sda` 같은 리다이렉션 판정도 살아 있다.
 */
export function maskReadOnlyArguments(command) {
  return maskQuoted(command, (name) => READ_ONLY_COMMANDS.has(name));
}
