# 요건 정의서 — 스키마 카탈로그

## 개요

- **무엇을 하는 화면인가**: 고객사가 공개할 테이블·뷰와 등록 컬럼의 구조·업무 의미·값 도메인·관계·필수 조회 제약을 후보로 작성한다.
- **프로세스상 위치**: (선행) 데이터소스·공개 대상 선정 → **이 화면의 초안/검수** → (후행) 자산 변경 세트의 요청·승인/전결·전체 반영.
- **이 데이터를 누가 쓰나**: 지식·인증 예제·agent 조회 계획. 현재 운영본·고정 후보·미완성 초안을 구분하며 현재 접근/정책을 별도 재검증한다.
- **바꾸면 어디가 흔들리나**: 연결 지식·인증 예제·관계·조회 제약의 의미와 참조 판. 원천 구조 정상만으로 업무 의미 변화가 없다고 판단하지 않는다.

> 미구현 설계 초안이다. [REQ-301/304/306](../../../../spec/10-requirements/007-knowledge-catalog.yaml), [FEAT-003/011](../../../../spec/31-features/002-admin.yaml), [카탈로그 저장/공개 계약](../../../../spec/50-api/005-admin-catalog-contracts.yaml)이 정본이다. 대상 시스템·데이터소스의 직접 변경 이력 방식을 승인 후보에 확대하지 않는다.

## 0. 메타

| 항목 | 값 |
|---|---|
| 화면 / 기능 / 유즈케이스 | SCR-003 / FEAT-003·FEAT-011 / UC-007·008·014·026 |
| 페이지 경로 | `/admin/hub/catalog` — 설계 경로 |
| 메뉴코드 / 상위 메뉴 | `HUB_CATALOG` / `HUB_INTEGRATION` — 설계값 |
| 프론트 폴더 | `sources/frontend/src/modules/admin/features/catalog/` — 예정 |
| 백엔드 패키지 | `sources/backend/modules/admin/src/main/java/com/aiagent/admin/` — 예정 |
| 화면 유형 | 마스터-디테일(상하) · 모든 정의는 그리드/셀 편집 |
| 처리 유형 | 현재 항목 조회 + 후보 전체 구성 편집 + 소유 변경 세트 인계 |
| 쓰는 액션 | READ · SAVE · EXECUTE(수동 샘플) · EXPORT, EXPORT_YN=Y. 원본/정책 권한은 별도 |
| 페이징 | 목록·판/관계·사용처·변경 근거 offset. 전체 후보 자식은 한 편집본으로 확보 |
| 문서 상태 | 초안 — 전체 화면 상세 승인/구현 승인 전 |

## 1. 화면 구성

```text
[조회조건 / 조회·신규·판 목록·후보 복사/저장·검증]
[카탈로그 목록 — 현재 1:1 항목, 전체 폭]
[상하 스플리터]
[후보 정의 · 컬럼·값 · 키·제약 · 권장 관계 · 접근 정책 · 관측·샘플 · 변경 근거 · 판 이력]
[선택 내용 판의 해당 그리드(들) — 전체 폭]
```

- 상단은 카탈로그 안정 항목의 현재 1:1 값이다. 운영 항목을 직접 편집하지 않는다. 내용 판은 카탈로그에 1:N이므로 하단 후보 정의 그리드에서 판의 1:1 속성을 편집한다. 기본정보 입력 폼은 없다.
- 같은 후보의 컬럼·값·키·제약·관리측 관계를 하나의 전체 편집본으로 보관한다. 탭별 저장/승인·원천 DDL 편집·전체 DB 자동 등록은 없다.
- 초기에는 현재 판을 읽기 전용으로 열고, 현재 판 없는 신규 항목은 판 목록에서 열람할 초안을 명시 선택한다. DRAFT는 현재 SAVE·소유·전체 구성 확보 후 후보 계속 편집으로 같은 revisionId의 편집을 재개한다. FROZEN/과거 판은 읽기 전용이며 복사로 연결한다. 최근 초안을 자동 편집하지 않는다.
- 과거 판은 동일한 전체 그리드/탭에서 읽기 전용으로 열람하고 상단에 현재 효력과 선택 판을 따로 표시한다. 후보 이름 변경도 실제 반영 전까지 상단 현재 이름을 바꾸지 않는다.
- 드문 속성은 그리드 설정에서 선택 표시한다. 원본 샘플은 일반 메타데이터 엑셀에 포함하지 않는다.

### 1-1. 마스터-디테일 연동

- catalogId로 현재 항목/판 목록을 읽고 catalogId+revisionId 소유를 검사해 전체 판을 확보한다. 일부 자식/그룹 참조를 읽지 못하면 전체 저장을 막고 이전 항목 값을 새 대상으로 남기지 않는다.
- STATE_VERSION(현재 포인터), EDIT_VERSION(후보 편집), revisionId(내용 판)를 구분한다. 편집은 DRAFT와 현재 SAVE/소유 권한에서만 허용한다. FROZEN과 과거 판은 새 초안 복사로 연결한다.
- 미저장 상태에서 행/판 전환·재조회·이탈은 확인하고 취소 시 입력을 유지한다. 탭 이동은 한 편집본을 유지한다. 저장/결과 불명 중 편집·신규·복사·근거 새 접수를 잠그고 원 키 확인/재시도만 허용한다.
- 판 이력은 선택/탭 진입 때 최신 판 순으로 자동 조회하며 탭 내부 검색조건/조회 버튼·하단 상세 폼은 없다. 변경 근거도 이 화면에서는 catalogId로 자동 최신 접수순 조회하며 별도 검색폼 없이 페이지 이동한다.
- 폐기 항목 이력 진입은 `?tab=history&catalogId={원ID}&revisionId={선택판ID}`를 사용한다. 현재 READ/보존 권한·소유·미저장 확인을 적용하고 현재 자식으로 과거 판을 재구성하지 않는다. 실제 UI 라우팅은 구현 시 공통 탭 상태와 연결한다.
- 접근 정책의 미결 후보/FK/현재 정책 계약, 요청/승인 원장, 원천 샘플 상한은 소유 설계에서 완성한다. 조회 실패를 빈 그룹·영향 없음·객체 없음으로 치환하지 않는다.

### 1-2. 목업 상태

