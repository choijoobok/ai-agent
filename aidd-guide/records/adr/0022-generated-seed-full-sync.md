# ADR-0022. 생성 시드는 전체 동기화하고, 사람이 부여한 권한 행은 남긴다

- 상태: 채택
- 일자: 2026-08-27
- 관련: [ADR-0020](./0020-path-prefix-action-and-seed-generation.md) · [ADR-0016](./0016-api-master-table.md) · [ADR-0010](./0010-request-logging-without-audit-trail.md) · [22-db-portability](../../standard/backend/_study/db-portability.md) §1 · [42-data-model-authz](../../knowledge/sys/menu.md) §5·§6 · [25-build-and-deploy](../../standard/build-deploy.md) §7.1

## 맥락

[ADR-0020](./0020-path-prefix-action-and-seed-generation.md) 이 `SYS_API` · `SYS_MENU_API` 시드를 **생성물**로 만들었다. 개발자가
`generateApiSeed` 를 돌리고 결과를 커밋하며, `checkApiSeed` 가 CI 에서 누락을 막는다.

**그런데 두 번째 실행부터가 비어 있었다.** 코드가 바뀌어 시드를 다시 만들면 그 파일을
**어떻게 쓰는가** — 기존 changeset 을 덮어쓰나, 델타를 새 파일로 쌓나. Liquibase 는
**이미 실행된 changeset 의 수정을 체크섬으로 막으므로** 이것은 취향 문제가 아니라
배포가 되느냐 마느냐의 문제다.

그리고 그 답이 **소스가 사라진 데이터의 운명**을 정한다. API 를 지우거나 이름을 바꾸면
`SYS_API` 행이 고아가 되고, 그 `(메뉴, 액션)` 에 걸려 있던 `SYS_USER_MENU_AUTH` ·
`SYS_ROLE_MENU_AUTH` 행도 함께 고아가 된다.

## 결정

**시드를 셋으로 가른다. 가르는 축은 *"누가 소유하는가"* 다.**

| 시드 | 소유 | 방식 |
|---|---|---|
| `006-init-api` · `007-init-menu-api` (**생성물**) | **코드** | **전체 동기화** — 전건 삭제 후 전건 삽입 |
| `005-init-code` (**손으로 쓰는 시드**) | **사람** | **누적** — 기존 changeset 은 손대지 않고 새 것을 더한다 |
| ~~`003-init-menu`~~ → **칸을 옮겼다**(2026-09-01) | **구조는 코드 · 표시는 운영** | **생성물이 되었고 upsert 한다. 지우지 않는다** — [ADR-0028](./0028-menu-seed-upsert-and-orphan.md) |
| `008-init-message-key` (**생성물**) | **키는 코드 · 값은 사람** | **없는 것만 추가** — 넷째 칸이며 [ADR-0023](./0023-message-key-sync-from-source.md) 이 갖는다(2026-08-28). 행을 지우지 않고 `USE_SCOPE` 만 전건 재계산한다 |
| `SYS_ROLE_MENU_AUTH` · `SYS_USER_MENU_AUTH` (**운영 데이터**) | **운영자** | **시드가 건드리지 않는다** — 부트스트랩 최초 1회를 뺀다 |

### 1. 생성 시드 — 파일 하나를 다시 쓰고 `runOnChange`

```yaml
- changeSet:
    id: init-api
    author: generated          # generateApiSeed
    runOnChange: true          # 파일이 바뀌면 다시 돈다
    changes:
      - delete: { tableName: SYS_MENU_API }   # 자식 먼저
      - delete: { tableName: SYS_API }
      - insert: { tableName: SYS_API, columns: [ … ] }
      - …
```

| | |
|---|---|
| **파일이 하나다** | 재생성하면 **그 파일만 바뀐다.** 파일이 늘지 않는다 |
| **`runOnChange: true`** | 바뀌지 않은 배포에서는 **돌지 않는다.** 체크섬 충돌도 나지 않는다 |
| **전건 삭제 → 전건 삽입** | 코드에서 사라진 API 가 **데이터에서도 사라진다** |
| **한 트랜잭션** | 중간 상태가 노출되지 않는다 |
| **벤더 중립** | `delete` · `insert` 는 Liquibase 추상 명령이다([22](../../standard/backend/_study/db-portability.md) §1) |

