# ADR-008 — 템플릿 독립 지원과 AI Hub 통합 DBMS 경계를 분리한다

| 항목 | 내용 |
|---|---|
| 결정 일자 | **2026-09-12** — 사용자 승인 |
| 상태 | **accepted.** 합쳐진 백오피스 템플릿과 AI Agent Hub의 DBMS 정책을 배포 경계별로 확정했다 |
| 적용 범위 | 독립 백오피스 템플릿, 통합 AI Agent Hub의 system·admin·portal·agent, 고객사 업무 DB·DW 연결 |
| 관련 결정 | ADR-005의 pgvector 선택은 통합 AI Agent Hub의 공유 PostgreSQL 스키마에 적용한다 |

## 1. 맥락

이 저장소는 주요 DBMS 지원을 목표로 한 **백오피스 템플릿**과, 임베딩 기능에 pgvector를 쓸
**AI Agent Hub**를 합쳐 관리한다. 템플릿의 PostgreSQL·Oracle·MySQL·MariaDB·SQL Server
드라이버와 Liquibase 분기는 독립 템플릿 배포를 위한 것이지만, 통합 Hub 배포의 DBMS 정책과
구분되어 있지 않아 SQL Server 지원이 Hub 내부 AI DB에도 필요한 것처럼 보였다.

사용자는 통합 AI Agent Hub에서는 템플릿 기반 `system`과 `admin`·`portal`·`agent` 세 모듈을
**하나의 PostgreSQL 스키마**에 함께 둔다고 확정했다. 반면 템플릿을 독립 배포할 때의 주요
DBMS 지원은 유지하고, 고객사 업무 DB·DW는 특정 DBMS에 종속하지 않아야 한다.

## 2. 고려한 대안

### 대안 A — 독립 템플릿·통합 Hub·외부 DW의 지원 정책을 분리한다 — **사용자 선택**

- 내용: 독립 백오피스 템플릿은 주요 DBMS 지원을 유지한다. 통합 AI Agent Hub는 `system`·`admin`·
  `portal`·`agent`의 설정·이력·지식·임베딩 벡터를 하나의 PostgreSQL 스키마에 저장하고
  pgvector를 쓴다. 고객사 업무 DB·DW는 데이터소스 연결 경계에서 특정 DBMS를 전제하지 않는다.
- 장점: 템플릿의 재사용성, Hub의 pgvector 보장, 이기종 DW 연동을 함께 지킨다.
- 단점: 코드·배포·시험에서 독립 템플릿과 통합 Hub의 데이터소스 프로파일·Liquibase 적용 범위를
  명확히 구분해야 한다.
- 비용/난이도: 중간. 합쳐진 소스의 의존성·Liquibase·배포 문서에 소유 경계를 계속 표시해야 한다.

### 대안 B — 전체 제품 DB를 PostgreSQL만 지원한다

- 내용: 템플릿의 다중 DBMS 드라이버·Liquibase·시험을 제거하고 Hub와 같은 정책으로 통일한다.
- 장점: 내부 구현과 검증 매트릭스가 줄어든다.
- 단점: 독립 백오피스 템플릿의 핵심 목표를 포기한다.
- 왜 선택하지 않았나: 템플릿을 재사용 가능한 기반으로 유지한다는 사용자 요구에 어긋난다.

### 대안 C — 통합 AI Hub도 템플릿과 같은 다중 DBMS로 지원한다

- 내용: Hub의 네 모듈을 DBMS별로 배포하고 pgvector가 없는 DBMS에는 대체 벡터 저장소 또는 구현을
  병행한다.
- 장점: Hub 설치 DBMS 선택지가 늘어난다.
- 단점: 네 모듈이 공유하는 데이터·배포·복구 지점이 DBMS별로 갈리고, 임베딩 표준을 보장할 수 없다.
- 왜 선택하지 않았나: ADR-005가 배제한 별도 벡터 저장소의 운영·정합 비용을 되살린다.

## 3. 결정

**독립 백오피스 템플릿은 주요 DBMS 지원을 유지한다. 통합 AI Agent Hub는 `system`·`admin`·
`portal`·`agent` 전부를 하나의 PostgreSQL 스키마에 두고 pgvector를 쓴다. 고객사 업무 DB·DW
연결은 특정 DBMS에 종속하지 않는다.**

## 4. 근거

1. pgvector는 PostgreSQL 확장이므로, 임베딩을 포함한 통합 Hub의 네 모듈이 공유하는 DB는
   PostgreSQL이어야 한다.
2. 같은 스키마를 공유해도 테이블·Entity/Repository의 쓰기 소유권은 모듈별로 하나씩 둔다
   (ARCH-024). 이는 데이터 복제와 이중 쓰기를 만들지 않으면서 책임을 분리한다.
3. 독립 템플릿의 다중 DBMS 지원은 Hub의 임베딩 선택과 별개다. DW·업무 데이터소스는 고객사
   환경의 이기종 시스템이므로 PostgreSQL만 가정하면 레거시 무침습 원칙(PRN-09)을 위반한다.

## 5. 포기한 것 (Trade-off)

- 통합 AI Agent Hub를 PostgreSQL 이외 DBMS에 배포하는 선택지.
- 하나의 데이터소스 정책과 하나의 DBMS 시험 매트릭스만으로 독립 템플릿과 통합 Hub를 검증하는
  단순함.
- 템플릿 기능에서 PostgreSQL 전용 SQL·인덱스 기능을 일반 규칙으로 쓰는 선택지.

## 6. 되돌리기

- 되돌릴 수 있는가: 가능하지만 비용이 높다.
- 되돌리는 방법: Hub 공유 스키마의 벡터 저장소·마이그레이션·백업 절차를 DBMS별로 다시 설계하거나,
  템플릿의 독립 다중 DBMS 지원 범위를 축소한다.
- 예상 비용: CON-001·CON-002·CON-008·CON-012·ARCH-003·ARCH-024·ARCH-060·ADR-005와
  데이터소스 프로파일·Liquibase·통합 시험을 재작업하는 여러 슬라이스 규모다.
- 되돌려야 한다는 신호: pgvector를 PostgreSQL에서 지속 운영할 수 없거나, 템플릿의 독립 다중
  DBMS 지원 비용이 실제 지원 계약을 충족하지 못하는 경우.

## 7. 영향

- 산출물: PRN-04·CON-001·CON-002·CON-008·CON-012·ARCH-003·ARCH-024, ADR-005, bootstrap
  DB 드라이버·vendor Liquibase 분기·외부 데이터소스 파서/시험 범위.
- 후속으로 정해야 할 것: CR-004에서 각 드라이버·Liquibase changeset·시험이 독립 템플릿용인지
  통합 Hub 공유 PostgreSQL 스키마용인지 식별하고, 배포 프로파일과 검증 매트릭스를 분리한다.
  실제 지원할 외부 DBMS와 버전 목록은 CON-023에 따라 고객사 데이터소스별로 확정한다.
