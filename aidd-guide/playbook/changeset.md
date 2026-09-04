---
id: LLM-PLY-004
title: "Liquibase changeset — 표를 만들고 시드를 더한다"
category: "11-playbook"
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/backend/bootstrap/src/main/resources/db/changelog/", "aidd-guide/standard/backend/_study/db-portability.md"]
author: Bong Jong Hyeon
tier: 2
tags: [playbook, liquibase, changeset, seed, schema]
---

# Liquibase changeset — 표를 만들고 시드를 더한다

> **파일 이름이 `insert-sql.md` 였다.** 이 저장소에는 손으로 쓰는 INSERT SQL 이 없다 —
> DDL 도 시드도 **Liquibase changeset** 이고 벤더별 SQL 은 실행 시점에 만들어진다.
>
> **실물**: `sources/backend/bootstrap/src/main/resources/db/changelog/`.
> 생성 시드의 절차는 [06-framework/seed.md](../standard/seed.md) 가 갖는다 — 여기는
> **사람이 쓰는 쪽**이다.

## 1. 먼저 가른다 — 누구의 것인가

| 소유 | 무엇 | 고치는 법 |
|---|---|---|
| **생성물** | 메뉴(`003`) · API(`006`·`007`) · 메시지 **키**(`008`) | **선언을 고치고 다시 만든다.** 손편집은 훅이 차단한다 |
| **사람** | 스키마 · 코드 · 메시지 **값** · 부트스트랩 권한 · 시퀀스 행 | **새 파일을 더한다** |

**이미 적재된 changeset 을 고치지 않는다.** 고치면 **남의 로컬이 checksum 으로 죽는다.**
`loadData` 의 체크섬은 **CSV 를 본다** — 값만 고쳐도 같은 일이 난다.

## 2. 파일 하나를 더하는 절차

```
1. 번호를 정한다        data/ 의 마지막 번호 + 1   (스키마는 schema/)
2. 파일을 쓴다          {번호}-{무엇}.yaml  (+ 필요하면 같은 이름의 .csv)
3. master 에 include    db.changelog-master.yaml 맨 끝에 — 주석으로 **왜** 를 적는다
4. 기동해 확인          ./gradlew bootRun — 적재 실패는 기동 실패다
```

- **번호는 실행 순서가 아니라 이름이다.** 순서는 `master` 의 include 순서가 정한다.
- **`master` 의 주석이 이 저장소의 이력이다.** *무엇을 왜 이 자리에 넣었나* 를 한두 줄
  적는다 — 파일명만으로는 **FK 때문인지 우연인지** 알 수 없다.
- **끝에 붙인다.** 여럿이 동시에 고치는 파일이라 중간에 끼우면 충돌이 난다. 순서가
  성립하는 한 끝이 맞는다.
- **3 을 잊으면 파일만 있고 적재되지 않는다.** `master` 는 `includeAll` 이 아니라 include 를
  하나씩 적기 때문이며, 그것이 순서와 주석을 얻는 대가다. `SeedChangelogIncludeTest` 가
  **폴더와 include 목록을 대조해** 막는다 — 전에는 이 자리에 게이트가 없었고, 시드 검사는
  `master` 가 아니라 **폴더를 훑으므로** 잊어도 전부 초록이었다(`./gradlew test` 에
  Liquibase 를 태우는 테스트가 하나도 없다).

## 3. 스키마 — 벤더 다섯을 한 벌로 쓴다

```yaml
- changeSet:
    id: 013-create-sys-code-group
    author: template
    changes:
      - createTable: { tableName: SYS_CODE_GROUP, columns: [...] }
```

- **`createTable` 같은 추상 명령으로 쓴다.** 벤더별 DDL 을 손으로 다섯 벌 관리하면 서로
  어긋나는 것은 시간 문제다.
- **타입은 표 안에서만 고른다** — [06-framework/backend/persistence.md](../standard/backend/persistence.md) §2.
- **표가 늘면 `SYS_SEQUENCE` 에 행이 하나 는다.** 식별자가 `TABLE` 전략이다.
- **파일 머리에 왜를 적는다.** 이 저장소의 스키마 파일은 *무엇을 만드나* 가 아니라
  *왜 이 모양인가* 를 담는다 — 다음 사람이 컬럼을 지우려 할 때 읽을 유일한 글이다.

## 4. 코드 시드

```yaml
- insert: { tableName: SYS_CODE_GROUP, columns: [ { column: { name: GRP_CD, value: ... } } ] }
- insert: { tableName: SYS_CODE,       columns: [ ... ] }
```

