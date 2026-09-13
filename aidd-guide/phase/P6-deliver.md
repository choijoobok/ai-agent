---
id: LLM-PHS-006
title: "P6 인도 — 배포·런북·매뉴얼·인수"
category: phase
type: operation
created: 2026-09-04
updated: 2026-09-13
status: active
sources: ["documents/delivery.yaml", "documents/spec/80-operations.yaml"]
tier: 1
tags: [deliver, runbook, manual, offline]
---

# P6 인도 — 배포·운영·매뉴얼·인수

> 목표: 사용자가 **AI 없이도 운영할 수 있는 상태**로 넘긴다.
> 최종 묶음은 `build/deliverables/`의 설계·사용자·운영 세 오프라인 사이트와 선택 PDF다.

## 1. P6에서 처음 문서를 쓰지 않는다

정본은 개발 단계부터 원래 자리에서 계속 자란다. 제출 직전에 복사하거나 별도 HTML을 손으로 만들지 않는다.

| 시점 | 누적하는 정본·근거 |
|---|---|
| P2 | `80-operations.yaml`의 구성·배포 경계, ARCH 연결 |
| P3 | 운영 화면·외부 연동·권한·업무 흐름, SCR/API/IF 연결 |
| P4 | 배포·롤백·정기 작업과 구현된 실제 명령 |
| P5 | NFR 임계값, 백업/복구·장애 대응 리허설과 검증 근거 |
| P6 | 고객 환경의 주기·담당·연락 위치, 실제 화면 캡처, 인수 판정 |

운영 런북의 근거는 `20-architecture.yaml`, `21-nfr.yaml`, `02-constraints.yaml`,
`60-screens.yaml`, `70-testcases.yaml`, 현재 소스와 P5 실측이다. `/runbook`이 빈 필수 절과
미룬 값을 검사하고 `/doc-gen`이 `documents/generated/80-운영런북.md`를 만든다.

## 2. 배포·복구 인수

- 환경별 설정 차이와 비밀값 보관 위치를 문서화한다. 비밀값 자체는 적지 않는다.
- 초기 데이터 투입과 앱 기동을 폐쇄망 기준으로 재현한다.
- 롤백과 PostgreSQL 백업·복구를 실제로 한 번 실행하고 정상 확인 근거를 남긴다.
- 고객 운영자가 런북만 보고 같은 결과를 재현하는지 확인한다.

## 3. 사용자 매뉴얼 그림

화면별 정본은 `documents/screen/{페이지경로}/manual.md`다. 그림 자리는
`[캡션](./mockup.html#그림키)`로 선언하고 목업은 같은 `data-manual="그림키"`를 갖는다.

- 개발·설계 검토: 목업을 그대로 사용한다.
- 실제 화면 준비 후: `main`은 `screen.png`, 나머지는 `screen-{그림키}.png`로 같은 폴더에 둔다.
- 사이트 빌더는 같은 키의 PNG가 있으면 목업을 자동 치환한다. Markdown과 HTML은 고치지 않는다.
- 캡처는 개인정보·토큰·고객 비밀을 제거한 뒤 인수 근거로 보존한다.

자동 대표 캡처는 선택이다. 앱·테스트 계정·데이터가 준비된 환경에서 Playwright가 실제 메뉴 URL을
열어 찍는다. 탭·모달·조회 결과는 사람이 상태를 만든 뒤 키 이름으로 저장한다.

## 4. 고객 제출 사이트

[`documents/delivery.yaml`](../../documents/delivery.yaml)이 배치를 정하고 `/deliverable-site`가
외부 CDN 없는 폴더 하나를 만든다.

| 사이트 | 입력 | 고객이 보는 것 |
|---|---|---|
| 설계·검증 | `documents/generated/`, `documents/design/`, 화면 요건서+목업 | 좌측 트리에서 모든 설계와 통합 목업 검토 |
| 사용자 | 화면별 `manual.md` + 목업/실제 캡처 | 실제 메뉴 순서의 사용자 절차 |
| 운영·개발 | 운영 런북 + `developer-guide/` | 구축·배포·장애·복구·유지보수 |

```bash
node .claude/skills/doc-gen/gen.mjs
node .claude/skills/runbook/check.mjs --release
node .claude/skills/deliverable-site/build.mjs all --release
node .claude/skills/deliverable-site/build.mjs all --release --pdf  # 선택
node .claude/skills/deliverable-site/build.mjs user --release --standalone  # 일반 사용자에게 따로 전달
```

검토 모드는 목업과 캡처 목표 경로를 보여 준다. `--release`는 사용자 매뉴얼의 모든 그림 자리에
실제 PNG가 없으면 실패한다. 일반 사용자에게는 설계·운영 자료가 없는 `build/deliverables-user/`만 준다.
`--pdf`는 문서별 PDF를 만들며 Mermaid SVG 완료를 기다린다. 자동 생성 의존성이 없으면 HTML의
`현재 페이지 인쇄·PDF` 버튼으로 보고 있는 문서만 저장한다. `build/`는 파생물이므로 커밋하지 않고 인도 시 새로 만든다.

## 5. 데이터 이행과 인수 확인

데이터 이행이 있으면 원천 목록·매핑·정제·대사·리허설·실패 롤백을 기록한다.
인수 확인서는 성공 기준, 요구사항 이행, 제출 사이트와 PDF 목록, 알려진 결함·우회 방법,
사용자 승인 발화와 날짜를 담는다. 경로는 산출물 지도에 등록된 자리만 쓴다.

## 6. 프로젝트 회고

회고는 다음 프로젝트의 프레임워크 개선 입력이다. 가장 많이 되돌아간 게이트, 일찍 물었어야 할
질문, 결함 원인, 검증 부하, 실제로 줄인 절차의 결과를 원래 상태·결정 자리에 남긴다.
별도 회고 문서는 산출물 지도에 자리가 있을 때만 만든다.

## 7. G6 게이트

→ [04-gates.md](../process/04-gates.md)의 G6. 세 사이트를 고객 브라우저에서 열고 링크·검색·인쇄,
실제 캡처, 런북 리허설, 알려진 이슈를 함께 확인한 뒤 사용자 명시 승인을 받는다.
