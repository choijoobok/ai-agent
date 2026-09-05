---
id: LLM-MET-001
title: "메타블록 표준 스펙"
category: meta
type: operation
created: "2026-04-30"
updated: "2026-09-03"
status: active
sources: ["wms5/orchestration/00-meta (외부 프로젝트 — 이 저장소에 없다)"]
author: Bong Jong Hyeon
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
author: "문서 작성자 이름"
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
| `category` | ✅ | 카테고리 폴더 상대 경로 (예: `06-framework/backend`) |
| `created` | ✅ | 최초 생성일 (변경 불가) |
| `updated` | ✅ | 최종 수정일 (수정 시 반드시 갱신) |
| `author` | ⭕ | 문서 작성자 이름. 이 저장소는 `Bong Jong Hyeon` 하나다 |
| `sources` | ⭕ | 참고한 원본 문서·URL 목록 (배열) |
| `status` | ✅ | `active` / `deprecated` / `replaced` |
| `tags` | ⭕ | 검색용 키워드 배열 |
| `replaces` | ⭕ | (status=replaced 시) 대체 대상 ID |
| `replaced_by` | ⭕ | (status=deprecated 시) 새 ID |

## ID 체계

| Prefix | 카테고리 |
|--------|---------|
| LLM-IDX | 마스터 인덱스 (`aidd-guide/INDEX.md`) |
| LLM-MET | 00-meta |
| LLM-CTX | 02-context |
| LLM-PMT | 03-prompt |
| LLM-MEM | 04-memory |
| LLM-HRN | 05-harness |
| LLM-FWK | 06-framework |
| LLM-PLY | 11-playbook |
| LLM-KNW | 09-knowledge |

서브 카테고리는 추가 prefix:
- `LLM-PMT-OVR-{SEQ}` — 03-prompt/overlays
- `LLM-FWK-BE-{SEQ}` — 06-framework/backend
- `LLM-FWK-FE-{SEQ}` — 06-framework/frontend
- `LLM-KNW-SYS-{SEQ}` / `LLM-KNW-{도메인3자}-{SEQ}`

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
3. **`sources` 는 가능한 모든 원본 명시** — 추적성 확보
4. **신규 문서 등록 시** 해당 카테고리 INDEX.md 의 표에 추가

## 검증 (수동)

문서를 추가하거나 수정한 뒤 다음을 확인:

- [ ] `id` 가 다른 파일과 충돌하지 않는다
- [ ] `category` 가 실제 폴더 경로와 일치한다
- [ ] `updated` 가 오늘 날짜로 갱신됐다
- [ ] 카테고리 INDEX.md 에 본 파일이 등록돼 있다
- [ ] 200줄 이내다
