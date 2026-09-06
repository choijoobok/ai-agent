import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `saveEnvelope` 의 키가 <b>서버 요청 레코드에 실제로 있는가</b>.
 *
 * <p><b>타입이 이 경계를 지키지 못한다.</b> 선언이 `(rows: unknown[]) => unknown` 이라
 * 돌려주는 객체에 아무 제약이 없고, 프론트가 만든 것과 서버의 Java `record` 사이에
 * <b>공유하는 타입이 하나도 없다</b> — 둘은 HTTP 로만 만난다. 그래서 오타를 내도,
 * 엉뚱한 키를 써도, `saveEnvelope` 를 통째로 빠뜨려도(기본값 `{ rows }` 가 되어 부모 키가
 * 사라진다) <b>컴파일이 통과한다</b>.
 *
 * <p>드러나는 자리는 <b>사용자가 저장을 누를 때</b>다. 서버가 `@NotBlank` 를 못 받아
 * 400 을 내며, 그것을 처음 아는 사람이 사용자가 된다.
 *
 * <pre>
 *   npm run lint      # eslint 뒤에 이어서 돈다
 *   node scripts/check-save-envelope.mjs
 * </pre>
 *
 * <h2>사슬</h2>
 *
 * <pre>
 * saveEnvelope 의 키 ─→ 그 그리드의 api.save.url ─→ endpoints.ts ─→ 컨트롤러 ─→ record
 * </pre>
 *
 * <p><b>못 풀면 실패한다.</b> 새로운 선언 모양이 생기면 조용히 건너뛰는 대신 여기서 멈춘다 —
 * 건너뛰는 검사는 <b>있는 것보다 나쁘다</b>(통과했다고 믿게 한다).
 */

const FEATURES = 'src/features';
const BACKEND = '../backend';

/** 그리드가 몇 개인지는 바뀐다. <b>0 이 되면 파서가 눈이 먼 것</b>이므로 그것만 잠근다. */
const MIN_GRIDS = 15;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'build' || name === '.gradle') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** `{ a: b, c, rows }` → `['a', 'c']`. 깊이를 세어 중첩된 콤마를 무시한다. */
function objectKeys(literal) {
  const keys = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < literal.length; i += 1) {
    const ch = literal[i];
    if ('({['.includes(ch)) depth += 1;
    else if (')}]'.includes(ch)) depth -= 1;
    else if (ch === ',' && depth === 0) {
      keys.push(literal.slice(start, i));
      start = i + 1;
    }
  }
  keys.push(literal.slice(start));
  return keys
    .map((part) => part.split(':')[0].trim())
    .filter((key) => key !== '' && key !== 'rows');
}

/** `X_ENDPOINTS.key` → `/service/…`. */
function endpointUrls() {
  const urls = new Map();
  for (const file of walk(FEATURES)) {
    if (!file.endsWith('endpoints.ts')) continue;
    const text = readFileSync(file, 'utf8');
    const owner = text.match(/export const (\w+) = \{/)?.[1];
    if (!owner) continue;
    for (const [, key, url] of text.matchAll(/^ {2}(\w+): '([^']+)',$/gm)) {
      urls.set(`${owner}.${key}`, url);
    }
  }
  return urls;
}

/** 프론트가 부르는 URL → `@RequestBody` 의 레코드 이름. */
function requestRecords() {
  const byUrl = new Map();
  for (const file of walk(join(BACKEND, 'api/src/main/java'))) {
    if (!file.endsWith('Controller.java')) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    const base = lines.join('\n').match(/@RequestMapping\("([^"]+)"\)/)?.[1];
    if (!base) continue;

    for (let i = 0; i < lines.length; i += 1) {
      const path = lines[i].match(/@PostMapping\("([^"]+)"\)/)?.[1];
      if (!path) continue;
      // 다음 매핑 전까지에서 본문 타입을 찾는다 — 없으면 본문 없는 POST 다.
      for (let j = i + 1; j < lines.length && !/@(Post|Get)Mapping/.test(lines[j]); j += 1) {
        // 애너테이션을 건너뛴다 — `@RequestBody @Valid Xxx request` 에서 `Valid` 를 타입으로 읽지 않게.
        const type = lines[j].match(/@RequestBody\s+(?:@\w+\s+)*([A-Z]\w+)\s+\w+/)?.[1];
        if (type) {
          byUrl.set(`${base}${path}`.replace(/^\/api/, ''), type);
          break;
        }
      }
    }
  }
  return byUrl;
}