**전건 삭제가 안전한 이유** — `SYS_API` 의 PK 는 `API_URL` 이고 **대리키가 없다**
([42](../../knowledge/sys/menu.md) §5). 재삽입해도 참조가 깨지지 않는다. 그리고 `SYS_API` 를 참조하는 것은
`SYS_MENU_API` 뿐이며, 그것도 **같은 changeset 에서 함께 다시 쓰인다.**

> **`checkApiSeed` 가 이미 이것을 전제하고 있었다.** 그 태스크는 *"재생성 결과 == 커밋본"*
> 을 비교하는데([ADR-0020](./0020-path-prefix-action-and-seed-generation.md) §3), **재생성은 언제나 전체를 뱉는다.** 델타를 쌓는 방식이면
> 비교할 상대가 없어 그 CI 장치가 성립하지 않는다. 이 ADR 은 새 제약을 더하는 것이 아니라
> **[ADR-0020](./0020-path-prefix-action-and-seed-generation.md) 이 이미 깔고 있던 전제를 명시하는 것**이다.

**감사 4컬럼은 매번 다시 쓰인다.** 받아들인다 — 이 행들의 감사는 **시드 커밋의 git
이력**이 한다. 누가 언제 왜 이 API 를 이 메뉴에 열었는지는 PR 에 있고, [ADR-0020](./0020-path-prefix-action-and-seed-generation.md) 이
컨트롤러·프론트·시드를 **한 커밋**에 담게 한 이유가 그것이다.

### 2. 손으로 쓰는 시드 — 누적한다

공통코드 · 메시지 값 시드는 **사람이 소유**하며 운영에서 화면으로도 고친다
(`CODE_MGMT` · `MESSAGE_MGMT`). 전건 삭제하면 **운영자가 고친 것을 배포가 지운다.**

> **메뉴가 이 칸에서 빠졌다**(2026-09-01 — [ADR-0028](./0028-menu-seed-upsert-and-orphan.md)). 위 문장은 메뉴에도 참이지만
> **그것이 *누적* 을 요구하지는 않았다.** 누적은 여럿이 동시에 고칠 때 머지·브랜치 전환·
> checksum 셋을 깨고, 메뉴는 **화면과 1:1 이라 개발이 가장 자주 바꾸는 시드**다. 옮긴 곳은
> `008` 과 같은 칸(**upsert + 표시**)이며 **전건 삭제가 아니다** — 그랬으면 §3 이 금지한
> *배포가 운영 결정을 지운다* 가 됐을 것이다. **공통코드와 메시지 값은 옮기지 않는다**:
> 그 둘은 **운영이 바꾼다.**

| | |
|---|---|
| 방식 | **새 changeset 을 더한다** — `003-init-menu.yaml` 은 최초 1회이고, 이후는 `01x-menu-add-*.yaml` |
| 지우는 것 | **명시적으로 쓴다** — 무엇을 왜 지우는지가 diff 에 남아야 한다 |
| `runOnChange` | **쓰지 않는다** — 한 번 실행된 것은 그대로 둔다 |

### 3. 운영 권한 행 — 코드 변경이 지우지 않는다

`SYS_USER_MENU_AUTH` · `SYS_ROLE_MENU_AUTH` 는 **사람이 부여한 것**이다.
API 가 사라져 `(메뉴, 액션)` 이 미정의가 되어도 **행을 지우지 않는다.**

| | |
|---|---|
| **인가** | **무해하다** — 부를 API 가 없으므로 그 권한으로 할 수 있는 일이 없다. fail-closed 가 그대로 선다 |
| **권한 트리** | `—` (액션 미정의 — [61](../../../documents/screen/user/requirements.md) §4.4) |
| **예외 목록 · 역할 권한 목록** | 행이 보인다 + **고아 표시** |
| **지우는 것** | **사람이 판단한다** — 화면에서 지운다 |
| 진단 | `API_CATALOG`(AUTHZ-14)의 미등록·미매핑 진단과 같은 자리([42](../../knowledge/sys/menu.md) §5) |

