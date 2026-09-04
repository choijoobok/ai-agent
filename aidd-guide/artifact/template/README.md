---
id: LLM-ART-002
title: "문서 템플릿 목록"
category: artifact
type: operation
created: 2026-09-04
updated: 2026-09-04
status: active
sources: []
author: Bong Jong Hyeon
tier: 3
tags: [template]
---

# 문서 템플릿

`documents/generated/` 산출물은 대부분 `/doc-gen` 이 `documents/spec/` 에서 **생성**한다.
이 디렉터리의 템플릿은 그 생성 포맷의 기준이자, 손으로 쓰는 소수 문서(`S` 종류)의 서식이다.

| 템플릿 | 대응 산출물 | 생성/수기 |
|---|---|---|
| `requirement-def.md` | `documents/generated/32-요건정의서/FEAT-###.md` | 생성 |
| `usecase.md` | `documents/generated/30-유즈케이스.md` | 생성 |
| `test-result.md` | `documents/generated/71-테스트결과서.md` | 생성 |
| `runbook.md` | `documents/generated/80-운영런북.md` | 수기 (P6) |
| `user-manual.md` | `documents/generated/81-사용자매뉴얼.md` | 생성 후 화면 캡처 추가 |
| `acceptance.md` | `documents/generated/99-인수확인서.md` | 생성 |

생성 문서에는 반드시 프런트매터와 경고 주석을 넣는다:
```yaml
---
id: FEAT-012
traces_to: [UC-004, REQ-011]
status: baselined
generated_from: documents/spec/31-features.yaml
last_sync: 2026-09-04
---
<!-- 생성물입니다. 직접 수정하지 마세요. documents/spec/ 수정 후 /doc-gen 하세요. -->
```
