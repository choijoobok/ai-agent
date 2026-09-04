# ADR-0015. 식별자 생성은 `TABLE` 전략으로 통일

- 상태: 채택
- 일자: 2026-08-26
- 관련: [22-db-portability](../../standard/backend/_study/db-portability.md) §4.1 · §6.1 · [ADR-0003](./0003-liquibase-for-db-portability.md)
- 근거 데이터: [`./evidence/db-portability-2026-08-24/`](./evidence/db-portability-2026-08-24)

## 맥락

성공 기준 2번은 *"데이터소스 설정만 바꾸면 PostgreSQL / Oracle / MS SQL Server / MySQL(MariaDB)
에서 자바·SQL 소스 수정 없이 기동"* 이다 → 설계 개요 §2.

기존 결정은 `GenerationType.SEQUENCE` 였다. 4종 모두 시퀀스를 지원하고, MySQL 8 만 예외이며
그 예외는 *"Liquibase 의 시퀀스 에뮬레이션 테이블 방식으로 처리"* 된다고 적혀 있었다.

## 확인한 사실 (Phase 3 착수 전 스파이크)

DB 를 띄우지 않고, 같은 선언에 대해 두 도구가 생성하는 DDL 을 벤더별로 뽑아 비교했다.

| 벤더 | Liquibase `createSequence` | Hibernate `SEQUENCE` |
|---|---|---|
| PostgreSQL · Oracle · SQL Server · MariaDB | `CREATE SEQUENCE SEQ_LO_ACCESS` | 동일 |
| **MySQL** | **아무것도 생성하지 않는다 — 에러도 경고도 없다** | `create table SEQ_LO_ACCESS (next_val bigint)` + 시드 INSERT |

**"Liquibase 가 에뮬레이트한다"는 전제는 사실이 아니었다.** 에뮬레이션은 Hibernate 가 하고,
Liquibase 는 조용히 건너뛴다.

스키마의 유일한 출처는 Liquibase 이고([ADR-0003](./0003-liquibase-for-db-portability.md)), 전 환경에 건 `ddl-auto=validate`
는 **엔티티↔테이블 대조만 할 뿐 시퀀스 같은 생성기 객체의 부재는 잡지 않는다.** 그래서
MySQL 에서는 **기동은 성공하고 첫 INSERT 에서 실패**한다. 배포 파이프라인에는 아무 신호가 없다.

> 이 실패 시나리오 자체는 DDL 두 장을 비교해 **추론**한 것이었다.
> **2026-08-28 에 런타임으로 확인했다** — 아래 "런타임 확인".

## 결정

**`GenerationType.TABLE` 을 전 엔티티에 적용한다.** 생성기 테이블은 프로젝트가 명시한다.

```java
@Id
@GeneratedValue(strategy = GenerationType.TABLE, generator = "sys_sequence")
@TableGenerator(
        name = "sys_sequence",
        table = "SYS_SEQUENCE",
        pkColumnName = "SEQ_NAME",
        valueColumnName = "NEXT_VAL",
        pkColumnValue = "SYS_USER",        // 논리 시퀀스명 = 테이블명
        initialValue = 1,
        allocationSize = 50)                       // 이력 테이블은 1000 — [45] §3
private Long id;
```

- 생성기 테이블은 **하나를 공유**한다 — 논리 시퀀스마다 한 행. 락은 행 단위이므로
  경합이 엔티티 단위로 갈리고 전역이 되지 않는다
- changelog 는 `createSequence` 를 쓰지 않는다. **평범한 `createTable`** 로 만든다
- 시드 행은 changelog 가 넣는다. Hibernate 도 없으면 넣지만, 다중 노드가 첫 요청을
  동시에 받으면 경합한다
- `SEQ_NAME` 길이는 **255** 로 둔다. `@TableGenerator` 에 pk 컬럼 길이 옵션이 없어
  애플리케이션 쪽에서 좁힐 수 없고, 좁히면 스키마 검증을 켤 수 없다

### 검증 결과

같은 오프라인 방법으로 채택안을 재확인했다(`findings/02-after-table/`).
**5개 벤더 전부에서 두 도구가 같은 테이블·컬럼·시드 행을 만든다.**

