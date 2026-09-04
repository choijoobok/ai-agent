/**
 * PPTX 작성기 — <b>의존성 없이</b> 슬라이드를 만든다.
 *
 * <p>`.pptx` 는 <b>XML 몇 장을 담은 ZIP</b> 이다. 그래서 라이브러리 없이 쓸 수 있고,
 * 폐쇄망에서 `npm i` 없이 산출물이 나온다(CLAUDE.md §1). ZIP 은 node 기본 `zlib` 로 압축하고
 * 헤더는 손으로 쓴다.
 *
 * <h2>슬라이드는 요약이다</h2>
 *
 * <p>메뉴얼의 표와 절차를 그대로 담지 않는다 — 넣으면 글자가 6pt 가 되고 아무도 못 읽는다.
 * <b>슬라이드는 *무엇을 하는 화면인가* 를 말하고 자세한 것은 PDF 가 갖는다</b>
 * (`outlineForSlides` 가 그 갈림을 정한다).
 *
 * <p><b>PowerPoint 로 열어 확인해야 한다.</b> 여기서 검사할 수 있는 것은 ZIP 이 풀리는가와
 * XML 이 파싱되는가까지다 — 규격을 지켰다는 것이 <i>그 프로그램이 연다</i> 와 같은 말은 아니다.
 */

import { deflateRawSync } from 'node:zlib';

// ── ZIP ────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0 ^ -1;
  for (let i = 0; i < buffer.length; i += 1) c = (c >>> 8) ^ CRC_TABLE[(c ^ buffer[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

/**
 * 파일 목록 → ZIP 바이트.
 *
 * <p>시각을 <b>고정</b>한다(1980-01-01). 돌릴 때마다 바이트가 달라지면 <i>내용이 같은데도
 * 다른 파일</i> 이 되어 무엇이 바뀌었는지 볼 수 없다.
 */
export function zip(files) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBytes = Buffer.from(name, 'utf8');
    const body = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const compressed = deflateRawSync(body, { level: 9 });
    const sum = crc32(body);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // 필요 버전
    local.writeUInt16LE(0, 6); // 플래그
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10); // 시각
    local.writeUInt16LE(0x0021, 12); // 날짜 — 1980-01-01
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, compressed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(0, 12);
    entry.writeUInt16LE(0x0021, 14);
    entry.writeUInt32LE(sum, 16);
    entry.writeUInt32LE(compressed.length, 20);
    entry.writeUInt32LE(body.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(0, 38); // 외부 속성
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);

    offset += local.length + nameBytes.length + compressed.length;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBuffer, end]);
}

// ── OOXML ──────────────────────────────────────────────────────────

const xml = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const EMU_PER_INCH = 914400;
const SLIDE_W = Math.round(13.333 * EMU_PER_INCH);
const SLIDE_H = 7.5 * EMU_PER_INCH;

