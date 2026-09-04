---
id: LLM-FWK-BE-S003
title: "DB 중립성 전략 — 원문"
category: "06-framework/backend"
type: study
created: 2026-08-28
updated: 2026-09-03
status: active
sources: ["(원본) docs/design/22-db-portability.md — 2026-09-04 폐지"]
author: Bong Jong Hyeon
tier: 2
tags: [backend, database, portability, study]
---

> **이 파일은 근거다** — 규칙은 [`../persistence.md`](../persistence.md) 가 갖는다.
> 벤더별 실측·스파이크 정의·해소된 미결이 여기 남는다.

# 22. DB 중립성 전략

- 상태: 확정
- 최종수정일: 2026-08-28
- 관련 ADR: [0003](../../../records/adr/0003-liquibase-for-db-portability.md)
- **읽어야 할 때**: DDL·쿼리를 작성할 때 · 벤더 종속 기능을 쓰려 할 때

## 0. 요구사항

> 개발은 PostgreSQL 로 한다. Oracle / MS SQL Server / MySQL(MariaDB) 은
> **데이터소스 설정만 바꾸면 소스 수정 없이** 동작해야 한다.

## 1. DDL 스크립트를 DB별로 손으로 만들 필요는 없다

당초 "PostgreSQL 스크립트와 JPA Entity 를 보고 벤더별 DDL 을 따로 만들어야 하나"는
질문이 있었다. **그럴 필요 없다.** DB별 DDL 을 수작업 관리하면 4벌이 서로 어긋나는 것은 시간 문제다.

채택 방식은 **Liquibase 의 DB 중립 changelog** 다.

```
bootstrap/src/main/resources/db/changelog/
├── db.changelog-master.yaml
├── schema/
│   ├── 001-core-tables.yaml        # SYS_SEQUENCE (ADR-0015)
│   ├── 002-auth.yaml               # SYS_USER
│   ├── 003-log.yaml                # SYS_LO_LOGIN
│   ├── 004-authz.yaml              # 역할·메뉴·권한·API (42)
│   └── ...
├── data/
│   ├── 001-init-sequence.yaml      # 시퀀스 시드 행     (사람 · ADR-0015)
│   ├── 002-init-admin.yaml         # 부트스트랩 관리자  (사람)
│   ├── 003-init-menu.yaml          # 메뉴 시드          (사람 · 52)
│   ├── 004-init-role.yaml          # 역할·부여·역할권한 (사람)
│   ├── 005-init-code.yaml          # 공통코드 시드      (사람)
│   ├── 006-init-api.yaml           # API 마스터         (생성물 · ADR-0020)
│   ├── 007-init-menu-api.yaml      # 메뉴↔API 매핑      (생성물 · 〃)
│   └── 008-init-message-key.yaml   # 메시지 키          (생성물 · ADR-0023)
└── vendor/                         # 벤더별로 갈릴 수밖에 없는 것만
    ├── postgresql.yaml
    ├── oracle.yaml
    ├── mssql.yaml
    └── mysql.yaml
```

- changelog 는 `createTable` / `addColumn` 같은 **추상 명령**으로 작성한다.
  Liquibase 가 접속한 DB 에 맞는 DDL 을 실행 시점에 생성한다.
- 벤더별 분기는 `<changeSet dbms="oracle">` 속성으로 **예외적인 것만** 처리한다.
- 사람이 읽을 벤더별 SQL 파일이 필요하면 **생성**한다. 손으로 쓰지 않는다:

```bash
./gradlew updateSql -Pdb=oracle   # → build/liquibase/oracle-schema.sql
```

- JPA `ddl-auto` 는 **모든 환경에서 `validate`**. Liquibase 가 유일한 스키마 출처다.
  (엔티티와 스키마 불일치 시 기동 실패 → P1 장치화)

### 1.1 두 번째 배포부터 — 시드를 다시 쓰는 방식

**Liquibase 는 이미 실행된 changeset 의 수정을 체크섬으로 막는다.** 그러므로 *"시드 파일을
다시 만들면 어떻게 되는가"* 는 취향이 아니라 배포가 되느냐의 문제다. **시드의 소유자에
따라 갈린다** — 근거와 기각 대안은 [ADR-0022](../../../records/adr/0022-generated-seed-full-sync.md).

| 시드 | 소유 | 방식 |
|---|---|---|
| `006-init-api` · `007-init-menu-api` (**생성물**) | **코드** | **전체 동기화** — 파일 하나를 다시 쓰고 `runOnChange: true`. 내용은 **전건 삭제 → 전건 삽입** |
| `001~005`(부트스트랩·메뉴·역할·코드) | **사람** | **누적** — 기존 changeset 은 손대지 않고 새 파일을 더한다. `runOnChange` 를 쓰지 않는다 |
| **`008-init-message-key`**(생성물) | **키는 코드 · 값은 사람** | **없는 것만 추가** — `loadUpdateData`(PK 지정) + `runOnChange: true`. **행을 지우지 않고 `USE_SCOPE` 만 전건 재계산**한다. 값 테이블(`SYS_MESSAGE`)은 **건드리지 않는다** — [ADR-0023](../../../records/adr/0023-message-key-sync-from-source.md) |
| **`009-init-message`**(사람) | 사람 | **설치 출발값**(2026-08-29 신설). `loadData` 로 `SYS_MESSAGE` 와 `menu.*` 키 행을 넣는다. `runOnChange` 를 쓰지 않으며 그 뒤로는 `MESSAGE_MGMT` 가 고친다 |
| 권한 부여 행(`SYS_*_MENU_AUTH`) | **운영자** | **부트스트랩 최초 1회만.** 이후 시드가 건드리지 않는다 |

