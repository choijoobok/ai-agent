# 변경 요청 대장 (Change Requests)

G3(설계 베이스라인) 승인 이후의 모든 spec 변경을 기록한다.
절차 → [08-change-control.md](../../aidd-guide/process/08-change-control.md)

| ID | 일자 | 유형 | 요청 내용 | 요청자 | 영향 | 재작업 규모 | 판정 | 상태 |
|---|---|---|---|---|---|---|---|---|
| CR-001 | 2026-09-12 | Modify | 기존 백오피스를 system으로 분리하고 admin·agent·portal과 함께 모듈별 소스·문서·API 경계를 둔다 | 사용자 | ARCH-003·010~014·018~020, 모듈·인가·라우팅·시드·화면 문서 | Large | A | 반영중 |
| CR-002 | 2026-09-12 | Fix | 메뉴 URL의 1:1 규칙을 서버 검증과 DB 유니크 제약으로 강제하고 중복은 409로 거부한다 | 사용자 | UC-503·FEAT-503·ENT-510·API-540·TC-5032·메뉴 화면·Liquibase | Small (SLICE-503 보강) | A | 완료 |
| CR-003 | 2026-09-12 | Modify | 실패 폐쇄 인가 판정 인터셉터와 소유 테스트를 system으로 이행하고, 인터셉터 조립 설정은 bootstrap에 둬 api↔system 순환 의존을 만들지 않는다 | 사용자 | ARCH-012·ARCH-026·UC-503·FEAT-503·TC-5035·인가 조립 설정 | Medium (SLICE-503 확장) | A | 완료 |
| CR-004 | 2026-09-12 | Modify | 합쳐진 백오피스 템플릿·AI Agent Hub의 DBMS 지원 경계를 분리한다. 독립 템플릿은 주요 DBMS 지원을 유지하고, 통합 Hub의 system·admin·portal·agent는 하나의 PostgreSQL 스키마와 pgvector를 공유하며, 고객사 업무 DB·DW 연결은 중립으로 둔다 | 사용자 | PRN-04·CON-001·CON-002·CON-008·CON-012·ARCH-003·ARCH-024·ARCH-060·ADR-005, bootstrap DB 드라이버·시험 의존성·vendor Liquibase 분기·외부 데이터소스 파서 | Medium (별도 DB 경계 정비 범위) | A | 반영중 |
| CR-005 | 2026-09-12 | Fix | 비밀값·임의 변경 금지 값은 화면에서 마스킹·거부하지 않고, `sys-config.*`와 분리된 `yml` 프로퍼티 경로에서 배포 관리한다 | 사용자 | REQ-506·UC-506·FEAT-506·API-558~560·SCR-515·TC-5063·시스템 환경설정 요건서·ConfigCatalog 경계 시험 | Small (SLICE-508 보강) | C | 완료 |
| CR-006 | 2026-09-12 | Fix | 설정값은 노드 TTL 캐시를 두지 않고 다음 작업 스코프에서 DB 오버라이드를 다시 합성한다 | 사용자 | REQ-506·UC-506·FEAT-506·TC-5065·ConfigLookup 작업 스코프 시험 | Small (SLICE-508 보강) | A | 완료 |
| CR-007 | 2026-09-12 | Fix | FEAT-507의 ‘민감 상세’는 데이터 등급이 명시된 상세에만 적용하고, 현재 이력 화면의 마스킹된 불변 상세는 화면별 캐시 정책을 따른다. `PARAMETERS` 안 개인정보 등 민감값의 필드별 판별·마스킹은 Hub 개발 완료 뒤 별도 기능으로 설계한다 | 사용자 | UC-507·SCR-517·사용 이력 화면 요건·SLICE-509 규칙 반전 범위 | Small (SLICE-509 문구 정정) | A | 완료 |
| CR-008 | 2026-09-12 | Fix | 이력 상세는 CLOB 전문을 목록에서 분리해 부하를 막는 조회 방식이며 별도 권한 자원이 아니다. 목록·상세 모두 해당 이력 메뉴의 같은 현재 READ 권한으로 보호한다 | 사용자 | REQ-507·UC-507·FEAT-507·ENT-522·API-561~565·SCR-517~518·TC-5074·SLICE-510 | Small (SLICE-510 문구 정정·권한 계약 시험) | A | 완료 |
| CR-009 | 2026-09-12 | Fix | FEAT-509의 공지 검증과 관리 요청 판정 검증을 슬라이스 경계에 맞춰 분리한다. TC-5092·5093은 공지 전용으로 바로잡고, 요청 판정 검증은 TC-5096·5097로 SLICE-514에 배정한다 | 사용자 | UC-509·FEAT-509·TC-5092·TC-5093·TC-5096·TC-5097·SLICE-513·SLICE-514 | Small (테스트 배정 정정) | A | 완료 |
| CR-010 | 2026-09-13 | Fix | 같은 관리 요청을 동시에 판정하면 대상 행을 잠가 첫 요청만 처리하고, 뒤 요청은 처리자 정보를 드러내지 않는 기존 상태 충돌(409) 문구로 거부한다. 잠금 대기 초과는 공통 오류 정책을 유지한다 | 사용자 | UC-509·FEAT-509·ENT-527·API-582·TC-5097·NotiRequestService·요청함 화면 | Small (SLICE-514 동시성 보강) | A | 완료 |
| CR-012 | 2026-09-13 | Fix | 현재 구현을 정본으로 확정한다. `COND_JSON`은 프런트가 직렬화하는 개인 설정 값이므로 서버가 내용을 열어 거부하지 않는다. 저장조건을 고르면 화면별 기본값 위에 현재 유효한 필드만 적용하며, 같은 이름은 덮어쓰고 새 기본 저장조건은 이전 기본 저장조건을 자동 해제한다 | 사용자 | TC-5102·ENT-531·FEAT-510·개인화 지식·SearchCondService·SavedCondControl·SLICE-515 | Small (TC·엔티티 규칙 정정, 구현 재작업 없음) | A | 완료 |
| CR-013 | 2026-09-13 | Fix | 메뉴 선택 통계의 동시 탭 선택은 편의용 best-effort로 유지하며 같은 메뉴를 동시에 열 때 한 건 유실을 허용한다 | 사용자 | UC-510·ENT-530·TC-5105·MenuStatService·SysUserMenuStatRepository·SLICE-516 | Small (동시성 규칙 정정, 구현 재작업 없음) | B | 완료 |
| CR-014 | 2026-09-13 | Modify | 현재 대시보드의 서버 호출 없는 카드 두 장 슬롯 구현을 유지하고, 즐겨찾기·자주 쓰는 메뉴 등 위젯 상세 요건은 Hub 개발 완료 후 고객 요구에 맞춰 정의한다 | 사용자 | SCR-525·DashboardPage·대시보드 요건·SLICE-516 | Medium (후속 화면·API 호출·빈 상태 설계) | B | 완료 |
| CR-015 | 2026-09-13 | Modify | 메뉴 트리에서 `window.open`으로 브라우저 새 탭 또는 창을 실제로 열면 월별 메뉴 사용 횟수에 포함하고, 팝업 차단으로 열리지 않으면 기록하지 않는다 | 사용자 | UC-510·ENT-530·SCR-512·TC-5105·공통 메뉴 진입 요건·ShellLayout·SLICE-516 | Small (프런트 집계 경로·규칙 시험) | A | 완료 |
| CR-016 | 2026-09-13 | Fix | 같은 즐겨찾기를 두 탭에서 동시에 등록해도 복합 PK 충돌을 오류로 내보내지 않고, 모두 성공·행 하나로 끝낸다 | 사용자 | UC-510·ENT-528·TC-5101·FavoriteService·SysUserFavoriteRepository·SLICE-515 | Small (동시 등록 저장소 계약·시험) | A | 완료 |
| CR-017 | 2026-09-13 | Fix | 같은 사용자의 동시 기본 조회조건 저장은 사용자 행 잠금으로 직렬화해 마지막 저장 완료 요청 하나만 기본으로 둔다 | 사용자 | UC-510·ENT-531·TC-5102·SearchCondService·SysUserRepository·SLICE-515 | Small (동시 기본값 잠금·시험) | A | 완료 |
| CR-018 | 2026-09-13 | Modify | 샘플 메뉴·API·도메인·프런트를 삭제 가능한 별도 sample 모듈로 분리하되 현재 외부 주소와 `SMPL_*` 시드·제거 절차는 유지한다 | 사용자 | ARCH-010·011·027, Gradle·ArchUnit·프런트 경계, 샘플 화면·API·도메인·시드·playbook 경로 | Medium (SLICE-518 신규) | A | 완료 |
| CR-019 | 2026-09-13 | Modify | 현재 최종 상태를 모듈별 Liquibase 기준선으로 재구성하고, sample은 local 변형에서만 코드·화면·API·시드를 포함한다. 현재 로컬 DB는 삭제·재생성한다 | 사용자 | ARCH-027·ADR-009·CR-018, Gradle·Vite·Liquibase·시드·sample 화면 문서·배포 안내 | Large (SLICE-518 재작업) | A | 완료 |
| CR-020 | 2026-09-13 | Add | 개발 중인 정본을 옮기거나 화면별 HTML을 중복 생성하지 않고, 설계·사용자·운영 세 오프라인 사이트와 선택 PDF로 고객 제출본을 만든다. 사용자 매뉴얼 그림은 의미 키로 목업에서 실제 캡처로 치환한다 | 사용자 | 산출물 지도·P6·화면 문서·doc-gen·manual-site·신규 runbook/deliverable-site 스킬·공통 HTML UI 키트 | Medium (문서 하네스 3개 작업 단위, 제품 슬라이스 0) | A | 완료 |
| CR-021 | 2026-09-14 | Fix | 서버 기동에는 활성 프로파일을 반드시 요구하고, local 프로파일에서만 sample 포함·프론트 생략을 기본으로 하며 다른 프로파일은 반대 기본값을 적용한다. 명시 옵션은 기본값보다 우선한다 | 사용자 | ARCH-027·TC-5036·Gradle 변형 판정·애플리케이션 기동 가드·개발·배포 안내 | Small (SLICE-519 신규) | A | 완료 |
| CR-022 | 2026-09-15 | Fix | 일부 운영 규칙만 확인한 admin P1 승인 상태를 되돌리고, 기존 admin 요구사항 전체를 P1 기준으로 다시 점검한다 | 사용자 | admin 작업흐름 P1 상태·다음 작업. 확정된 REQ-115·REQ-307 등 운영 규칙은 유지 | Small (문서 커버리지 점검, 구현 슬라이스 0) | A | 반영중 |

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
| CR-005 | 96 | 0 (+0.0%) | Add 0 / Modify 3 / Remove 0 / Fix 2 |
| CR-006 | 96 | 0 (+0.0%) | Add 0 / Modify 3 / Remove 0 / Fix 3 |
| CR-007 | 96 | 0 (+0.0%) | Add 0 / Modify 3 / Remove 0 / Fix 4 |
| CR-008 | 96 | 0 (+0.0%) | Add 0 / Modify 3 / Remove 0 / Fix 5 |
| CR-009 | 96 | 0 (+0.0%) | Add 0 / Modify 3 / Remove 0 / Fix 6 |
| CR-010 | 96 | 0 (+0.0%) | Add 0 / Modify 3 / Remove 0 / Fix 7 |
| CR-013 | 96 | 0 (+0.0%) | Add 0 / Modify 4 / Remove 0 / Fix 8 |
| CR-014 | 96 | 0 (+0.0%) | Add 0 / Modify 5 / Remove 0 / Fix 8 |
| CR-015 | 96 | 0 (+0.0%) | Add 0 / Modify 6 / Remove 0 / Fix 8 |
| CR-016 | 96 | 0 (+0.0%) | Add 0 / Modify 6 / Remove 0 / Fix 9 |
| CR-017 | 96 | 0 (+0.0%) | Add 0 / Modify 6 / Remove 0 / Fix 10 |
| CR-018 | 96 | 0 (+0.0%) | Add 0 / Modify 7 / Remove 0 / Fix 10 |
| CR-019 | 96 | 0 (+0.0%) | Add 0 / Modify 8 / Remove 0 / Fix 10 |
| CR-020 | 96 | 0 (+0.0%) | Add 1 / Modify 8 / Remove 0 / Fix 10 |
| CR-021 | 96 | 0 (+0.0%) | Add 1 / Modify 8 / Remove 0 / Fix 11 |