/** 레코드 이름 → 칸 이름들. */
function recordComponents() {
  const byName = new Map();
  for (const file of walk(join(BACKEND, 'api/src/main/java'))) {
    if (!file.endsWith('.java')) continue;
    const text = readFileSync(file, 'utf8');
    const at = text.search(/\brecord\s+\w+\s*\(/);
    if (at < 0) continue;

    const name = text.slice(at).match(/\brecord\s+(\w+)\s*\(/)?.[1];
    if (!name) continue;

    // 헤더의 괄호를 짝지어 잘라 낸다 — 제네릭과 애너테이션 인자가 안에 있다.
    let depth = 0;
    let end = -1;
    const open = text.indexOf('(', at);
    for (let i = open; i < text.length; i += 1) {
      if (text[i] === '(') depth += 1;
      else if (text[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) continue;

    const header = text.slice(open + 1, end);
    const fields = new Set();
    let angle = 0;
    let paren = 0;
    let start = 0;
    const parts = [];
    for (let i = 0; i < header.length; i += 1) {
      const ch = header[i];
      if (ch === '<') angle += 1;
      else if (ch === '>') angle -= 1;
      else if (ch === '(') paren += 1;
      else if (ch === ')') paren -= 1;
      else if (ch === ',' && angle === 0 && paren === 0) {
        parts.push(header.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(header.slice(start));
    for (const part of parts) {
      const word = part.trim().split(/\s+/).pop();
      if (word) fields.add(word);
    }
    byName.set(name, fields);
  }
  return byName;
}

/**
 * <b>봉투가 아니라 그리드를 센다.</b> 봉투를 세면 <i>있어야 하는데 없는 봉투</i> 를 볼
 * 방법이 없다 — 지워진 선언은 목록에 나타나지 않으므로 검사할 것이 없어진다. 그런데
 * 그것이 <b>가장 흔한 실패</b>다: `saveEnvelope` 는 선택 속성이라 빠뜨리면 기본값
 * `{ rows }` 가 되어 <b>부모 키가 조용히 사라진다</b>.
 */
function grids(urls) {
  const found = [];

  for (const file of walk(FEATURES)) {
    if (!/\.tsx?$/.test(file) || file.endsWith('.test.ts')) continue;
    const lines = readFileSync(file, 'utf8').split('\n');

    for (let i = 0; i < lines.length; i += 1) {
      if (!/^\s*toSaveRow: \(row\) => \(\{$/.test(lines[i])) continue;
      found.push({
        where: `${file}:${i + 1}`,
        keys: envelopeKeys(file, lines, i),
        url: saveUrl(file, lines, i, urls),
      });
    }
  }
  return found;
}

/** 그 그리드의 봉투 키 — <b>없으면 빈 배열</b>이고, 그것이 곧 `{ rows }` 다. */
function envelopeKeys(file, lines, at) {
  for (let i = at + 1; i < lines.length; i += 1) {
    // 다음 그리드에 닿으면 이 그리드에는 봉투가 없다.
    if (/^\s*toSaveRow: \(row\) => \(\{$/.test(lines[i])) break;
    if (/useGridController/.test(lines[i])) break;

    const literal = lines[i].match(/saveEnvelope: \(rows\) => \(\{(.*)\}\),/)?.[1];
    if (literal !== undefined) return objectKeys(literal);
    if (lines[i].includes('saveEnvelope')) {
      throw new Error(`${file}:${i + 1} — 한 줄짜리 saveEnvelope 만 읽을 수 있다`);
    }
  }
  return [];
}

/** 그 그리드의 `api.save.url` — 뒤로 훑어 `api:` 를 찾고, 이름이면 그 선언까지 따라간다. */
function saveUrl(file, lines, at, urls) {
  for (let i = at; i >= 0; i -= 1) {
    const named = lines[i].match(/^\s*api: (\w+),$/)?.[1] ?? lines[i].match(/^\s*(api),$/)?.[1];
    const from = named
      ? lines.findIndex((line) => new RegExp(`\\bconst ${named}\\b`).test(line))
      : /^\s*api: \{/.test(lines[i])
        ? i
        : -1;
    if (from < 0) continue;

    for (let j = from; j < lines.length; j += 1) {
      const ref = lines[j].match(/url: (\w+\.\w+)/);
      if (ref && lines.slice(from, j + 1).some((line) => /\bsave:/.test(line))) {
        const url = urls.get(ref[1]);
        if (url === undefined) {
          throw new Error(`${file}:${at + 1} — endpoints 에 없다: ${ref[1]}`);
        }
        return url;
      }
    }
  }
  throw new Error(`${file}:${at + 1} — 이 그리드의 save.url 을 찾지 못했다`);
}

const urls = endpointUrls();
const records = requestRecords();
const components = recordComponents();
const all = grids(urls);

const wrong = [];

if (all.length < MIN_GRIDS) {
  wrong.push(`저장 그리드를 ${all.length} 개만 찾았다 — 파서가 눈이 먼 것이다(최소 ${MIN_GRIDS})`);
}

for (const envelope of all) {
  const record = records.get(envelope.url);
  if (!record) {
    wrong.push(`${envelope.where} — ${envelope.url} 을 받는 컨트롤러를 찾지 못했다`);
    continue;
  }
  const fields = components.get(record);
  if (!fields) {
    wrong.push(`${envelope.where} — ${record} 의 선언을 찾지 못했다`);
    continue;
  }
  for (const key of envelope.keys) {
    if (!fields.has(key)) {
      wrong.push(`${envelope.where} — ${record} 에 \`${key}\` 가 없다 (${[...fields].join(' · ')})`);
    }
  }
  // 서버가 요구하는 부모 키를 화면이 빠뜨리면 저장이 400 이 된다.
  for (const field of fields) {
    if (field !== 'rows' && !envelope.keys.includes(field)) {
      wrong.push(`${envelope.where} — ${record} 의 \`${field}\` 를 보내지 않는다`);
    }
  }
}

if (wrong.length > 0) {
  process.stdout.write(`저장 봉투 위반: ${wrong.length} 건\n`);
  for (const line of wrong) process.stdout.write(`  - ${line}\n`);
  process.exit(1);
}
process.stdout.write(`저장 봉투 — 그리드 ${all.length} 개 전부 서버 레코드와 맞는다\n`);
