---
id: LLM-REC-002
title: "SUMMARY 로그 템플릿"
category: "10-records"
type: operation
created: "2026-04-30"
updated: "2026-09-03"
status: active
sources: ["CLAUDE.md §9"]
author: Bong Jong Hyeon
tier: 3
tags: [records, log, summary, template]
---
# SUMMARY 로그 템플릿

> raw 로그를 압축한 사실 기반 요약. **AI 가 쓴다** — 훅은 관여하지 않는다.
> 정책은 [04-memory/logs.md](../harness/memory/logs.md).

## 저장 위치

```
chat-history/YYYY-MM/summary/YYYY-MM-DD.md
```

## 형식

```md
## [YYYY-MM-DD HH:mm:ss]

### Topic
<한 줄 사실 기술>

### Summary
- 사실 기반 요약 (bullet point)

### Artifacts / Decisions
- 관련 파일 또는 의사결정 ID
---
```

## 핵심 규칙

1. **사실만 기록** — 추정·감상·평가 금지
2. **bullet point** — 산문 자제
3. **Artifacts** 는 파일 경로·DEC ID 등 **검증 가능한 좌표**
4. **Topic 한 줄** — USER 메시지의 행위 명사화 (60자 이내)

## 좋은 vs 나쁜 예

❌ 나쁨 (감상·추정):
```
- 사용자가 답답해 보였다
- 코드가 깔끔해졌다
- 이 패턴은 좋아 보인다
```

✅ 좋음 (사실):
```
- SysMessageController 에 /excelDownload 추가
- xlsx-js-style 의존성 추가 (react/package.json)
- 단위 테스트 3건 추가, 모두 통과
```

## Artifacts / Decisions 예

```md
### Artifacts / Decisions
- src/main/java/com/wop/sys/message/SysMessageController.java
- src/main/java/com/wop/sys/message/service/SysMessageService.java
- react/src/pages/menu/sys/SysMessage/api.ts
- `a1b2c3d` 엑셀 다운로드 세 갈래 — ADR-0019
```

## 작성 절차 (AI)

**훅이 하지 않는다.** 무엇이 결정이고 무엇이 미결인지는 판단이라 **세션을 마칠 때 AI 가 직접 쓴다.**

1. 그날 [raw](./raw-log.md) 를 근거로 삼는다 — 같은 날 파일 하나에 시간순으로 이어 붙인다
2. **Topic** — USER 첫 메시지를 행위 명사화(60자 이내)
   - 예: "SysMessage 화면 만들어줘" → `SysMessage CRUD 화면 신규 작성`
3. **Summary** — raw 에서 사실만 bullet 로
4. **Artifacts / Decisions** — 파일 경로 · 커밋 해시 · `ADR-NNNN` 같은 **검증 가능한 좌표**
5. 저장한다. 커밋하지 않는다 — `chat-history/` 는 형상 관리 밖이다(CLAUDE.md §9)

## Topic 행위 명사화

| USER 원문 | Topic |
|----------|-------|
| "X 만들어줘" | `X 신규 작성` 또는 `X CRUD 작성` |
| "X 수정해" | `X 수정` |
| "X 버그 고쳐" | `X 버그 수정` (구체적 증상 추가) |
| "X 어떻게 동작해?" | `X 동작 분석` |
| "결정 저장: ..." | `결정 — 커밋 <해시>` (버린 안이 있으면 `ADR-NNNN`) |

## summary 가 비어 있을 때

USER 메시지가 빈 메시지·인사 등이라 요약할 게 없으면:

```md
### Topic
대화 시작 인사

### Summary
- 별도 작업 없음

### Artifacts / Decisions
- 없음
---
```

→ skip 사유를 그대로 적는다. **빈 요약을 채우려고 없는 일을 적지 않는다.**

## 관련

- [10-records INDEX](./INDEX.md)
- [raw-log.md](./raw-log.md)
- [04-memory/logs.md](../harness/memory/logs.md) — 정책
