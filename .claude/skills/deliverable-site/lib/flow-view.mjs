/** 정본 흐름/상세도를 한 페이지로 조립한다. 배치는 delivery.yaml, 업무 연결은 요구사항에서 읽는다. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { escapeHtml, renderMarkdown } from '../../manual-site/lib/markdown.mjs';

const esc = (value) => escapeHtml(String(value)).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const safeScript = (value) => value.replace(/<\/script/gi, '<\\/script');
const assetRoot = 'aidd-guide/artifact/site-kit/assets';

function wrapLabel(text, budget = 26) {
  const lines=[];let line='',width=0;
  for(const ch of text){const size=/[\u0000-\u00ff]/.test(ch)?1:2;if(width+size>budget){lines.push(line);line='';width=0;}line+=ch;width+=size;}
  if(line)lines.push(line);return lines;
}

function graphOf(source) {
  const nodes = new Map([...source.matchAll(/\b(\w+)\["([^"]*)"\]/g)].map((m) => [m[1], m[2]]));
  const edges = [];
  for (const line of source.trim().split('\n').slice(1)) {
    const edge = line.match(/^\s*(\w+)(?:\["[^"]*"\])?\s*(-->|-\.->)(?:\|([^|]*)\|)?\s*(\w+)/);
    if (!edge) throw new Error(`흐름 배치기가 해석하지 못한 정본 구문: ${line}`);
    edges.push({ from: edge[1], to: edge[4], label: edge[3] || '연결', dotted: edge[2] !== '-->' });
  }
  return { nodes, edges };
}

function overviewSvg(req, layout) {
  const graph = graphOf(req.overview_diagram);
  const groups = new Map(layout.groups.map((g) => [g.key, g]));
  const owner = new Map();
  for (const g of groups.values()) {
    if (!req.sequence_routes.some((route) => route.key === g.sequence)) throw new Error(`상세도 연결 없음: ${g.key}`);
    for (const node of g.nodes) {
      if (!graph.nodes.has(node) || owner.has(node)) throw new Error(`누락/중복된 흐름 노드 배치: ${node}`);
      owner.set(node, g.key);
    }
  }
  for (const node of graph.nodes.keys()) if (!owner.has(node)) throw new Error(`배치에서 빠진 정본 노드: ${node}`);
  const connections = new Map();
  for (const edge of graph.edges) {
    const from = owner.get(edge.from), to = owner.get(edge.to), key = `${from}>${to}`;
    if (!connections.has(key)) connections.set(key, { from, to, edges: [] });
    connections.get(key).edges.push(edge);
  }
  const routes = new Map((layout.routes || []).map((r) => [`${r.from}>${r.to}`, r]));
  for (const key of routes.keys()) if (!connections.has(key)) throw new Error(`정본에 없는 배치 연결: ${key}`);
  const edgesSvg = [...connections.entries()].filter(([, c]) => c.from !== c.to).map(([key, c]) => {
    const route = routes.get(key), a = groups.get(c.from), b = groups.get(c.to);
    const x1 = a.x + 120, y1 = a.y + 110, x2 = b.x + 120, y2 = b.y;
    const lane = Math.max(a.y + 145, b.y - 30);
    const d = route?.path || `M${x1} ${y1} V${lane} H${x2} V${y2}`;
    if (!/^[MLHVQCSZ0-9.,\s-]+$/i.test(d)) throw new Error(`허용하지 않는 SVG 경로: ${key}`);
    const title = c.edges.map((e) => `${graph.nodes.get(e.from)} → ${graph.nodes.get(e.to)}: ${e.label}`).join('\n');
    const label = route?.label ? `<text x="${route.lx}" y="${route.ly}" class="edge-label">${esc(route.label)}</text>` : '';
    return `<g class="flow-edge ${route ? 'primary' : 'secondary'} ${route?.kind === 'control' ? 'control' : ''}" data-from="${c.from}" data-to="${c.to}"><title>${esc(title)}</title><path d="${d}" marker-end="url(#flow-arrow)"/>${label}</g>`;
  }).join('');
  const cards = [...groups.values()].map((g) => {
    const labels = g.nodes.map((id) => graph.nodes.get(id));
    const short = labels[0].replace(/^S\d+(?:\/S?\d+)*\s*·\s*/, '');
    const lines = wrapLabel(short);
    if (lines.length > 2) lines[1] = `${lines[1].slice(0, -1)}…`;
    return `<g class="flow-node" data-group="${g.key}" role="button" tabindex="0" aria-label="${esc(g.title)} 연결 보기" transform="translate(${g.x},${g.y})"><title>${esc(labels.join('\n'))}</title><rect width="240" height="110" rx="14"/><text x="18" y="31" class="node-title">${esc(g.title)}</text>${lines.slice(0,2).map((line,i)=>`<text x="18" y="${58+i*22}" class="node-detail">${esc(line)}</text>`).join('')}<a href="#${g.sequence}" aria-label="${g.sequence} 상세 시퀀스로 이동"><rect x="179" y="81" width="50" height="23" rx="7" class="node-badge"/><text x="204" y="97" class="node-link">${g.sequence} ↘</text></a></g>`;
  }).join('');
  const svg = `<svg id="flow-map" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-labelledby="map-title map-desc"><title id="map-title">${esc(req.title)} — 처리 묶음별 배치</title><desc id="map-desc">정본 ${graph.nodes.size}개 노드를 ${groups.size}개 묶음으로 배치했다. 실선은 주요 처리 흐름이며, 묶음을 선택하면 대기·실패·중단 등 연결을 강조한다. 각 S 링크는 아래 상세 시퀀스로 이동한다.</desc><defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#6284a0"/></marker></defs><rect width="1600" height="990" rx="22" fill="#f7fafc"/><text x="40" y="45" class="lane-title">01  접수 → 시작 → 필요한 작업 선택 → 종결</text>${edgesSvg}${cards}<text x="40" y="948" class="map-footnote">S1~S8은 상세도 검토 순번입니다. 모든 요청이 검색·모델·도구를 차례로 호출하는 것은 아닙니다.</text></svg>`;
  return { svg, graph, groups, connections, nodeCount: graph.nodes.size };
}

