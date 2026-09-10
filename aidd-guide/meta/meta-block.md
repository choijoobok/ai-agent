---
id: LLM-MET-001
title: "메타블록 표준 스펙"
category: meta
type: operation
created: "2026-04-30"
updated: "2026-09-07"
status: active
sources: []
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
sources: ["저장소 안 경로", "…"]
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
| `sources` | ⭕ | 이 문서가 설명하는 **저장소 안 경로** 목록 (배열). 외부 출처는 넣지 않는다 — 아래 작성 규칙 3 |
| `class` | ⭕ | **`standard/` 전용.** 어겼을 때 무엇이 막는가 — `contract`(컴파일) / `policy`(아무 일도 일어나지 않는다) / `none`(부류 밖). 무엇을 쓰나는 [standard/INDEX.md](../standard/INDEX.md) 의 「부류 둘」 이 갖는다 |
| `status` | ✅ | `active` / `deprecated` / `replaced` |
| `tags` | ⭕ | 검색용 키워드 배열 |
| `replaces` | ⭕ | (status=replaced 시) 대체 대상 ID |
| `replaced_by` | ⭕ | (status=deprecated 시) 새 ID |

## ID 체계

**접두 ↔ 폴더 표는 [`aidd-guide/INDEX.md`](../INDEX.md) 의 `ID 체계` 절이 갖는다** —
여기서 다시 적지 않는다. 카테고리 지도와 같은 자리에 있어야 폴더를 더할 때 함께 눈에 든다.

- 형식은 `LLM-{CAT3}[-{SUB3}]-{NNN}`, 각 폴더의 `INDEX.md` 는 `{prefix}-IDX` 다.
- **접두는 폴더 이름에서 유도되지 않는다** — `artifact/screen` 이 `LLM-PMT` 다.
  **지어내지 말고 표에서 찾는다.** 없는 폴더를 새로 만들었으면 **그 표에 먼저 더한다.**
- **한 번 발급한 접두는 바꾸지 않는다.** 폴더가 이름을 바꿔도 ID 는 앵커로 남는다.

## status 값

| 값 | 의미 | 처리 |
|----|------|------|
| `active` | 현행 — 정상 사용 | 검색·참조 대상 |
| `deprecated` | 폐기 예정 — 사용 자제 | `replaced_by` 로 새 문서 안내 |
| `replaced` | 다른 문서로 대체됨 — 읽지 말 것 | `replaces` 의 대상이었던 ID 가 새 문서 |

## 작성 규칙

1. **`updated` 갱신 필수** — 본문 변경 시 반드시 갱신
2. **`id` 변경 금지** — 신규 발급 외 불변
3. **`sources` 에는 이 저장소에서 열 수 있는 경로만 적는다** — `sources/…` · `documents/…` ·
   `aidd-guide/…` · `.claude/…` 처럼. 그 값이 `guide-drift` 훅의 역인덱스 입력이고,
   `lint.mjs` 가 **실물과 맞는지 검사한다.**
   **다른 저장소·외부 글·URL 은 적지 않는다.** 열어 볼 수 없는 출처는 참고가 되지 못하면서
   *어딘가에 근거가 있다* 는 인상만 남긴다 — 확인할 방법이 없으므로 반박도 못 한다.
   근거를 남겨야 하면 **본문에 문장으로** 쓴다. 적을 것이 없으면 `[]` 로 둔다
   (`standard/` 와 `playbook/` 은 비울 수 없다 — 소스를 설명하는 문서라서다.
   **`standard/safety/` 는 예외다** — 그것은 AI 의 작업 규칙이고 설명하는 소스가 없다).
   - **`sources:` 에 이 문서 자신을 적지 않는다.** *이 문서가 설명하는 소스* 가 이 문서일
     수는 없다. 문서 열두 개에 있었고 전부 한 뿌리였다 — 옛 원문을 가리키던 값이 문서가
     흡수될 때 자기를 가리키게 됐다(같은 흡수가 본문에도 자기 링크 넷을 남겼다).
   - **루트에 있는 파일도 경로다** — `AGENTS.md` · `.gitignore` 처럼. 접두가 없다고
     인용으로 보지 않는다.
   - **`aidd-guide/` 와 `.claude/` 도 읽힌다.** 다른 가이드나 설정 파일을 근거로 적으면
     `guide-drift` 가 **그것을 고칠 때 이 문서를 지목한다** — 장식이 아니다.
     **폴더로 적으려면 세그먼트 넷 이상**이어야 하고(`sources/backend/` 는 백엔드 전부를
     주장하는 값이라 빠진다), **파일로 적으면 문턱이 없다.**
4. **`author` 를 두지 않는다** — 저자는 git 이 갖는다(`git blame`). frontmatter 의 이름은
   고쳐도 안 고쳐도 틀린다: 이 저장소는 다른 프로젝트의 원저자 이름을 131 파일에 달고
   있었고, 그중 상당수는 여기서 다시 쓰인 것이었다.
5. **`standard/` 문서는 `class` 를 비울 수 없다** — 부류를 한 곳에 산문으로 모아 두면
   **문서를 더할 때 함께 고쳐지지 않는다.** 그렇게 낡은 목록은 새 표준 문서가 어느
   부류인지 **아무 데도 말하지 않는 상태**를 만든다. `lint.mjs` 가 값이 달렸는지와
   **`policy` 가 「보장하는 것」 절을 갖는지** 를 본다.
6. **신규 문서 등록 시** 해당 카테고리 INDEX.md 의 표에 추가

## 검증 (수동)

문서를 추가하거나 수정한 뒤 다음을 확인:

- [ ] `id` 가 다른 파일과 충돌하지 않는다
- [ ] `category` 가 실제 폴더 경로와 일치한다
- [ ] `updated` 가 오늘 날짜로 갱신됐다
- [ ] 카테고리 INDEX.md 에 본 파일이 등록돼 있다
- [ ] 200줄 이내다
