/**
 * 목업 화면 → <b>슬라이드가 그릴 수 있는 뼈대</b>.
 *
 * <h2>왜 이것이 필요한가</h2>
 *
 * <p>PPT 는 HTML 을 담지 못한다. <b>이미지가 아니면 못 들어간다.</b> 그런데 브라우저 없이
 * HTML 을 이미지로 굽는 방법이 없고(헤드리스를 넣지 않기로 했다 — 무의존 · 폐쇄망),
 * 그대로 두면 <b>슬라이드에 화면이 하나도 없는 발표 자료</b>가 나온다.
 *
 * <p>그래서 목업에서 <b>구조만</b> 뽑아 파워포인트가 자기 도형으로 다시 그리게 한다 —
 * 제목줄 · 탭 · 단추 · 표. 픽셀이 같지는 않지만 <b>무엇이 어디 있는지</b>는 같고,
 * 그것이 목업이 애초에 주장하는 것이기도 하다(픽셀 충실도는 목업의 목표가 아니다).
 *
 * <h2>순서를 지어내지 않는다</h2>
 *
 * <p>블록을 <b>문서에 나온 순서 그대로</b> 낸다. 종류별로 모아 <i>주소줄 · 탭 · 툴바 · 표</i>
 * 순으로 고정하면 마스터-디테일 화면에서 <b>아래쪽 탭이 위쪽 그리드 앞으로 올라간다</b> —
 * 배치를 보이는 것이 목적인 그림이 배치를 틀리게 말하게 된다.
 *
 * <p><b>캡처 PNG 가 있으면 그쪽이 이긴다</b> — 실물이 있는데 다시 그릴 이유가 없다.
 *
 * <h2>정규식으로 읽는다</h2>
 *
 * <p>파서를 붙이지 않는다. 읽는 대상이 <b>우리가 만든 목업</b> 하나이고 어휘가 다섯으로
 * 정해져 있다(`.sf` · `.tb` · `.grid` · `.pg` · `.split`). 남의 HTML 을 읽는다면 다른 답이겠지만
 * 그럴 일이 없고, 라이브러리를 넣는 순간 폐쇄망에서 산출물이 안 나온다.
 */

/** 슬라이드 가로·세로에 들어가는 한계 — 넘기면 글자가 읽을 수 없게 작아진다. */
const MAX_COLS = 7;
const MAX_ROWS = 5;

/** 태그를 걷어낸 맨 글자 — 셀 안의 배지·스위치까지 글자로 눌러 담는다. */
function text(html) {
  return String(html)
    .replace(/<span class="swt[^"]*\bon\b[^"]*"[^>]*>\s*<\/span>/g, 'Y')
    .replace(/<span class="swt[^"]*"[^>]*>\s*<\/span>/g, 'N')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8226;/g, '·')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 화면 하나의 뼈대 — `{ blocks: [...] }`. 아무것도 못 찾으면 `null`.
 *
 * <p>블록은 다섯이다: `bar`(주소줄) · `search`(조회조건) · `tabs`(탭바) · `toolbar`(제목+단추) ·
 * `table`(그리드). 조회조건은 <b>칸 이름만</b> 한 줄로 줄인다 — 슬라이드에 입력칸을 그대로
 * 옮기면 자리를 다 먹고, 발표에서 필요한 것은 <i>무엇으로 찾을 수 있나</i> 뿐이다.
 */
export function screenSpec(html) {
  if (!html) return null;
  const blocks = [];

  /* 여는 태그를 순서대로 훑는다 — 어느 것이 먼저 나왔는지가 곧 배치다. */
  const opener = /<div class="(bar|sf|tabs|tb|grid)\b[^"]*"[^>]*>/g;
  let match;
  while ((match = opener.exec(html)) !== null) {
    const inner = balanced(html, match.index);
    if (inner === null) continue;

    if (match[1] === 'bar') {
      const value = text(inner);
      if (value) blocks.push({ kind: 'bar', text: value });
    } else if (match[1] === 'sf') {
      const fields = [...inner.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)]
        .map((field) => text(field[1]))
        .filter(Boolean);
      if (fields.length > 0) blocks.push({ kind: 'search', fields });
    } else if (match[1] === 'tabs') {
      const tabs = [...inner.matchAll(/<span([^>]*)>([\s\S]*?)<\/span>/g)]
        .map((tab) => ({ text: text(tab[2]), on: /class="on"/.test(tab[1]) }))
        .filter((tab) => tab.text);
      if (tabs.length > 0) blocks.push({ kind: 'tabs', tabs });
    } else if (match[1] === 'tb') {
      const title = text(inner.match(/<span class="ttl">([\s\S]*?)<\/span>/)?.[1] ?? '');
      const buttons = [...inner.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)]
        .map((button) => text(button[1]))
        .filter(Boolean);
      if (title || buttons.length > 0) blocks.push({ kind: 'toolbar', title, buttons });
    } else {
      const table = parseTable(inner);
      if (table) blocks.push({ kind: 'table', ...table });
    }
  }

  return blocks.length > 0 ? { blocks } : null;
}

/** `<div class="…">` 하나의 안쪽 — 여는 태그와 닫는 태그를 세어 맞춘다. */
function balanced(source, start) {
  let depth = 0;
  const tag = /<div\b|<\/div>/g;
  tag.lastIndex = start;
  let match;
  while ((match = tag.exec(source)) !== null) {
    depth += match[0] === '</div>' ? -1 : 1;
    if (depth === 0) return source.slice(source.indexOf('>', start) + 1, match.index);
  }
  return null;
}

function parseTable(html) {
  const table = html.match(/<table>([\s\S]*?)<\/table>/)?.[1];
  if (!table) return null;

  const headCells = [
    ...(table.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] ?? '').matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g),
  ].map((cell) => text(cell[1]).replace(/[☰▲▼]/g, '').trim());

  const bodyRows = [
    ...(table.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g),
  ].map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => text(cell[1])));

  if (headCells.length === 0 && bodyRows.length === 0) return null;

  /*
    <b>빈 첫 칸을 버린다</b> — 행 상태(`.st`)와 삭제(`.del`)는 그리드의 크롬이지 데이터가
    아니다. 슬라이드에서는 가뜩이나 좁은 가로를 그것들이 먼저 먹는다.
  */
  const drop = headCells.length > 0 && headCells[0] === '' ? 1 : 0;
  return {
    headers: headCells.slice(drop, drop + MAX_COLS),
    rows: bodyRows
      .slice(0, MAX_ROWS)
      .map((cells) => cells.slice(drop, drop + MAX_COLS))
      .filter((cells) => cells.some(Boolean)),
  };
}
