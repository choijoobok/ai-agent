---
id: LLM-MET-001
title: "메타블록 표준 스펙"
category: meta
type: operation
created: "2026-04-30"
updated: "2026-09-06"
status: active
sources: ["wms5/orchestration/00-meta (외부 프로젝트 — 이 저장소에 없다)"]
tier: 3
tags: [meta, frontmatter, spec]
---
# 메타블록 표준 스펙

> `aidd-guide` 의 모든 MD 파일은 **상단에 YAML frontmatter** 형식의 메타블록을 둔다. 추적성·검색·자동화의 기반.

## 표준 형식

```yaml
---
id: LLM-{PREFIX}-{SEQ}
title: "사람이 읽는 제목"
category: "{카테고리 경로}"
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
sources:
  - "참고 원본 경로 또는 URL"
status: active
tags: [tag1, tag2]
---
```

## 필드 정의

| 필드 | 필수 | 설명 |
|------|-----|------|
| `id` | ✅ | 전역 유일 ID. 형식: `LLM-{3char}-{3digit}` 또는 `LLM-{3char}-IDX` (인덱스) |
| `title` | ✅ | 한국어 제목 (큰따옴표) |
| `category` | ✅ | **파일이 실제로 있는 폴더**의 `aidd-guide/` 기준 경로 (예: `standard/backend`). 폴더를 옮기면 이 값도 함께 옮긴다 |
| `created` | ✅ | 최초 생성일 (변경 불가) |
| `updated` | ✅ | 최종 수정일 (수정 시 반드시 갱신) |
| `sources` | ⭕ | 참고한 원본 문서·URL 목록 (배열) |
| `status` | ✅ | `active` / `deprecated` / `replaced` |
| `tags` | ⭕ | 검색용 키워드 배열 |
| `replaces` | ⭕ | (status=replaced 시) 대체 대상 ID |
| `replaced_by` | ⭕ | (status=deprecated 시) 새 ID |

## ID 체계

**접두는 폴더 하나에 하나씩 붙고, 폴더 이름에서 유도되지 않는다.** 그래서 **지어내지 않고
이 표에서 찾는다** — 없는 폴더를 새로 만들었으면 **여기에 접두를 먼저 더한다.**

| Prefix | 폴더 (`category` 값과 같다) |
|--------|---------|
| `LLM-IDX` | 마스터 인덱스 `aidd-guide/INDEX.md` 하나 (`LLM-IDX-000`) |
| `LLM-MET` | `meta` |
| `LLM-PRO` | `process` |
| `LLM-PHS` | `phase` |
| `LLM-ART` | `artifact` · `artifact/template` · `artifact/template/generated` |
| `LLM-PMT` | `artifact/screen` |
| `LLM-PMT-OVR` | `artifact/screen/overlay` |
| `LLM-PLY` | `playbook` |
| `LLM-FWK` | `standard` |
| `LLM-FWK-BE` | `standard/backend` |
| `LLM-FWK-FE` | `standard/frontend` |
| `LLM-SAF` | `standard/safety` |
| `LLM-KNW` | `knowledge` |
| `LLM-KNW-SYS` | `knowledge/sys` — 다른 도메인은 `LLM-KNW-{도메인3자}` |
| `LLM-HRN` | `harness` |
| `LLM-CTX` | `harness/context` |
| `LLM-MEM` | `harness/memory` |
| `LLM-QLT` | `quality` |
| `LLM-EVL` | `quality/evals` |
| `LLM-OBS` | `quality/observability` |

## 인덱스 ID

각 폴더의 `INDEX.md` 는 `{prefix}-IDX` 형식 (예: `LLM-MET-IDX`).

## status 값

| 값 | 의미 | 처리 |
|----|------|------|
| `active` | 현행 — 정상 사용 | 검색·참조 대상 |
| `deprecated` | 폐기 예정 — 사용 자제 | `replaced_by` 로 새 문서 안내 |
| `replaced` | 다른 문서로 대체됨 — 읽지 말 것 | `replaces` 의 대상이었던 ID 가 새 문서 |

## 작성 규칙

1. **`updated` 갱신 필수** — 본문 변경 시 반드시 갱신
2. **`id` 변경 금지** — 신규 발급 외 불변
3. **`sources` 는 가능한 모든 원본 명시** — 추적성 확보.
   **다른 저장소에서 온 것은 그 저장소를 밝힌다** — `wms5/orchestration/00-meta` 처럼.
   폴더 이름만 적으면 어디 것인지 알 수 없고, 그러면 *여기에 맞는 규칙인가* 를 의심할 근거가 사라진다.
4. **`author` 를 두지 않는다** — 저자는 git 이 갖는다(`git blame`). frontmatter 의 이름은
   고쳐도 안 고쳐도 틀린다: 이 저장소는 다른 프로젝트의 원저자 이름을 131 파일에 달고
   있었고, 그중 상당수는 여기서 다시 쓰인 것이었다.
5. **신규 문서 등록 시** 해당 카테고리 INDEX.md 의 표에 추가

## 검증 (수동)

문서를 추가하거나 수정한 뒤 다음을 확인:

- [ ] `id` 가 다른 파일과 충돌하지 않는다
- [ ] `category` 가 실제 폴더 경로와 일치한다
- [ ] `updated` 가 오늘 날짜로 갱신됐다
- [ ] 카테고리 INDEX.md 에 본 파일이 등록돼 있다
- [ ] 200줄 이내다
