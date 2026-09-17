---
name: integrate-main
description: 같은 main에서 병행한 변경을 pull·merge하거나 충돌을 해결할 때 쓴다. fast-forward, 충돌 통합 기록, 오프라인 확인, 테스트·문서 재검토 위임을 한 절차로 처리한다.
---

<!-- generated_from: aidd-guide/harness/skill-src/integrate-main.md; do not edit -->

# main 통합

정본 절차는 [`aidd-guide/process/14-collaboration.md`](../../process/14-collaboration.md)다.

## 절차

1. `git status`와 추적 원격을 확인한다. 사용자 변경을 버리거나 자동 stash하지 않는다.
2. `git fetch` 후 앞섬·뒤처짐을 센다. 뒤처지기만 했으면 `git pull --ff-only`로 끝낸다.
3. 양쪽에 커밋이 있으면 `git merge --no-commit <upstream>`으로 통합한다.
4. 충돌의 의미 선택이 필요하면 원 변경자에게 오프라인 확인받도록 현재 사용자에게 알린다.
   사용자가 확인 결과를 전달하면 그대로 적용하고, AI가 사람이나 계정을 추정하지 않는다.
5. 영향 ID와 검증을 정한다. 불명확하면 TC→FEAT→모듈 순으로 넓힌다.
6. 검증했으면 결과를 `[충돌 통합]` 블록에, 넘기면 merge commit 뒤 별도 `state` 커밋의
   `pending_rechecks`에 기록한다. 두 커밋은 사용자가 요청할 때 한 번에 push한다.

merge commit은 Git이 부분 커밋을 허용하지 않으므로 `git commit -F -`를 쓰며, merge 상태가
아닌 일반 커밋은 항상 경로를 지정한다. 생성 문서 충돌은 정본에서 다시 생성한다. 승인된
spec 의미가 바뀌면 이 절차로 덮지 않고 `change-request`를 먼저 쓴다.

