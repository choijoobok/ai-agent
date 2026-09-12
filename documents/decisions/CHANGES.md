# 변경 요청 대장 (Change Requests)

G3(설계 베이스라인) 승인 이후의 모든 spec 변경을 기록한다.
절차 → [08-change-control.md](../../aidd-guide/process/08-change-control.md)

| ID | 일자 | 유형 | 요청 내용 | 요청자 | 영향 | 재작업 규모 | 판정 | 상태 |
|---|---|---|---|---|---|---|---|---|
| CR-001 | 2026-09-12 | Modify | 기존 백오피스를 system으로 분리하고 admin·agent·portal과 함께 모듈별 소스·문서·API 경계를 둔다 | 사용자 | ARCH-003·010~014·018~020, 모듈·인가·라우팅·시드·화면 문서 | Large | A | 반영중 |
| CR-002 | 2026-09-12 | Fix | 메뉴 URL의 1:1 규칙을 서버 검증과 DB 유니크 제약으로 강제하고 중복은 409로 거부한다 | 사용자 | UC-503·FEAT-503·ENT-510·API-540·TC-5032·메뉴 화면·Liquibase | Small (SLICE-503 보강) | A | 완료 |
| CR-003 | 2026-09-12 | Modify | 실패 폐쇄 인가 판정 인터셉터와 소유 테스트를 system으로 이행하고, 인터셉터 조립 설정은 bootstrap에 둬 api↔system 순환 의존을 만들지 않는다 | 사용자 | ARCH-012·ARCH-026·UC-503·FEAT-503·TC-5035·인가 조립 설정 | Medium (SLICE-503 확장) | A | 완료 |
| CR-004 | 2026-09-12 | Modify | 합쳐진 백오피스 템플릿·AI Agent Hub의 DBMS 지원 경계를 분리한다. 독립 템플릿은 주요 DBMS 지원을 유지하고, 통합 Hub의 system·admin·portal·agent는 하나의 PostgreSQL 스키마와 pgvector를 공유하며, 고객사 업무 DB·DW 연결은 중립으로 둔다 | 사용자 | PRN-04·CON-001·CON-002·CON-008·CON-012·ARCH-003·ARCH-024·ARCH-060·ADR-005, bootstrap DB 드라이버·시험 의존성·vendor Liquibase 분기·외부 데이터소스 파서 | Medium (별도 DB 경계 정비 범위) | A | 반영중 |

**유형**: Add / Modify / Remove / Fix
**판정**: A(지금 반영) / B(나중에) / C(안 함)
**상태**: 검토중 / 승인 / 반려 / 반영중 / 완료

---

## 범위 증가 추이

| 시점 | FEAT | 증감 | 누적 CR (Add/Mod/Rem) |
|---|---|---|---|
| G3 베이스라인 | — | — | — |
| CR-003 | 96 | 0 (+0.0%) | Add 0 / Modify 2 / Remove 0 / Fix 1 |
| CR-004 | 96 | 0 (+0.0%) | Add 0 / Modify 3 / Remove 0 / Fix 1 |
