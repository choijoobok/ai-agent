/**
 * BOM 과 CRLF 를 방금 쓴 파일에서 걷어낸다 — AGENTS.md §5-1 · `.gitattributes`.
 *
 * <p><b>경고가 아니라 고친다.</b> 판단이 들어갈 자리가 없는 규칙이라(저장소는 LF · BOM 없음)
 * 사람에게 물을 것이 없고, 경고만 하면 <i>다음에 고치자</i> 가 쌓여 어느 날 <b>줄끝만 다른
 * 허위 변경</b>이 diff 를 덮는다.
 *
 * <p><b>예외는 `.gitattributes` 가 정한 그대로다</b> — `*.bat` · `*.cmd` 는 CRLF 여야 안전하고
 * 바이너리는 손대지 않는다. 규칙을 여기서 다시 정의하지 않는다.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { readHookInput, targetPath, repoRelative, warn, pass } from './lib.mjs';

/** CRLF 를 지켜야 하는 것 — `.gitattributes` 의 `text eol=crlf`. */
const KEEP_CRLF = /\.(bat|cmd)$/i;

/** 손대지 않는 것 — `.gitattributes` 의 `binary`. 확장자로 거른다(내용을 읽지 않는다). */
const BINARY = /\.(png|jpe?g|gif|ico|pdf|woff2?|jar|zip|class|xlsx?)$/i;

const input = await readHookInput();
const absolute = targetPath(input);
const path = repoRelative(absolute);
if (!path || BINARY.test(path)) pass();

let raw;
try {
  raw = readFileSync(absolute);
} catch {
  pass();
}

const text = raw.toString('utf8');
const hadBom = text.charCodeAt(0) === 0xfeff;
const hadCrlf = !KEEP_CRLF.test(path) && text.includes('\r\n');
if (!hadBom && !hadCrlf) pass();

let fixed = hadBom ? text.slice(1) : text;
if (hadCrlf) fixed = fixed.replace(/\r\n/g, '\n');

try {
  writeFileSync(absolute, fixed, 'utf8');
} catch {
  warn(`${path} 에 ${hadBom ? 'BOM' : 'CRLF'} 이 섞였는데 고치지 못했다 — 손으로 확인한다.`);
}

const fixes = [hadBom && 'BOM 제거', hadCrlf && 'CRLF → LF'].filter(Boolean).join(' · ');
warn(
  [
    `${path} — ${fixes} 로 정리했다(AGENTS.md §5-1).`,
    '편집 도구가 줄끝을 섞어 넣고 있다면 다음 쓰기에서도 같은 일이 난다.',
  ].join('\n'),
);
