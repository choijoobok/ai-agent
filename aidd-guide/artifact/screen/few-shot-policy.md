---
id: LLM-PMT-005
title: "Few-shot · Canonical Examples 정책"
category: artifact/screen
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: [Anthropic "Effective context engineering"]
author: Bong Jong Hyeon
tier: 1
tags: [prompt, few-shot, canonical-example]
---

# Few-shot · Canonical Examples 정책

> Anthropic Context Engineering 권장: **많은 저신호 예시보다 적고 강한 high-signal canonical 예시**가 LLM 성능을 더 끌어올린다.

## 핵심 원칙

1. **3개 ≤ N ≤ 5개** — 6개 이상이면 attention 분산.
2. **다양성 > 길이** — 같은 패턴 5개보다 서로 다른 분기 3개.
3. **가까운 카테고리에 배치** — 예시는 사용 위치 근처에 두고, 별도 폴더에 모아 두지 않음.
4. **실제 코드와 동기화** — 예시가 stale 하면 즉시 갱신. 코드 변경 후 예시 검증 필수.

## 채택 vs 거절

채택할 때:
- 패턴이 자주 등장하고, 변형이 다양함 (CRUD 화면, changeset, 메시지 등)
- 코드만 보고는 의도를 추론하기 어려움
- 룰로 표현하기엔 길고 모호한데 예시로는 명확함

거절할 때:
- 한 번만 쓰는 1회성 패턴 (재사용 없음)
- 룰 1줄로 충분히 명확
- 코드 자체가 이미 충분히 자기서술적

## Canonical Example 의 자격

| 조건 | 설명 |
|------|------|
| 단순함 | 부수 코드 최소. 본질 패턴만. |
| 정합 | 본 프로젝트 실제 코드와 일치. 가공된 데모 X. |
| 가시 | 예시 파일을 직접 링크해 보여줌. |
| 갱신 가능 | 코드 변경 시 같이 변경되는 곳에 위치. |

## 본 시스템에서의 적용 위치

| 카테고리 | 예시 위치 | 형태 |
|---------|----------|------|
| 03-prompt/crud.md · screen.md | 인라인 대화 블록 | 요건서를 받아내는 대화 |
| 11-playbook/crud-screen.md | 단계별 명령어 | 실행 가능한 레시피 |
| 03-prompt/overlays/* | 트리거 + 흔한 누락 | 조건부 체크리스트 |
| 06-framework/conventions.md | 참조 파일 링크 | 실제 코드를 가리킴 |

## 안티 패턴

- **"여기에 50개 SQL 예시 모두 모아둠"** → Distraction. 카테고리 분리 또는 외부 추출.
- **"모든 화면 패턴을 한 파일에 다 넣었음"** → 200줄 위반. Overlay 분기로 분할.
- **"옛날 코드 예시 그대로 둠"** → Poisoning. 코드 변경 시 예시도 같이.

## 관련

- [artifact/screen/INDEX.md](./INDEX.md)
- [artifact/screen/overlay/INDEX.md](./overlay/INDEX.md) — Overlay = 조건부 canonical example