> **번호가 계획과 다르다**(2026-08-29 구현). 원래 목록은 `001-init-code` · `002-init-menu` ·
> `003-init-api` · `004-init-menu-api` · `005-init-message-key` 다섯이었는데,
> **시퀀스 시드 · 부트스트랩 관리자 · 역할 부여가 목록에 없었다** — 번호만 어긋난 것이
> 아니라 **세 파일이 빠져 있었다**. 위 목록이 구현이 만든 실제 순서이며 문서를 그쪽에 맞췄다.
>
> 번호는 **사람이 읽는 순서**일 뿐이다. Liquibase 의 실행 순서는 `db.changelog-master.yaml`
> 의 `include` 순서가 정하므로, 번호를 고쳐도 실행 순서가 바뀌지 않는다. 다만 **FK 방향과
> 어긋나면 읽는 사람이 헷갈리므로** 참조하는 쪽이 뒤에 오도록 맞춘다 — 역할 권한(004)이
> 메뉴(003) 뒤인 것이 그것이다.

- **시드에 현재 시각을 넣을 때는 `valueComputed: CURRENT_TIMESTAMP`** 를 쓴다(2026-08-28 실측).
  `valueDate: "now"` 는 Liquibase 5.0.3 이 번역하지 않고 `now` 를 **컬럼 이름으로** 내보내
  *"now 이름의 칼럼은 없습니다"* 로 실패한다. `CURRENT_TIMESTAMP` 는 표준 SQL 이라 5개
  벤더가 모두 받는다. §4.5 의 *현재시각 금지* 는 **애플리케이션 쿼리** 규칙이며, 설치 시
  한 번 도는 시드는 그 대상이 아니다 — 값을 주입할 애플리케이션이 아직 없다
- `delete` · `insert` · **`loadUpdateData`** 는 **Liquibase 추상 명령**이라 벤더 중립이 유지된다.
  `loadUpdateData` 는 PK 로 upsert 하며 **CSV 에 담은 컬럼만 갱신**한다 — 그래서 키 시드가
  `MSG_VAL` 을 건드리지 않는다([ADR-0023](../../../records/adr/0023-message-key-sync-from-source.md))
- **덮어쓰기를 `validCheckSum` 으로 통과시키지 않는다** — 체크섬 검증을 무력화하는 것이다
- **생성 태스크를 언제 돌리고 배포 전에 무엇을 확인하는지는 [33](../../_study/seed-generation.md)** 이다. `updateSql`(§1)이
  그 검증의 첫 단계로 쓰인다 — **`DELETE` 가 어느 시드에 있어야 하는지**를 본다([33](../../_study/seed-generation.md) §4.1)

## 2. 강제 장치: 멀티 DB CI

문서 규칙만으로는 지켜지지 않는다. Testcontainers 로 **4종 DB 에서 동일한 통합 테스트**를 돌린다.

| 단계 | 대상 | 시점 |
|---|---|---|
| PR | PostgreSQL | 매 PR (빠름) |
| PR | MySQL | 매 PR |
| 야간 | PostgreSQL, MySQL, MariaDB, MSSQL | nightly |
| 야간 | Oracle (Free 이미지) | nightly, 실패 허용 → 안정화 후 필수 전환 |

Oracle 컨테이너는 무겁고 라이선스 이미지 이슈가 있어 PR 파이프라인에서는 제외한다.

### 무엇으로 검증하는가 — 샘플 테이블

이식성을 실증할 **대표 픽스처**가 필요하다. 공통(`SYS_`) 테이블은 성격이 치우쳐 있어
타입 조합을 고루 담지 못한다.

**샘플 테이블(`SMPL_`)** 에 숫자·날짜·`CHAR(1)` Y/N·시퀀스·긴 문자열·NULL 허용 컬럼을
고루 배치하고, 샘플 CRUD 시나리오를 4종 DB 에서 돌린다. 통과하면 이식성이 문서상
주장이 아니라 **검증된 사실**이 된다.

그래서 샘플은 템플릿 저장소에서 **삭제하지 않는다** — 사용자가 자기 프로젝트에서 지운다.
→ [10-feature-inventory](../../../knowledge/features.md) L 그룹

## 3. 타입 매핑 기준

엔티티에서 사용할 타입을 아래로 제한한다. 그 외 타입은 리뷰 대상.

| 논리 타입 | Java | Liquibase 타입 | PostgreSQL | Oracle | MSSQL | MySQL |
|---|---|---|---|---|---|---|
| 식별자 | `Long` | `BIGINT` | bigint | NUMBER(19) | bigint | bigint |
| 코드/짧은 문자 | `String` | `VARCHAR(n)` | varchar | VARCHAR2 | nvarchar | varchar |
| 긴 텍스트 | `String` + **§3.1 매핑 필수** | **`NCLOB`** | text | nclob | nvarchar(max) | longtext |
| 불리언 | `Boolean` | `BOOLEAN` | boolean | NUMBER(1) | bit | tinyint(1) |
| 정수 | `Integer` | `INT` | integer | NUMBER(10) | int | int |
| 금액/소수 | `BigDecimal` | `DECIMAL(p,s)` | numeric | NUMBER | decimal | decimal |
| 일시 | `Instant` | `TIMESTAMP WITH TIME ZONE` | timestamptz | TIMESTAMP WITH TIME ZONE | datetimeoffset | timestamp |
| 날짜 | `LocalDate` | `DATE` | date | DATE | date | date |
| 바이너리 | `byte[]` | `BLOB` | bytea | BLOB | varbinary(max) | longblob |

