---
id: LLM-REC-ADR-IDX
title: "ADR — 아키텍처 결정 기록 서른하나"
category: records
type: operation
created: 2026-09-04
updated: 2026-09-04
status: active
sources: ["aidd-guide/records/adr/"]
author: Bong Jong Hyeon
tier: 2
tags: [records, adr, decision, index]
---

# ADR — 아키텍처 결정 기록 서른하나

> **여기 있는 것은 *왜 다른 안을 버렸나* 다.** 규칙은 [standard](../../standard/INDEX.md) 가
> 갖고 사실은 [knowledge](../../knowledge/INDEX.md) 가 갖는다 — **ADR 은 그 둘이 답하지
> 못하는 질문 하나에만 답한다**: *왜 이렇게 됐나.*
>
> **읽는 순서가 아니다.** 규칙을 따르다 *이건 왜 이렇게 하지* 가 남을 때만 들어온다
> ([harness/context/budget.md](../../harness/context/budget.md)).

## 형식이 aidd-guide 의 다른 문서와 다르다

ADR 은 **머리말(frontmatter)이 없고** 대신 네 줄로 시작한다 — `상태` · `일자` · `관련` ·
`## 맥락`. **그대로 둔다**: 형식이 널리 통하는 것이고, 옮기면서 형식을 바꾸면 **번호는 같은데
다른 문서**가 되어 지난 커밋 메시지의 인용이 어긋난다.

**ADR 은 고치지 않는다.** 결정이 바뀌면 새 ADR 을 쓰고 옛 것의 상태를 `대체됨` 으로 적는다 —
지금까지 그런 일은 없었고, 개정은 `0008` · `0017` · `0026` 셋이 본문에 이력을 덧붙이는 방식으로
처리했다.

## 어디 있었나

`docs/design/adr/` 에 있었고 2026-09-04 에 `llm-guide/10-records/adr/` 로, 같은 날
세 저장소를 합치면서 여기로 옮겼다(ADR-0030). `docs/design/` 이 폐지 대상인데
**ADR 만은 다른 문서가 대신할 수 없어서**다 — 표준은 `standard/` 가, 표는 `knowledge/`
가, 화면은 `documents/screen/` 가 받았지만 **버린 안과 그 이유는 아무도 받지 않았다.**

## 목록