/** PNG 의 가로·세로 — IHDR 에 있다. 비율을 지켜 넣으려면 이것이 필요하다. */
export function pngSize(buffer) {
  if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function theme() {
  const font = '맑은 고딕';
  const scheme = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  const colors = ['000000', 'FFFFFF', '1F4E79', 'EEEEEE', '1F4E79', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '0563C1', '954F72'];
  const clr = scheme
    .map((name, i) =>
      name === 'dk1'
        ? '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>'
        : name === 'lt1'
          ? '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>'
          : `<a:${name}><a:srgbClr val="${colors[i]}"/></a:${name}>`,
    )
    .join('');
  const fill =
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  const line =
    '<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'.repeat(3);
  const effect = '<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3);
  return `${HEAD}
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="ai-agent">
<a:themeElements>
<a:clrScheme name="ai-agent">${clr}</a:clrScheme>
<a:fontScheme name="ai-agent">
<a:majorFont><a:latin typeface="${font}"/><a:ea typeface="${font}"/><a:cs typeface=""/></a:majorFont>
<a:minorFont><a:latin typeface="${font}"/><a:ea typeface="${font}"/><a:cs typeface=""/></a:minorFont>
</a:fontScheme>
<a:fmtScheme name="ai-agent">
<a:fillStyleLst>${fill}</a:fillStyleLst>
<a:lnStyleLst>${line}</a:lnStyleLst>
<a:effectStyleLst>${effect}</a:effectStyleLst>
<a:bgFillStyleLst>${fill}</a:bgFillStyleLst>
</a:fmtScheme>
</a:themeElements>
<a:objectDefaults/><a:extraClrSchemeLst/>
</a:theme>`;
}

const EMPTY_TREE = `<p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>
<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree>`;

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

function slideMaster() {
  return `${HEAD}
<p:sldMaster ${NS}>
<p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
${EMPTY_TREE}</p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`;
}

function slideLayout() {
  return `${HEAD}
<p:sldLayout ${NS} type="blank" preserve="1">
<p:cSld name="빈 화면">${EMPTY_TREE}</p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

/** 글상자 하나. `runs` 는 `{text, size, bold, color, bullet}` 의 배열이다. */
function textBox({ id, name, x, y, cx, cy, runs }) {
  const paragraphs = runs
    .map((run) => {
      const props =
        `<a:pPr${run.bullet ? ' marL="228600" indent="-228600"' : ''}>` +
        (run.bullet
          ? '<a:buFont typeface="Arial"/><a:buChar char="&#8226;"/>'
          : '<a:buNone/>') +
        '</a:pPr>';
      const style =
        `sz="${run.size ?? 1600}"${run.bold ? ' b="1"' : ''} lang="ko-KR" dirty="0"`;
      return (
        `<a:p>${props}<a:r><a:rPr ${style}>` +
        `<a:solidFill><a:srgbClr val="${run.color ?? '1A1A1A'}"/></a:solidFill>` +
        `</a:rPr><a:t>${xml(run.text)}</a:t></a:r></a:p>`
      );
    })
    .join('');
  return `<p:sp>
<p:nvSpPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"><a:normAutofit/></a:bodyPr>
<a:lstStyle/>${paragraphs}</p:txBody>
</p:sp>`;
}

function picture({ id, rId, x, y, cx, cy }) {
  return `<p:pic>
<p:nvPicPr><p:cNvPr id="${id}" name="화면"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
<a:ln w="9525"><a:solidFill><a:srgbClr val="C9C9C9"/></a:solidFill></a:ln></p:spPr>
</p:pic>`;
}

/** 네모 하나 — 화면 뼈대의 테두리 · 탭 · 단추가 전부 이것이다. */
function rect({ id, name, x, y, cx, cy, fill, line, text: label, size = 800, bold, color = '1A1A1A' }) {
  const body = label
    ? `<p:txBody><a:bodyPr wrap="square" lIns="45720" rIns="45720" tIns="18288" bIns="18288" anchor="ctr">
<a:normAutofit/></a:bodyPr><a:lstStyle/>
<a:p><a:pPr algn="ctr"><a:buNone/></a:pPr><a:r>
<a:rPr sz="${size}"${bold ? ' b="1"' : ''} lang="ko-KR" dirty="0">
<a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${xml(label)}</a:t></a:r></a:p></p:txBody>`
    : '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>';
  return `<p:sp>
<p:nvSpPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
${fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>'}
${line ? `<a:ln w="9525"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>'}
</p:spPr>
${body}
</p:sp>`;
}

/** 표 — <b>파워포인트의 진짜 표</b>다. 이미지가 아니라서 열어서 고칠 수 있다. */
function tableXml({ id, x, y, cx, cy, headers, rows }) {
  const cols = Math.max(headers.length, rows[0]?.length ?? 1);
  /* 첫 칸이 이름·경로라 넓어야 한다 — 균등하게 나누면 거기서만 줄바꿈이 터진다. */
  const weights = Array.from({ length: cols }, (_, i) => (i === 0 ? 2.2 : 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const widths = weights.map((weight) => Math.round((cx * weight) / total));
  const lines = ['L', 'R', 'T', 'B']
    .map((side) => `<a:ln${side} w="6350"><a:solidFill><a:srgbClr val="C9C9C9"/></a:solidFill></a:ln${side}>`)
    .join('');

  const cell = (value, head) => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>
<a:p><a:pPr><a:buNone/></a:pPr><a:r><a:rPr sz="800"${head ? ' b="1"' : ''} lang="ko-KR" dirty="0">
<a:solidFill><a:srgbClr val="${head ? '1A1A1A' : '333333'}"/></a:solidFill></a:rPr>
<a:t>${xml(value ?? '')}</a:t></a:r></a:p></a:txBody>
<a:tcPr marL="45720" marR="45720" marT="18288" marB="18288" anchor="ctr">${lines}
<a:solidFill><a:srgbClr val="${head ? 'F0F0F0' : 'FFFFFF'}"/></a:solidFill></a:tcPr></a:tc>`;

  const rowH = Math.max(200000, Math.round(cy / (rows.length + 1)));
  const line = (cells, head) =>
    `<a:tr h="${rowH}">${Array.from({ length: cols }, (_, i) => cell(cells[i], head)).join('')}</a:tr>`;

  return `<p:graphicFrame>
<p:nvGraphicFramePr><p:cNvPr id="${id}" name="화면 표"/>
<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>
<p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
<a:tbl><a:tblPr/><a:tblGrid>${widths.map((w) => `<a:gridCol w="${w}"/>`).join('')}</a:tblGrid>
${headers.length > 0 ? line(headers, true) : ''}
${rows.map((cells) => line(cells, false)).join('\n')}
</a:tbl></a:graphicData></a:graphic>
</p:graphicFrame>`;
}

/**
 * 목업 뼈대를 <b>파워포인트 도형으로 다시 그린다</b> — 제목줄 · 탭 · 단추 · 표.
 *
 * <p>HTML 을 이미지로 굽지 못하는 대신 <b>구조를 옮긴다</b>. 픽셀이 같지는 않지만
 * <i>무엇이 어디 있는지</i> 는 같고, 목업이 애초에 주장하는 것도 그것이다.
 */
function screenShapes(spec, box, firstId) {
  const shapes = [];
  let id = firstId;
  const pad = 110000;
  const rowH = 250000;
  const gap = 70000;

  shapes.push(rect({ id: id++, name: '화면 테두리', ...box, fill: 'FFFFFF', line: 'C9C9C9' }));

  const innerX = box.x + pad;
  const innerW = box.cx - pad * 2;
  const bottom = box.y + box.cy - pad;
  let y = box.y + pad;

  /* 표에 남는 세로를 미리 나눈다 — 마스터-디테일이면 표가 둘이다. */
  const tables = spec.blocks.filter((block) => block.kind === 'table').length;
  const others = spec.blocks.length - tables;
  const tableH =
    tables > 0 ? Math.floor((bottom - y - others * (rowH + gap) - tables * gap) / tables) : 0;

  for (const block of spec.blocks) {
    if (y >= bottom) break;

    if (block.kind === 'bar') {
      shapes.push(rect({
        id: id++, name: '주소줄', x: innerX, y, cx: innerW, cy: rowH,
        fill: 'F7F7F7', line: 'E4E4E4', text: block.text, size: 800, color: '6B6B6B',
      }));
      y += rowH + gap;
    } else if (block.kind === 'search') {
      shapes.push(rect({
        id: id++, name: '조회조건', x: innerX, y, cx: innerW, cy: rowH,
        fill: 'F7F7F7', line: 'E4E4E4',
        text: `조회조건   ${block.fields.join('  ·  ')}`, size: 800, color: '6B6B6B',
      }));
      y += rowH + gap;
    } else if (block.kind === 'tabs') {
      const tabGap = 40000;
      const tabW = Math.round((innerW - tabGap * (block.tabs.length - 1)) / block.tabs.length);
      block.tabs.forEach((tab, index) => {
        shapes.push(rect({
          id: id++, name: `탭 ${tab.text}`,
          x: innerX + (tabW + tabGap) * index, y, cx: tabW, cy: rowH,
          fill: tab.on ? 'EAF1F9' : 'F7F7F7', line: tab.on ? '1F4E79' : 'E4E4E4',
          text: tab.text, size: 800, bold: tab.on, color: tab.on ? '1F4E79' : '6B6B6B',
        }));
      });
      y += rowH + gap;
    } else if (block.kind === 'toolbar') {
      /* 단추는 오른쪽에 몰린다 — 그리드 툴바가 그렇게 생겼다(왼쪽 제목 · 오른쪽 단추). */
      const btnW = 900000;
      const btnGap = 40000;
      const count = Math.min(block.buttons.length, 5);
      const btnsW = count > 0 ? btnW * count + btnGap * (count - 1) : 0;

      if (block.title) {
        shapes.push(textBox({
          id: id++, name: '그리드 제목', x: innerX, y, cx: Math.max(innerW - btnsW - btnGap, 900000),
          cy: rowH, runs: [{ text: block.title, size: 1000, bold: true }],
        }));
      }
      block.buttons.slice(0, count).forEach((label, index) => {
        const primary = index === count - 1;
        shapes.push(rect({
          id: id++, name: `단추 ${label}`,
          x: innerX + innerW - btnsW + (btnW + btnGap) * index, y, cx: btnW, cy: rowH,
          fill: primary ? '1F4E79' : 'FFFFFF', line: primary ? '1F4E79' : 'C9C9C9',
          text: label, size: 800, color: primary ? 'FFFFFF' : '1A1A1A',
        }));
      });
      y += rowH + gap;
    } else if (block.kind === 'table') {
      const height = Math.min(tableH, bottom - y);
      if (height > 300000) {
        shapes.push(tableXml({
          id: id++, x: innerX, y, cx: innerW, cy: height,
          headers: block.headers, rows: block.rows,
        }));
        y += height + gap;
      }
    }
  }

  return shapes;
}

/**
 * 슬라이드 하나 — 제목 · 부제 아래에 <b>글이거나 화면이거나</b>.
 *
 * <p>화면(캡처든 도형이든)이 있으면 <b>가로를 통째로</b> 준다. 옆에 글을 두면 둘 다 작아져
 * 화면은 못 알아보고 글은 안 읽힌다 — 화면을 보이는 슬라이드와 설명하는 슬라이드를 나눈다.
 */
function slideXml({ title, subtitle, bullets = [], image, screen }) {
  const margin = 685800;
  const top = 420000;
  const titleH = 700000;
  const bodyTop = top + titleH + 120000;
  const bodyH = SLIDE_H - bodyTop - 500000;
  const fullW = SLIDE_W - margin * 2;
  const hasVisual = Boolean(image || screen);
  const leadH = hasVisual && bullets.length > 0 ? 380000 : 0;
  const textW = fullW;

  const shapes = [
    textBox({
      id: 2,
      name: '제목',
      x: margin,
      y: top,
      cx: fullW,
      cy: titleH,
      runs: [
        { text: title, size: 2400, bold: true, color: '1F4E79' },
        ...(subtitle ? [{ text: subtitle, size: 1200, color: '6B6B6B' }] : []),
      ],
    }),
  ];

  if (bullets.length > 0) {
    shapes.push(
      textBox({
        id: 3,
        name: '본문',
        x: margin,
        y: bodyTop,
        cx: textW,
        cy: hasVisual ? leadH : bodyH,
        runs: bullets.map((bullet) => ({
          text: bullet.text,
          size: hasVisual ? 1200 : bullet.lead ? 1500 : 1300,
          bold: !hasVisual && Boolean(bullet.lead),
          bullet: !hasVisual && !bullet.lead,
          color: hasVisual ? '6B6B6B' : undefined,
        })),
      }),
    );
  }

  const visualTop = bodyTop + leadH;
  const visualH = bodyH - leadH;

  if (image) {
    const scale = Math.min(fullW / image.width, visualH / image.height);
    const cx = Math.round(image.width * scale);
    const cy = Math.round(image.height * scale);
    shapes.push(
      picture({ id: 4, rId: 'rId2', x: Math.round((SLIDE_W - cx) / 2), y: visualTop, cx, cy }),
    );
  } else if (screen) {
    shapes.push(
      ...screenShapes(screen, { x: margin, y: visualTop, cx: fullW, cy: visualH }, 10),
    );
  }

  return `${HEAD}
<p:sld ${NS}>
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>
<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${shapes.join('\n')}
</p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

/**
 * 슬라이드 묶음 → `.pptx` 바이트.
 *
 * @param slides `[{ title, subtitle, bullets, png }]` — `png` 는 `Buffer` 이거나 없음
 */
export function buildPptx(slides) {
  const files = [];
  const media = [];

  slides.forEach((slide, index) => {
    const n = index + 1;
    let image = null;
    if (slide.png) {
      const size = pngSize(slide.png);
      if (size) {
        const mediaName = `image${n}.png`;
        media.push({ name: `ppt/media/${mediaName}`, data: slide.png });
        image = { ...size, mediaName };
      }
    }
    files.push({ name: `ppt/slides/slide${n}.xml`, data: slideXml({ ...slide, image }) });
    files.push({
      name: `ppt/slides/_rels/slide${n}.xml.rels`,
      data: `${HEAD}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
${image ? `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${image.mediaName}"/>` : ''}
</Relationships>`,
    });
  });

  const sldIds = slides
    .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${2 + i}"/>`)
    .join('');
  const sldRels = slides
    .map(
      (_, i) =>
        `<Relationship Id="rId${2 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`,
    )
    .join('');

  files.push(
    { name: 'ppt/presentation.xml', data: `${HEAD}
<p:presentation ${NS} saveSubsetFonts="1">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>${sldIds}</p:sldIdLst>
<p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/>
<p:notesSz cx="${SLIDE_H}" cy="${SLIDE_W}"/>
</p:presentation>` },
    { name: 'ppt/_rels/presentation.xml.rels', data: `${HEAD}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
${sldRels}
<Relationship Id="rId${2 + slides.length}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>` },
    { name: 'ppt/slideMasters/slideMaster1.xml', data: slideMaster() },
    { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: `${HEAD}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>` },
    { name: 'ppt/slideLayouts/slideLayout1.xml', data: slideLayout() },
    { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: `${HEAD}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>` },
    { name: 'ppt/theme/theme1.xml', data: theme() },
    ...media,
    { name: '_rels/.rels', data: `${HEAD}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>` },
    { name: '[Content_Types].xml', data: `${HEAD}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('\n')}
</Types>` },
  );

  /* `[Content_Types].xml` 이 <b>맨 앞</b>이어야 하는 구현이 있다 — 순서를 뒤집어 담는다. */
  files.sort((a, b) => (a.name === '[Content_Types].xml' ? -1 : b.name === '[Content_Types].xml' ? 1 : 0));

  return zip(files);
}