| 규칙 | |
|---|---|
| **`DTL_NM` 은 이름이 아니라 메시지 키다** | `code.{GRP_CD}.{DTL_CD}` — 값은 메시지 시드가 넣는다 |
| **값을 안 넣으면 화면에 키가 그대로 보인다** | 그것이 *시끄럽게 드러나는* 쪽이라 의도된 모양이다 |
| **소스가 문자열로 참조하는 그룹은 `SYS_YN='Y'`** | 운영이 지우면 코드가 죽는다 |
| **코드를 넣었으면 캐시 버전을 올린다** | §6 |

## 5. 메시지 값 시드 — CSV + `loadData`

```yaml
- changeSet:
    id: data-106-message
    changes:
      - loadData:
          tableName: SYS_MESSAGE
          file: db/changelog/data/106-init-message.csv
          relativeToChangelogFile: false
          encoding: UTF-8
          columns: [ { column: { name: MSG_KEY, type: STRING } }, ... ]
```

- **키는 생성물이고 값은 사람의 것이다.** `generateMessageSeed` 가 `MSG`·`MsgKey` 에서 키를
  만들고, **문구는 여기서 넣는다.**
- **키가 시드에 없으면 기동에서 FK 가 거부한다.** 값 시드는 키 시드보다 뒤여야 한다.
- **같은 키의 값을 두 파일이 넣지 않는다.** `SYS_MESSAGE` PK 위반으로 **기동이 실패한다** —
  `SeedMessageTest` 가 중복을 검사하지만 **새 파일을 쓸 때 기존 것을 먼저 찾는다.**
- **언어마다 한 줄이다**(`ko`·`en`).
- **개명은 지우고 다시 넣는 것이다.** `MSG_KEY` 가 PK 이고 값이 그것을 참조하므로 `update`
  로 옮기려면 순서를 잡아야 한다 — 행이 몇 안 되면 `delete` 둘 + `loadData` 가 짧다.

## 6. 값을 넣었으면 캐시 버전을 올린다

```yaml
- update:
    tableName: SYS_CACHE_VERSION
    columns:
      - column: { name: VERSION, valueComputed: VERSION + 1 }
      - column: { name: MOD_DTM, valueComputed: CURRENT_TIMESTAMP }
    where: CACHE_NAME = 'message'
```

**올리지 않으면 이미 뜬 인스턴스가 옛 값을 계속 쓴다.** 대상은 `message` · `code` ·
`config` — [06-framework/backend/caching.md](../standard/backend/caching.md).

## 7. 지우는 법까지가 한 벌이다

**`include` 를 지우기만 하면 아무 일도 일어나지 않는다.** Liquibase 는 이미 적용한
changeset 을 목록에서 빼도 **되돌리지 않는다** — `DATABASECHANGELOG` 행이 남고 표도 시드도
그대로다. *앞으로 안 만든다* 이지 *지운다* 가 아니었다.

**걷어낼 수 있어야 하는 묶음에는 제거 changeset 을 함께 만든다** — 샘플의
`999-sample-remove.yaml` 이 그 실물이며, 쓰는 법과 **함께 지울 소스 목록**이 파일 머리에 있다.

| 제거 changeset 에서 조심할 것 | |
|---|---|
| **`LIKE` 의 밑줄이 와일드카드다** | `SMPL\_%` 는 `SMPLX...` 도 잡는다. **`ESCAPE` 를 반드시 쓴다** |
| **역슬래시를 이스케이프 문자로 쓰지 않는다** | MySQL 이 문자열 리터럴에서 **한 번 더 해석한다** |
| **새 DB 에서도 안전해야 한다** | 지울 것이 없으면 `delete` 는 0행, `dropTable` 은 `preConditions` 로 건너뛴다 |

## 8. 생성 시드와 섞지 않는다

| 하지 않는다 | 왜 |
|---|---|
| 생성 CSV 를 손으로 고친다 | 훅이 차단한다. 막히지 않아도 **다음 생성에서 사라진다** |
| 생성 시드에 사람의 행을 섞는다 | API 시드는 **전건 삭제 후 전건 삽입**이다 |
| 메뉴 시드를 전건 삭제로 바꾼다 | `SYS_MENU` 를 참조하는 FK 가 일곱이고 넷은 **사람이 결정한 사실**이다 |

## 9. 커밋 전 체크리스트

- [ ] 기존 changeset·CSV 를 **고치지 않고 더했는가**
- [ ] `master` 에 include 했고 **왜** 를 주석으로 적었는가
- [ ] 메시지 값이면 키가 **먼저** 들어가는가 · 같은 키가 다른 파일에 **없는가**
- [ ] 코드·메시지·설정을 넣었으면 **캐시 버전**을 올렸는가
- [ ] 실제로 기동해 적재를 확인했는가

## 관련

- [06-framework/seed.md](../standard/seed.md) — 생성 시드의 절차
- [06-framework/backend/persistence.md](../standard/backend/persistence.md) — 타입과 벤더
- [09-knowledge](../knowledge/INDEX.md) — 코드·메시지·메뉴가 무엇인가
