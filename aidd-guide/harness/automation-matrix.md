---
id: LLM-HRN-003
title: "자동화 vs AI 책임 매트릭스"
category: harness
type: operation
created: "2026-04-30"
updated: "2026-09-06"
status: active
sources: [".claude/settings.json", ".claude/hooks/"]
tier: 1
tags: [harness, hooks, automation]
---

# 자동화 vs AI 책임 매트릭스

> **기계가 지킬 수 있는 것을 사람에게 외우게 하지 않는다.** 구현 주체가 AI 이므로
> 표준은 문서와 **게이트**로 존재해야 한다(CLAUDE.md §8).
>
> 훅은 [`.claude/hooks/`](../../.claude/hooks) 에 있고 [`.claude/settings.json`](../../.claude/settings.json) 이 건다. `node` 하나로 돌며 의존성이 없다 — **폐쇄망에서도 돈다.**

## 빌드가 막는다 — 어기면 빌드가 깨진다

| 게이트 | 무엇 |
|---|---|
| ESLint `no-restricted-syntax` | 문자열·JSX 텍스트·템플릿 문자열 **속 한글** 금지 · `label()` 리터럴 금지 · `/api`·계층 경로 리터럴 금지 |
| ESLint `no-restricted-imports` | `@/shared/api/*` 딥 임포트 금지 — HTTP 는 **배럴 `@/shared/api`** 하나 |
| `check-save-envelope.mjs` | **`saveEnvelope` 의 키가 서버 `record` 의 칸인가** — 부모 키를 빠뜨렸거나 이름이 어긋나면 차단(`npm run lint` 가 이어서 돈다) |
| ESLint `import-x/no-restricted-paths` | `features/*` 끼리 직접 import 금지 |
| ArchUnit `LayerDependencyTest` | 모듈 의존 방향(core ← support ← domain ← api) |
| ArchUnit `ServiceConventionTest` | 조회 서비스는 클래스 레벨 `readOnly` · 메서드 레벨 없음 / 컨트롤러에 트랜잭션 없음 |
| ArchUnit `SampleIsolationTest` | 밖에서 샘플 참조 금지 · 샘플은 `SMPL_` 테이블만 |
| ArchUnit `RowTxConventionTest` | 목록 처리의 트랜잭션 경계가 이름과 맞는가 |
| ArchUnit `TimeSourceConventionTest` | 맨 `now()` · `ZoneId.systemDefault()` · `System.currentTimeMillis()` · `new Date()` 금지 — **면제는 양방향으로 실패한다**(standard/backend/time.md §2) |
| `checkSeeds` · `SeedMessageTest` · `SeedChangelogIncludeTest` | 시드가 소스와 일치 · 값 시드의 키가 키 시드에 있음 · changelog 를 `master` 에 걸었음 |
| `lint.mjs` | 메타블록 · 200줄 · BOM · **깨진 링크** · 선언 어휘 누락 · **폐지 어휘**(`@deprecated` 를 아직 가르치는 문서) · **`sources:` 메타**(비었나 · 실물과 맞나) · **헌법 인용**(맨 텍스트 `CLAUDE.md §N-M` 이 있는 절·항목인가) · **요건서 서식**(백엔드 칸 · 컬럼 표 · **필드명 칸** · 케이스 번호) |
| `trace-check.mjs` | 추적성 T1~T12 — dangling ID · 미실현 요구사항 · 고아 기능 · TC 없는 FEAT |

## 훅이 막는다 — 목록은 생성물이 갖는다

어느 훅이 언제 무엇에 걸리고 **강도가 무엇인가**는 [`user-guide/07-harness.md`](../../user-guide/07-harness.md) 가 갖는다 —
`harness-doc` 훅이 **실물에서 계산해** 다시 만든다. 여기에 베껴 적지 않는다 — 베낀 순간 **훅을 더할 때마다 낡는다**.

**여기는 *왜 그런 강도인가* 를 갖는다.**

## 강도가 넷인 이유

| 강도 | 언제 쓰나 | 왜 |
|---|---|---|
| **차단** | 되돌리기가 비싼 것 | 시드 CSV 를 손으로 고치면 다음 생성에서 조용히 사라지고, `-a` 커밋은 한 트리의 다른 세션 것을 되돌린다 |
| **교정** | 답이 하나뿐인 것 | BOM·CRLF 에 판단의 여지가 없다. 물을 이유가 없으면 그냥 고친다 |
| **경고** | **판단이 필요한 것** | *문서를 고쳐야 하는가* 는 판단이다 — 일치하면 고치지 않는다(CLAUDE.md §6.4). 기계가 대신 결정할 수 없다 |
| **기록** | 말할 것이 없는 것 | 매 턴 도는 훅이 한 마디라도 내면 그 말이 **모든 턴에 쌓인다.** 특히 `UserPromptSubmit` 의 표준 출력은 모델의 문맥에 그대로 들어간다 — 기록이 문맥을 갉아먹으면 안 된다 |

> **차단을 남발하지 않는다.** 판단해야 할 것을 차단으로 막으면 우회하는 습관이 생기고,
> 그때부터 진짜 차단도 우회 대상이 된다.

## AI 가 하는 것 — 훅이 못 하는 것

| 영역 | 담당 | 지침 |
|---|---|---|
| 시드 CSV **생성** | AI (`./gradlew generate*Seed`) | 손편집은 훅이 막는다. **태스크를 돌려 생성물을 같은 커밋에 담는다**(CLAUDE.md §5-8) |
| 화면 문서 현행화 | AI | `doc-drift` 는 *어느 화면인지* 만 가리킨다. 고칠지 말지는 AI 와 사람이 정한다 |
| 목업 생성 | AI (`/mockup`) | 요건서에서 만든다. 골격은 기계가 내고 **그림만 AI 가 그린다** |
| 공통물 승격 | AI | 두 번째 사용을 알아채는 검사가 없다 — 리뷰에서 *이거 다른 화면에도 있지 않나* 를 묻는다 |
| `chat-history` 요약 | AI | **원문은 `log-raw` 가 남긴다.** 요약은 결정·산출물·미결만(CLAUDE.md §10 · [harness/memory/logs.md](./memory/logs.md)) |
| 결정 기록 | AI | **커밋 메시지에 *왜* 를 적는다**(CLAUDE.md §9). 버린 안이 있으면 ADR 을 더한다 |

## 위반 패턴

```
❌ 생성 시드 CSV 를 손으로 고친다            → guard-generated 가 막는다
❌ git commit -a / git commit -m "..."       → guard-commit 이 막는다
❌ 소스만 고치고 화면 문서를 그대로 둔다      → doc-drift 가 가리키지만 막지는 않는다
❌ 이미 적재된 changeset 을 수정한다          → 남의 로컬이 checksum 으로 죽는다 (검사 없음)
```

## 관련

- [INDEX.md](./INDEX.md)
- [hooks.md](./hooks.md) — 훅 하나하나의 상세
- [skills.md](./skills.md) — 스킬 카탈로그
- [CLAUDE.md §8](../../CLAUDE.md) — 기계가 막는 것 / 사람이 지키는 것
