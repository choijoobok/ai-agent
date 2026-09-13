/**
 * 메뉴얼에 들어가는 <b>화면 그림들</b> — 목업에서 오리거나, 캡처 PNG 를 쓴다.
 *
 * <h2>목업을 다시 그리지 않는다</h2>
 *
 * <p>화면의 모습은 이미 `mockup.html` 이 갖고 있다(설계자가 확인한 그것이다). 메뉴얼용으로
 * 따로 그리면 <b>같은 화면의 그림이 두 벌</b>이 되고, 둘이 갈리는 날 어느 쪽이 맞는지 아무도
 * 모른다 — CLAUDE.md §5-7 과 같은 이유다.
 *
 * <h2>그림이 여럿인 화면이 있다</h2>
 *
 * <p>탭이 다섯이면 <b>탭마다 모습이 다르다</b>. 그림 한 장으로는 <i>이 탭이 어떻게 생겼나</i>
 * 에 답할 수 없고, 답하지 못하면 메뉴얼의 그 절은 글자만 남는다.
 *
 * <p>그래서 <b>키로 짝짓는다</b> — 목업의 화면 블록에 <code>data-manual="키"</code> 를 달고
 * 메뉴얼에서 <code>[설명](mockup.html#키)</code> 로 부른다. 짝이 맞지 않으면 <b>생성기가 보고한다</b>:
 * 한쪽에만 있는 키는 <i>그림이 빠진 절</i> 이거나 <i>아무도 안 쓰는 그림</i> 이며, 둘 다 조용히
 * 지나가면 안 되는 어긋남이다(CLAUDE.md §2).
 *
 * <h2>캡처가 있으면 캡처가 이긴다</h2>
 *
 * <p>`screen.png` 는 대표 그림, `screen-{키}.png` 는 그 키의 그림이다. 사람이 직접 넣든
 * `capture.mjs` 가 채우든 <b>자리는 같다</b>.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS, REPO, read } from './menu.mjs';

/** 대표 그림의 키 — 목업이 아무 키도 달지 않았을 때 첫 화면이 이것이 된다. */
export const MAIN = 'main';

/**
 * 한 화면의 그림 전부.
 *
 * @param url  페이지 경로(`/user`)
 * @param mode `auto`(기본 · 캡처 우선) · `png`(캡처만) · `mockup`(목업만) · `none`
 * @returns `{ figures: Map<키, 그림>, style: string }` — `그림` 은
 *          `{kind:'png', file, key}` 또는 `{kind:'mockup', html, key}`
 */
export function figuresOf(url, mode = 'auto') {
  const figures = new Map();
  if (mode === 'none') return { figures, style: '' };

  const source = mode === 'png' ? '' : read(`${DOCS}${url}/mockup.html`);
  const style = source ? styleBlock(source) : '';

  if (source) {
    /* 주석은 여기서 한 번만 벗긴다 — HTML · 인쇄본 · 슬라이드가 같은 그림을 받아야 한다. */
    for (const block of screenBlocks(source)) {
      figures.set(block.key, { kind: 'mockup', file: `${DOCS}${url}/mockup.html`, ...block, html: stripAnnotations(block.html) });
    }
  }

  /* 캡처가 목업을 덮어쓴다 — 같은 키의 실물이 있으면 그것이 답이다. */
  if (mode === 'auto' || mode === 'png') {
    for (const [key, file] of shots(url)) figures.set(key, { kind: 'png', file, key });
  }

  return { figures, style };
}

/** `screen.png` · `screen-{키}.png` 를 훑는다. */
function shots(url) {
  const found = [];
  for (const ext of ['png', 'jpg', 'jpeg']) {
    if (existsSync(join(REPO, `${DOCS}${url}/screen.${ext}`))) {
      found.push([MAIN, `${DOCS}${url}/screen.${ext}`]);
      break;
    }
  }
  /* 키 있는 캡처는 목업이 선언한 키만 찾는다 — 파일 이름이 키의 목록이 되면 안 된다. */
  const source = read(`${DOCS}${url}/mockup.html`);
  for (const block of source ? screenBlocks(source) : []) {
    if (block.key === MAIN) continue;
    for (const ext of ['png', 'jpg', 'jpeg']) {
      const file = `${DOCS}${url}/screen-${block.key}.${ext}`;
      if (existsSync(join(REPO, file))) {
        found.push([block.key, file]);
        break;
      }
    }
  }
  return found;
}

/**
 * 목업의 화면 블록들 — <b>여는 태그와 닫는 태그를 세어</b> 맞춘다.
 *
 * <p>정규식으로 `</div>` 까지 자르면 <b>안에 든 첫 `</div>` 에서 끊긴다</b>. 목업의 화면
 * 블록은 중첩이 깊어 그 방법이 늘 틀린다.
 *
 * <h2>키를 하나라도 달았으면 키 없는 블록은 그림이 아니다</h2>
 *
 * <p>목업에는 상태별 화면이 여럿이다(빈 · 편집 · 검증 실패 · 모달). 키 없는 것을 함께 주우면
 * 메뉴얼이 <b>되면 안 되는 화면</b>을 싣게 되고, 무엇이 실릴지가 <i>목업에서 몇 번째인가</i>
 * 라는 <b>순서에 매이는</b> 규칙이 된다 — 목업에 화면 하나를 끼워 넣는 순간 메뉴얼의 그림이
 * 바뀌는데 아무 오류도 나지 않는다.
 *
 * <p>키가 하나도 없는 목업에서만 <b>첫 화면</b>을 대표로 받는다. 그림 자리를 아직 안 적은
 * 메뉴얼이 그림 없이 나가지 않게 하는 되돌림이다.
 */
