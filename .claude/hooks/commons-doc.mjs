/**
 * 공통물 목록을 `aidd-guide/standard/registry.md` 로 만든다 — `PostToolUse` 훅 겸 생성기.
 *
 * <h2>왜 손으로 쓰지 않나</h2>
 * <p>`standard/frontend/packages.md` §3 이 <b>「목록에 없는 공통 컴포넌트는 없는 것과
 * 같다」</b> 고 하고 `CLAUDE.md` §3 이 그 목록을 가리킨다. 그런데 <b>그 목록이 없었다</b> —
 * 폴더 33개가 등재 없이 있었고, 가리키는 두 문서가 거짓말을 하고 있었다.
 *
 * <p>손으로 적으면 폴더를 더할 때마다 낡는다. <b>낡은 목록은 없는 것보다 나쁘다</b> —
 * 있다고 믿게 해서 다음 사람이 같은 것을 또 만든다. 그래서 실물에서 계산한다: 폴더를
 * 지우면 다음 생성에서 사라지고, 더하면 <b>다음 생성에서 저절로 선다</b>.
 *
 * <h2>「어디를 읽나」도 계산이다</h2>
 * <p>가이드 문서의 `sources:` 메타를 역인덱스로 뒤집어 얻는다({@link guidesForFolder}) —
 * `guide-drift` 가 쓰는 것과 <b>같은 매처</b>다. 둘로 두면 갈리고, 갈리면 훅과 목록이 서로
 * 다른 사실을 말한다(CLAUDE.md §4-3).
 *
 * <p><b>빈 칸을 숨기지 않는다.</b> 아무 문서도 지목하지 않은 공통물이 목록의 값이다 —
 * 그것이 *다음에 쓸 문서* 의 목록이기 때문이다.
 *
 * <h2>한 줄 설명을 짓지 않는다</h2>
 * <p>폴더 이름 옆에 <i>무엇을 하는 것인가</i> 를 적으려면 어디선가 가져와야 하는데,
 * `shared/` 21개 중 `index.ts` 를 가진 것은 하나뿐이고 폴더 단위 주석 규약이 없다.
 * <b>없는 것을 뽑을 수는 없고, 지어내면 그것이 낡는 자리가 된다.</b> 대신 지목된 표준
 * 문서의 `title` 을 싣는다 — 이미 한 번 쓰인 한 줄이고, 고치면 여기도 따라온다.
 *
 * <pre>
 *   node .claude/hooks/commons-doc.mjs --write    다시 만든다
 *   node .claude/hooks/commons-doc.mjs --check    어긋났는지만 본다 (게이트용)
 * </pre>
 *
 * <p>훅으로 걸리면 <b>`shared/` · `core/` · `support/` 아래가 바뀔 때 스스로 다시
 * 만든다</b> — 새 공통물 폴더가 등재 없이 서 있는 시간을 0 으로 만드는 것이 목적이다.
 */

import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPO,
  readHookInput,
  repoRelative,
  targetPath,
  readText,
  guideSourceIndex,
  guidesForFolder,
  walkFiles,
  pass,
  warn,
} from './lib.mjs';

const OUT = 'aidd-guide/standard/registry.md';

/**
 * 훑는 뿌리 셋 — <b>공통물이 사는 곳</b>.
 *
 * <p>이 셋인 이유는 모듈 경계가 이미 그렇게 갈라 놓았다는 것이다: `core` 가 계약,
 * `support` 가 횡단 지원, 프론트는 `shared` 하나에 둘이 섞여 있다. 여기에 `features/` 나
 * `api/` 를 더하지 않는다 — 그것은 기능이고, 기능의 목록은 화면 문서가 갖는다.
 */
const ROOTS = [
  { area: '프론트', base: 'sources/frontend/src/shared', show: 'shared/' },
  { area: 'core', base: 'sources/backend/core/src/main/java/com/aiagent/core', show: 'core/' },
  { area: 'support', base: 'sources/backend/support/src/main/java/com/aiagent/support', show: 'support/' },
];

/** 「어디를 읽나」 칸에 몇 개까지 적나 — 넘으면 `외 N`. 열 개를 늘어놓으면 칸이 문단이 된다. */
const MAX_DOCS = 3;