### 금지 타입
| 타입 | 사유 | 대안 |
|---|---|---|
| `JSON` / `JSONB` | 벤더별 지원·문법 편차가 가장 큼 | `CLOB` + 애플리케이션 직렬화 |
| 배열 | PostgreSQL 전용 | 정규화 또는 구분자 문자열 |
| `ENUM` | 벤더별 상이 | `VARCHAR` + Java enum + `@Enumerated(STRING)` |
| `UUID` 네이티브 | 표현 방식 상이 | **`CHAR(36)` 로 통일.** PII 참조키도 동일 → [27-pii-vault](../pii-vault.md) §3.2 |
| 공간/지리 타입 | | 범위 밖 |

> **`Boolean` 주의**: Oracle 에는 전통적으로 boolean 컬럼이 없어 `NUMBER(1)` 로 매핑된다.
> Hibernate 방언이 처리하지만, MyBatis 쿼리에서 `WHERE use_yn = true` 같은 표현을 쓰면 깨진다.
> **MyBatis 를 쓰는 컬럼은 `CHAR(1)` 'Y'/'N'** 을 쓰는 편이 안전하다. → 아래 4.3

### 3.1 긴 텍스트는 `@Lob` 만으로는 이식되지 않는다

**스파이크 실측(2026-08-24).** `@Lob String` 은 5개 벤더 중 **3곳에서 쓸 수 없는 타입**이 된다.

| 매핑 | PostgreSQL | Oracle | SQL Server | MySQL | MariaDB |
|---|---|---|---|---|---|
| `@Lob` | **`oid`** | `clob` | `varchar(max)` | **`tinytext`** | **`tinytext`** |
| `@JdbcTypeCode(LONG32VARCHAR)` | `text` | `clob` | `varchar(max)` | **`tinytext`** | **`tinytext`** |
| **`@Nationalized` + `LONG32NVARCHAR`** | `text` | `nclob` | `nvarchar(max)` | `longtext utf8mb4` | `longtext` |
| `@Column(length = 1MB)` | `varchar(1048576)` | `clob` | `varchar(max)` | `mediumtext` | `mediumtext` |

- **`tinytext` 는 255 바이트다.** 1MB 요청 전문을 넣을 수 없다
- **`oid` 는 PostgreSQL Large Object** 다. 실데이터가 `pg_largeobject` 에 따로 살고
  **행을 지워도 남는다** — 파기 정책([32](../../../knowledge/retention.md))과 정면 충돌
- `LONG32VARCHAR` 만으로는 부족하다. **국가문자 여부까지 지정해야** MySQL 방언이
  `longtext` 를 고른다. `@Lob` 이면 될 것 같은 직관이 여기서 깨진다

**규약** — 긴 텍스트 컬럼은 아래 형태로만 선언한다.

```java
@Nationalized
@JdbcTypeCode(SqlTypes.LONG32NVARCHAR)
@Column(name = "PARAMETERS")
private String parameters;
```

5개 벤더 전부에서 의도한 타입이 나오는 유일한 조합이고,
비기능 요건 §5 의 "전 구간 UTF-8" 요구와도 일치한다.

**changelog 쪽은 `clob` 이 아니라 `nclob` 을 쓴다.** `clob` 으로 두면 SQL Server 가
`varchar(MAX)`(비유니코드)가 되어 한글이 위험하고, Oracle 도 `CLOB` 이라 위 매핑과 어긋난다.

| changelog 타입 | PostgreSQL | Oracle | SQL Server | MySQL | MariaDB | 애플리케이션과 일치 |
|---|---|---|---|---|---|---|
| `clob` | `TEXT` | `CLOB` | **`varchar(MAX)`** | `LONGTEXT` | `LONGTEXT` | ✗ Oracle·SQL Server |
| **`nclob`** | `TEXT` | `NCLOB` | `nvarchar(MAX)` | `LONGTEXT` | `LONGTEXT` | **✓ 5종 전부** |

실측 근거: [`evidence/db-portability-2026-08-24/02-after-table/`](../../../records/adr/evidence/db-portability-2026-08-24).

## 4. 벤더 차이가 실제로 문제되는 지점과 대응

### 4.1 식별자 생성

**`TABLE` 전략으로 통일한다** → [ADR-0015](../../../records/adr/0015-table-based-id-generation.md).

| 방식 | 판정 |
|---|---|
| `IDENTITY` | ✗ Oracle 12c 미만 미지원, JPA 배치 INSERT 불가 |
| `AUTO` | ✗ 방언마다 다른 전략 선택 → 스키마 불일치 |
| `SEQUENCE` | ✗ **기각(2026-08-24).** MySQL 에서 Liquibase 가 `createSequence` 를 조용히 건너뛴다 — 아래 주의 |
| **`TABLE`** | **✓ 채택.** 생성기 테이블을 명시하므로 5개 벤더가 같은 객체를 쓴다 |

```java
@Id
@GeneratedValue(strategy = GenerationType.TABLE, generator = "sys_sequence")
@TableGenerator(
        name = "sys_sequence",
        table = "SYS_SEQUENCE",
        pkColumnName = "SEQ_NAME",
        valueColumnName = "NEXT_VAL",
        pkColumnValue = "SYS_LO_ACCESS",   // 논리 시퀀스명 = 테이블명
        initialValue = 1,
        allocationSize = 50)
private Long id;
```

