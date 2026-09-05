---
id: LLM-ART-002
title: "산출물 서식 — 정본과 파생"
category: artifact/template
type: operation
created: 2026-09-04
updated: 2026-09-04
status: active
sources: ["aidd-guide/artifact/INDEX.md", "documents/screen/"]
tier: 3
tags: [artifact, template, format]
---

# 산출물 서식 — 정본과 파생

> **형식은 규칙이라 여기 있고, 채운 것은 산출물이라 `documents/` 에 있다.**
> 서식을 고치면 다음에 만드는 산출물이 달라진다 — **이미 만든 것을 함께 고치지는 않는다.**

## 정본 서식 — 사람과 AI 가 손으로 쓴다

번호가 **만드는 순서**다. `ls` 만으로 무엇을 먼저 쓰는지 알 수 있어야 한다.

| 서식 | 단계 | 채우면 어디로 | 독자 |
|---|---|---|---|
| [`01-adr.md`](./01-adr.md) | P2~ | `documents/decisions/ADR-{번호}-{제목}.md` | 다음 사람 |
| [`02-requirements.md`](./02-requirements.md) | P3 | `documents/screen/{페이지경로}/requirements.md` | **AI**(구현 주체) |
| [`04-manual.md`](./04-manual.md) | P4 | `documents/screen/{페이지경로}/manual.md` | **운영자·사용자** |
| [`05-runbook.md`](./05-runbook.md) | P6 | `documents/generated/80-운영런북.md` | 운영 |

- **02·04 가 화면 하나의 정본 둘이다.** 읽는 사람이 다르고, 같은 사실을 두 번 적지 않는다 —
  요건서가 규칙의 정본이고 메뉴얼은 그것을 사용자의 말로 옮긴다. 워크플로는 `CLAUDE.md` §6 이 갖는다.
- **02·04 는 ordinary-backoffice 에서 31화면에 실제로 쓰인 서식이다.** 지어낸 형식이
  아니라 쓰이면서 자란 것이므로, 고칠 때는 *왜 그 칸이 생겼나* 를 먼저 본다.
- **[`03-mockup.html`](./03-mockup.html) 은 목록에 없다** — 목업이 파생물이 됐기 때문이다.
  그 파일은 이제 서식이 아니라 **`<style>` 블록의 원본이자 그림의 형식 참조**이며,
  `/mockup` 의 `scaffold.mjs` 가 그 블록을 읽어 넣는다. 아래 *파생 서식* 을 본다.

## 파생 서식 — `/doc-gen` 이 만든다

[`generated/`](./generated/) 아래에 있다. **사람이 쓰는 서식과 섞지 않는다** — 섞으면
어느 것을 손으로 고쳐도 되는지가 흐려지고, 생성물을 손으로 고치는 사고가 난다.

| 서식 | 무엇에서 나오나 | 누가 만드나 |
|---|---|---|
| [`03-mockup.html`](./03-mockup.html) | `documents/screen/{경로}/requirements.md` | `/mockup` |
| [`generated/feature-spec.md`](./generated/feature-spec.md) | `documents/spec/31-features.yaml` | `/doc-gen` |
| [`generated/test-result.md`](./generated/test-result.md) | `documents/spec/70-testcases.yaml` + 실행 결과 | `/doc-gen` |

**`03-mockup.html` 만 `generated/` 밖에 있다.** 그 파일은 *채워 넣는 서식* 이 아니라
**생성기가 읽는 스타일 원본**이기 때문이다 — `generated/` 로 옮기면 "생성물이니 손대지 말라" 와
"여기를 고쳐야 전 화면의 색이 바뀐다" 가 한 폴더에서 부딪힌다.

**파생 문서는 형상 관리에 넣지 않는다**(`CLAUDE.md` §4). 정본이 있으면 언제든 다시
만들 수 있고, 커밋에 넣으면 정본을 고칠 때마다 파생물이 diff 를 덮는다.
그래서 파생 문서의 머리에는 출처와 경고를 넣는다 — **훅이 그 표식을 보고 손편집을 막는다.**

```yaml
---
id: FEAT-012
traces_to: [UC-004, REQ-011]
status: baselined
generated_from: documents/spec/31-features.yaml
last_sync: 2026-09-04
---
<!-- 생성물입니다. 직접 수정하지 마세요. documents/spec/ 를 고친 뒤 /doc-gen 하세요. -->
```

## 관련

- 무엇을 언제 어디에 만드나 — [`../INDEX.md`](../INDEX.md)(산출물 지도)
- 화면 요건서를 쓸 때 무엇을 물어야 하나 — [`../screen/INDEX.md`](../screen/INDEX.md)
- 채운 것들의 현재 상태 — [`documents/INDEX.md`](../../../documents/INDEX.md)
