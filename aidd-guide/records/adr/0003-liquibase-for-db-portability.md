# ADR-0003. Liquibase 기반 DB 중립 스키마 관리

- 상태: 채택
- 일자: 2026-08-26

## 맥락
개발은 PostgreSQL 로 하되, Oracle / MSSQL / MySQL(MariaDB) 에서
**데이터소스 설정만 바꿔** 동작해야 한다. 벤더별 DDL 스크립트를 수작업으로
4벌 관리하는 방식이 검토되었다.

## 결정
**Liquibase** 를 채택하고, changelog 를 벤더 중립 명령(YAML)으로 작성한다.
벤더별 SQL 이 필요하면 `updateSql` 태스크로 **생성**한다. 손으로 쓰지 않는다.
JPA `ddl-auto` 는 전 환경 `validate` 로 고정한다.

## 근거
- Liquibase 는 `createTable` 등 추상 명령을 접속 DB 방언으로 변환한다. Flyway 는
  기본이 벤더별 SQL 파일이라 이 요구에 맞지 않는다.
- DDL 4벌 수작업 관리는 시간이 지나면 반드시 어긋난다.
- `ddl-auto=validate` 로 두면 엔티티와 스키마 불일치 시 기동이 실패해,
  드리프트가 배포 전에 드러난다.

## 대안
| 대안 | 기각 사유 |
|---|---|
| Flyway + 벤더별 SQL 디렉터리 | 4벌 동기화 부담. 이 요구사항에는 부적합 |
| `ddl-auto=update` | 운영 사용 불가. 변경 이력 추적 불가 |
| JPA 스키마 생성 스크립트 export | 인덱스·제약·시드 데이터 관리 불가 |

## 결과
- 벤더 중립을 유지하기 위한 제약이 생긴다: JSON/배열/ENUM 타입 금지, ID 생성 전략 고정,
  식별자 30자 제한, 예약어 회피 등 ([22-db-portability](../../standard/backend/_study/db-portability.md)).
- ~~MySQL 은 시퀀스를 지원하지 않아 Liquibase 에뮬레이션에 의존한다. **Phase 7 검증 필수.**~~

> **개정(2026-08-24) — [ADR-0015](./0015-table-based-id-generation.md).** 위 두 줄은 *"시퀀스 전략 고정 +
> Liquibase 가 MySQL 에서 에뮬레이트한다"* 를 전제했는데, **에뮬레이션 주체는 Hibernate 이고
> Liquibase 는 `createSequence` 를 조용히 건너뛴다.** ID 생성 전략은 `SEQUENCE` 가 아니라
> **`GenerationType.TABLE`** 로 확정됐다. `ddl-auto` 방침(전 환경 `validate`)은 그대로다.
- 파티셔닝 등 벤더 고유 최적화는 템플릿에서 제외한다.
- Testcontainers 멀티 DB CI 로 중립성을 강제한다.
