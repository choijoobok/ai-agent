/** 소스 변경 → 선언된 기능/API/화면과 모든 소비 화면의 정본 대조. 경고만 한다. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { REPO, readHookInput, targetPath, repoRelative, readText, warn, pass, skillRef } from './lib.mjs';
import { parseScreenRegistry } from './screen-registry.mjs';
import { sourceImpactData } from './trace-check.mjs';

/** 같은 컨트롤러를 쓰는 두 메뉴를 모두 찾는다. 첫 매핑에서 반환하지 않는다. */
export function registryScreenUrls(path, content, entries, endpointText) {
  if (path.startsWith('sources/frontend/src/')) {
    const matches = entries.filter(({ sourceDir }) => path.startsWith(`sources/frontend/src/${sourceDir}/`));
    const longest = Math.max(0, ...matches.map(({ sourceDir }) => sourceDir.length));
    return [...new Set(matches.filter(({ sourceDir }) => sourceDir.length === longest).map(({ url }) => url))];
  }
  if (!path.startsWith('sources/backend/') || !path.endsWith('Controller.java')) return [];
  const base = content.match(/@RequestMapping\("([^"]+)"\)/)?.[1];
  if (!base) return [];
  const prefix = `${base.replace(/^\/api/, '')}/`;
  return [...new Set(entries.filter(({ sourceDir }) => endpointText(sourceDir).includes(`'${prefix}`)).map(({ url }) => url))];
}

function alreadyTold(sessionId, key) {
  if (!sessionId) return false;
  const dir = join(tmpdir(), 'ai-agent-doc-drift');
  const file = join(dir, `${String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
  try {
    mkdirSync(dir, { recursive: true });
    const seen = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    if (seen.includes(key)) return true;
    writeFileSync(file, JSON.stringify([...seen, key]), 'utf8');
  } catch { /* 알림 캐시 실패가 현행화 안내를 막지 않는다. */ }
  return false;
}

async function main() {
  const input = await readHookInput();
  const path = repoRelative(targetPath(input));
  if (!path?.startsWith('sources/') || /\.(test|spec)\.[jt]sx?$/.test(path)) pass();
  const content = readText(join(REPO, path));
  const entries = parseScreenRegistry(readText(join(REPO, 'sources/frontend/src/shared/routes/screenRegistry.ts')));
  const urls = registryScreenUrls(path, content, entries,
    (dir) => readText(join(REPO, 'sources/frontend/src', dir, 'api/endpoints.ts')));
  const impact = sourceImpactData(path);
  const docs = new Set(impact.docs);
  for (const url of urls) {
    docs.add(`documents/screen${url}/requirements.md`);
    docs.add(`documents/screen${url}/manual.md`);
  }
  const fresh = [...docs].filter((doc) => !alreadyTold(input?.session_id, doc));
  if (!fresh.length && (!impact.seeds.length || alreadyTold(input?.session_id, `impact:${path}`))) pass();
  const lines = [`${path} 를 고쳤다 — 연결된 명세와 모든 소비 화면을 대조한다.`];
  if (impact.ids.length) lines.push(`영향: ${impact.ids.join(' · ')}`);
  for (const doc of fresh) {
    if (!existsSync(join(REPO, doc))) {
      lines.push(`- 없음: ${doc} — 계획된 경로인지 확인하고 소유 단계에서 작성한다.`);
      continue;
    }
    lines.push(`- 대조: ${doc}`);
    if (doc.endsWith('/requirements.md')) {
      const status = readText(join(REPO, doc)).match(/^\|\s*문서 상태\s*\|([^|]*)\|/m)?.[1];
      if (!status || !/^\s*(승인\s*\d{4}-\d{2}-\d{2}|구현됨)/.test(status)) {
        lines.push('  요건서가 승인 상태인지 확인한다. 화면 변경은 요건서·목업을 함께 승인받은 뒤 구현한다.');
      }
    }
  }
  lines.push(`기능·API·데이터·테스트·운영 정본 전체: node .claude/hooks/trace-check.mjs --source "${path}"`,
    '기록된 연결의 검토 범위이며 API 전수 일치나 동적 호출까지 보장하지 않는다. 삭제·이동은 변경 전 연결도 확인한다.',
    `차이가 있으면 정본을 고치고 ${skillRef('mockup')}·문서 생성을 실행한다. 일치하면 고치지 않는다. 소스·정본은 같은 변경에 담는다.`);
  warn(lines.join('\n'));
}

if (new URL(import.meta.url).searchParams.has('embedded') ||
    (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))) await main();
