---
id: LLM-ART-DATA
title: "데이터 모델 · Liquibase · 테이블 명세서 동기화"
category: artifact
type: operation
created: 2026-10-28
updated: 2026-10-28
status: active
sources: []
tier: 2
tags: [data, schema, liquibase, trace]
---

# 데이터 모델 · Liquibase · 테이블 명세서

**물리 구조를 바꾸는 작업은 모델과 Liquibase를 같은 변경에서 현행화하고 문서를 재생성한다.**
테이블 명세서를 별도 수기 정본으로 만들지 않는다. 소유자는 해당 ENT의 모듈이다.

## 역할과 정본

| 대상 | 역할 | 수정 위치 |
|---|---|---|
| 도메인·데이터 모델 | 개념·소유·업무 규칙·상태·논리 관계·검토한 물리 계약 | `documents/spec/40-domain/` |
| Liquibase | 실행 가능한 스키마 변경 이력, 구현된 물리 구조의 근거 | `sources/backend/bootstrap/src/main/resources/db/changelog/` |
| ERD | 데이터 모델의 관계 개요 | `documents/generated/40-ERD.md` — 생성 |
| 테이블 목록·명세서 | 테이블별 컬럼·자료형/길이·NULL·기본값·키·제약·인덱스·변경 근거 | `documents/generated/41-테이블명세서/` — 생성 |
| HTML | 위 산출물의 종류 → 모듈별 열람 | `build/deliverables/design/index.html` — 생성 |

`physical`은 검토한 설계 계약, Liquibase는 구현이다. 서로 다른 역할의 계약을 검사하며 한쪽으로
다른 쪽을 자동 덮어쓰지 않는다. 구현 후 차이가 생기면 소스를 현재 사실로 보고하되 의도한 변경인지
결함인지 판정한다. 승인된 의미를 바꾸면 `change-request` 절차를 따른다.

## ENT 기록 형식

- `id`·`module`·`features`·`table`: 식별자, 쓰기 소유 모듈, 소비 기능, 대문자 물리 이름.
- `implementation`: `planned`는 미구현 설계, `implemented`는 활성 Liquibase에 존재하는 구조.
- `attributes`·`relations`·`rules`·`state_machine`: 업무 속성·논리 관계·불변식. 논리 관계가
  있다고 DB 외래키가 존재하는 것은 아니다. 기존 `columns` 이름 목록은 호환하며 신규 문서에는 중복하지 않는다.
- `physical.attributes`: 전체 컬럼의 순서·`name`·정확한 `type`·`nullable`·`default`(없으면 null).
  실제 DB 주석은 선택 `comment`, 업무 설명은 논리 속성의 `description`에 둔다.
- `physical.constraints`: 이름과 전체 `definition`. 기본키·유일성·외래키·CHECK를 포함하고
  복합 키 순서·참조 동작·지연 조건을 생략하지 않는다.
- `physical.indexes`: 이름·`unique`·`method`·전체 `definition`. 제약이 생성하는 인덱스와 구분한다.
- `sources`: 테이블 생성/변경 파일과 활성 include 경로. 변경 파일 → ENT → FEAT → 관련 문서를 추적한다.
- `planned_changes`: 기존 구현의 다음 변경을 설계할 때 CR/요구·예정 계약·적용 조건을 기록한다.
  구현 전의 예정 컬럼을 현재 `physical`에 섞거나 `implemented` 전체를 `planned`로 낮추지 않는다.

신규 `planned` 테이블의 `physical`이 미완성이면 생성물에도 미완성으로 표시한다. G3에서는
해당 범위의 필수 물리 설계와 제약을 완성해야 한다. G3 전에 제품 changeset을 만들어 소스 게이트를
우회하지 않는다. 물리 이름과 키는 기존 명명·식별자 표준을 따른다.

## 변경 절차

1. ENT/FEAT와 `trace-check --source <경로>`로 요구사항·유즈케이스·API·화면·테스트 영향을 확인한다.
2. 설계 단계는 `planned` 또는 `planned_changes`를 작성한다. 구현 단계에서는 승인된 계약으로
   `physical`을 갱신하고 **새 Liquibase changeset**을 추가한다. 적재된 변경 파일을 수정하지 않는다.
3. 새 파일을 실제 실행하는 master/모듈 changelog에 include하고 ENT `sources`도 갱신한다.
   파일만 추가하고 include하지 않은 경우는 구현된 것으로 판정하지 않는다.
4. 마이그레이션 적용·기존 데이터 전환·롤백/복구 시험을 수행한다. 신규 테이블은 구현 시
   `implemented`로 바꾸고 완료한 `planned_changes`를 현재 계약에 반영한다.
5. 아래 검사와 문서 생성을 수행한다. 설계·Liquibase·관련 코드/테스트를 같은 변경에 담는다.
   파생 문서의 커밋 여부는 저장소 생성물 규약을 따른다.

```bash
node aidd-guide/harness/runtime/domain-schema.mjs
node .claude/skills/doc-gen/gen.mjs
node .claude/skills/doc-gen/gen.mjs --check
node .claude/skills/deliverable-site/build.mjs all
node .claude/skills/deliverable-site/check.mjs
```

## 생성·검사 경계

활성 루트와 resources 경로는 `conventions.liquibase`가 정의한다. 폴더 전체를 검색하여 과거
이관용 파일을 합치지 않는다. 기술 기반 테이블은 같은 설정의 `technical_tables`에 모듈·이유를
명시하며 가짜 업무 ENT를 만들지 않는다. 미분류 신규 테이블은 오류다.

생성 전 전체 대조에서 테이블/컬럼 추가·누락, 타입·NULL·기본값, 키·제약·인덱스, 소스 연결의
차이를 찾는다. 불일치나 미지원 구문이 있으면 문서를 쓰기 전에 실패한다. `gen --check`는 명세서의
실제 내용도 다시 계산해 낡은 파일을 찾는다. 차이를 검사에서 제외해 초록으로 만들지 않는다.

현재 판독기는 제품 PostgreSQL의 무조건 적용 경로와 SQL CREATE TABLE·ADD CONSTRAINT·CREATE INDEX·
ADD COLUMN·일부 ALTER COLUMN·COMMENT, YAML의 알려진 데이터 변경 및 `sql`을 지원한다.
DROP/RENAME·기타 스키마 구문·조건부 context/dbms/precondition·includeAll 등은 조용히 무시하지 않고
실패한다. 해당 변경을 처음 도입할 때 판독기와 회귀 사례를 함께 확장한다. rollback은 순방향에 합산하지 않는다.

이 검사는 **소스 기준 예상 스키마**를 비교한다. 운영 DB의 적용 여부·Liquibase checksum·수동 변경을
검증했다고 보고하지 않는다. 실제 마이그레이션 시험은 구현/통합 검증에서 별도로 수행한다.