/*
  <b>목록의 `sources:` 는 일부러 굵게 적는다</b> — 세그먼트 셋(`sources/backend/core/`)이라
  `guide-drift` 의 역인덱스 최소치(넷)에 못 미쳐 <b>인덱스에 오르지 않는다</b>. 그것이
  의도다: 공통물을 고치면 이 훅이 이미 목록을 다시 만들고 알리므로, 저 훅까지 같은 일로
  말하면 <b>경고가 둘</b>이 되고 둘 다 배경음이 된다. `lint.mjs` 는 `standard/` 문서의
  `sources:` 가 비어 있는 것을 위반으로 보므로, 비우는 것으로 피할 수는 없다.
*/

const mode = process.argv[2];

if (mode === '--write' || mode === '--check') {
  const made = render();
  const now = readText(join(REPO, OUT));
  if (mode === '--check') {
    if (made === now) {
      console.log(`${OUT} — 실물과 일치`);
      process.exit(0);
    }
    console.log(`${OUT} 가 실물과 어긋났다. \`node .claude/hooks/commons-doc.mjs --write\` 로 다시 만든다.`);
    process.exit(1);
  }
  writeFileSync(join(REPO, OUT), made, 'utf8');
  const all = units();
  console.log(`${OUT} — 공통물 ${all.length} · 문서 없음 ${all.filter((u) => u.docs.length === 0).length}`);
  process.exit(0);
}

/* ── 훅으로 불렸을 때 — 공통물 폴더가 바뀌었으면 스스로 다시 만든다 ── */
const input = await readHookInput();
const path = repoRelative(targetPath(input));
if (!path) pass();
if (!ROOTS.some(({ base }) => path.startsWith(`${base}/`))) pass();

const made = render();
if (made === readText(join(REPO, OUT))) pass();
writeFileSync(join(REPO, OUT), made, 'utf8');
warn(
  [
    `${OUT} 를 다시 만들었다 — 공통물 폴더가 바뀌었다.`,
    '**소스와 같은 커밋에 담는다**(CLAUDE.md §9) — 빠지면 목록이 실물보다 낡는다.',
  ].join('\n'),
);

// ── 실물에서 센다 ─────────────────────────────────────────────────

/** 공통물 하나 = 뿌리 아래의 폴더 하나. 파일 수는 <b>테스트를 뺀</b> 소스 수다. */
function units() {
  const index = guideSourceIndex();
  const out = [];
  for (const { area, base, show } of ROOTS) {
    const dir = join(REPO, base);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const folder = `${base}/${entry.name}`;
      out.push({
        area,
        name: entry.name,
        show: `${show}${entry.name}/`,
        files: walkFiles(join(REPO, folder)).filter(
          (f) => /\.(ts|tsx|java)$/.test(f) && !/[/\\]src[/\\]test[/\\]|\.(test|spec)\.[jt]sx?$/.test(f),
        ).length,
        docs: rank(guidesForFolder(folder, index)),
      });
    }
  }
  return out;
}

/**
 * 지목한 문서를 <b>구체적인 것부터</b> — `standard/` · `playbook/` · 그 밖.
 *
 * <p>열 개를 이름순으로 늘어놓으면 첫 칸에 `artifact/…` 가 오고, 그것을 읽으러 간
 * 사람은 규약이 아니라 화면 질문지를 만난다. <b>표준이 먼저다.</b>
 */
function rank(docs) {
  const weight = (d) => (d.startsWith('aidd-guide/standard/') ? 0 : d.startsWith('aidd-guide/playbook/') ? 1 : 2);
  return [...docs].sort((a, b) => weight(a.doc) - weight(b.doc) || a.doc.localeCompare(b.doc));
}

// ── 그린다 ────────────────────────────────────────────────────────