| # | 결정 | 일자 |
|---|---|---|
| [0001](./0001-repository-layout.md) | 단일 저장소 + 프론트엔드 임베드 빌드 | 2026-08-22 |
| [0002](./0002-selectable-session-store.md) | 세션 스토어 선택형 (JDBC / Redis) | 2026-08-26 |
| [0003](./0003-liquibase-for-db-portability.md) | Liquibase 기반 DB 중립 스키마 관리 | 2026-08-26 |
| [0004](./0004-antd-with-ag-grid.md) | Ant Design + AG Grid Community | 2026-08-22 |
| [0005](./0005-multi-tab-workspace.md) | 멀티탭 워크스페이스 | 2026-08-22 |
| [0006](./0006-single-tenancy.md) | 싱글 테넌시 전제 | 2026-08-22 |
| [0007](./0007-adopt-llm-engine-template.md) | LLM 엔지니어링 체계 채택 | 2026-08-23 |
| [0008](./0008-pii-vault-pattern.md) | 개인정보 분리보관 패턴 — **적용은 미룸, 스키마 재설계 대상** | 2026-08-23 |
| [0009](./0009-role-based-authz-without-org.md) | 조직 계층 없는 역할 기반 권한 + 개인 예외 | 2026-08-23 |
| [0010](./0010-request-logging-without-audit-trail.md) | 감사 이력 미구현 + 요청 전문 로깅 | 2026-08-23 |
| [0011](./0011-p6spy-and-logback-strategy.md) | SQL 로깅은 P6Spy, 비동기·사용자별은 Logback | 2026-08-26 |
| [0012](./0012-request-dedup.md) | `request-id` 기반 중복 요청 방어 | 2026-08-23 |
| [0013](./0013-virtual-threads-and-context-propagation.md) | Virtual Thread + `TaskDecorator` 컨텍스트 전파 | 2026-08-26 |
| [0014](./0014-distributed-lock-cooldown.md) | 분산 락 — 만료 안전망과 쿨다운의 분리 | 2026-08-23 |
| [0015](./0015-table-based-id-generation.md) | 식별자 생성은 `TABLE` 전략으로 통일 | 2026-08-26 |
| [0016](./0016-api-master-table.md) | API 마스터 테이블 분리 — 액션은 API 의 속성 | 2026-08-26 |
| [0017](./0017-cache-strategy-per-target.md) | 캐시는 대상별로 다르다 — **§3 개정**(요청 → 작업 스코프) | 2026-08-26 |
| [0018](./0018-grid-edition-agnostic-vocabulary.md) | 그리드 어휘를 우리가 갖는다 | 2026-08-25 |
| [0019](./0019-excel-download-three-paths.md) | 엑셀 다운로드는 세 갈래 — 둘은 프론트, 하나는 서버 | 2026-08-26 |
| [0020](./0020-path-prefix-action-and-seed-generation.md) | 액션은 경로 접두가 정하고 인가 시드는 생성한다 | 2026-08-26 |
| [0021](./0021-reauth-modal-preserves-tabs.md) | 만료는 로그아웃이 아니다 — 재인증 모달 | 2026-08-26 |
| [0022](./0022-generated-seed-full-sync.md) | 생성 시드는 전체 동기화, 사람이 준 권한 행은 남긴다 | 2026-08-27 |
| [0023](./0023-message-key-sync-from-source.md) | 메시지 키는 코드가, 값은 사람이 소유한다 | 2026-08-28 |
| [0024](./0024-excel-upload-dedicated-tab.md) | 엑셀 업로드는 전용 탭 — 저장 경로를 새로 만들지 않는다 | 2026-08-28 |
| [0025](./0025-reference-code-definition-and-dynamic-columns.md) | 참조 코드는 그룹이 정의하고 동적 컬럼으로 나온다 | 2026-08-28 |
| [0026](./0026-config-lookup-util-and-work-scope-snapshot.md) | 설정은 조회 유틸이 읽는다 — 작업 스코프 스냅샷 | 2026-08-28 |
| [0027](./0027-menu-declared-export-action.md) | 프론트가 만드는 엑셀의 `EXPORT` 는 메뉴가 선언한다 | 2026-08-30 |
| [0028](./0028-menu-seed-upsert-and-orphan.md) | 메뉴 시드는 생성물이되 지우지 않는다 — upsert + 고아 | 2026-09-01 |
| [0029](./0029-server-text-language.md) | 소스에 남는 서버 문구는 한국어로 쓴다 — 규칙을 현실에 맞춘다 | 2026-09-04 |
| [0030](./0030-merge-three-repositories.md) | **세 저장소를 폴더 넷으로 합친다 — 축은 *누가 읽나*** | 2026-09-04 |
| [0031](./0031-single-hook-runtime.md) | **훅과 도구는 Node 하나로 돈다 — 의존성 0** | 2026-09-04 |

**서른하나가 전부 `채택` 이다** — 폐기·대체된 것이 없다.

> **0001~0029 는 백오피스 템플릿(ordinary-backoffice)의 결정이고, 0030 부터가 이 저장소의
> 결정이다.** 번호를 이어 붙인 것은 템플릿이 이 프로젝트의 것이 되었기 때문이다 —
> 두 계열로 나누면 `ADR-0012` 가 어느 계열인지 매번 물어야 한다(ADR-0030).

## 새 ADR 을 쓸 때

- 번호는 **마지막 + 1**. 파일 이름은 `{번호}-{영문-요약}.md`.
- 머리 네 줄(`상태` · `일자` · `관련`)을 지키고 **`## 맥락` → `## 결정` → `## 결과`** 로 쓴다.
- **버린 안을 반드시 적는다.** 그것이 없으면 이 문서는 규칙 문서와 다를 바가 없다.
- 이 INDEX 의 표에 한 줄을 더한다.

## 관련

- **ADR 보다 가벼운 결정은 커밋 메시지가 갖는다**(`CLAUDE.md` §9) — 별도 레지스트리를 두지 않는다.
  결정을 적는 자리가 둘이면 언젠가 갈리고, 갈렸을 때 어느 쪽이 참인지 알 방법이 없다
- **이 프로젝트(Agentic AI Hub)의 결정은 [`documents/decisions/`](../../../documents/decisions/ASSUMPTIONS.md) 가 받는다** —
  여기는 프레임워크와 템플릿의 결정이다. 프로젝트가 끝나면 여기는 남고 그쪽은 프로젝트와 함께 닫힌다
- [legacy-doc-map.md](../legacy-doc-map.md) — 같은 폴더에서 온 설계 문서 마흔여섯의 행방
- [standard/INDEX.md](../../standard/INDEX.md) — 결정이 규칙이 된 자리
