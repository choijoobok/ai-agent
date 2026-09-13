---
id: LLM-ART-003
title: "운영 런북 정본 템플릿"
category: artifact/template
type: template
created: 2026-09-04
updated: 2026-09-13
status: active
sources: ["documents/spec/80-operations.yaml"]
tier: 3
tags: [template, runbook, operations]
---

# 운영 런북 정본

> 운영 인력이 장애 중에도 순서대로 실행할 수 있어야 한다. Markdown 결과를 직접 쓰지 않고
> `documents/spec/80-operations.yaml`에 다음 구조를 채운다.

```yaml
meta:
  status: in_progress
  baselined: null
  owner: system
  traces_to: [ARCH-###, NFR-###]

system_overview:
  - id: RUN-001
    title: "시스템 구성 확인"
    purpose: "무엇을 판단하는 절차인가"
    traces_to: [ARCH-###]
    procedure: ["확인 순서"]
    verify: "정상이라고 판정하는 관측값"
    rollback: "실패할 때 안전하게 되돌리는 법"
    status: draft

daily_checks: []
incidents: []
backup_restore: []
monitoring: []
periodic_tasks: []
escalation: []
```

각 항목은 `RUN-###` ID와 근거 ID를 갖는다. 고객 환경의 주기·담당·연락 위치가 미정이면
지어내지 않고 `@defer P6 — 근거 CON-###`로 남긴다. `verified`는 실행 근거와 확인 방법이
있을 때만 쓴다. 완결성 검사는 `/runbook`, 읽는 문서 생성은 `/doc-gen`이 담당한다.
