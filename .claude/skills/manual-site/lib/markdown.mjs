/**
 * 마크다운 → HTML — <b>메뉴얼이 쓰는 문법만</b> 다룬다.
 *
 * <p>제목 · 표 · 목록 · 인용 · 코드 · 굵게 · 기울임 · 링크 · 구분선. 그 밖의 문법이
 * 필요해졌다면 먼저 <i>그것이 운영자에게 필요한가</i> 를 묻는다 — 대개는 아니다.
 *
 * <p>의존성이 없다. 마크다운 라이브러리를 넣는 순간 폐쇄망에서 산출물을 못 만든다.
 */

export const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * 화면 그림 한 줄 — <code>[설명](mockup.html#키)</code>. <b>이 표기를 아는 곳은 여기 하나다.</b>
 *
 * <p>전에는 세 군데가 같은 정규식을 따로 적고 있었고, 그중 하나만 고치면 <b>그림이 조용히
 * 문단으로 떨어졌다</b>. 표기가 바뀌는 것은 드문 일이지만 <b>바뀔 때 세 군데가 함께 바뀌지
 * 않는 것</b>은 드물지 않다.
 *
 * <p>설명을 <code>[^\]]*</code> 가 아니라 <code>.*</code> 로 받는다 — 줄이 반드시
 * <code>](mockup.html#키)</code> 로 끝나므로 욕심 매칭이 흔들리지 않는다. 앞의 것은
 * <b>설명에 <code>]</code> 가 하나만 들어가도 짝이 깨졌다</b>(실제로 두 번 겪었다).
 */
export const FIGURE_LINE = /^\[(.*)\]\((?:\.\/)?mockup\.html#([\w-]+)\)$/;

/**
 * 인라인 — <b>코드를 먼저 빼낸다</b>. 코드 안의 `**` 를 굵게 만들면 안 된다.
 *
 * <h2>자리표시자가 제어문자다</h2>
 *
 * <p>` 0 ` 처럼 <i>공백+숫자+공백</i> 을 쓰면 본문의 평범한 숫자(<i>실패 5 회</i>)가 같은
 * 모양이라 <b>엉뚱한 코드로 바뀌거나 undefined 가 된다</b>. 문서에 절대 없는 글자여야 한다.
 */

/**
 * 자리표시자로 쓰는 제어문자 — <b>소스에는 원시 NUL 을 박지 않는다</b>.
 *
 * <p>박으면 grep·diff 가 이 파일을 <b>바이너리로 취급해</b> 도구에서 사라진다. 이 저장소가
 * 한 번 겪은 일이며(커밋 e813e77) 그때의 조치도 <i>상수 하나로 모은다</i> 였다.
 */
const MARK = String.fromCharCode(0);

export function inline(text) {
  const codes = [];
  let out = escapeHtml(text).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `${MARK}${codes.length - 1}${MARK}`;
  });
  out = out
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<i>$2</i>');
  return out.replace(new RegExp(`${MARK}(\\d+)${MARK}`, 'g'), (_, i) => `<code>${codes[Number(i)]}</code>`);
}

/**
 * 마크다운 본문 → HTML 조각. `<h1>` 부터 그대로 낸다(감싸는 것은 부르는 쪽의 일이다).
 *
 * <h2>화면 그림은 <code>[설명](mockup.html#키)</code> 로 부른다</h2>
 *
 * <p>줄 하나가 통째로 그 모양이면 `figure` 해결자에게 넘긴다. <b>메뉴얼이 자리를 정한다</b> —
 * 생성기가 <i>탭 절이 어디쯤일 것</i> 이라고 추측하면 절이 바뀔 때마다 그림이 엉뚱한 곳에
 * 붙고, 그 어긋남은 아무 오류도 내지 않는다.
 *
 * <p><b>생성기만 아는 표기가 아니다.</b> 전에는 `![설명](figure:키)` 였는데, 그것은
 * <b>마크다운 뷰어에서 깨진 이미지</b>가 됐다 — `figure:` 라는 스킴이 없기 때문이다.
 * 지금은 <b>옆 파일의 앵커를 가리키는 진짜 링크</b>라 뷰어에서 눌러 목업의 그 화면으로 간다.
 * <b>원본을 그대로 읽는 사람이 생성물을 만들지 않고도 그림을 볼 수 있어야 한다.</b>
 *
 * @param options `{ figure(키, 설명) → HTML }` — 없으면 그림 줄은 그대로 문단이 된다
 */
