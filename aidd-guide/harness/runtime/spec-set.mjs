/**
 * 논리 spec 문서를 단일 YAML 또는 분할된 spec-set 폴더에서 읽는다.
 *
 * <p>마이그레이션 동안에는 {@code 31-features.yaml}, 이후에는
 * {@code 31-features/_index.yaml} 중 하나만 존재한다. 호출자는 물리 경로가 아니라
 * {@code 31-features}라는 논리 이름만 안다. 폴더의 조각은 `_index.yaml`에 적힌 순서대로
 * 합치며, 목록에 없는 YAML이나 조용한 값 덮어쓰기는 오류다.
 */

import {
  existsSync, readdirSync, readFileSync, realpathSync, statSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const SPEC_ROOT = 'documents/spec';
const YAML = /\.yaml$/i;
const PART = /^\d{3}-.+\.yaml$/i;

const slash = (value) => String(value).split(sep).join('/');
const inside = (parent, child) => {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel);
};

function assertName(name) {
  if (!/^[0-9]{2}-[a-z0-9][a-z0-9-]*$/.test(String(name ?? ''))) {
    throw new Error(`잘못된 spec-set 이름: ${name ?? '(없음)'}`);
  }
}

function yamlFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yamlFiles(full, out);
    else if (YAML.test(entry.name)) out.push(full);
  }
  return out;
}

function mergeStrict(left, right, at) {
  if (left === undefined) return structuredClone(right);
  if (Array.isArray(left) && Array.isArray(right)) return [...left, ...structuredClone(right)];
  if (left && right && typeof left === 'object' && typeof right === 'object'
      && !Array.isArray(left) && !Array.isArray(right)) {
    const out = structuredClone(left);
    for (const [key, value] of Object.entries(right)) {
      out[key] = mergeStrict(out[key], value, `${at}.${key}`);
    }
    return out;
  }
  throw new Error(`${at}: 분할 조각이 같은 값을 둘 이상 정의한다.`);
}

/** 저장소에 존재하는 논리 spec-set 이름을 정렬해 돌려준다. */
export function listSpecSetNames({ repo }) {
  const root = resolve(repo, SPEC_ROOT);
  if (!existsSync(root)) return [];
  const names = new Map();
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    let name = null;
    let kind = null;
    if (entry.isFile() && YAML.test(entry.name)) {
      name = entry.name.slice(0, -'.yaml'.length);
      kind = 'legacy';
    } else if (entry.isDirectory() && existsSync(join(root, entry.name, '_index.yaml'))) {
      name = entry.name;
      kind = 'set';
    }
    if (!name || name.startsWith('_')) continue;
    assertName(name);
    if (names.has(name)) throw new Error(`${name}: 단일 YAML과 spec-set 폴더가 함께 존재한다.`);
    names.set(name, kind);
  }
  return [...names.keys()].sort();
}

/**
 * 논리 spec 문서를 읽는다.
 *
 * @returns {{document: *, raw: string, source: string, entry: string,
 *   files: string[], format: 'legacy'|'set'}|null}
 */
