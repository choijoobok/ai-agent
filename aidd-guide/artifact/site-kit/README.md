---
id: LLM-ART-004
title: "고객 제출 사이트 UI 키트"
category: artifact
type: operation
created: 2026-09-13
updated: 2026-09-13
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
| `BUILD-README.txt` | `build/README.txt`로 복사되는 생성 명령·옵션·AI 요청 예문 |

`guide-skill/`은 도입 근거일 뿐 런타임 입력이 아니다. 모양을 고칠 때는 이 폴더만 수정하고,
생성된 `build/deliverables/`를 손으로 고치지 않는다.
