import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

/** 요건서에 실제 목업 상태를 선언한 화면만 필수 생성 대상으로 본다. */
export function preparedMockups({ repo, screens }) {
  return screens.flatMap(screen => {
    if (screen.view_kind === 'change_history' || screen.route?.startsWith('/sample')) return [];
    const doc = screen.target_doc ?? screen.current_doc;
    if (typeof doc !== 'string' || !doc.endsWith('/requirements.md') || !existsSync(resolve(repo, doc))) return [];
    const text = readFileSync(resolve(repo, doc), 'utf8');
    const lines = text.split(/\r?\n/);
    const start = lines.findIndex(line => /^#{2,4}\s+.*목업 상태/.test(line));
    if (start < 0) return [];
    const rest = lines.slice(start + 1);
    const next = rest.findIndex(line => /^#{1,4}\s/.test(line));
    const state = (next < 0 ? rest : rest.slice(0, next)).join('\n');
    if (!/^\|\s*그림 키\s*\|/m.test(state) || !/^\|\s*[a-z][a-z0-9-]*\s*\|/m.test(state)) return [];
    return [{ id: screen.id, doc, file: doc.replace(/requirements\.md$/, 'mockup.html'),
      dir: relative(resolve(repo, 'documents/screen'), dirname(resolve(repo, doc))).split(sep).join('/') }];
  });
}

export function preparedMockupErrors({ repo, screens, html }) {
  return preparedMockups({ repo, screens }).flatMap(target => {
    if (!existsSync(resolve(repo, target.file))) {
      return [`${target.id}: 목업 상태를 선언한 화면의 ${target.file}가 없다. node .claude/skills/mockup/scaffold.mjs --write ${target.dir} 후 검사·재생성한다.`];
    }
    if (html !== undefined && !html.includes(`data-mockup="${target.id}/__design__"`)) {
      return [`${target.id}: 준비된 목업이 최종 설계 HTML에 빠졌다 — 원본 목업을 확인하고 재생성한다.`];
    }
    return [];
  });
}