export function loadSpecSet({ repo, name, parseYaml, required = true }) {
  assertName(name);
  if (typeof parseYaml !== 'function') throw new Error('parseYaml 함수가 필요하다.');

  const root = resolve(repo, SPEC_ROOT);
  const legacy = join(root, `${name}.yaml`);
  const folder = join(root, name);
  const index = join(folder, '_index.yaml');
  const hasLegacy = existsSync(legacy);
  const hasSet = existsSync(index);
  if (hasLegacy && hasSet) throw new Error(`${name}: 단일 YAML과 spec-set 폴더가 함께 존재한다.`);
  if (!hasLegacy && !hasSet) {
    if (!required) return null;
    throw new Error(`${name}: spec 문서를 찾을 수 없다.`);
  }

  if (hasLegacy) {
    const rootReal = realpathSync(root);
    const legacyReal = realpathSync(legacy);
    if (!inside(rootReal, legacyReal)) throw new Error(`${name}: spec 루트 밖 YAML은 읽을 수 없다.`);
    const raw = readFileSync(legacyReal, 'utf8');
    const source = `${SPEC_ROOT}/${name}.yaml`;
    return { document: parseYaml(raw), raw, source, entry: source, files: [source], format: 'legacy' };
  }

  const rootReal = realpathSync(root);
  const folderReal = realpathSync(folder);
  if (!inside(rootReal, folderReal)) throw new Error(`${name}: spec 루트 밖 폴더는 읽을 수 없다.`);
  const indexReal = realpathSync(index);
  if (!inside(folderReal, indexReal)) throw new Error(`${name}: 폴더 밖 _index.yaml은 읽을 수 없다.`);
  const indexRaw = readFileSync(indexReal, 'utf8');
  const indexDoc = parseYaml(indexRaw);
  if (!indexDoc || typeof indexDoc !== 'object' || Array.isArray(indexDoc)) {
    throw new Error(`${name}/_index.yaml: 객체여야 한다.`);
  }
  const extra = Object.keys(indexDoc).filter((key) => !['meta', 'spec_set'].includes(key));
  if (extra.length) throw new Error(`${name}/_index.yaml: 본문 키는 조각으로 옮긴다: ${extra.join(', ')}`);
  if (!indexDoc.meta || typeof indexDoc.meta !== 'object' || Array.isArray(indexDoc.meta)) {
    throw new Error(`${name}/_index.yaml: meta 객체가 필요하다.`);
  }
  const parts = indexDoc.spec_set?.parts;
  if (indexDoc.spec_set?.version !== 1 || !Array.isArray(parts) || parts.length === 0) {
    throw new Error(`${name}/_index.yaml: spec_set.version: 1과 비어 있지 않은 parts 배열이 필요하다.`);
  }

  const listed = new Set();
  const partFiles = [];
  let document = { meta: structuredClone(indexDoc.meta) };
  const raw = [indexRaw];
  for (const value of parts) {
    if (typeof value !== 'string' || !value || value.includes('\\')) {
      throw new Error(`${name}/_index.yaml: parts는 슬래시 상대 경로 문자열이어야 한다.`);
    }
    const normalized = value.replace(/^\.\//, '');
    const segments = normalized.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
      throw new Error(`${name}/_index.yaml: 허용되지 않는 조각 경로 ${value}`);
    }
    if (!PART.test(segments.at(-1)) || segments.at(-1) === '_index.yaml') {
      throw new Error(`${name}/_index.yaml: 조각 파일은 ` + '`NNN-name.yaml` 형식이어야 한다: ' + value);
    }
    const key = normalized.toLowerCase();
    if (listed.has(key)) throw new Error(`${name}/_index.yaml: 중복 조각 ${value}`);
    listed.add(key);

    const full = resolve(folder, ...segments);
    if (!existsSync(full) || !statSync(full).isFile()) throw new Error(`${name}/_index.yaml: 조각 없음 ${value}`);
    const real = realpathSync(full);
    if (!inside(folderReal, real)) throw new Error(`${name}/_index.yaml: 폴더 밖 조각은 읽을 수 없다: ${value}`);
    const text = readFileSync(real, 'utf8');
    const part = parseYaml(text);
    if (!part || typeof part !== 'object' || Array.isArray(part)) {
      throw new Error(`${name}/${value}: 최상위 객체여야 한다.`);
    }
    if ('meta' in part || 'spec_set' in part) {
      throw new Error(`${name}/${value}: meta와 spec_set은 _index.yaml만 정의한다.`);
    }
    document = mergeStrict(document, part, name);
    raw.push(text);
    partFiles.push(`${SPEC_ROOT}/${name}/${normalized}`);
  }

  const actual = yamlFiles(folder)
    .map((file) => slash(relative(folder, file)))
    .filter((file) => file.toLowerCase() !== '_index.yaml')
    .map((file) => file.toLowerCase())
    .sort();
  const unlisted = actual.filter((file) => !listed.has(file));
  if (unlisted.length) throw new Error(`${name}/_index.yaml: parts에 없는 YAML: ${unlisted.join(', ')}`);

  const entry = `${SPEC_ROOT}/${name}/_index.yaml`;
  return {
    document,
    raw: raw.join('\n'),
    source: `${SPEC_ROOT}/${name}/`,
    entry,
    files: [entry, ...partFiles],
    format: 'set',
  };
}