function screenBlocks(source) {
  const found = [];
  const opener = /<div\b[^>]*class="[^"]*\bscreen\b[^"]*"[^>]*>/g;
  let match;
  while ((match = opener.exec(source)) !== null) {
    const key = match[0].match(/data-manual="([^"]+)"/)?.[1] ?? null;
    const html = balanced(source, match.index);
    if (html) found.push({ key, html });
  }

  const keyed = found.filter((block) => block.key);
  if (keyed.length > 0) return keyed;

  const first = found[0];
  return first ? [{ key: MAIN, html: first.html }] : [];
}

/**
 * 오려 낸 그림에서 <b>설계자용 주석을 벗긴다</b>.
 *
 * <p>목업의 화면 블록은 <b>화면 + 그 화면에 대한 설명</b>이다. 설명은 설계자의 것이고
 * (`mockup.html` 의 독자다 — CLAUDE.md §6.2), 메뉴얼의 독자는 운영자다. 벗기는 것 셋:
 *
 * <table>
 *   <tr><td>{@code .bar}</td><td>목업 캡션 — <i>"리프 화면이라 셸 크롬을 그리지 않는다"</i></td></tr>
 *   <tr><td>{@code .banner}</td><td>설계 판단을 적은 배너</td></tr>
 *   <tr><td>{@code span.n}</td><td><b>숫자 배지</b></td></tr>
 * </table>
 *
 * <p>배지가 가장 나빴다. 범례(`.notes`)가 <b>화면 블록 바깥</b>에 있어 그림만 따라오고,
 * 메뉴얼에는 <b>가리키는 데가 없는 동그란 숫자</b>만 남았다 — 독자는 그것이 무엇을 뜻하는지
 * 물을 데가 없다. <b>설명할 수 없는 표시는 싣지 않는 것이 낫다.</b>
 *
 * <p><b>목업 원본은 건드리지 않는다.</b> 설계자는 여전히 캡션·배너·배지를 다 본다 —
 * 벗기는 것은 <i>오려 낸 사본</i> 뿐이며, 그래서 둘이 갈릴 일이 없다.
 */
function stripAnnotations(html) {
  const noBadges = html.replace(/\s*<span\b[^>]*class="[^"]*\bn\b[^"]*"[^>]*>\d+<\/span>/g, '');
  return ['bar', 'banner'].reduce(cutBlocks, noBadges);
}

/** `class` 에 그 낱말이 든 `<div>` 를 통째로 — <b>안에 `<div>` 가 있어</b> 균형을 센다. */
function cutBlocks(html, cls) {
  const opener = new RegExp(`<div\\b[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>`);
  let out = html;
  for (;;) {
    const match = out.match(opener);
    if (!match) return out;
    const block = balanced(out, match.index);
    if (!block) return out; // 닫히지 않은 태그 — 자르면 더 망가진다
    out = `${out.slice(0, match.index)}${out.slice(match.index + block.length)}`;
  }
}

function balanced(source, start) {
  let depth = 0;
  const tag = /<div\b|<\/div>/g;
  tag.lastIndex = start;
  let match;
  while ((match = tag.exec(source)) !== null) {
    depth += match[0] === '</div>' ? -1 : 1;
    if (depth === 0) return source.slice(start, match.index + match[0].length);
  }
  return null;
}

/** 목업이 지고 다니는 `<style>` 블록 — 오린 화면이 그것 없이는 아무 모양도 아니다. */
function styleBlock(source) {
  const match = source.match(/<style>([\s\S]*?)<\/style>/);
  return match ? match[1] : '';
}

/**
 * 그림을 감싼 조각 — 캡션이 <b>무엇으로 그린 것인지</b> 를 말한다.
 *
 * <p>목업 그림을 실제 화면인 것처럼 두면 고객사가 <i>내 화면과 다른데</i> 라고 묻는다.
 * 배치와 흐름은 같고 데이터와 세부 모양이 다르다는 것을 <b>그림 옆에서</b> 말해 준다.
 *
 * @param caption 그림의 설명 — 메뉴얼이 `[여기](mockup.html#키)` 에 적은 말이다
 * @param href    PNG 를 가리킬 상대 경로. 목업 그림에는 쓰이지 않는다
 */
export function figureHtml(figure, caption, href) {
  if (!figure) return '';
  if (figure.kind === 'png') {
    return `<figure class="shot">
<img src="${escapeAttr(href)}" alt="${escapeAttr(caption)}">
<figcaption>${escapeAttr(caption)}</figcaption>
</figure>`;
  }
  return `<figure class="shot mock">
<div class="mockwrap">${figure.html}</div>
<figcaption>${escapeAttr(caption)} — <b>배치를 보이는 그림</b>입니다. 실제 화면의 데이터·글꼴·색은 다를 수 있습니다.</figcaption>
</figure>`;
}

const escapeAttr = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