| 그림 키 | 상태 | 상세 영역 | 안내 | 허용 버튼 | 편집 | 예시 변경 | 셀 편집 | 빈 그리드 |
|---|---|---|---|---|---|---|---| --- |
| main | 현재 운영본 열람 | 컬럼·값 | 현재 판 401 / 열람 판 401 FROZEN — 현재 운영본입니다. 변경은 별도 후보로 작성합니다. | 조회·판 목록·후보 복사·엑셀 다운로드 | 잠금 | 없음 | 없음 | 컬럼·값 / INLINE 값;컬럼·값 / CODE 조건 |
| draft | 후보 정의 편집 | 후보 정의 | 현재 판 401 / 열람 판 402 DRAFT — 초안 저장은 운영 반영이 아닙니다. 선택한 판 전체를 저장합니다. | 조회·후보 저장·편집 취소·검증 결과·엑셀 다운로드 | 가능 | 없음 | 없음 | 없음 |
| new | 공개 객체 신규 초안 | 후보 정의 | 현재 판 없음 / 신규 미저장 후보 — 선정한 정확 객체를 확인하고 미완성 초안을 저장할 수 있습니다. 미발급/미등록 표시는 화면 문구이며 서버 ID/상태값이 아닙니다. | 조회·객체 확인·신규 초안 저장·편집 취소·엑셀 다운로드 | 가능 | 카탈로그 ID=미발급;현재 객체명=미등록;현재 업무명=미등록;현재 내용 판=없음;효력 상태=미등록;반영 시각=미반영;열람 판 ID=미발급;편집 버전=미발급;기준 판=없음;상태 버전=미발급 | 없음 | 없음 |
| columns | 등록 컬럼과 값 도메인 | 컬럼·값 | 현재 판 401 / 열람 판 402 DRAFT — 자동 발견은 등록이 아닙니다. 코드와 열거 값은 해당 모드에서만 저장합니다. | 조회·후보 저장·컬럼 추가·컬럼 제거·편집 취소·엑셀 다운로드 | 가능 | 없음 | 없음 | 컬럼·값 / INLINE 값;컬럼·값 / CODE 조건 |
| constraints | 식별키와 필수 제약 | 키·제약 | 현재 판 401 / 열람 판 402 DRAFT — 복합 키 전체·기간 경계·단위와 검수 근거를 확인합니다. | 조회·후보 저장·키 추가·제약 추가·편집 취소·엑셀 다운로드 | 가능 | 없음 | 없음 | 없음 |
| joins | 관리측 관계 후보 | 권장 관계 | 현재 판 401 / 열람 판 402 DRAFT — 관리 카탈로그는 생성 시 선택·고정하며 두 역할과 전체 쌍을 보존합니다. | 조회·후보 저장·관계 추가·쌍 추가·편집 취소·엑셀 다운로드 | 가능 | 없음 | 없음 | 없음 |
| join-peer | 반대편에서 관계 조회 | 권장 관계 | 현재 판 401 / 열람 판 402 DRAFT — 같은 정본입니다. 변경은 관리 카탈로그의 편집 후보로 이동합니다. | 조회·관리측 후보 열기·엑셀 다운로드 | 잠금 | 관리 카탈로그=302 | 없음 | 없음 |
| self-join | 자기조인 두 역할 | 권장 관계 | 현재 판 401 / 열람 판 402 DRAFT — 같은 객체여도 두 역할과 방향 컬럼쌍을 합치지 않습니다. | 조회·후보 저장·쌍 추가·편집 취소·엑셀 다운로드 | 가능 | 오른쪽 객체=301;오른쪽 참조 판=402;왼쪽 역할=주문;오른쪽 역할=원 주문 | 없음 | 없음 |
| policy | 그룹 후보·현재 정책 확인 | 접근 정책 | 현재 판 401 / 열람 판 402 DRAFT — 소유 계약 확정 전입니다. 확인 불가를 빈 그룹이나 상속 해제로 저장하지 않습니다. | 조회·엑셀 다운로드 | 잠금 | 없음 | 없음 | 없음 |
| observation | 선정 객체 구조 관측 | 관측·샘플 | 현재 판 401 / 열람 판 402 DRAFT — 원천 사실과 코멘트 제안은 검수 자료입니다. 원본 값 샘플은 별도 실행입니다. | 조회·구조 확인·엑셀 다운로드 | 잠금 | 없음 | 없음 | 없음 |
| partial | 부분 관측 | 관측·샘플 | 현재 판 401 / 열람 판 402 DRAFT — 누락 범위가 있습니다. 관측 실패로 등록 컬럼을 삭제하지 않습니다. | 조회·구조 확인·엑셀 다운로드 | 잠금 | 관측 완전성=PARTIAL;구조 차이=일부 컬럼 확인 불가 | 없음 | 없음 |
| sample-disabled | 샘플 실행 대기 | 관측·샘플 | 현재 판 401 / 열람 판 402 DRAFT — 상한/권한/개인정보 제외 계약을 확정하기 전에는 샘플을 실행할 수 없습니다. | 조회·엑셀 다운로드 | 잠금 | 없음 | 없음 | 없음 |
| evidence | 근거와 영향 조회 | 변경 근거 | 현재 판 401 / 열람 판 402 DRAFT — 구조 변화 없음과 업무 의미 변화 없음은 다릅니다. 지식 직접/예제 경유 영향을 확인합니다. | 조회·근거 접수·근거 상세·사용처·엑셀 다운로드 | 잠금 | 없음 | 없음 | 없음 |
| history | 내용 판 이력 | 판 이력 | 현재 판 401 / 열람 판 401 FROZEN — 최신 판 순으로 자동 조회합니다. 과거 전체 구성은 같은 그리드/탭에서 읽기 전용으로 열람합니다. | 조회·판 열람·엑셀 다운로드 | 잠금 | 없음 | 없음 | 없음 |
| frozen | 고정 후보 잠금 | 후보 정의 | 현재 판 401 / 열람 판 402 FROZEN — 고정 후보는 수정할 수 없습니다. 새 초안으로 복사합니다. | 조회·후보 복사·변경 세트 열기·엑셀 다운로드 | 잠금 | 판 상태=FROZEN | 없음 | 없음 |
| rename | 동일 객체 이름 변경 후보 | 후보 정의 | 현재 판 401 / 열람 판 402 DRAFT — 기존 안정 ID를 유지하려면 동일 실체의 근거와 반영 직전 재검증이 필요합니다. | 조회·객체 확인·후보 저장·편집 취소·엑셀 다운로드 | 가능 | 후보 객체명=sales_orders;동일 객체 근거=고객사 변경 통지와 원천 동일성 확인 대기 | 없음 | 없음 |
| invalid | 초안 오류 | 후보 정의 | 현재 판 401 / 열람 판 402 DRAFT — 존재하지 않는 참조·중복 구성·소유 불일치는 초안이라도 저장할 수 없습니다. | 조회·후보 저장·편집 취소·엑셀 다운로드 | 가능 | 메타데이터 검수=INVALID | 없음 | 없음 |
| conflict | 편집 버전 충돌 | 후보 정의 | 현재 판 401 / 열람 판 402 DRAFT — 입력을 보존합니다. 다른 편집본과 자동 병합하지 않습니다. | 최신 판 조회 | 잠금 | 없음 | 없음 | 없음 |
| unknown | 초안 저장 결과 불명 | 후보 정의 | 현재 판 401 / 열람 판 402 DRAFT — 원 키와 전체 입력을 유지하고 결과를 확인합니다. 새 초안이나 새 키를 만들지 않습니다. | 결과 확인·같은 입력 재시도 | 잠금 | 없음 | 없음 | 없음 |
| readonly | 읽기 전용 | 컬럼·값 | 현재 판 401 / 열람 판 401 FROZEN — 조회 권한으로 의미·정책·원본 값을 변경/실행할 수 없습니다. | 조회·판 목록·엑셀 다운로드 | 잠금 | 없음 | 없음 | 컬럼·값 / INLINE 값;컬럼·값 / CODE 조건 |
| no-export | 반출 권한 없음 | 컬럼·값 | 현재 판 401 / 열람 판 401 FROZEN — 조회는 가능하며 엑셀 다운로드는 허용되지 않습니다. | 조회·판 목록 | 잠금 | 없음 | 없음 | 컬럼·값 / INLINE 값;컬럼·값 / CODE 조건 |
| empty | 목록 없음 | 없음 | 대상 미선택 — 공개 객체가 등록되지 않았습니다. 전체 DB를 자동 수집하지 않습니다. | 조회·신규·엑셀 다운로드 | 잠금 | 없음 | 없음 | 없음 |
| denied | 조회 권한 없음 | 없음 | 대상 미선택 — 이 화면을 조회할 권한이 없습니다. | 없음 | 잠금 | 없음 | 없음 | 없음 |
| resume-draft | 저장한 후보 재진입 | 판 이력 | 현재 판 401 / 열람 판 402 DRAFT — DRAFT를 명시 선택하고 현재 SAVE·소유·전체 구성을 확인하면 같은 판의 편집을 계속할 수 있습니다. | 조회·판 열람·후보 계속 편집·엑셀 다운로드 | 잠금 | 판 상태=DRAFT;내용 판=402;구성 상태=DRAFT;판 순번=2;기준 내용 판=401 | 없음 | 없음 |
| inline | INLINE 컬럼의 값 편집 | 컬럼·값 | 현재 판 401 / 열람 판 402 DRAFT — 선택한 INLINE 컬럼의 열거 값만 표시하며 CODE 조건은 비웁니다. | 조회·후보 저장·편집 취소·엑셀 다운로드 | 가능 | 컬럼 ID=503;컬럼명=order_status;원천 자료형=varchar;컬럼 업무명=주문 상태;의미 유형=CODE;의미 검수=UNKNOWN;값 방식=INLINE;값 검수=UNKNOWN | 없음 | 컬럼·값 / CODE 조건 |
| code | CODE 컬럼의 조건 편집 | 컬럼·값 | 현재 판 401 / 열람 판 402 DRAFT — 같은 데이터소스의 정확 코드 판·컬럼·AND 조건만 표시하며 INLINE 값은 비웁니다. | 조회·후보 저장·편집 취소·엑셀 다운로드 | 가능 | 컬럼 ID=503;컬럼명=order_status;원천 자료형=varchar;컬럼 업무명=주문 상태;의미 유형=CODE;의미 검수=UNKNOWN;값 방식=CODE;코드 카탈로그=351;코드 판=451;코드 값 컬럼=551;코드명 컬럼=552;조건 컬럼=553;값 검수=UNKNOWN | 없음 | 컬럼·값 / INLINE 값 |
| join-incomplete | 관계 쌍 미완성 초안 | 권장 관계 | 현재 판 401 / 열람 판 402 DRAFT — 쌍 목록 0개와 누락 사유·UNKNOWN으로 초안 저장하며 검수 완료/운영 경로로 사용하지 않습니다. | 조회·후보 저장·쌍 추가·편집 취소·엑셀 다운로드 | 가능 | 관계 검수=UNKNOWN;관계 원천 근거=컬럼 대응 확인 필요 | 없음 | 권장 관계 / 방향 컬럼쌍 |

## 2. 조회조건

| 조건 | 대상 컬럼 | 필드명 | 입력방식 | 연산 | 필수 | 기본값 | 선택 출처 | 라벨 키 |
|---|---|---|---|---|---|---|---|---|
| 데이터소스 | DATA_SOURCE_ID | dataSourceId | 텍스트 | eq | 선택 | 없음 | 현재 READ 범위의 데이터소스 후보; 원천 계약 후속 | MSG.ADMIN_CATALOG_DATA_SOURCE |
| 업무명 | BUSINESS_NAME | businessName | 텍스트 | contains | 선택 | 없음 | 직접 입력 | MSG.ADMIN_CATALOG_BUSINESS_NAME |
| 효력 상태 | LIFECYCLE_CD | lifecycle | 셀렉트 | eq | 선택 | 없음 | 상수 DRAFT·ACTIVE·RETIRED | MSG.ADMIN_CATALOG_LIFECYCLE |

## 3. 조회 — 테이블과 범위

### 3-1. 사용 테이블 · 결합

| 영역 | 테이블/원천 | 결합 기준 |
|---|---|---|
| 현재 항목 | AI_ADMIN_CATALOG_ENTRY | CATALOG_ID; DATA_SOURCE_ID의 현재 권한/관측은 별도 |
| 선택 내용 판 | AI_ADMIN_CATALOG_REVISION | CATALOG_ID+REVISION_ID 소유 검사 |
| 컬럼/구성 ID | AI_ADMIN_CATALOG_COLUMN / AI_ADMIN_CATALOG_MEMBER | REVISION_ID 및 CATALOG_ID·MEMBER_KIND 소유 |
| 값/키/제약 | AI_ADMIN_CATALOG_KEY / AI_ADMIN_CATALOG_KEY_COLUMN / AI_ADMIN_CATALOG_INLINE_VALUE / AI_ADMIN_CAT_CODE_CONDITION / AI_ADMIN_QUERY_CONSTRAINT / AI_ADMIN_CAT_ALTERNATIVE_KEY | 선택 판 및 키/컬럼/제약의 소유·전체 순서 |
| 관계/컬럼쌍 | AI_ADMIN_CAT_JOIN_RELATION / AI_ADMIN_CATALOG_JOIN_PAIR | 관리 카탈로그·판·관계 ID; 반대편 동일 정본 조회 |
| 근거/대상/명령 | AI_ADMIN_CATALOG_EVIDENCE / AI_ADMIN_CAT_EVIDENCE_TARGET / AI_ADMIN_CATALOG_EDIT_COMMAND | 원 evidenceId/commandKey와 현재 권한·주체 |
| 정책/반영 원장 | FEAT-007/012/014/036/040 소유 공개 계약 | 현재 정책과 당시 근거·실제 세트 결과 분리; 물리 참조 미결 |

