---
id: LLM-ART-004
title: "고객 제출 사이트 UI 키트"
category: artifact
type: operation
created: 2026-09-13
updated: 2026-10-29
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

## 설계 문서 목차

설계 사이트의 `navigation`은 `documents/delivery.yaml`에 둔다. `sections`는 문서 종류별
`key`·목차 `path`·`source_prefixes`와 `group_by_module`을 갖는다. 생성 문서와 상세 설계는
같은 분류를 사용하며 가장 긴 원본 경로 접두가 우선한다. 파일별 목록은 만들지 않는다.

개별 문서의 앞부분 YAML 메타에 `delivery: { section: sequence }`처럼 분류를 지정하면
경로 규칙보다 우선한다. 단일 모듈 문서는 같은 메타의 `module: agent`처럼 소유자를 지정한다.
기능 명세는 `owner: feature`로 `31-features` 정본의 ID·module을 사용하고 문서 메타와
충돌하면 실패한다. 모듈명·기능 번호 구간을 생성 코드에 열거하지 않는다. 표시명은 선택
`module_labels`에서 바꾸며 새 모듈은 등록 없이 원래 이름으로 그룹을 만든다.

모듈을 나누지 않은 집계 문서는 `integrated_label`(전체·통합)에 둔다. 새 모듈별 파생 문서를
만들 때는 생성기가 정본의 소유 모듈을 메타에 함께 출력한다. 파생 Markdown을 직접 고치지 않는다.
기존 종류의 새 파일은 자동 분류한다. 새 종류는 sections에 한 번 등록하며 미분류·동일 우선순위
중복 분류·존재하지 않는 명시 분류는 생성 오류다. 새 문서를 임의의 기타 항목으로 숨기지 않는다.

설계 사이트의 하위 그룹은 처음에 접고 현재 문서의 경로만 펼친다. 검색 중에는 일치 문서의
경로를 펼치고, 검색을 지우면 이전 접힘 상태와 현재 문서 경로를 복원한다. 기존 문서 ID와
해시 링크는 유지하며 상단 현재 경로는 새 분류를 표시한다.

화면 문서는 실제 메뉴가 있으면 그 트리를 사용하고, 설계 중인 메뉴는 `60-screens`의
route·module·group으로 식별/분류한다. 요건 정의서와 목업은 같은 SCR 식별자를 쓴다.
`usecases`에 연결된 UC의 생성 시퀀스가 있으면 같은 화면에 `처리 시퀀스` 탭을 자동으로 붙인다.
탭은 생성 Markdown의 원래 경로를 기준으로 링크를 해석하며 시퀀스가 없는 화면의 완료를 추정하지 않는다.
문서 링크는 원래 그림 앵커도 보존해 해당 문서·탭·그림으로 이동한다. 목업의 내부 스타일과
시퀀스 SVG는 상단 다크/라이트 선택을 따르며 페이지 재진입에도 선택을 유지한다.
목업의 테마 조건은 내부 스타일의 `:host(...)`에 전달하고 SVG는 셸의 색 토큰을 사용한다.
숨은 탭은 표시할 때 렌더링해 잘못된 텍스트 높이 측정을 피한다. 브라우저 검사는 전체 Mermaid
구문과 메뉴별 실제 표시·다크/라이트 전환·그림 앵커 이동을 함께 확인한다.

## 흐름과 시퀀스의 연속 보기

설계 사이트의 선택 `flow_views`는 `documents/delivery.yaml`에 둔다. `key`가 HTML 파일명,
`requirement`가 전체 흐름과 `sequence_routes`를 가진 요구사항 ID다. `layout.groups`는 정본
노드를 빠짐없이 묶고 좌표·제목·상세도 연결만 정한다. `layout.routes`는 정본에 존재하는
주요 연결의 선 배치만 정하며 업무 조건은 정본에서 읽는다. 누락 노드·새로 지어낸 연결은 생성 오류다.

첫 화면 `index.html`은 선택한 사이트와 실제 생성된 연속 보기마다 진입 카드를 만든다.
전체 패키지는 세 사이트와 등록한 흐름도 카드, 설계 전용본은 설계·흐름도 카드를 제공한다.
사용자·운영 전용본에는 흐름도 카드를 넣지 않는다. `check.mjs`는 카드 누락·중복·연결 파일을 검사한다.

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