function render() {
  const all = units();
  const blank = all.filter((u) => u.docs.length === 0);
  const today = new Date().toISOString().slice(0, 10);
  const created = readText(join(REPO, OUT)).match(/^created:\s*(\S+)/m)?.[1] ?? today;

  const rows = all.map((u) => {
    const shown = u.docs.slice(0, MAX_DOCS).map((d) => {
      const href = relHref(d.doc);
      return `[${href}](${href})`;
    });
    const rest = u.docs.length - shown.length;
    const cell = shown.length === 0 ? '**— 없음**' : shown.join(' · ') + (rest > 0 ? ` 외 ${rest}` : '');
    return `| ${u.area} | \`${u.show}\` | ${u.files} | ${cell} |`;
  });

  return `---
id: LLM-FWK-011
title: "공통물 목록 — 이미 있는 것"
category: standard
type: operation
created: ${created}
updated: ${today}
status: active
sources: ["sources/frontend/src/", "sources/backend/core/", "sources/backend/support/"]
tier: 1
tags: [standard, registry, shared, commons]
---

# 공통물 목록 — 이미 있는 것

> **생성물이다. 손으로 고치지 않는다** — \`node .claude/hooks/commons-doc.mjs --write\` 가
> \`shared/\` · \`core/\` · \`support/\` 의 실물에서 만든다(CLAUDE.md §5-11).
> \`guard-generated\` 가 손편집을 막는다.

**목록에 없는 공통물은 없는 것과 같다** — 다음 사람이 찾지 못해 또 만든다
([frontend/packages.md](./frontend/packages.md) §3). 그래서 **세는 것을 사람에게 맡기지
않는다**: 폴더를 더하면 다음 생성에서 저절로 서고, 지우면 사라진다.

**고치는 절차는 [INDEX.md](./INDEX.md) 의 「이미 있는 것을 고칠 때」가 갖는다.**

| 영역 | 사는 곳 | 파일 | 어디를 읽나 |
|---|---|--:|---|
${rows.join('\n')}

- **「사는 곳」의 뿌리 셋**: \`shared/\` = \`sources/frontend/src/shared/\` ·
  \`core/\` = \`sources/backend/core/…/com/aiagent/core/\` ·
  \`support/\` = \`sources/backend/support/…/com/aiagent/support/\`
- **「파일」은 테스트를 뺀 소스 수**다. 크기의 눈금이지 품질의 눈금이 아니다.
- **「어디를 읽나」는 계산이다** — 가이드 문서의 \`sources:\` 메타를 뒤집어 얻는다.
  \`guide-drift\` 훅과 **같은 매처**를 쓰므로, 여기가 빈 공통물은 **그 훅도 가리키지 못한다.**

## 어디를 읽나가 빈 것 — ${blank.length} / ${all.length}

${blank.length === 0 ? '없다.' : blank.map((u) => `\`${u.show}\``).join(' · ')}

**둘 중 하나다.** ① 문서가 정말 없다, 또는 ② 문서는 있는데 그 문서의 \`sources:\` 가 이
폴더를 적지 않았다. **②가 먼저다** — 적는 것이 한 줄이고, 적으면 \`guide-drift\` 가 그
소스를 고칠 때부터 문서를 가리킨다. ①이면 [INDEX.md](./INDEX.md) 의 진입 결정 트리에
자리를 먼저 정한다.

## 관련

- [INDEX.md](./INDEX.md) — 표준의 정본 · 고칠 때의 절차
- [frontend/packages.md](./frontend/packages.md) — 언제 \`shared/\` 로 올리나
- [backend/packages.md](./backend/packages.md) — \`core\` / \`support\` 의 경계
`;
}

/**
 * `aidd-guide/standard/registry.md` 에서 그 문서로 가는 <b>상대 경로</b>.
 *
 * <p><b>라벨도 같은 문자열을 쓴다.</b> `lint.mjs` 는 `/` 가 든 라벨이 실제로 풀리는지
 * 보므로(라벨이 거짓말하지 않는다), 라벨과 href 를 같게 두면 <b>둘이 갈릴 자리가
 * 없어진다</b>. 짧은 이름을 라벨로 쓰면 `modal.md` 가 playbook 과 artifact 에 하나씩
 * 있어 어느 쪽인지 사라진다.
 */
function relHref(doc) {
  const inStandard = doc.replace(/^aidd-guide\/standard\//, '');
  if (inStandard !== doc) return `./${inStandard}`;
  return `../${doc.replace(/^aidd-guide\//, '')}`;
}