### 3-2. 고정 조건 · 기본 정렬

- API-019의 허용 필터/정렬·PageSpec을 사용한다. RETIRED는 현재 기록 보존 권한이 있어야 보인다. 판 목록은 최신 revisionNo와 revisionId 내림차순으로 표시한다. API-021의 정렬 계약도 같은 기준으로 확정한다.
- 변경 근거는 receivedAt/evidenceId 내림차순이다. 목록의 비노출 사용처는 서버의 전체 참조 보호에서 제외하지 않는다.

## 4. 컬럼

### 4-1. 표시 · 입력 항목

DTO의 자식 필드명은 아래 표시 매핑 초안이다. 전체 CatalogComposition의 자료형/소유는 공개 계약을 따르며 실제 DTO·코드값·메시지는 구현 전 정합화한다. 예시의 코드 표시는 실제 공통코드 확정을 대신하지 않는다.

#### 카탈로그 목록

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 카탈로그 ID | `MSG.ADMIN_CATALOG_CATALOGID` | `CATALOG_ID` | `catalogId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 301 | — | 표시 |
| 데이터소스 | `MSG.ADMIN_CATALOG_DATASOURCEID` | `DATA_SOURCE_ID` | `dataSourceId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 101 | — | 표시 |
| 현재 객체명 | `MSG.ADMIN_CATALOG_OBJECTNAME` | `OBJECT_NAME` | `objectName` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | orders | — | 표시 |
| 현재 업무명 | `MSG.ADMIN_CATALOG_BUSINESSNAME` | `BUSINESS_NAME` | `businessName` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 주문 | — | 표시 |
| 효력 상태 | `MSG.ADMIN_CATALOG_LIFECYCLE` | `LIFECYCLE_CD` | `lifecycle` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | ACTIVE | — | 표시 |
| 현재 내용 판 | `MSG.ADMIN_CATALOG_CURRENTREVISIONID` | `CURRENT_REVISION_ID` | `currentRevisionId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 401 | — | 표시 |
| 상태 버전 | `MSG.ADMIN_CATALOG_STATEVERSION` | `STATE_VERSION` | `stateVersion` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 내용 판 편집 버전과 구분 | 3 | — | 선택 표시 |
| 서버 한정자 | `MSG.ADMIN_CATALOG_SERVERNAME` | `SERVER_NAME` | `serverName` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 미확인과 해당 없음 구분 | 해당 없음 | — | 선택 표시 |
| DB·카탈로그 | `MSG.ADMIN_CATALOG_DATABASENAME` | `DATABASE_NAME` | `databaseName` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 정확 이름 | erp | — | 선택 표시 |
| DB 스키마 | `MSG.ADMIN_CATALOG_SCHEMANAME` | `SCHEMA_NAME` | `schemaName` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 기본 스키마도 실제 이름 | sales | — | 선택 표시 |
| 식별 규칙 | `MSG.ADMIN_CATALOG_IDENTITYPROFILE` | `IDENTITY_PROFILE` | `identityProfile` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 원천 식별 규칙 버전 | postgres-v1 | — | 선택 표시 |
| 반영 시각 | `MSG.ADMIN_CATALOG_APPLIEDAT` | `APPLIED_DTM` | `appliedAt` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 서버 근거 | 2026-10-29 10:00 | — | 선택 표시 |

#### 후보 정의

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 열람 판 ID | `MSG.ADMIN_CATALOG_REVISIONID` | `REVISION_ID` | `revisionId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 402 | — | 표시 |
| 판 상태 | `MSG.ADMIN_CATALOG_CONTENTSTATE` | `CONTENT_STATE` | `contentState` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | DRAFT | — | 표시 |
| 편집 버전 | `MSG.ADMIN_CATALOG_EDITVERSION` | `EDIT_VERSION` | `editVersion` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 2 | — | 표시 |
| 기준 판 | `MSG.ADMIN_CATALOG_BASEREVISIONID` | `BASE_REVISION_ID` | `baseRevisionId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 기준 운영본 고정 | 401 | — | 선택 표시 |
| 반영 의도 | `MSG.ADMIN_CATALOG_INTENT` | `INTENT_CD` | `intent` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | PUBLISH/RETIRE; 복원은 새 판 복사로 작성 | PUBLISH | — | 표시 |
| 후보 업무명 | `MSG.ADMIN_CATALOG_VALUES_BUSINESSNAME` | `BUSINESS_NAME` | `values.businessName` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 주문 내역 | — | 표시 |
| 후보 객체명 | `MSG.ADMIN_CATALOG_VALUES_OBJECTNAME` | `OBJECT_NAME` | `values.objectName` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 정확 객체 확인·이름 변경은 동일성 근거 필수 | orders | — | 표시 |
| 객체 유형 | `MSG.ADMIN_CATALOG_VALUES_OBJECTTYPE` | `OBJECT_TYPE` | `values.objectType` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | TABLE/VIEW는 중복 회피 키가 아님 | TABLE | — | 선택 표시 |
| 후보 서버 | `MSG.ADMIN_CATALOG_VALUES_SERVERNAME` | `SERVER_NAME` | `values.serverName` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 원천 차원 상태 확인 | 해당 없음 | — | 선택 표시 |
| 후보 DB | `MSG.ADMIN_CATALOG_VALUES_DATABASENAME` | `DATABASE_NAME` | `values.databaseName` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 정확 객체 확인 | erp | — | 선택 표시 |
| 후보 스키마 | `MSG.ADMIN_CATALOG_VALUES_SCHEMANAME` | `SCHEMA_NAME` | `values.schemaName` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 실제 스키마 명시 | sales | — | 선택 표시 |
| 후보 설명 | `MSG.ADMIN_CATALOG_VALUES_DESCRIPTION` | `DESCRIPTION` | `values.description` | 장문 셀 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 미완성은 사용 제외 | 주문별 현재 업무 상태와 고객을 설명합니다. | — | 선택 표시 |
| 조회 제약 상태 | `MSG.ADMIN_CATALOG_VALUES_CONSTRAINTSTATE` | `CONSTRAINT_STATE` | `values.constraintState` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 미확인과 검수된 제약 없음 구분 | UNKNOWN | — | 선택 표시 |
| 메타데이터 검수 | `MSG.ADMIN_CATALOG_VALUES_REVIEWSTATUS` | `REVIEW_STATUS` | `values.reviewStatus` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | VERIFIED는 서버 필수 검증 후 확정 | UNKNOWN | — | 표시 |
| 검수 근거 | `MSG.ADMIN_CATALOG_VALUES_REVIEWEVIDENCE` | `REVIEW_EVIDENCE` | `values.reviewEvidence` | 장문 셀 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 검수 의도·근거 전달; 검수자/시각은 서버 | 업무 담당자 확인 대기 | — | 선택 표시 |
| 동일 객체 근거 | `MSG.ADMIN_CATALOG_VALUES_IDENTITYEVIDENCE` | `IDENTITY_EVIDENCE` | `values.identityEvidence` | 장문 셀 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 이름 변경/복원은 동일 실체 확인; 삭제 재생성 자동 승계 금지 | 미지정 | — | 선택 표시 |
| 변경 사유 | `MSG.ADMIN_CATALOG_REASON` | `CHANGE_REASON` | `reason` | 장문 셀 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 비공백 사유 | 주문 상태 의미 보완 | — | 선택 표시 |
| 검수자 | `MSG.ADMIN_CATALOG_REVIEWERID` | `REVIEWER_ID` | `reviewerId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 서버 근거 | 미확인 | — | 선택 표시 |
| 고정 시각 | `MSG.ADMIN_CATALOG_FROZENAT` | `FROZEN_DTM` | `frozenAt` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 고정은 세트 소유 | 미고정 | — | 선택 표시 |
| 복원 원본 판 | `MSG.ADMIN_CATALOG_RESTOREREVISIONID` | `RESTORE_REVISION_ID` | `restoreRevisionId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 옛 판 복사 근거; 현재 기준 판과 구분 | 미지정 | — | 선택 표시 |

#### 컬럼·값 / 등록 컬럼

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 컬럼 ID | `MSG.ADMIN_CATALOG_COLUMNID` | `COLUMN_ID` | `columnId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 501 | — | 표시 |
| 컬럼명 | `MSG.ADMIN_CATALOG_COLUMNNAME` | `COLUMN_NAME` | `columnName` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | order_id | — | 표시 |
| 원천 자료형 | `MSG.ADMIN_CATALOG_SOURCETYPE` | `SOURCE_TYPE` | `sourceType` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | bigint | — | 표시 |
| NULL 허용 | `MSG.ADMIN_CATALOG_NULLABLE` | `NULLABLE_CD` | `nullable` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | NO | — | 표시 |
| 컬럼 업무명 | `MSG.ADMIN_CATALOG_COLUMNBUSINESSNAME` | `BUSINESS_NAME` | `columnBusinessName` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 주문 번호 | — | 표시 |
| 의미 유형 | `MSG.ADMIN_CATALOG_SEMANTICTYPE` | `SEMANTIC_TYPE` | `semanticType` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | IDENTIFIER | — | 표시 |
| 의미 검수 | `MSG.ADMIN_CATALOG_COLUMNREVIEWSTATUS` | `REVIEW_STATUS` | `columnReviewStatus` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 내용 변경 시 의존 검수 무효화 | VERIFIED | — | 표시 |
| 값 방식 | `MSG.ADMIN_CATALOG_VALUEMODE` | `VALUE_MODE` | `valueMode` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | NONE/UNKNOWN/CODE/INLINE | NONE | — | 표시 |
| 컬럼 설명 | `MSG.ADMIN_CATALOG_COLUMNDESCRIPTION` | `DESCRIPTION` | `columnDescription` | 장문 셀 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 이름/값 모양으로 의미 추정 금지 | 주문을 유일하게 식별합니다. | — | 선택 표시 |
| 해석 형식 | `MSG.ADMIN_CATALOG_VALUEFORMAT` | `VALUE_FORMAT` | `valueFormat` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 필요한 날짜/일시 형식 | 해당 없음 | — | 선택 표시 |
| 컬럼 시간대 | `MSG.ADMIN_CATALOG_COLUMNTIMEZONEID` | `TIME_ZONE_ID` | `columnTimeZoneId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 필요한 시간대; 임의 기본값 없음 | 미지정 | — | 선택 표시 |
| 단위 | `MSG.ADMIN_CATALOG_UNITCODE` | `UNIT_CD` | `unitCode` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 필요한 단위 | 해당 없음 | — | 선택 표시 |
| 코드 카탈로그 | `MSG.ADMIN_CATALOG_CODECATALOGID` | `CODE_CATALOG_ID` | `codeCatalogId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 같은 데이터소스의 공개 정확 판 | 미지정 | — | 선택 표시 |
| 코드 판 | `MSG.ADMIN_CATALOG_CODEREVISIONID` | `CODE_REVISION_ID` | `codeRevisionId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | CODE 모드에서만 참조 | 미지정 | — | 선택 표시 |
| 코드 값 컬럼 | `MSG.ADMIN_CATALOG_CODEVALUECOLUMNID` | `CODE_VALUE_COLUMN_ID` | `codeValueColumnId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 정확한 등록 컬럼 | 미지정 | — | 선택 표시 |
| 코드명 컬럼 | `MSG.ADMIN_CATALOG_CODENAMECOLUMNID` | `CODE_NAME_COLUMN_ID` | `codeNameColumnId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 정확한 등록 컬럼 | 미지정 | — | 선택 표시 |
| 값 검수 | `MSG.ADMIN_CATALOG_VALUEREVIEWSTATUS` | `VALUE_REVIEW_STATUS` | `valueReviewStatus` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 빈 INLINE/무효 CODE는 VERIFIED 불가 | UNKNOWN | — | 선택 표시 |
| 컬럼 검수 근거 | `MSG.ADMIN_CATALOG_COLUMNREVIEWEVIDENCE` | `REVIEW_EVIDENCE` | `columnReviewEvidence` | 장문 셀 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 서버 검수 | 업무 키 확인 | — | 선택 표시 |
| 값 검수 근거 | `MSG.ADMIN_CATALOG_VALUEREVIEWEVIDENCE` | `VALUE_REVIEW_EVIDENCE` | `valueReviewEvidence` | 장문 셀 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 서버 검수 | 미확인 | — | 선택 표시 |
| 컬럼 동일성 근거 | `MSG.ADMIN_CATALOG_COLUMNIDENTITYEVIDENCE` | `IDENTITY_EVIDENCE` | `columnIdentityEvidence` | 장문 셀 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 동명 발견만으로 이전 ID 배정 금지 | 미지정 | — | 선택 표시 |

#### 컬럼·값 / INLINE 값

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 대상 컬럼 | `MSG.ADMIN_CATALOG_INLINECOLUMNID` | `COLUMN_ID` | `inlineColumnId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 503 | — | 표시 |
| 값 순서 | `MSG.ADMIN_CATALOG_VALUENO` | `VALUE_NO` | `valueNo` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 1 | — | 표시 |
| 값 유형 | `MSG.ADMIN_CATALOG_VALUETYPE` | `VALUE_TYPE` | `valueType` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | STRING | — | 표시 |
| 정형 값 | `MSG.ADMIN_CATALOG_VALUETEXT` | `VALUE_TEXT` | `valueText` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | READY | — | 표시 |
| 값 의미 | `MSG.ADMIN_CATALOG_VALUEMEANING` | `VALUE_MEANING` | `valueMeaning` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 접수 완료 | — | 표시 |