changelog 는 `createSequence` 를 쓰지 않는다. 생성기 테이블을 **평범한 `createTable`** 로
만들고 **논리 시퀀스마다 시드 행을 넣는다**. 시드를 빠뜨리면 첫 INSERT 가 Hibernate 자체
INSERT 경로로 빠지고 다중 노드에서 경합한다.

> **`SEQUENCE` 를 기각한 이유 — 스파이크 실측(2026-08-24).**
>
> | | MySQL 에서 실제로 무엇을 하는가 |
> |---|---|
> | Liquibase `createSequence` | **아무것도 하지 않는다.** 에러도 경고도 없이 건너뛴다 |
> | Hibernate `SEQUENCE` 전략 | `SEQ_LO_ACCESS` 라는 **테이블**(단일 컬럼 `next_val`)을 기대한다 |
>
> 에뮬레이션 주체는 **Hibernate** 이며, 이 문서가 전에 적었던 "Liquibase 가 에뮬레이트한다"는
> 사실이 아니었다. 스키마의 유일한 출처는 Liquibase 이고(§1), `ddl-auto=validate` 는
> **엔티티↔테이블만 대조할 뿐 생성기 객체의 부재를 잡지 않는다.** 그래서 MySQL 에서는
> **기동은 성공하고 첫 INSERT 에서 실패**한다.
>
> MariaDB 는 네이티브 시퀀스를 지원하므로(10.3+) 문제가 없었다 — MySQL 하나만의 문제였다.
> 근거 DDL: [`evidence/db-portability-2026-08-24/01-before-sequence/`](../../../records/adr/evidence/db-portability-2026-08-24).

> **`SEQ_NAME` 은 `varchar(255)`.** `@TableGenerator` 에 pk 컬럼 길이 옵션이 없어
> 애플리케이션 쪽에서 좁힐 수 없다. 좁히면 스키마 검증을 켤 수 없게 된다.

### 4.2 예약어 / 식별자 규칙
| 규칙 | 내용 |
|---|---|
| 길이 | 테이블·컬럼명 **30자 이내** (구 Oracle 제약 기준) |
| 대소문자 | **전부 대문자 스네이크** 로 정의. 따옴표로 감싸지 않는다 |
| 예약어 | `USER`, `ORDER`, `GROUP`, `LEVEL`, `SESSION`, `KEY`, `VALUE`, `TYPE`, `SIZE` 등 금지 |
| 접두사 | 공통 테이블은 `SYS_` 접두사 — 업무 테이블과 충돌 방지 |
| **시각 접미사** | **`_DTM`** = timestamp(시각), **`_DT`** = date(날짜만). 둘을 섞지 않는다 — 타입이 이름에서 드러나야 한다 |

예: 사용자 테이블은 `USER` 가 아니라 **`SYS_USER`**. 코드는 `SYS_CODE`, `SYS_CODE_GROUP`.

### 4.3 Y/N 플래그
공통 테이블의 불리언 성격 컬럼은 `CHAR(1)` `'Y'`/`'N'` 으로 통일한다.
JPA 는 `AttributeConverter` 로 `Boolean` ↔ `'Y'/'N'` 변환, MyBatis 는 문자 비교로 안전하다.

> **컨버터의 DB 쪽 타입은 `Character` 다 — `String` 이 아니다** (2026-08-28 실측).
> `AttributeConverter<Boolean, String>` 이면 Hibernate 가 `VARCHAR(1)` 로 잡고 changelog 의
> `CHAR(1)` 과 어긋나 **기동이 실패한다**(`found [bpchar], but expecting [varchar(1)]`).
> `Character` 로 두면 `CHAR` 로 잡히므로 **컬럼마다 `@JdbcTypeCode(CHAR)` 를 붙일 필요가
> 없다** — 빠뜨릴 수 있는 자리를 아예 없앤다.
>
> **`autoApply = true` 는 쓰지 않는다.** 켜면 앞으로 만들 모든 엔티티의 모든 `Boolean` 이
> 조용히 `CHAR(1)` 이 되고, 업무 테이블이 진짜 `BOOLEAN` 을 쓰려 할 때 끄는 방법이 애매해진다.

> **`CHAR` 는 여기와 UUID 둘뿐이다** (2026-08-30 실측 — 같은 실패를 다시 겪었다).
> 컨버터 없는 **순수 `String`** 필드에 `CHAR(n)` 컬럼을 주면 Hibernate 는 `VARCHAR(n)` 을
> 기대하므로 **기동이 검증에서 실패한다** — `SYS_USER_MENU_STAT.STAT_YM`(`yyyyMM`)이
> 그랬다([42](../../../knowledge/sys/menu.md) §8).
>
> 고치는 길이 둘인데(엔티티에 `@JdbcTypeCode(CHAR)` / 컬럼을 `VARCHAR` 로) **컬럼을
> 바꾼다.** §3 의 타입 표가 *"코드/짧은 문자 → `VARCHAR(n)`"* 이고, 애너테이션 쪽은
> **컬럼마다 붙여야 하는 자리**가 하나 느는데 위 문단이 바로 그것을 없앤 참이다.
> 길이가 늘 n 인 것은 **값을 만드는 애플리케이션**이 지킨다 — 벤더별 `CHAR` 패딩 차이
> (Oracle 은 공백을 채우고 MySQL 은 읽을 때 떼어낸다)를 지고 갈 이유도 없다.

