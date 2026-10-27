---
id: LLM-ART-004
title: "고객 제출 사이트 UI 키트"
category: artifact
type: operation
created: 2026-09-13
updated: 2026-10-27
status: active
sources: ["aidd-guide/artifact/INDEX.md", "aidd-guide/harness/skill-src/deliverable-site.md"]
tier: 3
tags: [artifact, html, offline, delivery]
---

# 고객 제출 사이트 UI 키트

설계·사용자·운영 사이트가 공유하는 오프라인 HTML 자산의 단일 원본이다.
`/deliverable-site`가 아래 파일을 `build/deliverables/assets/`로 복사한다.

| 파일 | 역할 |
|---|---|
| `assets/guide.css` | 가이드 템플릿의 색·글꼴·기본 컴포넌트 |
| `assets/icons.js` | 외부 CDN 없는 SVG 아이콘 심볼 |
| `assets/delivery.css` | 트리형 문서 사이트·인쇄·캡처 상태 확장 |
| `assets/delivery.js` | 목차 이동·검색·현재 경로·보기 설정·테마·현재 문서 인쇄·Mermaid 렌더링 |
| `assets/flow-view.css` · `assets/flow-view.js` | 전체 흐름 배치·상세 시퀀스·설명을 이어 보는 단일 HTML의 보기·확대·인쇄 |
| `BUILD-README.txt` | `build/README.txt`로 복사되는 생성 명령·옵션·AI 요청 예문 |

`guide-skill/`은 도입 근거일 뿐 런타임 입력이 아니다. 모양을 고칠 때는 이 폴더만 수정하고,
생성된 `build/deliverables/`를 손으로 고치지 않는다.

## 흐름과 시퀀스의 연속 보기

설계 사이트의 선택 `flow_views`는 `documents/delivery.yaml`에 둔다. `key`가 HTML 파일명,
`requirement`가 전체 흐름과 `sequence_routes`를 가진 요구사항 ID다. `layout.groups`는 정본
노드를 빠짐없이 묶고 좌표·제목·상세도 연결만 정한다. `layout.routes`는 정본에 존재하는
주요 연결의 선 배치만 정하며 업무 조건은 정본에서 읽는다. 누락 노드·새로 지어낸 연결은 생성 오류다.

`flow-view.mjs`는 같은 설계 문서에서 시퀀스·순서 설명·공통 계약/검증 조건을 추출한다.
전체 개요는 정본 Mermaid의 노드·간선을 배치 SVG로 표현하고, 상세도는 Mermaid로 렌더링한다.
보조 연결은 묶음 선택이나 전체 표시로 볼 수 있다. 단일 HTML에 CSS·JS·Mermaid를 포함하므로
해당 파일 하나만 복사해도 오프라인 열람·전체 인쇄·SVG 저장이 된다. 그림의 번호는 검토 순번이다.
처음 열 때는 다크 모드이며 상단에서 라이트/다크를 전환한다. 저장 가능한 환경에서는 다른
산출물과 같은 `delivery-theme` 선택을 기억한다. 전체 흐름·상세 SVG·표를 함께 전환하고 확대
상태를 유지한다. SVG 저장은 선택 테마, 인쇄는 흰 배경용 색을 적용한다.

생성 시 manifest에 전용본을 등록하고 `check.mjs`로 누락·로컬 링크·해시를 검사한다.
`node .claude/skills/deliverable-site/flow-view-check.mjs`는 실제 렌더링·탐색·확대·인쇄·외부 요청을
검사한다. 검증용 Chromium이 없고 설치된 Edge/Chrome을 쓸 때는 이 명령과 `browser-check.mjs`에
`--browser=msedge` 또는 `--browser=chrome`을 명시한다. 이 검사는 업무 구현 시험을 대신하지 않는다.