#### 컬럼·값 / CODE 조건

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 코드 판 | `MSG.ADMIN_CATALOG_CONDITIONCODEREVISIONID` | `CODE_REVISION_ID` | `conditionCodeRevisionId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 451 | — | 표시 |
| 조건 컬럼 | `MSG.ADMIN_CATALOG_CONDITIONCOLUMNID` | `TARGET_COLUMN_ID` | `conditionColumnId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 551 | — | 표시 |
| 조건 타입 | `MSG.ADMIN_CATALOG_CONDITIONVALUETYPE` | `VALUE_TYPE` | `conditionValueType` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | STRING | — | 표시 |
| 조건 값 | `MSG.ADMIN_CATALOG_CONDITIONVALUETEXT` | `VALUE_TEXT` | `conditionValueText` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | AND 동등 조건만 허용; NULL/임의 SQL 금지 | ORDER_STATUS | — | 표시 |

#### 키·제약 / 식별키

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 키 번호 | `MSG.ADMIN_CATALOG_KEYNO` | `KEY_NO` | `keyNo` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 1 | — | 표시 |
| 키 종류 | `MSG.ADMIN_CATALOG_KEYKIND` | `KEY_KIND` | `keyKind` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | PRIMARY | — | 표시 |
| 원천 키명 | `MSG.ADMIN_CATALOG_KEYSOURCENAME` | `SOURCE_NAME` | `keySourceName` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | orders_pk | — | 표시 |
| 키 검수 | `MSG.ADMIN_CATALOG_KEYREVIEWSTATUS` | `REVIEW_STATUS` | `keyReviewStatus` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 전체 등록 구성으로 검수 | VERIFIED | — | 표시 |
| 키 근거 | `MSG.ADMIN_CATALOG_KEYREVIEWEVIDENCE` | `REVIEW_EVIDENCE` | `keyReviewEvidence` | 장문 셀 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 원천 구조 확인 | — | 표시 |

#### 키·제약 / 키 구성

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 구성 키 | `MSG.ADMIN_CATALOG_MEMBERKEYNO` | `KEY_NO` | `memberKeyNo` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 1 | — | 표시 |
| 키 내 순서 | `MSG.ADMIN_CATALOG_POSITIONNO` | `POSITION_NO` | `positionNo` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 1 | — | 표시 |
| 구성 컬럼 | `MSG.ADMIN_CATALOG_KEYCOLUMNID` | `COLUMN_ID` | `keyColumnId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 복합 키 전체·순서·중복 검사 | 501 | — | 표시 |

#### 키·제약 / 기간 제약

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 제약 ID | `MSG.ADMIN_CATALOG_CONSTRAINTID` | `CONSTRAINT_ID` | `constraintId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 601 | — | 표시 |
| 제약명 | `MSG.ADMIN_CATALOG_CONSTRAINTNAME` | `BUSINESS_NAME` | `constraintName` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 주문일 기간 | — | 표시 |
| 규칙 | `MSG.ADMIN_CATALOG_RULEKIND` | `RULE_KIND` | `ruleKind` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | PERIOD_MAX | — | 표시 |
| 기간 컬럼 | `MSG.ADMIN_CATALOG_PERIODCOLUMNID` | `PERIOD_COLUMN_ID` | `periodColumnId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 502 | — | 표시 |
| 최대 범위 | `MSG.ADMIN_CATALOG_MAXSPAN` | `MAX_SPAN` | `maxSpan` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 31 | — | 표시 |
| 범위 단위 | `MSG.ADMIN_CATALOG_SPANUNIT` | `SPAN_UNIT` | `spanUnit` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | CALENDAR_DAY/ELAPSED_SECOND; 월수 임의 변환 금지 | CALENDAR_DAY | — | 표시 |
| 제약 검수 | `MSG.ADMIN_CATALOG_CONSTRAINTREVIEWSTATUS` | `REVIEW_STATUS` | `constraintReviewStatus` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | UNKNOWN | — | 표시 |
| 제약 사유 | `MSG.ADMIN_CATALOG_CONSTRAINTREASON` | `REASON` | `constraintReason` | 장문 셀 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 제약별 사유 | 기간을 제한해 업무 조회를 안정화합니다. | — | 선택 표시 |
| 기간 형식 | `MSG.ADMIN_CATALOG_PERIODFORMAT` | `VALUE_FORMAT` | `periodFormat` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 열의 실제 해석 형식 | yyyy-MM-dd | — | 선택 표시 |
| 기간 시간대 | `MSG.ADMIN_CATALOG_PERIODTIMEZONEID` | `TIME_ZONE_ID` | `periodTimeZoneId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 기준 미확인 시 사용 불가 | Asia/Seoul | — | 선택 표시 |
| 시작 경계 | `MSG.ADMIN_CATALOG_STARTBOUND` | `START_BOUND` | `startBound` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 실제 허용 코드는 DTO 계약 확정 후 연결 | INCLUSIVE | — | 선택 표시 |
| 끝 경계 | `MSG.ADMIN_CATALOG_ENDBOUND` | `END_BOUND` | `endBound` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 경계 포함/제외 명시 | EXCLUSIVE | — | 선택 표시 |
| 제약 근거 | `MSG.ADMIN_CATALOG_CONSTRAINTREVIEWEVIDENCE` | `REVIEW_EVIDENCE` | `constraintReviewEvidence` | 장문 셀 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 임의 SQL 없음 | 업무 검수 대기 | — | 선택 표시 |