### 4.6 `IN` 목록에는 한계가 있다 — 쪼개서 보낸다

**재는 자가 벤더마다 다르다**(2026-08-30 — 실물 쿼리를 보고 나온 지적).

| 벤더 | 한계 |
|---|---|
| **Oracle** | `IN` 의 **표현식 1000개** — 넘으면 `ORA-01795` |
| SQL Server | 개수가 아니라 **바인드 파라미터 2100개**(문장 전체) |
| MySQL · MariaDB | 개수 제한 없음 — **패킷 크기**(`max_allowed_packet`)로 막는다 |
| PostgreSQL | 바인드 65535개 |

**가장 낮은 것에 맞춘다** — `InChunks.LIMIT = 900`. **1000 이 아닌 것이 요점이다**: 1000 은
오라클의 한계와 *같은* 값이라 여유가 없고, 조건이 하나 더 붙거나 판이 바인드를 하나 더 쓰면
그 자리에서 깨진다.

> **왜 지금 필요한가.** `PageSpec.MAX_SIZE` 가 1000 이라 *페이지 하나 분량* 이 정확히 **경계
> 위**에 있었다. 지금은 통과하지만 **상한을 한 칸만 올리면** 오라클에서 깨지고, 그 실패는
> **오라클로 배포한 뒤에야** 나타난다 — 개발용 PostgreSQL 은 6만 개도 받는다.

쪼개는 방법이 **자리에 따라 둘**이다.

| 어디 | 방법 | 왜 |
|---|---|---|
| **조건절 안**(사용자 검색 `in`) | `IN` 을 나눠 **`OR` 로 잇는다** | 한 `WHERE` 에 남아야 **페이징이 성립한다** — 반복 질의로 나눌 수 없다 |
| **그 자체가 목적인 질의**(마스터 페이지의 값 조회) | **반복 질의** 후 결과를 합친다 | 순서가 결과에 관여하지 않는다 — 키로 찾아 쓴다 |

> **JPQL 에는 목록이 보이지 않는다.** 자리표 하나(`?1`)로 찍히고 **드라이버로 나갈 때** 펼쳐진다 —
> 한계도 거기서 걸린다. 그래서 테스트가 셀 수 있는 것은 *조각이 몇 개인가* 뿐이며, 실제로 몇 개가
> 나갔는지는 [28](./system-logging.md) §2 의 SQL 로그가 보여 준다.

### 4.4 페이징
| 방식 | 판정 |
|---|---|
| JPA/QueryDSL `Pageable` | ✓ Hibernate 방언이 처리 |
| MyBatis 에서 `LIMIT/OFFSET` 직접 작성 | ✗ Oracle/MSSQL 문법 상이 |
| **MyBatis 는 `OFFSET n ROWS FETCH NEXT m ROWS ONLY`** | ✓ 표준 SQL. Oracle 12c+/MSSQL 2012+/PostgreSQL 지원. **MySQL 만 미지원** → `databaseId="mysql"` 분기 |

### 4.5 함수 / 표현식
| 용도 | 금지 | 대안 |
|---|---|---|
| 현재시각 | `SYSDATE`, `NOW()`, `GETDATE()` | 애플리케이션에서 값 주입 (테스트에도 유리) |
| NULL 처리 | `NVL`, `ISNULL` | `COALESCE` |
| 문자열 결합 | `+`, `CONCAT`, `||` 혼용 | `CONCAT()` 또는 애플리케이션 처리 |
| 형변환 | `TO_CHAR`, `CONVERT` | 애플리케이션 포맷팅 |
| 조건 분기 | `DECODE`, `IIF` | `CASE WHEN` |
| 상위 N | `ROWNUM`, `TOP` | `FETCH FIRST n ROWS ONLY` |
| 빈 문자열 | — | **Oracle 은 `''` = NULL**. 빈 문자열을 유의미하게 쓰지 않는다 |
| 문자열 비교 | — | MySQL 기본 콜레이션은 대소문자 무시. **`LIKE` 셋(`startsWith`·`contains`·`endsWith`)은 서버가 `LOWER()` 로 정규화한다**([72](./api-conventions.md) §3.3 — 2026-08-30) — 맡겨 두면 같은 조건이 벤더마다 다른 답을 낸다. `eq`·`ne`·`in` 은 그대로 콜레이션을 탄다 |
| 정렬 | — | NULL 정렬 순서가 벤더별로 다름. `ORDER BY` 에 항상 명시적 tie-breaker(PK) 추가 |
| **한글 정렬 순서** | — | **아직 답이 없다.** 이 표는 대소문자와 `NULL` 위치만 다루는데, 한글 가나다 순서도 콜레이션이 정한다. PostgreSQL 은 ICU 로 고정할 수 있으나(§6.0) 나머지 셋은 각자의 체계다 → §6 미결 |

### 4.6 MyBatis 벤더 분기
`databaseIdProvider` 를 등록하고, 불가피한 경우만 분기한다.

```xml
<select id="findPage" databaseId="mysql">  SELECT ... LIMIT #{size} OFFSET #{offset} </select>
<select id="findPage">                      SELECT ... OFFSET #{offset} ROWS FETCH NEXT #{size} ROWS ONLY </select>
```

분기가 생기면 **모든 벤더 버전을 함께 작성**하는 것을 리뷰 규칙으로 한다.

