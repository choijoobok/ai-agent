---
id: LLM-HRN-007
title: "Sensors vs Guides 자동화 분류"
category: 05-harness
type: operation
created: 2026-05-04
updated: 2026-05-04
status: active
sources: [Birgitta Böckeler / Thoughtworks "Engineering with AI"]
author: Bong Jong Hyeon
tier: 2
tags: [harness, sensors, guides, automation, classification]
---

# Sensors vs Guides 자동화 분류

> Thoughtworks 의 자동화 모델: 자동화 자산은 **Guides (능동 규칙)** 와 **Sensors (수동 관측)** 으로 분리된다. 둘 다 컨텍스트의 일부지만 역할이 다르다.

## 정의

| 타입 | 역할 | 예 |
|------|------|---|
| **Guide** | "이렇게 해라" — AI 의 동작을 직접 안내 | CLAUDE.md, INDEX 결정 트리, skill SKILL.md |
| **Sensor** | "이건 이렇다" — 환경 상태를 관측해 알려줌 | `git status` · 게이트 결과 · `/context` 출력 |

## 본 프로젝트의 매핑

### Guides (능동 규칙)

| 자산 | 역할 |
|------|------|
| `CLAUDE.md` | 최상위 규칙 |
| `aidd-guide/INDEX.md` · 카테고리 INDEX | 라우팅 결정 트리 |
| `documents/screen/{경로}/requirements.md` | 화면 하나의 구현 지시 |
| `.claude/skills/*/SKILL.md` | 사용자 트리거 시 발동 |
| INDEX 카테고리별 결정 트리 | 분기 룰 |

### Sensors (수동 관측)

| 자산 | 역할 |
|------|------|
| `git status` 출력 | 변경 파일 |
| 빌드/테스트 결과 | 코드 정합 |
| `/context` 수치 | 컨텍스트 점유 |
| `/cost` 수치 | 토큰 비용 |
| `checkSeeds` 결과 | 시드가 소스와 일치하는가 |
| `chat-history/YYYY-MM/raw/` 의 그날 파일 | 이 세션이 무엇을 했나 (`log-raw` 가 남긴다) |

## 차이가 왜 중요한가

- **Guide 가 변하면** — AI 동작 자체가 변함. 회귀 테스트 필요.
- **Sensor 가 변하면** — 환경이 변한 것. AI 는 sensor 결과에 따라 행동만 바꿈.
- 두 가지를 섞으면 — "환경이 그렇다는데 그게 룰이다" 라는 잘못된 결합 발생.

## 작성 룰

1. **Guide** 는 명령형으로: "X 해라", "Y 금지", "Z 우선".
2. **Sensor** 는 서술형으로: "현재 X 상태", "타입 에러 N 건".
3. Sensor 에는 변동 가능성 명시: "이 값은 Stop 훅이 갱신한다".
4. AI 는 Sensor 를 신뢰하기 전에 **timestamp 또는 fresh 여부** 확인.

## 본 시스템의 sensor 자산

| 위치 | sensor | 갱신 주체 |
|------|--------|----------|
| `./gradlew check` 출력 | ArchUnit·시드 정합 | 사용자·AI 가 돌릴 때 |
| `npm run lint` · `tsc -b` 출력 | 금칙 구문·타입 | 〃 |
| `doc-drift` 훅 경고 | 화면 소스 ↔ 문서 셋 어긋남 | 훅 (`PostToolUse`) |
| `git status` 출력 | 변경 파일 | git |
| `chat-history/YYYY-MM/raw/` | 세션 원본 | 사람이 손대지 않는다 |

> **`.claude/state/` 는 없다.** 이 프로젝트의 sensor 는 전부 *돌려서 얻는 것* 이며
> 파일로 굳어 있지 않다 — 굳은 값은 낡을 수 있고, 낡은 sensor 는 거짓 Guide 가 된다.

## 관련

- [INDEX.md](./INDEX.md)
- [hooks.md](./hooks.md) — sensor 갱신 메커니즘
- [automation-matrix.md](./automation-matrix.md) — 훅 자동화 vs AI 책임
