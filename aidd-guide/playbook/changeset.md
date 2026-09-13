---
id: LLM-PLY-004
title: "Liquibase changeset — 모듈 기준선 뒤에 변경을 더한다"
category: playbook
type: operation
created: 2026-05-04
updated: 2026-09-13
status: active
sources: ["sources/backend/bootstrap/src/main/resources/db/changelog/", "aidd-guide/standard/backend/persistence.md"]
tier: 2
tags: [playbook, liquibase, changeset, seed, schema]
---

# Liquibase changeset — 모듈 기준선 뒤에 변경을 더한다

> 실물은 `sources/backend/bootstrap/src/main/resources/db/changelog/`이다. 기준선은 **새 DB를
> 현재 상태로 한 번 만드는 출발점**이고, 이후 변경은 해당 모듈의 새 changeset으로만 더한다.

## 1. 먼저 어느 기준선을 탈지 정한다

| 실행 변형 | 루트 | 포함 모듈 | 명령 |
|---|---|---|---|
| product | `db.changelog-master.yaml` | `platform` · `system` | `./gradlew :backend:bootstrap:bootJar` |
| local | `db.changelog-local.yaml` | product + `sample` | `./gradlew :backend:bootstrap:bootRun -PincludeSample=true` |

- `platform`·`system`·`sample`은 각각 `modules/{모듈}/db.changelog-{모듈}.yaml`이 자기
  기준선과 이후 changeset의 순서를 소유한다.
- **sample은 local 전용**이다. product master·JAR·프런트·API 시드에 sample을 넣지 않는다.
- 루트와 모듈 master는 `includeAll`을 쓰지 않는다. 순서·의존 이유를 include 옆 주석으로 남긴다.
  `SeedChangelogIncludeTest`가 두 루트에서 파일 누락과 중복 include를 검사한다.

## 2. 기준선과 이후 변경은 다르다

| 상황 | 하는 일 |
|---|---|
| 아직 배포하지 않은 초기 기준선 정리 | 모듈 기준선을 다시 만들 수 있다. 기존 DB는 승인 후 비우고 처음부터 기동해 검증한다. |
| 기준선이 적용된 DB가 하나라도 있다 | **기준선 파일을 고치지 않는다.** 모듈 master 끝에 새 changeset을 추가한다. |
| 메뉴·컨트롤러·`endpoints.ts`·메시지 키를 바꿨다 | 생성 태스크로 local 시드 CSV를 갱신하고 `-PincludeSample=true`로 검사한다. |
| product 배포를 만든다 | sample 제외 JAR과 product master 기동을 검증한다. local 생성 시드 검사는 의도적으로 건너뛴다. |

초기 기준선을 다시 만드는 일은 **현재 DB의 `DATABASECHANGELOG`만 지우는 작업이 아니다.**
동일 접속 정보를 유지하려면 서버를 멈춘 뒤 대상 스키마의 모든 객체를 삭제하고 빈 스키마를 만든
다음, 해당 변형으로 기동한다. 이미 운영된 DB의 변경 이력에는 이 방법을 쓰지 않는다.

## 3. 새 changeset을 더하는 절차

```
1. 소유 모듈을 정한다        platform | system | sample(local 전용)
2. 새 파일을 만든다          modules/{모듈}/{순번}-{무엇}.yaml 또는 .sql
3. 모듈 master 끝에 include  의존 순서와 이유를 주석으로 남긴다
4. 변형별로 기동한다         local은 -PincludeSample=true, product는 sample 없이
5. 시드 관련 변경이면 생성·검사를 함께 한다
```

- 이전에 적용된 changeset과 그 CSV는 수정하지 않는다. 체크섬 불일치로 기존 DB 기동이 멈춘다.
- 파일명 번호는 소유 모듈 안에서만 쓴다. 실제 실행 순서는 module master의 include 순서다.
- 새 테이블·FK·시드는 해당 모듈의 경계 안에 둔다. sample은 `SMPL_` 테이블만 소유하며 공통
  테이블의 기본 데이터를 추가해야 하면 local master에서 sample 뒤에 전용 changeset으로 적는다.

## 4. 생성 시드

메뉴·API·메뉴 API·메시지 키는 소스 선언에서 생성하는 local 시드다. CSV를 직접 고치지 않는다.

```bash
cd sources
./gradlew :backend:bootstrap:generateSeeds -PincludeSample=true
./gradlew :backend:bootstrap:checkSeeds -PincludeSample=true
```

생성물과 기준선은 역할이 다르다. 생성 CSV는 소스 선언의 일치 검사용이고, 신규 DB의 실제
초기 적재는 모듈 기준선이 책임진다. 기준선을 변경해야 하는 것은 새 DB에만 적용할 수 있는
초기화인지, 기존 DB에도 적용할 변경인지 먼저 판단한다.

## 5. 커밋 전 체크리스트

- [ ] product/local 중 어느 루트가 해당하는지 정했는가
- [ ] 올바른 모듈 master 끝에 새 파일을 include했는가
- [ ] 기존에 적용된 기준선·changeset·생성 CSV를 고치지 않았는가
- [ ] 메뉴·API·화면 등록을 바꿨다면 `generateSeeds`와 local `checkSeeds`를 실행했는가
- [ ] local과 product 중 영향을 받는 변형을 실제 기동 또는 패키지 검증했는가

## 관련

- [standard/seed.md](../standard/seed.md) — 생성 시드의 입력과 검사
- [standard/backend/persistence.md](../standard/backend/persistence.md) — 타입·DB 이식성
- [standard/build-deploy.md](../standard/build-deploy.md) — 변형별 빌드와 배포
