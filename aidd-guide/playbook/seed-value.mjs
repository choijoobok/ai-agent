/**
 * 시드의 **최종값**을 말한다 — 어느 changeset 이 넣고 어느 것이 덮었나.
 *
 * <p><b>왜 도구여야 하나.</b> 값 시드는 `loadData` 로 한 번 들어간 뒤 뒤의 changeset 이
 * `update` 로 덮는다. 이미 적재된 CSV 를 고치면 남의 로컬이 checksum 으로 죽기 때문에
 * <b>고치는 것이 아니라 덮는 것이 규약</b>이다(CLAUDE.md §5-8). 그래서 <b>CSV 하나만 보면
 * 반드시 옛 값을 읽는다.</b>
 *
 * <p>2026-09-05 에 재현 실험의 두 재현과 내가 <b>연달아 셋 다</b> 같은 오답을 냈다 —
 * `053-init-message.csv` 의 `시도 ID` 를 보고 화면이 그렇게 뜬다고 단정했는데,
 * `080-init-message.yaml` 이 `사용자 아이디` 로 이미 덮고 있었다. 세 번 반복된 오답은
 * 사람의 부주의가 아니라 <b>읽는 방법이 없는 것</b>이다.
 *
 * 쓰는 법:
 *   node aidd-guide/playbook/seed-value.mjs loginLog.col.userId
 *   node aidd-guide/playbook/seed-value.mjs code.LOGIN_RSLT_CD.FAIL_NO_USER ko
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'CLAUDE.md'))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
})();

/* changelog 의 include 경로는 **클래스패스 기준**(`db/changelog/…`)이라 접두가 필요하다. */
const RES = 'sources/backend/bootstrap/src/main/resources';
const onDisk = (p) => (p.startsWith('db/') ? `${RES}/${p}` : p);

const [key, lang = 'ko'] = process.argv.slice(2);
if (!key) {
  console.error('쓰는 법: node seed-value.mjs <MSG_KEY|코드키> [언어]   예) loginLog.col.userId ko');
  process.exit(2);
}

const read = (p) => {
  try {
    return readFileSync(join(REPO, p), 'utf8');
  } catch {
    return '';
  }
};

/**
 * <b>콤마로 쪼개지 않는다.</b> 시드 CSV 의 설명 칸에는 콤마가 든 한국어 문장이 있고,
 * 따옴표를 무시하면 칸이 밀려 <b>엉뚱한 칸을 값으로 읽는다</b>.
 */
function cells(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** master 가 거는 순서가 곧 적용 순서다 — 파일 이름 순이 아니다. */
const order = [...read(`${RES}/db/changelog/db.changelog-master.yaml`).matchAll(/file:\s*(\S+)/g)]
  .map((m) => m[1]);

const steps = [];

for (const rel of order) {
  const body = read(onDisk(rel));
  if (!body) continue;

  /* ① loadData — 짝이 되는 CSV 에서 값을 찾는다. */
  for (const m of body.matchAll(/file:\s*(\S+\.csv)/g)) {
    for (const line of read(onDisk(m[1])).split('\n')) {
      const cols = cells(line);
      if (cols[0] !== key) continue;
      /* 메시지 값 CSV 는 `키,언어,값` 이다. 언어 칸이 두 글자가 아니면 값 시드가 아니다
         (`008-init-message-key.csv` 는 키만 담는다 — 값이 없으므로 셀 것도 없다). */
      if (!/^[a-z]{2}$/i.test(cols[1] ?? '')) continue;
      if (cols[1] !== lang) continue;
      steps.push({ where: m[1], how: 'loadData', value: cols[2] ?? '' });
    }
  }

  /* ② update — `where` 에 이 키가 들어 있고 언어가 맞는 블록.
     블록 안에 `- column:` 이 또 있으므로 <b>목록 항목으로 자르지 않는다</b> —
     자르면 `value` 와 `where` 가 잘려 나가 update 를 통째로 놓친다. */
  for (const chunk of body.split(/-\s+update:/).slice(1)) {
    const where = chunk.match(/where:\s*(.+)/);
    const value = chunk.match(/value:\s*(.+)/);
    if (!where || !value) continue;
    if (!where[1].includes(`'${key}'`) && !where[1].includes(`"${key}"`)) continue;
    const hit = where[1].match(/LANG_CD\s*=\s*'([^']+)'/);
    if (hit && hit[1] !== lang) continue;
    steps.push({ where: rel, how: 'update', value: value[1].trim() });
  }
}

if (steps.length === 0) {
  console.log(`${key} (${lang}) — **어느 시드에도 없다.**`);
  process.exit(1);
}

console.log(`# ${key} (${lang})`);
console.log('');
console.log('| 순서 | 어디 | 어떻게 | 값 |');
console.log('|---|---|---|---|');
steps.forEach((s, i) => {
  console.log(`| ${i + 1} | ${s.where.split('/').pop()} | ${s.how} | ${s.value} |`);
});
console.log('');
console.log(`**최종값: ${steps[steps.length - 1].value}**`);
if (steps.length > 1) {
  console.log('');
  console.log('> 앞의 값은 **이력이다.** 적재된 CSV 는 고치지 않고 덮으므로(CLAUDE.md §5-8),');
  console.log('> CSV 하나만 보면 옛 값을 읽는다.');
}
