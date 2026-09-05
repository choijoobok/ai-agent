---
id: LLM-CTX-002
title: "seek-read 원칙 — 찾고 나서 읽는다"
category: harness/context
type: operation
created: "2026-04-30"
updated: "2026-09-03"
status: active
sources:
author: Bong Jong Hyeon
tier: 1
tags: [context, seek-read, grep]
---
# seek-read 원칙 — 찾고 나서 읽는다

> 큰 파일을 통째로 읽으면 **정작 필요한 구간이 나머지에 묻힌다.**
> 먼저 `Grep` 으로 위치를 찾고, `Read(offset, limit)` 로 그 구간만 읽는다.
> 이것은 `CLAUDE.md` §3 의 *읽는 방법* 을 상세화한 것이다.

## 핵심 원칙

1. **200줄 이상은 통째로 읽지 않는다** — 문서도 소스도 같다.
2. **찾기가 먼저다** — `Grep` 으로 절을 찾고 그 줄번호를 입구로 쓴다.
3. 키워드가 여러 절에 걸치면 **인접 절을 더 읽는다** — 끊어 읽고 추측하지 않는다.
4. **Overlay 트리거가 맞으면 Overlay 가 먼저다** ([artifact/screen/overlay](../../artifact/screen/overlay/INDEX.md)).

> **색인을 따로 두지 않는다.** 절마다 `offset`/`limit` 을 적어둔 지도를 유지하는 방식도
> 있지만, 원본이 바뀌는 순간 숫자가 거짓말이 된다. **`Grep` 은 늘 현재를 말한다.**

## 절차

```
[1] 작업 키워드 식별              (예: "그리드 저장 흐름")
[2] Grep 으로 위치 찾기           Grep(pattern="useGridController", output_mode="files_with_matches")
[3] 해당 파일에서 절 머리 찾기      Grep(pattern="^#{1,3} ", path=..., -n=true)
[4] 그 구간만 Read(offset, limit)
[5] 모자라면 인접 절 추가 로드
```

## 우선순위

```
[03-prompt/overlays] (트리거 매칭)      ← 최우선
        ↓
[Grep 으로 위치 확정]
        ↓
[Read(offset, limit)] 부분 로드
```

## 도구

| 도구 | 용도 |
|-----|------|
| `Grep` | 키워드 검색 → 파일·줄번호 식별 |
| `Glob` | 파일 패턴 매칭 |
| `Read(offset, limit)` | 확정된 구간만 읽기 |
| `Explore` 에이전트 | 3쿼리 이상 광범위 탐색 (메인 컨텍스트 보호) |

## 조각 모음 패턴

여러 작은 파일을 한 번에 보고 싶을 때 — **여는 것이 아니라 걸러내는 것이 먼저다.**

```bash
# 1. 키워드가 어느 파일에 있는지만 먼저
Grep(pattern="useGridController", glob="**/*.tsx", output_mode="files_with_matches")

# 2. 그중 필요한 것만 Read
```

## 소스에도 같은 규칙

문서만의 규칙이 아니다. 긴 컴포넌트·서비스를 읽을 때도 같다 —
**메서드 이름으로 찾아 그 메서드만 읽는다.**

```bash
Grep(pattern="^\s*(public|private|protected).*\(", path="긴파일.java", -n=true)
```

## 관련 카테고리

- [artifact/screen/overlay/INDEX.md](../../artifact/screen/overlay/INDEX.md) — Overlay 가 우선
- [harness/context/budget.md](./budget.md) — 토큰 예산
- [CLAUDE.md §3](../../../CLAUDE.md) — 진입 규칙의 *읽는 방법*