### 4.7 Spring Session JDBC 테이블
`SPRING_SESSION` / `SPRING_SESSION_ATTRIBUTES` 는 Spring Session 이 벤더별 DDL 을 제공한다.
직접 만들지 말고 제공 스크립트를 Liquibase changelog 에 벤더 분기(`dbms=`)로 포함한다.
→ [23-security-design](./security-design.md)

### 4.8 락

| 방식 | 판정 |
|---|---|
| **락 테이블 PK INSERT (즉시실패)** | ✓ INSERT/DELETE 뿐 — **완전 이식** |
| **비관적 락** `PESSIMISTIC_WRITE` | ✓ Hibernate dialect 가 `FOR UPDATE` / `WITH (UPDLOCK…)` 로 변환 |
| 락 **대기 타임아웃** 지정 | ✗ **벤더별로 전혀 다름** (아래) |
| Redis 분산 락 | ✓ Redis 사용 시 선택 가능 |

`FOR UPDATE` **자체는 이식된다.** 이식되지 않는 것은 **대기 시간 제어**다.

| DB | 대기 타임아웃 지정 방법 |
|---|---|
| Oracle | `FOR UPDATE WAIT n` — 구문에 포함 |
| PostgreSQL | 구문에 없음. 세션 `lock_timeout` 설정 (`NOWAIT` 만 구문 지원) |
| MySQL | 세션 `innodb_lock_wait_timeout` |
| MSSQL | `SET LOCK_TIMEOUT` |

`jakarta.persistence.lock.timeout` 힌트는 **벤더에 따라 무시되거나 오류**가 된다.
템플릿은 이 힌트에 의존하지 않고, 필요하면 **연결 초기화 시 세션 파라미터**로 설정한다.

락 저장소는 인터페이스로 추상화하고 설정으로 선택한다.
선택 기준: [31-distributed-lock](../persistence.md) §9

### 4.9 글로벌 트랜잭션 (XA)

**중립화 불가 — 템플릿 범위에서 제외한다.**

| DB | XA 전제조건 |
|---|---|
| PostgreSQL | `max_prepared_transactions` **기본값 0** → prepared transaction 자체가 실패. 변경 후 **서버 재시작** 필요 |
| MySQL | XA 복구 관련 이력 있음. 버전 의존적 |
| MSSQL | MSDTC 구성 필요 |
| Oracle | 상대적으로 양호 |

"설정만 바꿔 4종 DB 지원" 이라는 요구와 **정면으로 충돌**한다. PostgreSQL 하나만 봐도
서버 파라미터 변경과 재시작이 필요하므로 템플릿이 전제할 수 없다.

Spring Boot 3 이후 기본 제공 JTA 스타터도 없다 (Bitronix 2.3 제거, Atomikos 3.0 제거,
`ChainedTransactionManager` 는 Spring Data 에서 제거 — 원자성을 제공하지 않으면서
제공하는 것처럼 보였다).

대안 경로: 설계 원칙 §2

## 5. 개발자 체크리스트

새 테이블/쿼리를 추가할 때:

- [ ] 테이블명 30자 이내, `SYS_` 접두사(공통 테이블), 예약어 회피
- [ ] 타입이 §3 매핑 표 안에 있는가
- [ ] 불리언 성격 컬럼은 `CHAR(1)` Y/N 인가
- [ ] ID 는 `TABLE` 전략인가([ADR-0015](../../../records/adr/0015-table-based-id-generation.md))
- [ ] changelog 는 벤더 중립 명령으로 작성했는가
- [ ] MyBatis 쿼리에 §4.5 금지 함수가 없는가
- [ ] `ORDER BY` 에 PK tie-breaker 가 있는가
- [ ] 통합 테스트가 최소 PostgreSQL + MySQL 에서 통과하는가

## 6. 미결 사항

**스파이크 1차 완료 (2026-08-24)** — DB 없이 확인 가능한 항목. 결과로 §3.1·§4.1 이 개정되고
[ADR-0015](../../../records/adr/0015-table-based-id-generation.md) 가 신설됐다. 근거 DDL: [`evidence/db-portability-2026-08-24/`](../../../records/adr/evidence/db-portability-2026-08-24).

**스파이크 2차 완료 (2026-08-28)** — 4벤더 런타임. **개발 머신에서 가상화를 켤 수 없어
GitHub Actions 에서 돌렸다.** 통과한 것과 **확인하지 못한 것**을 아래에서 가른다 —
뭉뚱그리면 미확인이 확인으로 둔갑한다.

