/**
 * 훅·스킬 목록을 `user-guide/07-harness.md` 로 만든다 — `PostToolUse` 훅 겸 생성기.
 *
 * <h2>왜 손으로 쓰지 않나</h2>
 * <p>훅과 스킬의 목록은 이미 세 곳에 있다 — `AGENTS.md` §8(헌법의 요지) ·
 * `aidd-guide/harness/hooks.md`(왜 그렇게 만들었나) · `harness/skills.md`(작성 규약).
 * <b>손으로 쓴 네 번째를 만들면 그 순간 네 사실이 된다</b>(AGENTS.md §4-3). 그래서 이것은
 * 정본이 아니라 <b>실물에서 계산한 파생물</b>이다 — 훅을 지우면 다음 생성에서 사라진다.
 *
 * <h2>강도를 산문에서 읽지 않는다</h2>
 * <p>차단인지 경고인지는 <b>그 훅이 실제로 무엇을 부르는가</b>로 정한다 — `deny()` 를
 * 부르면 차단이고 `warn()` 이면 경고다. 머리 주석에 적힌 말을 믿으면 주석이 낡는 순간
 * 문서가 거짓말을 한다. <i>동작에서 유도하면 낡을 수가 없다.</i>
 *
 * <h2>커밋한다</h2>
 * <p>파생물은 형상 관리에서 빼는 것이 규칙이지만(AGENTS.md §4-5) 이것은 예외다 —
 * <b>읽는 사람이 저장소를 브라우저로 여는 사람</b>이고, 그 사람은 생성기를 돌리지 않는다.
 * 시드 CSV 를 커밋하는 것과 같은 이유다: 없으면 그 자리에서 쓸 수 없다.
 *
 * <pre>
 *   node .claude/hooks/harness-doc.mjs --write    다시 만든다
 *   node .claude/hooks/harness-doc.mjs --check    어긋났는지만 본다 (게이트용)
 * </pre>
 *
 * <p>훅으로 걸리면 공통 원본이나 provider 배선이 바뀔 때 <b>스스로 다시 만든다.</b>
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, readHookInput, repoRelative, targetPath, pass, warn } from './lib.mjs';

const OUT = 'user-guide/07-harness.md';
const HOOK_DIR = join(REPO, '.claude/hooks');
const SKILL_DIR = join(REPO, '.claude/skills');
const SETTINGS = join(REPO, '.claude/settings.json');
const CODEX_SETTINGS = join(REPO, '.codex/hooks.json');

/** `lib.mjs` 는 훅이 아니라 훅들이 함께 쓰는 것이다. */
const NOT_A_HOOK = new Set([
  'lib.mjs',
  'hook-chain.mjs',
  'pre-write.mjs',
  'post-write.mjs',
  'session-start.mjs',
]);

const mode = process.argv[2];

if (mode === '--write' || mode === '--check') {
  const made = render();
  const now = read(join(REPO, OUT));
  if (mode === '--check') {
    if (made === now) {
      console.log(`${OUT} — 실물과 일치`);
      process.exit(0);
    }
    console.log(`${OUT} 가 실물과 어긋났다. \`node .claude/hooks/harness-doc.mjs --write\` 로 다시 만든다.`);
    process.exit(1);
  }
  writeFileSync(join(REPO, OUT), made, 'utf8');
  console.log(`${OUT} — Claude 훅 ${countHooks('claude')} · Codex 훅 ${countHooks('codex')} · 스킬 ${skills().length}`);
  process.exit(0);
}

/* ── 훅으로 불렸을 때 — `.claude/` 가 바뀌었으면 스스로 다시 만든다 ── */
const input = await readHookInput();
const path = repoRelative(targetPath(input));
if (
  !path
  || !/^(\.claude\/(hooks|skills)\/|\.claude\/settings\.json$|\.agents\/skills\/|\.codex\/|aidd-guide\/harness\/skill-src\/)/.test(path)
) pass();

/*
  <b>`try` 가 감싸는 것은 계산과 쓰기뿐이다.</b> `warn()` 은 chain 안에서 예외를 던져
  결과를 회수하므로(`lib.mjs` 의 `finish`), `try` 안에 두면 그 예외를 아래 `catch` 가
  삼킨다 — 파일은 다시 쓰이는데 <b>아무도 그 사실을 듣지 못한다</b>. 커밋에서 빠지고
  CI 의 `--check` 가 거기서 죽는다. 조용한 실패라 눈에 띄지 않는다.
*/
let made = '';
try {
  made = render();
} catch {
  /* 문서를 못 만드는 것보다 나쁜 것은 그것 때문에 작업이 멈추는 것이다. */
  pass();
}