function rewriteLinks(text) {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (whole, label, target) => {
    const step = target.match(/#s([1-8])-/i);
    if (step) return `[${label}](#S${step[1]}${target.includes('읽는-순서') ? '-steps' : ''})`;
    if (/#req-010/i.test(target)) return `[${label}](#overview)`;
    if (/^https?:\/\//.test(target)) return whole;
    return label;
  });
}

function clean(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n/, '')
    .split('\n').filter((line) => !/^\*\*(?:S\d 검토 위치|관련 처리 경로|검토 순서|검토 시작)/.test(line) && !/^\[↑ S\d/.test(line)).join('\n');
}

function sectionOf(text, key) {
  const start = text.search(new RegExp(`^## ${key} `, 'm'));
  if (start < 0) throw new Error(`상세 시퀀스 절 누락: ${key}`);
  const rest = text.slice(start), end = rest.slice(1).search(/^## /m);
  return { text: end < 0 ? rest : rest.slice(0, end + 1), start, end: end < 0 ? text.length : start + end + 1 };
}

/** 현재 정본을 읽고 단독으로 복사해 열 수 있는 HTML을 생성한다. */
export function buildFlowViews({ views, requirements, repo, out, read, write, mermaidAsset }) {
  return (views || []).map((view) => {
    if (!/^[a-z0-9-]+$/.test(view.key)) throw new Error('단일 페이지 출력 키가 올바르지 않다.');
    const req = requirements.find((r) => r.id === view.requirement);
    if (!req?.overview_diagram || !req.sequence_routes?.length) throw new Error(`흐름 정본 없음: ${view.requirement}`);
    const mapped = overviewSvg(req, view.layout);
    const docs = new Map(req.sequence_routes.map((r) => [r.document, read(r.document)]));
    const sections = req.sequence_routes.map((route) => {
      const part = sectionOf(docs.get(route.document), route.key).text;
      if ([...part.matchAll(/```mermaid/g)].length !== 1) throw new Error(`${route.key}: 다이어그램이 정확히 하나여야 한다.`);
      let body = renderMarkdown(rewriteLinks(clean(part)));
      body = body.replace(/<h2>.*?<\/h2>/, '')
        .replace(`<h3>${route.key} 읽는 순서</h3>`, `<h3 id="${route.key}-steps">${route.key} 읽는 순서</h3>`);
      body = body.replace(/(<div class="mermaid"[^>]*>[\s\S]*?<\/div>)/g, '<div class="diagram-viewport">$1</div>');
      return `<section id="${route.key}" class="sequence-section" data-sequence="${route.key}"><header class="section-head"><span class="step-chip">${route.key}</span><div><h2>${esc(route.title)}</h2><p>${esc(route.focus)}</p></div><a href="#overview">전체 흐름 ↑</a></header><div class="diagram-tools"><button type="button" data-zoom="fit">너비에 맞춤</button><button type="button" data-zoom="actual">원래 크기</button><button type="button" data-zoom="out">−</button><button type="button" data-zoom="in">＋</button><button type="button" data-save-svg>그림 SVG 저장</button><a href="#${route.key}-steps">순서 설명 ↓</a></div>${body}<p class="source-path">정본: ${esc(route.document)} · ${esc(route.anchor)}</p></section>`;
    }).join('\n');
    const appendix = [...docs.entries()].map(([file, text]) => {
      let rest = text;
      for (const route of req.sequence_routes.filter((r) => r.document === file).reverse()) {
        const part = sectionOf(rest, route.key); rest = rest.slice(0,part.start)+rest.slice(part.end);
      }
      return `<section class="appendix-part">${renderMarkdown(rewriteLinks(clean(rest)))}<p class="source-path">${esc(file)}</p></section>`;
    }).join('');
    const rows = [...new Set((req.flow_coverage || []).flatMap((f) => f.requirements || []))].map((id) => {
      const r = requirements.find((item) => item.id === id);
      if (!r) throw new Error(`연결 요구사항 없음: ${id}`);
      const routes = req.sequence_routes.filter((route) => route.requirements.includes(id)).map((route) => `<a href="#${route.key}">${route.key}</a>`).join(' · ');
      return `<tr><td>${id}</td><td>${esc(r.title)}</td><td>${r.maturity?.level === 'confirmed' ? '확정' : '미확정'}</td><td>${routes || '공통 계약·검증 설명'}</td></tr>`;
    }).join('');
    const graphData = {
      groups: [...mapped.groups.values()].map((g) => ({ ...g, labels: g.nodes.map((n) => mapped.graph.nodes.get(n)) })),
      connections: [...mapped.connections.values()].map((c) => ({ ...c, edges: c.edges.map((e) => ({...e, fromLabel:mapped.graph.nodes.get(e.from),toLabel:mapped.graph.nodes.get(e.to)})) })),
    };
    const css = read(`${assetRoot}/flow-view.css`), js = read(`${assetRoot}/flow-view.js`);
    const library = readFileSync(mermaidAsset, 'utf8');
    const nav = req.sequence_routes.map((r) => `<a href="#${r.key}">${r.key} <span>${esc(r.title)}</span></a>`).join('');
    const confirmed = requirements.filter((r) => r.maturity?.level === 'confirmed').length;
    const verification = renderMarkdown((req.verification || []).map((item) => `- ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n'));
    const html = `<!doctype html><html lang="ko" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(view.title)}</title><script>try{const t=localStorage.getItem("delivery-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch{}</script><style>${css}</style></head><body>
<header class="topbar"><a class="brand" href="#overview">AI HUB <span>실행 흐름</span></a><nav><a href="#overview">전체 흐름</a><a href="#S1">상세 시퀀스</a><a href="#verification">검증 기준</a></nav><button type="button" id="theme-toggle" class="theme-toggle" aria-label="라이트 모드로 전환">☀ 라이트 모드</button><button type="button" id="print-all">전체 인쇄</button></header>
<main><section class="hero"><p class="eyebrow">${esc(req.id)} · DESIGN REVIEW</p><h1>${esc(view.title)}</h1><p>전체 구조를 먼저 보고, 아래로 스크롤하며 상세 처리와 설명을 읽습니다.</p><div class="status-tags"><span>요구사항 ${confirmed}/${requirements.length} 확정</span><span>전체 흐름 + 시퀀스 ${req.sequence_routes.length}개</span><span class="draft">상세 설계 검토안 · 구현 시험 전</span></div></section>
<section id="overview" class="overview"><div class="section-head"><div><h2>한눈에 보는 전체 흐름</h2><p>위쪽 주 흐름에서 필요한 작업으로 분기합니다. 묶음을 누르면 관련 조건과 연결을 확인하고, S 번호로 상세도에 이동할 수 있습니다.</p></div></div><div class="overview-tools"><button type="button" id="clear-selection">주 흐름 보기</button><label><input id="all-connections" type="checkbox"> 보조 연결 모두 표시</label><button type="button" id="save-overview">한 장 SVG 저장</button><button type="button" id="overview-fullscreen">그림 크게 보기</button></div><div class="overview-canvas">${mapped.svg}</div><div id="flow-inspector" class="flow-inspector" aria-live="polite"><b>실선은 주요 처리 경로입니다.</b><p>변경·중단·장애·재요청은 아래쪽 묶음에서 연결을 확인합니다. 원본 ${mapped.nodeCount}개 노드와 ${mapped.graph.edges.length}개 연결을 모두 유지하며 묶음 내부 연결도 선택 패널에 표시합니다.</p></div></section>
<nav class="sequence-nav" aria-label="상세도 바로 이동">${nav}</nav><p class="reading-note">S 번호는 검토 순서입니다. 실제 실행 순서는 조건에 따라 달라집니다. 그림의 화살표 번호와 ‘읽는 순서’의 설명 번호는 서로 다릅니다.</p>
<div id="diagram-status" role="status">상세 시퀀스 그림을 준비하고 있습니다.</div>${sections}
<section id="verification" class="verification"><p class="eyebrow">VERIFICATION DESIGN</p><h2>검증 기준과 요구사항 연결</h2><p>다음은 구현 시 확인할 검증 기준입니다. 요구사항 확정·문서 대조와 실제 동시성·복구·연동 시험 완료를 구분합니다.</p>${verification}<div class="table-wrap"><table><thead><tr><th>요구사항</th><th>내용</th><th>확정 상태</th><th>연결</th></tr></thead><tbody>${rows}</tbody></table></div></section>
<section id="contracts" class="contracts"><h2>공통 계약 · 예외 · 후속 검증</h2><p>네 상세 설계 문서의 공통 설명과 검증 조건을 이어서 제공합니다. 시퀀스별 본문은 위 각 절에 모두 포함했습니다.</p>${appendix}</section>
<footer>정본: ${esc(view.requirement)} · ${docs.size}개 상세 설계 문서 · 외부 연결 없이 열람 가능<br>이 HTML은 생성물입니다. 변경은 요구사항·설계 문서·배치 설정에 반영한 뒤 다시 생성합니다.</footer></main>
<script id="flow-data" type="application/json">${JSON.stringify(graphData).replace(/</g,'\\u003c')}</script><script>${safeScript(library)}</script><script>${safeScript(js)}</script></body></html>`;
    const path = `design/${view.key}.html`;
    write(resolve(out, path), html);
    return { key:view.key, path, requirement:req.id, sequences:req.sequence_routes.map((r)=>r.key), overviewNodes:mapped.nodeCount, overviewEdges:mapped.graph.edges.length, sha256:createHash('sha256').update(html).digest('hex') };
  });
}