> **스파이크를 지우고 실제 changelog 를 태운다 (2026-09-02).** [48](../../../playbook/INDEX.md) §8 의
> *"`SMPL_` 을 4벤더 CI 에 언제 태우나"* 에 대한 답이며, **지금**이다 — 여섯 화면이 다 섰고
> ([68](../../../playbook/INDEX.md) §2) 남은 질문이 전부 **실제 스키마와 실제 시드**를 요구한다.
>
> | | 스파이크(지웠다) | 지금 |
> |---|---|---|
> | 태우는 것 | 손으로 만든 **축소판 changelog** (테이블 하나) | **`db.changelog-master.yaml` 전부** — 시드·샘플·벤더 분기까지 |
> | 보는 것 | 식별자 전략 · CLOB 매핑 | **선다 → 걷어낸다 → 다시 선다** + 한글 왕복 · 한글 정렬 · `LIKE ESCAPE` |
> | 자리 | `spike/db-portability` · `spike-db-portability.yml` | `:backend:bootstrap:portabilityTest` · `db-portability.yml` |
>
> **둘을 함께 두지 않는다.** 축소판이 확인할 것은 끝났고(결론이 §3.1 · §4.1 · [ADR-0015](../../../records/adr/0015-table-based-id-generation.md) 로
> 옮겨졌다) 검사가 둘이면 **쉬운 쪽이 초록인 것을 보고 안심**하게 된다. 지운 것은 코드이며
> **측정값은 남겼다** — [`evidence/db-portability-2026-08-24/`](../../../records/adr/evidence/db-portability-2026-08-24) 는 되돌아볼 수 없는 시점의
> DDL 덤프라 ADR 이 그것을 근거로 인용한다.
>
> **태우는 조건이 셋이다.** changelog·엔티티가 바뀐 main 커밋 · 매일 한 번 · 수동(Oracle
> 포함 여부가 입력). 매 푸시에 태우면 20분이 붙어 **사람이 워크플로를 끄게** 된다.
>
> **아직 한 번도 돌지 않았다.** 개발 머신에 Docker 가 없어 여기서 확인할 수 있는 것은
> 태스크 배선까지이며(벤더 넷을 찾아 `assumeTrue` 로 건너뛰는 것을 확인했다) **컨테이너가
> 실제로 뜨는 것은 워크플로가 처음 도는 순간**이다.

| 항목 | 성격 | 범위 | 게이트 |
|---|---|---|---|
| **`TABLE` 전략 행 락 경합 비용** — `allocationSize=50` 에서 실제로 얼마나 아픈지 | 실측 | 템플릿 | **릴리스**(Phase 8 성능 측정) — 2차에서 다루지 않았다 |
| **배치 INSERT 가 실제로 묶이는가** — JDBC batch. 확인에 SQL 로그 리스너가 필요해 2차에서 미작성 | 검증 | 템플릿 | Phase 7 |
| **Oracle 런타임** — 이미지가 2GB+ 라 2차에서 제외했다(`-f oracle=false`) | 검증 | 템플릿 | Phase 7 |
| **Oracle LOB 조회 성능** — 목록에서 전문 컬럼을 SELECT 하지 않을 때 | 실측 | 템플릿 | 릴리스 |
| **한글 정렬 순서의 벤더 간 차이** — §4.5 는 대소문자와 `NULL` 위치만 다룬다. **그리드 정렬을 서버가 판정**하므로([54](../../frontend/_study/grid-column-contract.md) §3) 벤더를 바꾸면 같은 목록이 다른 순서로 나올 수 있다. **재는 자리가 생겼다**(2026-09-02) — `VendorPortabilityTest` 가 로컬(ICU `ko-KR` · §6.0)의 순서와 견주고, 다르면 그 벤더의 순서를 실패 메시지에 적는다 | 검증 | 템플릿 | Phase 8 |

> **Phase 7 을 막던 것은 풀렸다.** 식별자 전략과 긴 텍스트 매핑이 4벤더 런타임에서
> 확인됐으므로 DDL 구조를 바꿀 위험이 사라졌다. 남은 항목은 성능 실측과 Oracle
> 확인이며, **실패해도 `allocationSize` 조정이나 상한 하향으로 대응**한다.

### 6.0 PostgreSQL 로컬 개발 DB 는 **ICU 로 만든다** (2026-08-28)

libc 콜레이션은 **이름과 정렬 결과가 OS 마다 다르다** — Windows `Korean_Korea.utf8`,
Linux `ko_KR.utf8`. 개발이 Windows 이고 배포가 Linux 인데 **정렬 판정을 서버가 하므로**
([72](./api-conventions.md) · [54](../../frontend/_study/grid-column-contract.md) §3) 같은 데이터가 환경에 따라 다른 순서로 나온다.

```sql
CREATE DATABASE bo OWNER bo_admin ENCODING 'UTF8'
  LOCALE_PROVIDER icu ICU_LOCALE 'ko-KR'
  LOCALE 'Korean_Korea.utf8' TEMPLATE template0;
```

**이것이 벤더 간 일치를 뜻하지는 않는다** — Oracle·MySQL·SQL Server 는 각자의 콜레이션
체계를 쓴다. ICU 가 없애는 것은 *같은 PostgreSQL 인데 OS 가 달라서 생기는 차이*뿐이며,
벤더 간 차이는 위 미결 표의 마지막 항목이다.

### 6.1 스파이크 정의 (Phase 3 착수 전)

산출물은 문서가 아니라 **버릴 코드**다. Testcontainers 로 4개 벤더를 올리고 아래만 확인한 뒤
폐기한다. 정식 Phase 7 골격과 섞지 않는다 — 섞으면 검증이 아니라 구현이 된다.

#### S-1. 식별자 생성

| 확인 항목 | 통과 기준 |
|---|---|
| **누가 에뮬레이트하는가** | Liquibase(DDL 생성)와 Hibernate(런타임 할당)가 **같은 테이블·컬럼**을 쓰는가. 서로 다른 테이블을 만들면 ID 가 중복 발급되고, 그것이 **조용히** 일어난다 |
| `allocationSize = 50` | 4종 모두에서 연속 INSERT 200건이 PK 충돌 없이 통과 |
| 재기동 연속성 | 재기동 후 이전 할당 블록을 침범하지 않는다 |
| 배치 INSERT | JDBC batch 가 실제로 묶이는가 (벤더별 SQL 로그 확인) |

**폴백 사다리** — 위에서부터 시도한다.