#### 키·제약 / 대체 식별키

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 대상 제약 | `MSG.ADMIN_CATALOG_ALTERNATIVECONSTRAINTID` | `CONSTRAINT_ID` | `alternativeConstraintId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 601 | — | 표시 |
| 대체 키 | `MSG.ADMIN_CATALOG_ALTERNATIVEKEYNO` | `KEY_NO` | `alternativeKeyNo` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 검수된 정확 전체 키 하나; 부분 키로 기간 제약 면제 금지 | 1 | — | 표시 |

#### 권장 관계 / 관계 정의

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 관계 ID | `MSG.ADMIN_CATALOG_RELATIONID` | `RELATION_ID` | `relationId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 701 | — | 표시 |
| 관리 카탈로그 | `MSG.ADMIN_CATALOG_MANAGINGCATALOGID` | `CATALOG_ID` | `managingCatalogId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 301 | — | 표시 |
| 왼쪽 객체 | `MSG.ADMIN_CATALOG_LEFTCATALOGID` | `LEFT_CATALOG_ID` | `leftCatalogId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 301 | — | 표시 |
| 왼쪽 역할 | `MSG.ADMIN_CATALOG_LEFTROLENAME` | `LEFT_ROLE_NAME` | `leftRoleName` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 주문 | — | 표시 |
| 오른쪽 객체 | `MSG.ADMIN_CATALOG_RIGHTCATALOGID` | `RIGHT_CATALOG_ID` | `rightCatalogId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 302 | — | 표시 |
| 오른쪽 역할 | `MSG.ADMIN_CATALOG_RIGHTROLENAME` | `RIGHT_ROLE_NAME` | `rightRoleName` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 고객 | — | 표시 |
| 대응 수 | `MSG.ADMIN_CATALOG_CARDINALITY` | `CARDINALITY_CD` | `cardinality` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | UNKNOWN/ONE_ONE/ONE_MANY/MANY_ONE; 각각 미확인/1:1/1:N/N:1 | MANY_ONE | — | 표시 |
| 관계 검수 | `MSG.ADMIN_CATALOG_RELATIONREVIEWSTATUS` | `REVIEW_STATUS` | `relationReviewStatus` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 집계 중복 위험 확인 | UNKNOWN | — | 표시 |
| 왼쪽 참조 판 | `MSG.ADMIN_CATALOG_LEFTREVISIONID` | `LEFT_REVISION_ID` | `leftRevisionId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 자기/같은 세트 후보·외부 유효본 구분 | 402 | — | 선택 표시 |
| 오른쪽 참조 판 | `MSG.ADMIN_CATALOG_RIGHTREVISIONID` | `RIGHT_REVISION_ID` | `rightRevisionId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 현재 접근/정합성 검증 | 421 | — | 선택 표시 |
| 관계 설명 | `MSG.ADMIN_CATALOG_RELATIONDESCRIPTION` | `DESCRIPTION` | `relationDescription` | 장문 셀 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 두 역할 유지 | 주문 고객을 연결합니다. | — | 선택 표시 |
| 원천 종류 | `MSG.ADMIN_CATALOG_ORIGINKIND` | `ORIGIN_KIND` | `originKind` | 선택 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 물리 FK/검수한 논리 관계 | LOGICAL | — | 선택 표시 |
| 관계 원천 근거 | `MSG.ADMIN_CATALOG_ORIGINEVIDENCE` | `ORIGIN_EVIDENCE` | `originEvidence` | 장문 셀 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 동명 컬럼 자동 확정 금지 | 고객 식별 의미 확인 대기 | — | 선택 표시 |
| 관계 검수 근거 | `MSG.ADMIN_CATALOG_RELATIONREVIEWEVIDENCE` | `REVIEW_EVIDENCE` | `relationReviewEvidence` | 장문 셀 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 1:N DISTINCT로 위험 숨기기 금지 | 미확인 | — | 선택 표시 |

#### 권장 관계 / 방향 컬럼쌍

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 쌍의 관계 | `MSG.ADMIN_CATALOG_PAIRRELATIONID` | `RELATION_ID` | `pairRelationId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 701 | — | 표시 |
| 쌍 순서 | `MSG.ADMIN_CATALOG_PAIRNO` | `PAIR_NO` | `pairNo` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 1 | — | 표시 |
| 왼쪽 컬럼 | `MSG.ADMIN_CATALOG_LEFTCOLUMNID` | `LEFT_COLUMN_ID` | `leftColumnId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 504 | — | 표시 |
| 오른쪽 컬럼 | `MSG.ADMIN_CATALOG_RIGHTCOLUMNID` | `RIGHT_COLUMN_ID` | `rightColumnId` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 521 | — | 표시 |

#### 접근 정책

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 그룹 후보 계약 | `MSG.ADMIN_CATALOG_GROUPCANDIDATESTATE` | `POLICY_REFERENCES` | `groupCandidateState` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 소유 계약 확인 대기 | — | 표시 |
| 당시 정책 참조 | `MSG.ADMIN_CATALOG_HISTORICALPOLICYSTATE` | `POLICY_REFERENCES` | `historicalPolicyState` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 당시 근거·현재 인가와 별개 | — | 표시 |
| 현재 개인정보 | `MSG.ADMIN_CATALOG_PRIVACYSTATE` | `정책 원천` | `privacyState` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 현재 정책 원천에서 확인 | — | 표시 |
| 정책 소유 | `MSG.ADMIN_CATALOG_POLICYOWNER` | `소유 계약` | `policyOwner` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 접근 정책 영역 | — | 표시 |

#### 접근 정책 / 컬럼 개인정보

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 정책 대상 컬럼 | `MSG.ADMIN_CATALOG_PRIVACYCOLUMNID` | `정책 원천` | `privacyColumnId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 501 | — | 표시 |
| 개인정보 분류 | `MSG.ADMIN_CATALOG_PRIVACYCLASSIFICATION` | `정책 원천` | `privacyClassification` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 확인 대기 | — | 표시 |
| 식별 용도 | `MSG.ADMIN_CATALOG_IDENTIFICATIONPURPOSE` | `정책 원천` | `identificationPurpose` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 확인 대기 | — | 표시 |
| 마스킹 참조 | `MSG.ADMIN_CATALOG_MASKINGREFERENCE` | `정책 원천` | `maskingReference` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 확인 대기 | — | 표시 |
| 개인정보 검수 | `MSG.ADMIN_CATALOG_PRIVACYREVIEWSTATUS` | `정책 원천` | `privacyReviewStatus` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 확인 대기 | — | 표시 |

#### 관측·샘플 / 구조 관측

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 객체 해석 | `MSG.ADMIN_CATALOG_RESOLUTIONSTATE` | `관측 응답` | `resolutionState` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | RESOLVED | — | 표시 |
| 관측 완전성 | `MSG.ADMIN_CATALOG_OBSERVATIONSTATUS` | `관측 응답` | `observationStatus` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | COMPLETE | — | 표시 |
| 관측 객체 | `MSG.ADMIN_CATALOG_OBSERVEDOBJECT` | `관측 응답` | `observedObject` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | erp.sales.orders | — | 표시 |
| 확인 시각 | `MSG.ADMIN_CATALOG_OBSERVEDAT` | `관측 응답` | `observedAt` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 2026-10-29 10:20 | — | 표시 |
| 구조 차이 | `MSG.ADMIN_CATALOG_STRUCTUREDIFFERENCE` | `관측 응답` | `structureDifference` | 장문 뷰어 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 미등록 컬럼 발견 — 자동 공개 없음 | — | 표시 |
| 연결 관측 근거 | `MSG.ADMIN_CATALOG_OBSERVATIONCONTEXT` | `관측 응답` | `observationContext` | 장문 뷰어 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 비밀/주소 제외 | 현재 node/boot/적용 설정 참조 | — | 선택 표시 |

#### 관측·샘플 / 수동 샘플 요청

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 선택 등록 컬럼 | `MSG.ADMIN_CATALOG_SAMPLECOLUMNIDS` | `입력` | `sampleColumnIds` | 텍스트 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 503 | — | 표시 |
| 조회 조건 | `MSG.ADMIN_CATALOG_SAMPLECONDITION` | `입력` | `sampleCondition` | 장문 셀 | 120/좌 | — | 조건부 | 서버/선택 판 | — | 서버 검증 가능한 조건; 임의 SQL 금지 | 검수된 기간 조건 | — | 표시 |
| 상한 상태 | `MSG.ADMIN_CATALOG_SAMPLELIMITSTATE` | `정책 원천` | `sampleLimitState` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 계약 미확정 — 실행 비활성 | — | 표시 |
| 실행 이력 | `MSG.ADMIN_CATALOG_SAMPLEHISTORYREF` | `조회 이력 원천` | `sampleHistoryRef` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 실행 안 함 | — | 표시 |