export function renderMarkdown(source, options = {}) {
  /* 템플릿의 작성 안내 주석은 독자의 것이 아니다 — 원본에서만 산다. */
  const lines = source.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const html = [];
  let list = null;
  let inTable = false;
  let inFence = false;
  let fenceLanguage = '';
  let fenceLines = [];

  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };
  const closeTable = () => {
    if (inTable) {
      html.push('</tbody></table></div>');
      inTable = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith('```')) {
      closeList();
      closeTable();
      if (!inFence) {
        fenceLanguage = line.slice(3).trim().toLowerCase();
        fenceLines = [];
        inFence = true;
      } else {
        const source = fenceLines.join('\n');
        html.push(fenceLanguage === 'mermaid'
          ? `<div class="mermaid" data-mermaid-source="${encodeURIComponent(source)}">${escapeHtml(source)}</div>`
          : `<pre><code${fenceLanguage ? ` class="language-${escapeHtml(fenceLanguage)}"` : ''}>${escapeHtml(source)}</code></pre>`);
        inFence = false;
        fenceLanguage = '';
        fenceLines = [];
      }
      continue;
    }
    if (inFence) {
      fenceLines.push(raw);
      continue;
    }

    if (line.trim() === '') {
      closeList();
      closeTable();
      continue;
    }

    /* 그림 줄 — 줄 전체가 그 모양일 때만. 문장 속의 링크와 헷갈리지 않는다. */
    const figure = line.match(FIGURE_LINE);
    if (figure && options.figure) {
      closeList();
      closeTable();
      html.push(options.figure(figure[2], figure[1]));
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      closeTable();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      closeList();
      closeTable();
      html.push('<hr>');
      continue;
    }

    if (line.startsWith('|')) {
      if (/^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && inTable) continue;
      const cells = line.slice(1, line.replace(/\|\s*$/, '').length).split('|');
      const rendered = cells.map((cell) => inline(cell.trim()));
      if (!inTable) {
        closeList();
        html.push('<div class="table-wrap"><table><thead><tr>');
        html.push(rendered.map((c) => `<th>${c}</th>`).join(''));
        html.push('</tr></thead><tbody>');
        inTable = true;
      } else {
        html.push(`<tr>${rendered.map((c) => `<td>${c}</td>`).join('')}</tr>`);
      }
      continue;
    }
    closeTable();

    if (line.startsWith('> ')) {
      closeList();
      html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }

    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    const numbered = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (bullet || numbered) {
      const want = bullet ? 'ul' : 'ol';
      if (list !== want) {
        closeList();
        html.push(`<${want}>`);
        list = want;
      }
      html.push(`<li>${inline((bullet ?? numbered)[2])}</li>`);
      continue;
    }
    closeList();

    html.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  closeTable();
  if (inFence) {
    const source = fenceLines.join('\n');
    html.push(`<pre><code${fenceLanguage ? ` class="language-${escapeHtml(fenceLanguage)}"` : ''}>${escapeHtml(source)}</code></pre>`);
  }
  return html.join('\n');
}

/**
 * 슬라이드용 뼈대 — <b>표와 코드를 버리고</b> 제목과 항목만 남긴다.
 *
 * <p>PPT 는 <b>표·절차 목록을 그대로 담지 못한다</b>. 억지로 넣으면 글자가 6pt 가 되고
 * 아무도 못 읽는다 — 슬라이드는 <i>무엇을 하는 화면인가</i> 를 말하고 <b>자세한 것은 PDF
 * 가 갖는다</b>. 그 갈림을 여기서 한 번에 정한다.
 *
 * @returns `[{ title, bullets: string[] }]` — `##` 절 하나가 슬라이드 하나다
 */
export function outlineForSlides(source) {
  const clean = source.replace(/<!--[\s\S]*?-->/g, '');
  const sections = [];
  let current = null;
  let inFence = false;

  for (const raw of clean.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence || line.startsWith('|') || line === '' || /^(-{3,})$/.test(line)) continue;
    if (FIGURE_LINE.test(line)) continue; // 그림은 슬라이드가 따로 다룬다

    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      current = { title: plain(h2[1]), bullets: [] };
      sections.push(current);
      continue;
    }
    if (/^#\s+/.test(line) || /^###+\s+/.test(line)) {
      const h3 = line.match(/^###+\s+(.*)$/);
      if (h3 && current) current.bullets.push({ text: plain(h3[1]), level: 0, lead: true });
      continue;
    }
    if (!current) continue;

    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+\.\s+(.*)$/);
    const quote = line.match(/^>\s+(.*)$/);
    const text = plain((bullet ?? numbered ?? quote)?.[1] ?? '');
    if (text) current.bullets.push({ text, level: 1, lead: false });
  }

  return sections
    .map((section) => ({ ...section, bullets: section.bullets.slice(0, 8) }))
    .filter((section) => section.bullets.length > 0);
}

/** 마크다운 장식을 걷어낸 맨 글자 — 슬라이드는 서식을 못 받는다. */
export function plain(text) {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