**지우지 않는 이유가 둘이다.**

- **리팩터링이 권한을 소리 없이 지운다.** `getUserList` → `searchUserList` 로 바꿨다가
  되돌리는 사이의 배포 한 번이면 부여가 사라진다. **되돌릴 방법이 없다** — 변경 이력
  테이블을 두지 않았으므로([ADR-0010](./0010-request-logging-without-audit-trail.md)) 그 행 자체가 기록이었다
- **배포가 운영 결정을 지우는 것**이다. 개인 예외는 *"누구에게 왜 언제까지"* 를 사람이
  적은 것이며([42](../../knowledge/sys/menu.md) §6 — 사유 필수), 코드 변경이 그것을 없앨 권한은 없다

> **일관성의 축은 *"삭제하나 마나"* 가 아니다.** 셋을 다르게 다루는 것이 오히려 일관적이다
> — **소유자가 다르면 처리도 달라야 한다.** 코드가 소유한 것은 코드를 따라가고, 사람이
> 소유한 것은 사람을 기다린다.

## 기각한 대안

| 기각 | 이유 |
|---|---|
| **생성 시드도 델타를 쌓는다** | `checkApiSeed` 가 성립하지 않는다(위). 파일이 무한히 늘고 *"지금 DB 가 어떤 상태인가"* 를 알려면 전부 재생하며 읽어야 한다 |
| **생성 시드를 `loadUpdateData`(upsert)로** | **사라진 행을 지우지 못한다.** 삭제한 API 의 행이 영원히 남고, 그러면 `SYS_API` 가 *"코드가 결정하는 사실"* 이라는 [42](../../knowledge/sys/menu.md) §5 의 전제가 깨진다 |
| **기존 changeset 을 덮어쓰고 `validCheckSum` 으로 통과** | 체크섬 검증을 무력화한다. 손으로 쓰는 시드에도 같은 문 |
| **고아 권한 행을 함께 삭제 (`ON DELETE CASCADE` 포함)** | 위 §3 의 둘. 게다가 `SYS_USER_MENU_AUTH` 는 `SYS_API` 를 FK 로 참조하지 않는다 — `(MENU_CD, ACTION_CD)` 이므로 **DB 가 알아서 지울 관계가 아예 아니다** |
| **고아 권한 행을 배치로 정리** | 배치는 판단하지 않는다. *"이 API 는 영영 사라진 것인가 이름만 바뀐 것인가"* 를 구분할 수 없다 |
| **`SYS_API` 에 `USE_YN` 을 두고 끈다** | [42](../../knowledge/sys/menu.md) §5 가 이미 기각했다 — API 의 존재는 데이터로 끄는 대상이 아니다 |

## 결과

- **[ADR-0020](./0020-path-prefix-action-and-seed-generation.md) 의 개발자 작업 순서가 그대로 유지된다.** 4단계(`generateApiSeed`)가
  같은 파일을 다시 쓰고, 6단계의 diff 가 **추가·변경·삭제를 한눈에** 보여준다 —
  전체 스냅샷이라 삭제도 diff 에 나타난다
- **삭제된 API 의 리뷰가 가능해진다.** 델타였다면 *"무엇이 사라졌는가"* 는 생성기만 알았다
- **고아 권한 행이라는 상태가 정식으로 생긴다.** 화면이 그것을 표시해야 하며
  ([61](../../../documents/screen/user/requirements.md) §4.4 · `62`), 지우는 것은 사람의 판단이다
- 손으로 쓰는 시드의 **누적 규약이 처음 명시된다** — [22](../../standard/backend/_study/db-portability.md) §1 의 파일 배치만 있고
  두 번째 이후를 어떻게 쓰는지가 비어 있었다
- **부트스트랩 계정·역할의 권한 행은 최초 1회 시드로만 넣는다**([23](../../standard/backend/_study/security-design.md) §4) —
  그 뒤로는 운영 데이터이며 재생성 대상이 아니다