#### 변경 근거 / 근거 목록

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 근거 ID | `MSG.ADMIN_CATALOG_EVIDENCEID` | `EVIDENCE_ID` | `evidenceId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 801 | — | 표시 |
| 출처 | `MSG.ADMIN_CATALOG_SOURCEKIND` | `SOURCE_KIND` | `sourceKind` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | NOTICE/STRUCTURE/MEANING | NOTICE | — | 표시 |
| 관측 결과 | `MSG.ADMIN_CATALOG_EVIDENCEOBSERVATION` | `OBSERVATION_STATUS` | `evidenceObservation` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | UNCONFIRMED/COMPLETE/PARTIAL/FAILED | UNCONFIRMED | — | 표시 |
| 접수 시각 | `MSG.ADMIN_CATALOG_RECEIVEDAT` | `RECEIVED_DTM` | `receivedAt` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 2026-10-29 10:25 | — | 표시 |
| 관측 시각 | `MSG.ADMIN_CATALOG_EVIDENCEOBSERVEDAT` | `OBSERVED_DTM` | `evidenceObservedAt` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 접수시각과 구분 | 미확인 | — | 선택 표시 |
| 원천 예정 시각 | `MSG.ADMIN_CATALOG_PLANNEDSOURCEAT` | `PLANNED_SOURCE_DTM` | `plannedSourceAt` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 원천 실제시각과 구분 | 미확인 | — | 선택 표시 |
| 원천 실제 시각 | `MSG.ADMIN_CATALOG_ACTUALSOURCEAT` | `ACTUAL_SOURCE_DTM` | `actualSourceAt` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 관측/접수시각과 구분 | 미확인 | — | 선택 표시 |
| 구조·업무 근거 | `MSG.ADMIN_CATALOG_EVIDENCEBODY` | `EVIDENCE_BODY` | `evidenceBody` | 장문 뷰어 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 형식 버전 해석·비밀/원본 샘플 복사 금지 | 업무 담당자가 주문 상태 의미의 변경 가능성을 알렸습니다. | — | 표시 |
| 검토·조사 연결 | `MSG.ADMIN_CATALOG_IMPACTREVIEWLINK` | `소유 계약` | `impactReviewLink` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 지식 직접/예제 경유 영향 확인 | — | 표시 |

#### 변경 근거 / 대상과 영향

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 대상 근거 ID | `MSG.ADMIN_CATALOG_TARGETEVIDENCEID` | `EVIDENCE_ID` | `targetEvidenceId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 801 | — | 표시 |
| 대상 번호 | `MSG.ADMIN_CATALOG_TARGETNO` | `TARGET_NO` | `targetNo` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 1 | — | 표시 |
| 영향 카탈로그 | `MSG.ADMIN_CATALOG_TARGETCATALOGID` | `CATALOG_ID` | `targetCatalogId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 301 | — | 표시 |
| 영향 내용 판 | `MSG.ADMIN_CATALOG_TARGETREVISIONID` | `REVISION_ID` | `targetRevisionId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 402 | — | 표시 |
| 근거 역할 | `MSG.ADMIN_CATALOG_REFERENCEROLE` | `REFERENCE_ROLE` | `referenceRole` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 업무 의미 변경 대상 | — | 표시 |

#### 변경 근거 / 사용처

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 사용처 경로 | `MSG.ADMIN_CATALOG_REFERENCEPATH` | `공개 참조 응답` | `referencePath` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 지식 직접 연결 | — | 표시 |
| 대상 종류 | `MSG.ADMIN_CATALOG_REFERENCETARGETKIND` | `공개 참조 응답` | `referenceTargetKind` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | KNOWLEDGE | — | 표시 |
| 사용처 ID | `MSG.ADMIN_CATALOG_REFERENCETARGETID` | `공개 참조 응답` | `referenceTargetId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 901 | — | 표시 |
| 선택 내용 판 | `MSG.ADMIN_CATALOG_REFERENCEREVISIONID` | `공개 참조 응답` | `referenceRevisionId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 401 | — | 표시 |
| 참조 역할 | `MSG.ADMIN_CATALOG_REFERENCEROLENAME` | `공개 참조 응답` | `referenceRoleName` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 조회 대상 | — | 표시 |
| 사용처 영향 | `MSG.ADMIN_CATALOG_REFERENCEIMPACT` | `공개 참조 응답` | `referenceImpact` | 장문 뷰어 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 업무 의미 재검토 필요 | — | 표시 |

#### 판 이력

