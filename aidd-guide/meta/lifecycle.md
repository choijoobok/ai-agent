---
id: LLM-MET-004
title: "문서 생명주기"
category: "00-meta"
type: operation
created: "2026-04-30"
updated: "2026-04-30"
status: active
sources: [orchestration/]
author: Bong Jong Hyeon
tier: 3
tags: [meta, lifecycle]
---
# 문서 생명주기

> orchestration 문서의 **생성·수정·폐기** 절차. 추적성과 일관성을 유지하기 위함.

## 생명주기 다이어그램

```
[draft] → [active] ─┬─→ [deprecated] → [replaced]
                    │
                    └─→ (직접 삭제는 금지 — 항상 deprecated 경유)
```

## 1. 생성 (active)

새 문서 작성 절차:

1. **카테고리 결정** — 어디에 둘지 [INDEX.md](../INDEX.md) 트리로 판단
2. **ID 발급** — 카테고리 prefix + 다음 sequence (예: `LLM-FWK-BE-010`)
3. **메타블록 작성** — `created`/`updated` 동일 날짜
4. **본문 작성** — 200줄 이내, [doc-style.md](./doc-style.md) 준수
5. **카테고리 INDEX.md 갱신** — 표에 새 행 추가
6. **링크 검증** — 인접 카테고리에서 참조해야 하면 양방향 링크

## 2. 수정 (active 유지)

기존 문서 수정 시:

1. **`updated` 필드 갱신** — 오늘 날짜로
2. **`id` 변경 금지**
3. **본문 수정 후 200줄 재확인**

> 사소한 오타·표현 다듬기는 DEC 불필요. 규칙·절차의 변경만 기록.

## 3. 폐기 (deprecated)

문서를 더 이상 사용하지 않을 때:

1. `status: active` → `status: deprecated`
2. `replaced_by` 필드 추가 (대체 문서 ID)
3. 카테고리 INDEX.md 의 표에서 ⚠️ 표시 또는 별도 deprecated 섹션
4. **본문은 보존** — 추적용

## 4. 대체 (replaced)

대체 관계가 명확할 때:

1. 새 문서 작성 (예: `LLM-FWK-BE-010-v2`)
2. 새 문서에 `replaces: LLM-FWK-BE-010` 명시
3. 기존 문서를 `status: replaced` 로 변경
4. 기존 문서에 `replaced_by: LLM-FWK-BE-010-v2` 명시

## 5. 삭제 (예외)

원칙적으로 **삭제 금지**. 단, 다음만 예외:

- 잘못 발급된 ID (sequence 충돌)
- 카테고리 분기 시점의 임시 파일
- 사용자가 명시적으로 "완전 삭제" 지시

삭제 시 git 커밋 메시지에 사유 명시.

## 추적성

- **ID 는 영구 불변** — 한 번 발급되면 변경 금지
- **링크는 ID 또는 상대 경로** — ID 검색이 더 안정적
- **변경 이력은 git 으로** — 본 문서 시스템에 별도 changelog 두지 않음

## 정기 점검 (제안)

```
- 분기 1회: deprecated 문서 정리 검토
- 신규 카테고리 추가 시: 마스터 INDEX 갱신
- 큰 리팩터링 후: 패키지 구조 ↔ 06-framework 정합성 검토
```

## 검증

- [ ] 새 문서 ID 가 충돌하지 않는다
- [ ] 카테고리 INDEX.md 에 등록됐다
- [ ] 메타블록 `created` 가 today
- [ ] deprecate / replace 시 양 문서 모두 갱신됐다