| 순위 | 대안 | 대가 |
|---|---|---|
| 1 | **`TABLE`** (현행, §4.1 · [ADR-0015](../../../records/adr/0015-table-based-id-generation.md)) | 할당 시 행 락 경합. 대신 5종 동작이 완전히 동일하고 예측 가능 |
| 2 | 애플리케이션 ID 생성기 (Snowflake 유사) | DB 무관·고성능. 단조 증가가 **노드 시계에 의존** |
| 3 | `CHAR(36)` UUID | 인덱스 비대·클러스터링 불리. **업무 PK 로는 회피** — 참조키 용도는 이미 채택(§3) |

`IDENTITY` 는 폴백에 넣지 않는다 — §4.1 에서 배치 INSERT 불가로 이미 탈락했다.
`SEQUENCE` 도 넣지 않는다 — MySQL 에서 Liquibase 가 `createSequence` 를 건너뛰므로
폴백으로서 성립하지 않는다([ADR-0015](../../../records/adr/0015-table-based-id-generation.md)).

#### S-2. 요청 전문 CLOB

| 확인 항목 | 통과 기준 |
|---|---|
| 타입 매핑 | Liquibase `nclob` 이 text / NCLOB / nvarchar(max) / longtext (§3.1) 로 실제 생성되는가. **`clob` 이 아니다** — SQL Server 에서 `varchar(MAX)` 로 떨어져 기각됐다(§3.1) |
| 1MB 왕복 | 1MB 문자열 INSERT → SELECT 무손실. **[21](./architecture.md) §6.2 의 캐시 상한 1MB 와 같은 값이어야 한다** |
| 조회 성능 | 목록 조회에서 전문 컬럼을 **SELECT 하지 않을 때** 성능 저하가 없는가 (Oracle LOB 주의) |
| MySQL 패킷 | `max_allowed_packet` 기본값에서 1MB 가 통과하는가 |

**폴백 사다리**

| 순위 | 대안 | 대가 |
|---|---|---|
| 1 | 절단 상한 1MB (현행) | — |
| 2 | 절단 상한 하향 (예: 256KB) | [21](./architecture.md) §6.2 필터 캐시 상한도 **함께** 내린다 — 두 값이 어긋나면 잘린 전문이 저장된다 |
| 3 | 전문을 별도 테이블로 분리 | 조회 성능 회복. 조인 1회 추가 |
| 4 | 전문을 파일·객체 스토리지로, DB 는 포인터만 | 파기가 두 저장소에 걸친다 → [32](../../../knowledge/retention.md) §4 |


### 해소된 미결

| 항목 | 결정 | 해소일 |
|---|---|---|
| **S-1 `allocationSize = 50`** | **4벤더 통과.** 연속 INSERT 200건이 PK 충돌 없이 — PostgreSQL · MySQL 8.4 · MariaDB 11.4 · SQL Server 2022 | 2026-08-28 |
| **S-1 재기동 연속성** | **4벤더 통과.** 새 EMF 가 이전 할당 블록을 침범하지 않는다 | 2026-08-28 |
| **S-1 누가 에뮬레이트하는가** | **4벤더 통과.** Liquibase 단독으로 `SYS_SEQUENCE` 와 시드 행이 생기고, Hibernate `@TableGenerator` 가 같은 객체를 쓴다. **[ADR-0015](../../../records/adr/0015-table-based-id-generation.md) 가 런타임에서 확인됐다** — 그 전까지는 DDL 비교에 근거한 추론이었다 | 2026-08-28 |
| **S-2 1MB 무손실 왕복** | **4벤더 통과.** `nclob` 매핑이 1MB 전문을 손실 없이 왕복시킨다 | 2026-08-28 |
| **S-2 MySQL `max_allowed_packet`** | **제약이 아니다.** 순정 이미지 기본값은 **MySQL 8.4 = 64MB · MariaDB 11.4 = 16MB** 이며 1.36MB 전문보다 훨씬 크다. 2차 초기에 본 1MB 는 **Testcontainers 컨테이너 설정**이었다 — 벤더 기본값으로 오독할 뻔했다 | 2026-08-28 |
| MySQL 시퀀스 대응 방안 | **`TABLE` 전략 전면 채택(안 B).** 5개 벤더가 같은 생성기 테이블을 쓴다 — MySQL 특수 처리 소멸 → [ADR-0015](../../../records/adr/0015-table-based-id-generation.md) | 2026-08-24 |
| SQL Server 에서 Liquibase `clob` → 유니코드 강제 | **changelog 타입을 `nclob` 으로 쓴다.** 5종 전부 애플리케이션 매핑과 일치 — §3.1 | 2026-08-24 |
| MySQL 시퀀스 에뮬레이션 주체 규명 | **Hibernate 가 에뮬레이트한다.** Liquibase 는 `createSequence` 를 조용히 건너뛴다 — 기존 서술은 사실이 아니었다. §4.1 | 2026-08-24 |
| 요청 전문 CLOB 타입 매핑 | **`@Nationalized` + `@JdbcTypeCode(LONG32NVARCHAR)`.** `@Lob` 은 PostgreSQL `oid`·MySQL `tinytext`(255B) 가 되어 사용 불가 — §3.1 | 2026-08-24 |
| 대용량 이력 테이블 파티셔닝 | **템플릿은 파티셔닝하지 않는다.** 벤더별 문법이 완전히 달라 중립성과 정면 충돌 — 파티셔닝은 프로젝트별 선택으로 남기고 템플릿은 **아카이브 배치**로 대응 | 2026-08-24 |