| 컬럼 | 메시지 키 | DB 컬럼 | 필드명 | 입력방식 | 폭/정렬 | 필수 | 편집 | 기본값/원천 | 코드그룹 | 검증 | 예시 | 후보 예시 | 기본 표시 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 내용 판 | `MSG.ADMIN_CATALOG_HISTORYREVISIONID` | `REVISION_ID` | `historyRevisionId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 401 | — | 표시 |
| 판 순번 | `MSG.ADMIN_CATALOG_REVISIONNO` | `REVISION_NO` | `revisionNo` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 1 | — | 표시 |
| 구성 상태 | `MSG.ADMIN_CATALOG_HISTORYCONTENTSTATE` | `CONTENT_STATE` | `historyContentState` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | FROZEN | — | 표시 |
| 기준 내용 판 | `MSG.ADMIN_CATALOG_HISTORYBASEREVISIONID` | `BASE_REVISION_ID` | `historyBaseRevisionId` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 미지정 | — | 표시 |
| 판 작성 시각 | `MSG.ADMIN_CATALOG_REVISIONCREATEDAT` | `REG_DTM` | `revisionCreatedAt` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 2026-10-29 09:00 | — | 표시 |
| 변경 사유 | `MSG.ADMIN_CATALOG_HISTORYREASON` | `CHANGE_REASON` | `historyReason` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 최초 공개 정의 | — | 표시 |
| 운영 반영 | `MSG.ADMIN_CATALOG_APPLYRESULTREF` | `APPLY_RESULT_REF` | `applyResultRef` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 실제 반영 원장 참조 | — | 표시 |
| 전체 구성 | `MSG.ADMIN_CATALOG_REVISIONOPEN` | `REVISION_ID` | `revisionOpen` | 텍스트 | 120/좌 | — | 읽기전용 | 서버/선택 판 | — | 선택 판·소유·현재 권한 검사 | 판 열람 → 동일 탭의 읽기 전용 전체 그리드 | — | 표시 |

- 등록 컬럼 선택이 INLINE/CODE 자식의 문맥이다. 키/제약/관계도 선택한 안정 구성 ID로 자식을 연결한다. 다중 행은 전체 목록과 순서를 보존하며 예시 한 행이 전체 개수/상한을 뜻하지 않는다.
- 위 INLINE/CODE 표는 해당 방식 컬럼 선택 시의 구조 예시다. 선택한 컬럼의 VALUE_MODE가 NONE/UNKNOWN이면 해당 하위 그리드는 비고 메시지와 빈 목록으로 표시하며 다른 방식의 자식 예시를 현재 구성처럼 보여주지 않는다. 키/제약/관계의 하위 선택도 소유 문맥을 명시한다.
- 미완성 관계는 쌍 목록 0개 또는 일부 완전한 쌍과 누락 사유·UNKNOWN으로 저장한다. 한쪽 컬럼만 채운 쌍 행은 ENT-025의 필수 참조를 만족하지 않으므로 저장을 거부하고 로컬 입력을 유지한다. 자동으로 행을 버리지 않고 양쪽을 보완하거나 명시 삭제하게 한다.
- 현재 판의 소유 관계는 API-022 구성으로 읽고 반대편 관계는 API-027의 권한 있는 요약으로 찾는다. 전체 관계/쌍은 관리 카탈로그의 API-022 열람 권한을 확인해 읽으며, 없으면 허용 요약만 표시한다. 요약 응답을 전체 상세로 간주하지 않는다.
- 등록 컬럼의 개인정보 분류·식별 용도·마스킹 참조·검수 상태는 접근 정책 탭에서 선택 컬럼 문맥으로 현재 정책 원천을 조회한다. 별도 카탈로그 정책 사본이나 편집 API를 만들지 않는다. 소유 계약 미완성이면 확인 대기이며 해당 정책 기능을 완성으로 표시하지 않는다.
- 과거 전체 구성은 정규화한 선택 판/자식으로 재현한다. JSON 원문을 합성하거나 없는 원문 보기 버튼을 만들지 않는다. 장문 근거는 원문이 있는 범위만 읽기 전용으로 표시한다.

### 4-2. 편집 가능 판단 — 조건부

내용 판 DRAFT + 현재 SAVE/소유 권한 + 전체 편집본 확보 + 미종결 요청/고정 충돌 없음에서만 후보 정의·자식 입력을 편집한다. 관리측 아닌 관계는 잠그고 관리측 후보 열기로 이동한다. 정책 값·서버 검수자/시각·현재 포인터/식별키는 편집하지 않는다.

### 4-3. 값 변경 후 연쇄 · 재계산

구조/의미/값/키/관계/제약 변경은 해당/의존 검수를 무효화한다. CODE/INLINE 모드 변경 시 다른 모드 자식을 명시 제거/보완하며 서버가 남은 부적합 자식을 거부한다. 데이터소스는 기존 카탈로그에서 고정하고 이름 변경으로 다른 물리 실체 이전을 우회하지 않는다.

### 4-4. 팝업 · 모달 선택 결과 매핑

API-028의 정확 객체 확인, API-036의 등록 컬럼/코드/관계/키 후보 선택을 셀 선택 창에 연결한다. 전달값은 소유 catalogId/revisionId·용도·현재 권한, 결과는 정확 대상/선택 판·역할이다. 후보 페이지에 없음을 MISSING으로 추정하지 않는다. 관계 추가의 생성 파라미터 창에서 양쪽 카탈로그 중 관리측을 명시 선택한다. 선택 뒤에는 관계 그리드의 관리 카탈로그를 읽기 전용으로 고정하며 다른 관리측이면 해당 편집 후보로 이동한다. 신규 clientKey의 같은 저장 내부 참조와 서버 memberId 매핑을 구분한다.

### 4-5. 행 추가 기본값

신규 구성은 clientKey를 부여하고 확인하지 않은 의미/검수/차원은 UNKNOWN 또는 미지정으로 둔다. 필수 제약 없음·개인정보 아님·검수 완료·임의 시간대/조인 관계를 자동 선택하지 않는다. 코드/공통코드의 실제 허용값은 소유 계약을 따른다.
복사/복원은 같은 카탈로그의 새 DRAFT이며 원본 판과 현재 기준 판을 별도로 기록한다. 과거 직접 정책·기존 검수 완료를 새 내용/현재 권한의 근거로 자동 복사하지 않는다. 원천 기본값·컬럼 길이·인덱스의 별도 편집 기능은 추가하지 않는다.

### 4-6. 비노출 저장 컬럼

OBJECT_KEY·COLUMN_KEY·REQUEST_DIGEST·FROZEN_DIGEST 및 명령/서버 검수 근거는 서버가 계산/검증한다. 정정/이름 변경의 사용자 근거를 지문/서버 식별 근거로 대체하지 않는다. 1:N 값은 자식 테이블에 저장하며 화면 표시 문자열을 DB의 짧은 연결 문자열로 저장하지 않는다.

## 5. 버튼 · 액션

| 버튼 | 선언 | 메시지 키 | 권한 | 사용 조건 | 동작 | 연결 |
|---|---|---|---|---|---|---|
| 조회 | 선언 | MSG.ADMIN_CATALOG_ACTION_SEARCH | READ | 선택 판/현재 권한·상태에 따름 | 목록 조건 조회 | — |
| 신규 | 선언 | MSG.ADMIN_CATALOG_ACTION_NEW | SAVE | 선택 판/현재 권한·상태에 따름 | 정확 객체 선택 후 새 초안 시작 | API-023 |
| 객체 확인 | 선언 | MSG.ADMIN_CATALOG_ACTION_RESOLVE_OBJECT | READ | 선택 판/현재 권한·상태에 따름 | 선정한 정확 객체 해석·관측 | API-028 |
| 신규 초안 저장 | 선언 | MSG.ADMIN_CATALOG_ACTION_CREATE_DRAFT | SAVE | 선택 판/현재 권한·상태에 따름 | 새 카탈로그/내용 판과 전체 구성 저장 | API-023 |
| 후보 저장 | 선언 | MSG.ADMIN_CATALOG_ACTION_SAVE_DRAFT | SAVE | 선택 판/현재 권한·상태에 따름 | DRAFT 한 판의 전체 구성 저장 | API-024 |
| 후보 복사 | 선언 | MSG.ADMIN_CATALOG_ACTION_COPY_DRAFT | SAVE | 선택 판/현재 권한·상태에 따름 | 현재/과거/고정 판을 새 DRAFT로 복사 | API-025 |
| 판 목록 | 선언 | MSG.ADMIN_CATALOG_ACTION_LIST_REVISIONS | READ | 선택 판/현재 권한·상태에 따름 | 현재 카탈로그의 판 목록 조회 | API-021 |
| 판 열람 | 선언 | MSG.ADMIN_CATALOG_ACTION_OPEN_REVISION | READ | 선택 판/현재 권한·상태에 따름 | 선택 판의 전체 구성을 동일 탭에서 읽기 전용 열람 | API-022 |
| 후보 계속 편집 | 선언 | MSG.ADMIN_CATALOG_ACTION_RESUME_DRAFT | SAVE | 선택 판 DRAFT·현재 권한/소유·전체 구성 확보·결과 불명 아님 | API-022로 확보한 같은 revisionId의 편집본을 열고 EDIT_VERSION으로 API-024 저장. 복사로 바꾸지 않음 | API-022/024 |
| 최신 판 조회 | 선언 | MSG.ADMIN_CATALOG_ACTION_RELOAD_REVISION | READ | 선택 판/현재 권한·상태에 따름 | 충돌 입력 보존 후 명시적으로 최신 판 조회 | API-022 |
| 컬럼 추가 | 선언 | MSG.ADMIN_CATALOG_ACTION_ADD_COLUMN | SAVE | 선택 판/현재 권한·상태에 따름 | 명시 선택 컬럼을 후보에 추가; 즉시 운영 공개 없음 | 로컬 |
| 컬럼 제거 | 선언 | MSG.ADMIN_CATALOG_ACTION_REMOVE_COLUMN | SAVE | 선택 판/현재 권한·상태에 따름 | 참조 영향을 검증할 후보 변경 | 로컬 |
| 키 추가 | 선언 | MSG.ADMIN_CATALOG_ACTION_ADD_KEY | SAVE | 선택 판/현재 권한·상태에 따름 | 전체 식별키와 순서 작성 | 로컬 |
| 제약 추가 | 선언 | MSG.ADMIN_CATALOG_ACTION_ADD_CONSTRAINT | SAVE | 선택 판/현재 권한·상태에 따름 | 필수 조회 제약 후보 작성 | 로컬 |
| 관계 추가 | 선언 | MSG.ADMIN_CATALOG_ACTION_ADD_JOIN | SAVE | 선택 판/현재 권한·상태에 따름 | 관리 카탈로그를 생성 시 명시 선택·고정 | 로컬 |
| 쌍 추가 | 선언 | MSG.ADMIN_CATALOG_ACTION_ADD_PAIR | SAVE | 선택 판/현재 권한·상태에 따름 | 방향 컬럼쌍을 관계 후보에 추가 | 로컬 |
| 관리측 후보 열기 | 선언 | MSG.ADMIN_CATALOG_ACTION_OPEN_MANAGING_DRAFT | READ+SAVE | 선택 판/현재 권한·상태에 따름 | 관리 카탈로그의 현재 편집 권한을 검사하고 이동 | API-020/021/022 |
| 검증 결과 | 선언 | MSG.ADMIN_CATALOG_ACTION_VALIDATE | READ | 선택 판/현재 권한·상태에 따름 | 선택 후보/기대 버전과 명시한 세트 후보 집합을 검증; 반영 허가 아님 | API-035 |
| 변경 세트 열기 | 선언 | MSG.ADMIN_CATALOG_ACTION_OPEN_CHANGE_SET | READ | 선택 판/현재 권한·상태에 따름 | SCR-036의 소유 흐름으로 인계; 현재 후보/기준 판 고정은 소유 계약 | FEAT-014/040 |
| 구조 확인 | 선언 | MSG.ADMIN_CATALOG_ACTION_READ_STRUCTURE | READ | 선택 판/현재 권한·상태에 따름 | 등록 공개 범위의 사실만 조회 | API-029 |
| 수동 샘플 | 선언 | MSG.ADMIN_CATALOG_ACTION_RUN_SAMPLE | EXECUTE | 선택 판/현재 권한·상태에 따름 | 등록 컬럼 수동 선택과 현재 권한/개인정보/제약/상한 검증 뒤 실행 | API-030 |
| 근거 접수 | 선언 | MSG.ADMIN_CATALOG_ACTION_SAVE_EVIDENCE | SAVE | 선택 판/현재 권한·상태에 따름 | 명령 파라미터 창에서 수동 통지/업무 근거 접수; 서버 근거 검증 | API-033 |
| 근거 상세 | 선언 | MSG.ADMIN_CATALOG_ACTION_READ_EVIDENCE | READ | 선택 판/현재 권한·상태에 따름 | 권한 있는 대상/당시 판·영향 연결 확인 | API-032 |
| 사용처 | 선언 | MSG.ADMIN_CATALOG_ACTION_READ_REFERENCES | READ | 선택 판/현재 권한·상태에 따름 | 권한 있는 현재 사용처 조회; 숨은 참조도 보호 | API-026 |
| 결과 확인 | 선언 | MSG.ADMIN_CATALOG_ACTION_READ_COMMAND_RESULT | READ+SAVE | 선택 판/현재 권한·상태에 따름 | 원 명령의 성공 또는 UNKNOWN 확인 | API-034 |
| 같은 입력 재시도 | 선언 | MSG.ADMIN_CATALOG_ACTION_RETRY | SAVE | 선택 판/현재 권한·상태에 따름 | 원 키·원 입력으로 원 API 재전송 | API-023/024/025/033 |
| 편집 취소 | 선언 | MSG.ADMIN_CATALOG_ACTION_CANCEL | SAVE | 선택 판/현재 권한·상태에 따름 | 확인 후 로컬 후보 편집 취소 | 로컬 |
| 엑셀 다운로드 | 선언 | MSG.ADMIN_CATALOG_ACTION_EXPORT | READ+EXPORT | 선택 판/현재 권한·상태에 따름 | 표시 열/순서·현재 페이지/전체 범위; 원본 샘플 반출 권한을 대신하지 않음 | 공통 |

- 메타데이터 검수는 입력/근거에 대한 서버 확인이며 기술 검토·최종 승인이 아니다. 이 화면에는 독립 운영 반영·직접 폐기·강제 승인 버튼이 없다.
- 수동 샘플은 EXECUTE·현재 원본 열람/개인정보 제외/필수 제약·행/시간 상한 계약 확정 뒤에만 활성화한다. 현재 목업은 비활성 상태다. SCR-036 인계의 구체 입력·응답/원장은 소유 계약에서 확정하며 준비 전 신규 요청을 성공한 것처럼 표시하지 않는다.

## 6. 규칙 — 저장 · 실행

### 6-1. 검증

- 전체 입력/자식·소유/종류·clientKey/안정 ID·기대 편집 버전·현재 권한을 서버에서 검증한다. 미완성 초안은 허용하되 존재하지 않는 참조·다른 소유·중복·비밀값·임의 SQL은 거부한다.
- 정확 식별·이름 변경은 FEAT-003.identity_contract, 값·키·관계·필수 제약·검수는 composition_contract를 따른다. 모든 필드/목록을 명시하며 생략과 빈 목록을 합치지 않는다.
- 실제 검증 DTO/오류의 MsgKey는 400 invalidInput / 409 versionConflict·referenceConflict·identityConflict·commandConflict / 503 dependencyUnavailable의 공개 계약에 연결한다. 현재 구체 오류 코드는 API 정본을 따르며 이 문서의 분류로 새 코드를 만들지 않는다.

### 6-2. 영향 테이블

- 신규/저장/복사는 ENT-005/006·020 및 전체 자식 ENT-007~009/021~026과 ENT-028의 완전한 결과를 같은 트랜잭션으로 저장한다. 확정 결과 매핑 이후에만 응답하며 이력/자식 일부 실패는 전부 롤백한다. 직접 관리 ENT-019를 재사용하지 않는다.
- 근거 접수는 ENT-010/027과 명령 결과를 함께 처리한다. 수동 근거 보완은 새 evidenceId로 연결한다. 원천 관측/샘플의 서버 주체·시각을 사용자 입력으로 덮지 않는다.
- 고정·승인/전결·실제 반영의 전체 포인터/효력/이름·세트 원장은 FEAT-014/040 소유다. 현재 직접 정책은 카탈로그 복원으로 덮지 않는다.

### 6-3. 상태 전이

열람 → 명시한 새 DRAFT/복사 → 전체 편집/미완성 표시 → 초안 저장/검수 결과 → 소유 세트 인계 → 고정 후보(잠금) → 요청/검토/승인 또는 전결 → 실제 반영 결과 확인. 설정 미사용은 검증 생략이 아니다.

응답 유실은 결과 불명으로 원 키/입력을 잠근다. UNKNOWN은 미실행이 아니며 같은 키로 확인/재시도한다. 원 성공을 기대 버전 검사 전에 재생하고 키 경합 실패 TX는 종료한 뒤 새 읽기에서 확인한다. 미반영이 확정된 명시 거부만 편집 복귀하며 새 의도에 새 키를 만든다.

## 7. API

| API | 동작 | 권한 | 입력 | 출력 |
|---|---|---|---|---|
| API-019 | getList | READ | body=SearchRequest<CatalogFilter> | ApiResponse<PageResponse<CatalogRow>> |
| API-020 | getOne | READ | body=CatalogKey | ApiResponse<CatalogDetail> |
| API-021 | getRevisions | READ | body=SearchRequest<CatalogKey> | ApiResponse<PageResponse<RevisionRow>> |
| API-022 | getRevision | READ | body=RevisionKey | ApiResponse<RevisionDetail> |
| API-023 | saveCreateDraft | SAVE | body=DraftCreate | ApiResponse<DraftResult> |
| API-024 | saveDraft | SAVE | body=DraftSave | ApiResponse<DraftResult> |
| API-025 | saveCopyDraft | SAVE | body=DraftCopy | ApiResponse<DraftResult> |
| API-026 | getReferences | READ | body=SearchRequest<RevisionKey> | ApiResponse<PageResponse<CatalogReferenceRow>> |
| API-027 | getRelatedJoins | READ | body=SearchRequest<RevisionKey> | ApiResponse<PageResponse<CatalogReferenceRow>> |
| API-028 | getResolvedObject | READ | body=SourceObjectQuery | ApiResponse<SourceObjectResult> |
| API-029 | getStructure | READ | body=StructureQuery | ApiResponse<StructureResult> |
| API-030 | runSample | EXECUTE | body=SampleRequest | ApiResponse<SampleResult> |
| API-031 | getEvidenceList | READ | body=SearchRequest<EvidenceFilter> | ApiResponse<PageResponse<EvidenceRow>> |
| API-032 | getEvidenceOne | READ | body=EvidenceKey | ApiResponse<EvidenceDetail> |
| API-033 | saveEvidence | SAVE | body=EvidenceSave | ApiResponse<DraftResult> |
| API-034 | getCommandResult | READ | body=CatalogCommandKey | ApiResponse<CatalogCommandResult> |
| API-035 | getValidation | READ | body=ValidationRequest | ApiResponse<ValidationResult> |
| API-036 | getReferenceCandidates | READ | body=SearchRequest<ReferenceCandidateFilter> | ApiResponse<PageResponse<CatalogReferenceRow>> |

API-034는 현재 READ+SAVE·주체/기능 결합을 검사한다. READ 메타데이터 권한을 샘플 실행·원본 값 열람·정책 편집 권한으로 확대하지 않는다.

## 8. 시드 · 데이터 전제

- 메뉴/메시지/공통코드·API 시드는 소유 G3·화면 승인 후 생성/추가한다. 위 MSG 이름은 의미 연결 초안이며 아직 등록하지 않는다.
- 데이터소스·기반 현재 인가/메시지 계약이 선행한다. 그룹 후보·검토 원장·원천 관측/샘플·보존의 후속 조건은 각 공개 계약 pending을 따른다.
- 반출 허용 속성·현재 마스킹/권한 계약은 REQ-301.open과 FEAT-003.pending에서 완성한다. 표의 엑셀 허용 예시는 해당 계약과 READ+EXPORT가 충족된 검토 상태다. 확인 불가 또는 미완성 배포는 반출을 활성화하지 않는다.

## 9. 테스트 케이스

| 케이스 | 상황 | 기대 결과 | TC / 수단 |
|---|---|---|---|
| CAT-01 | 목록·현재/선택 판·과거 열람 | 현재 효력/후보 상태/편집 버전을 분리하고 소유 판 전체를 읽음 | TC-0031 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-02 | 신규 미완성 초안 저장 | 미확인과 해당 없음 구분·DRAFT 보존·운영 사용 제외 | TC-0032 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-03 | 전체 후보 구성 저장·고정 판 변경 | 전체 자식/매핑 함께 저장; FROZEN 직접 수정·부분 반영 금지 | TC-0033 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-04 | 같은 이전 EDIT_VERSION의 동시 편집 | 하나만 성공·다른 입력 보존·자동 병합 없음 | TC-0034 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-05 | 응답 유실·원 키 재전송·저장 일부 실패 | 원 성공 우선 재조회·clientKey 매핑 재사용·전체 롤백 | TC-0035 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-06 | 정확 물리 식별·해당 없음·중복/profile 차이 | 임의 기본 스키마/전역 소문자/새 profile 우회 금지 | TC-0036 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-07 | 동일 객체/컬럼 이름 변경·삭제 재생성 | 근거와 검토 반영 후 안정 ID 유지; 다른 실체 자동 승계 없음 | TC-0037 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-08 | 새 구성 clientKey와 자기 참조 | 종류/소유 고정·같은 저장의 신규 컬럼 ID 매핑·다른 후보 임시 키 추정 금지 | TC-0033 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-09 | 미완성 값 도메인·CODE/INLINE 모드 전환 | 다른 모드의 자식 거부·정확 코드 판/타입/조건·빈 INLINE 검수 금지 | TC-0038 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-10 | 복합 식별키 일부 누락·기간 경계/단위 미확인 | 전체 순서·모든 제약 검사; 부분 키/임의 기간 변환으로 면제 금지 | TC-0039 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-11 | 검수 의도 VERIFIED와 근거/필수 참조 오류 | 서버가 검수자/시각 확정·변경 후 의존 검수 무효화 | TC-00310 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-12 | 현재 정책·그룹 원천 조회 실패 | 빈 그룹/상속 해제/현재 정책 덮어쓰기 없음; 소유 계약 대기 | TC-00311 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-13 | 구조 관측 PARTIAL/FAILED·원천 코멘트 | 등록 컬럼 자동 제거/공개·의미 검수 완료로 바꾸지 않음 | TC-00312 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-14 | 수동 샘플 상한/권한 미완성·개인정보/미등록 열 | 실행 비활성 또는 서버 거부·원문을 후보/근거에 복사하지 않음 | TC-00312 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-15 | 검증 결과 후 요청·전결·반영 | API-035는 예약/승인 아님; 소유 세트에서 전체 기준/참조/현재 정책 재검증 | TC-00313 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-16 | 의미 변경·구조 변화 없음·영향 조회 실패 | 지식 직접/예제 경유 검토 연결·실패를 영향 없음으로 처리하지 않음 | TC-00314 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-17 | 그룹/정책/메타데이터·샘플/반출 권한 조합 | READ/SAVE/EXECUTE/EXPORT·현재 소유 권한을 각각 검사 | TC-00311 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-18 | 판 이력·폐기 항목 재진입 | 원 catalogId로 최신 판 목록 자동 조회·현재 자식으로 과거 재구성 금지 | TC-0031 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-19 | 상단 목록·하단 탭·숨김 열 엑셀 | 기본정보 폼 없음·표시 열/순서/범위 준수·숨김 열 자동 포함 없음 | TC-0031 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-20 | 관계 관리측·반대편 조회/편집 | 관리측 생성 시 고정·같은 정본·권한 검사 뒤 관리측 후보로 이동 | TC-0111 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-21 | 자기조인 두 역할·복합 컬럼쌍 | 같은 후보여도 두 역할/방향·전체 쌍 보존·순서/중복 검사 | TC-0112 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-22 | 외부 판·같은 세트 후보와 현재 접근 | 자동 최신판 치환/권한 부여 없음·참조만 하는 항목 업무 점유 없음 | TC-0113 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-23 | 1:N 집계와 불명 관계 | DISTINCT로 중복 의미 숨기지 않음·관계 불필요 독립 컬럼 사용 강제 차단 없음 | TC-0112 / 단위·계약·통합·E2E 중 해당 수단 |
| CAT-24 | 저장한 DRAFT 재방문·명시적 계속 편집 | 현재 SAVE/소유/전체 구성을 검사해 같은 revisionId·EDIT_VERSION으로 저장. 고정/과거 판은 편집 불가·복사만 가능 | TC-0033 / 통합·E2E |
| CAT-25 | 관계의 쌍 목록 누락과 잘못된 쌍 행 | 쌍 0개/일부 완전 쌍은 UNKNOWN/누락 사유로 초안 보존. 반쪽 쌍 행·없는 참조·소유 오류·중복은 거부하고 입력 유지. 미완성의 검수 완료/운영 사용 금지 | TC-0112 / 단위·계약·통합 |

## 10. 미결 · 확인 필요

- 사용자 필수 답변 대기 없음. 화면 상세 검토·구현 승인은 별도다.
- @defer P3 access_policy·knowledge — 그룹 후보/당시 정책의 정확 형식·현재 개인정보 조회·FK·권한 회수 동시성/세트 저장 계약. 확인 불가/미완성 상태를 유지한다.
- @defer P3 integration·agent — DBMS 정확 객체·식별 profile 이행/실행 환경·관측/샘플 상한·조회 이력 계약. 미완성 샘플 실행은 활성화하지 않는다.
- @defer P3 knowledge·audit_trace — 요청/고정/실제 세트 결과·영향 검토/보존과 늦은 명령 재수신 계약. 검증 결과를 접수/반영 허가로 쓰지 않는다.
- @defer P3 integration_assets — 실제 코드값/DTO 필드·구체 응답/오류 메시지, 전체 화면 승인과 구현 슬라이스 착수 전 정합화. 작업영역 5개 의존 조건을 유지한다.

## 11. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-10-29 | 상단 현재 항목·하단 후보 전체 그리드의 요건/목업 초안과 시험 연결 작성 |