```
CREATE TABLE SYS_SEQUENCE (SEQ_NAME varchar(255) NOT NULL, NEXT_VAL bigint NOT NULL, ...)
INSERT INTO SYS_SEQUENCE (SEQ_NAME, NEXT_VAL) VALUES ('SYS_LO_ACCESS', 1)
```

**MySQL 이 더 이상 예외가 아니다.** 벤더 특수 처리가 완전히 소멸했다.

### 런타임 확인 (2026-08-28)

오프라인 DDL 비교는 *"Liquibase 가 그렇게 쓰겠다고 한다"* 까지만 말한다. 실제로 INSERT 가
되는지는 DB 를 띄워야 알 수 있고, 개발 머신에서 가상화를 켤 수 없어 **GitHub Actions 에서
돌렸다**(`.github/workflows/db-portability.yml` — 그때는 `spike-` 접두가 붙어 있었고, 2026-09-02 에 스파이크가 지워지며 그 워크플로가 실제 changelog 를 태우는 것으로 바뀌었다).

| 확인 | PostgreSQL 16 | MySQL 8.4 | MariaDB 11.4 | SQL Server 2022 |
|---|---|---|---|---|
| Liquibase 단독으로 `SYS_SEQUENCE` + 시드 행 생성 | ✅ | ✅ | ✅ | ✅ |
| `allocationSize=50` — 연속 INSERT 200건 PK 충돌 없음 | ✅ | ✅ | ✅ | ✅ |
| 재기동 연속성 — 새 EMF 가 이전 블록을 침범하지 않음 | ✅ | ✅ | ✅ | ✅ |

**Oracle 은 아직이다** — 이미지가 2GB+ 라 제외했다([22](../../standard/backend/_study/db-portability.md) §6 미결).

## 고려한 대안

| 대안 | 기각 이유 |
|---|---|
| `SEQUENCE` 유지 + MySQL 전용 changeSet 으로 대체 테이블 생성 | 동작은 한다. 그러나 **Hibernate 내부 명명 규칙에 의존**한다 — 버전 업에서 이름이나 컬럼이 바뀌면 다시 조용히 깨진다. 실패 모드를 없애지 못하고 미룬다 |
| 벤더별 전략 분기 | DB 중립성 원칙 위반. 배포 산출물이 벤더를 알아야 한다 |
| `IDENTITY` | Oracle 12c 미만 미지원, **JPA 배치 INSERT 불가** — §4.1 에서 이미 탈락 |
| 애플리케이션 ID 생성기 (Snowflake 유사) | DB 무관·고성능이나 단조 증가가 **노드 시계에 의존**한다. 시계 역행 시 중복 위험 |
| `CHAR(36)` UUID | 인덱스 비대·클러스터링 불리. 업무 PK 로는 회피. 참조키 용도는 별건으로 이미 채택 → [27](../../standard/backend/pii-vault.md) §3.2 |

## 대가

**할당 시 행 락 경합이 생긴다.** 네이티브 시퀀스는 락 없이 값을 발급하지만
`TABLE` 전략은 생성기 행을 갱신한다. `allocationSize = 50` 이므로 INSERT 50건마다
한 번이며, 경합은 같은 엔티티에 동시 INSERT 하는 경우로 한정된다.

**이 비용은 아직 실측하지 않았다.** 2차 스파이크는 *동작하는가*만 확인했고 *얼마나
아픈가*는 다루지 않았다. 부하 실측은 Phase 8 성능 측정으로 미룬다 → [22](../../standard/backend/_study/db-portability.md) §6.

예측 가능성을 위해 이 대가를 받아들인다. 네이티브 시퀀스의 성능 이점보다,
**4개 벤더에서 같은 코드가 같게 동작한다는 보장**이 이 템플릿의 목적에 부합한다.
성능이 문제가 되는 프로젝트는 `allocationSize` 를 올리면 된다 — 설정 한 줄이다.

## 파급

- 모든 엔티티의 `@Id` 선언 형태가 고정된다 → Phase 9 개발 가이드에 싣는다
- `SYS_SEQUENCE` 가 논리 데이터 모델에 추가된다 → Phase 3
- 새 테이블을 만들 때 **시드 행 changeSet 을 함께 넣어야 한다** — 빠뜨리면 첫 INSERT 가
  Hibernate 의 자체 INSERT 경로로 빠지고 다중 노드에서 경합한다