if (made === read(join(REPO, OUT))) pass();

try {
  writeFileSync(join(REPO, OUT), made, 'utf8');
} catch {
  pass();
}

warn(`${OUT} 를 다시 만들었다 — 훅·스킬이 바뀌었다. **소스와 같은 커밋에 담는다**(AGENTS.md §9).`);

// ── 읽는 것 ───────────────────────────────────────────────────────

function read(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

/** provider 설정이 무엇을 어느 이벤트에 거는가. chain은 논리 훅으로 펼친다. */
function bound(provider) {
  const rows = [];
  let cfg;
  try {
    cfg = JSON.parse(read(provider === 'claude' ? SETTINGS : CODEX_SETTINGS));
  } catch {
    return rows;
  }
  for (const [event, groups] of Object.entries(cfg?.hooks ?? {})) {
    for (const group of groups) {
      for (const h of group.hooks ?? []) {
        const file = provider === 'claude'
          ? (h.args ?? []).find((a) => a.endsWith('.mjs'))
          : h.command?.match(/([A-Za-z0-9-]+\.mjs)/)?.[1];
        if (!file) continue;
        const row = {
          event,
          matcher: group.matcher ?? '',
          name: file.slice(file.lastIndexOf('/') + 1).replace(/\.mjs$/, ''),
          file,
          timeout: h.timeout,
        };
        rows.push(...expand(row, provider));
      }
    }
  }
  return rows;
}

function countHooks(provider) {
  return new Set(bound(provider).map((r) => r.name)).size;
}

function expand(row, provider) {
  const chains = {
    'pre-write': ['guard-write', 'guard-generated'],
    'post-write': ['normalize-encoding', 'hook-syntax', 'trace-check', 'doc-drift', 'guide-drift', 'skill-sync', 'harness-doc', 'commons-doc'],
    'pre-shell': ['guard-bash', 'guard-commit'],
    'session-start': ['git-sync', 'session-brief'],
  };
  if (provider === 'codex' && row.name === 'file-chain') {
    chains['file-chain'] = row.event === 'PreToolUse' ? chains['pre-write'] : chains['post-write'];
  }
  const names = chains[row.name] ?? [row.name];
  return names.map((name) => ({ ...row, name, file: `.claude/hooks/${name}.mjs` }));
}

/**
 * 훅이 하는 일 — <b>부르는 함수에서 유도한다.</b> 주석을 믿지 않는다.
 */
function strength(file) {
  const src = read(join(REPO, file))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const has = (fn) => new RegExp(`\\b${fn}\\(`).test(src);
  const out = [];
  if (has('deny')) out.push('**차단**');
  if (has('warn')) out.push('경고');
  if (has('inject')) out.push('문맥에 넣는다');
  return out.length ? out.join(' · ') : '조용히 한다';
}

/** 머리 주석의 첫 문장 — `<b>` 류 태그를 걷고 한 줄로 만든다. */
function summary(file) {
  const src = read(join(REPO, file));
  const head = src.slice(0, src.indexOf('*/'));
  const body = head
    .split('\n')
    .slice(1)
    .map((l) => l.replace(/^\s*\*\s?/, ''))
    .join(' ');
  const first = body.split(/(?<=[.다])\s/)[0] ?? body;
  return clean(first).slice(0, 200);
}

function clean(s) {
  return s
    .replace(/<\/?[a-z0-9]+>/gi, '')
    .replace(/&#47;/g, '/')
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

/** 스킬의 frontmatter — `name` 과 `description` 첫 문장. */
function skills() {
  if (!existsSync(SKILL_DIR)) return [];
  return readdirSync(SKILL_DIR)
    .filter((d) => statSync(join(SKILL_DIR, d)).isDirectory())
    .map((dir) => {
      const src = read(join(SKILL_DIR, dir, 'SKILL.md'));
      const fm = src.startsWith('---') ? src.slice(3, src.indexOf('\n---', 3)) : '';
      const desc = fm.match(/^description:\s*(.*)$/m)?.[1] ?? '';
      const files = existsSync(join(SKILL_DIR, dir))
        ? readdirSync(join(SKILL_DIR, dir)).filter((f) => f.endsWith('.mjs'))
        : [];
      return {
        name: fm.match(/^name:\s*(.*)$/m)?.[1] ?? dir,
        dir,
        what: clean(desc.split(/(?<=다\.)\s/)[0] ?? desc),
        rest: clean(desc.split(/(?<=다\.)\s/).slice(1).join(' ')),
        scripts: files,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── 만드는 것 ─────────────────────────────────────────────────────

function render() {
  const claudeRows = bound('claude');
  const codexRows = bound('codex');
  const boundNames = new Set([...claudeRows, ...codexRows].map((r) => r.name));
  const files = readdirSync(HOOK_DIR)
    .filter((f) => f.endsWith('.mjs') && !NOT_A_HOOK.has(f))
    .map((f) => f.replace(/\.mjs$/, ''));
  const loose = files.filter((n) => !boundNames.has(n)).sort();
  const list = skills();

  const out = [];
  out.push('# 07. 훅과 스킬 — 지금 무엇이 있나');
  out.push('');
  out.push('> **이 파일은 생성물이다. 손으로 고치지 않는다** — 다음 생성에서 사라지고, 훅이 막는다.');
  out.push('> 정본은 `aidd-guide/harness/`의 명세와 provider 배선이며');
  out.push('> `node .claude/hooks/harness-doc.mjs --write` 가 만든다.');
  out.push('>');
  out.push('> **여기는 *지금 무엇이 있나* 다.** *왜 그렇게 만들었나* 는');
  out.push('> [`aidd-guide/harness/hooks.md`](../aidd-guide/harness/hooks.md) 와');
  out.push('> [`skills.md`](../aidd-guide/harness/skills.md) 가 갖는다 — 같은 사실을 두 번 적지 않는다.');
  out.push('');
  out.push('---');
  out.push('');
  out.push('## 훅');
  out.push('');
  out.push('같은 의미의 정책 엔진을 공유하고 입력 adapter와 컨텍스트 전략만 다르게 둔다.');
  renderHookTable(out, `Claude Code — ${new Set(claudeRows.map((r) => r.name)).size}개`, claudeRows);
  renderHookTable(out, `Codex — ${new Set(codexRows.map((r) => r.name)).size}개`, codexRows);
  out.push('- 사전 보호 chain 내부 오류는 해당 쓰기를 차단한다. 사후 검사 오류는 명시 경고한다.');
  out.push('- **`node` 하나로 돌며 의존성이 없다.**');
  out.push('- 컨텍스트는 Claude만 사용량 경고를 내고, Codex는 자동 압축 뒤 SessionStart로 재주입한다.');

  if (loose.length) {
    out.push('');
    out.push('### 걸리지 않은 것 — 손으로 부른다');
    out.push('');
    out.push('| 파일 | 하는 일 | 언제 |');
    out.push('|---|---|---|');
    for (const n of loose) {
      out.push(`| \`${n}\` | ${summary(`.claude/hooks/${n}.mjs`)} | 필요할 때 \`node .claude/hooks/${n}.mjs\` |`);
    }
  }

  out.push('');
  out.push('---');
  out.push('');
  out.push(`## 스킬 — ${list.length} 개`);
  out.push('');
  out.push('공통 원본에서 두 발견 경로로 생성한다. **AI가 정해진 절차를 따르게 하는 지시서**다.');
  out.push('');
  out.push('| Claude | Codex | 무엇을 | 언제 쓰나 |');
  out.push('|---|---|---|---|');
  for (const s of list) {
    out.push(`| \`/${s.name}\` | \`\$${s.name}\` | ${s.what} | ${s.rest || '—'} |`);
  }

  const withScripts = list.filter((s) => s.scripts.length);
  if (withScripts.length) {
    out.push('');
    out.push('### 스크립트를 가진 스킬');
    out.push('');
    out.push('| 스킬 | 스크립트 | 직접 돌리려면 |');
    out.push('|---|---|---|');
    for (const s of withScripts) {
      for (const f of s.scripts) {
        out.push(`| \`/${s.name}\` | \`${f}\` | \`node .claude/skills/${s.dir}/${f}\` |`);
      }
    }
  }

  out.push('');
  return out.join('\n') + '\n';
}

function renderHookTable(out, title, rows) {
  out.push('');
  out.push(`### ${title}`);
  out.push('');
  out.push('| 이벤트 | 언제 | 훅 | 하는 일 | 강도 | 제한 |');
  out.push('|---|---|---|---|---|---|');
  for (const r of rows) {
    out.push(
      `| \`${r.event}\` | ${r.matcher ? `\`${r.matcher.replace(/\|/g, '\\|')}\`` : '—'} | \`${r.name}\` | ${summary(r.file)} | ${strength(r.file)} | ${r.timeout ?? '—'}s |`,
    );
  }
}
