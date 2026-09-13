---
name: runbook
description: 운영 런북 정본을 P2~P6 근거로 작성·검증하고 RUN ID, 장애 대응, 백업/복구, 모니터링, 정기 작업, 에스컬레이션의 누락을 점검한다. "운영 런북", "장애 대응 절차", "백업 복구 절차", "운영 인수" 요청에 사용한다.
---

<!-- generated_from: aidd-guide/harness/skill-src/runbook.md; do not edit -->

# 운영 런북 작성·검증

정본은 `documents/spec/80-operations.yaml`이다. `documents/generated/80-운영런북.md`와 HTML은
파생물이므로 직접 고치지 않는다.

## 근거를 모으는 순서

1. 구성·배포 경계는 `20-architecture.yaml`의 ARCH를 참조한다.
2. 정상·주의·위험 기준은 `21-nfr.yaml`의 NFR과 P5 실측을 참조한다.
3. 고객사 확정값은 `02-constraints.yaml`의 CON을 참조하고 미정이면 `@defer P6`로 남긴다.
4. 운영 화면은 `60-screens.yaml`의 SCR, 검증은 `70-testcases.yaml`의 TC를 연결한다.
5. 비밀값·개인 연락처 원문은 저장소에 쓰지 않고 승인된 보관 위치만 적는다.

절차마다 `RUN-###` ID, 증상/목적, 실행 순서, 정상 확인, 실패 시 복구·롤백, 근거와 마지막 검증일을 둔다.
P2에서 골격, P3에서 운영 흐름, P4에서 배포·정기 작업, P5에서 실측·리허설, P6에서 고객값과
운영 인수를 채운다.

```bash
node .claude/skills/runbook/check.mjs
node .claude/skills/runbook/check.mjs --release
node .claude/skills/doc-gen/gen.mjs 운영런북
node .claude/skills/deliverable-site/build.mjs operations
```

`--release`는 빈 필수 절과 `@defer`가 남은 절차를 실패로 판정한다. 검증 결과를 근거 없이
`verified`로 바꾸지 않는다.
