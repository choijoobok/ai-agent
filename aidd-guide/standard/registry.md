---
id: LLM-FWK-011
title: "공통물 목록 — 이미 있는 것"
category: standard
type: operation
created: 2026-09-07
updated: 2026-09-07
status: active
sources: ["sources/frontend/src/", "sources/backend/core/", "sources/backend/support/"]
tier: 1
tags: [standard, registry, shared, commons]
---

# 공통물 목록 — 이미 있는 것

> **생성물이다. 손으로 고치지 않는다** — `node .claude/hooks/commons-doc.mjs --write` 가
> `shared/` · `core/` · `support/` 의 실물에서 만든다(CLAUDE.md §5-11).
> `guard-generated` 가 손편집을 막는다.

**목록에 없는 공통물은 없는 것과 같다** — 다음 사람이 찾지 못해 또 만든다
([frontend/packages.md](./frontend/packages.md) §3). 그래서 **세는 것을 사람에게 맡기지
않는다**: 폴더를 더하면 다음 생성에서 저절로 서고, 지우면 사라진다.

**고치는 절차는 [INDEX.md](./INDEX.md) 의 「이미 있는 것을 고칠 때」가 갖는다.**

| 영역 | 사는 곳 | 파일 | 어디를 읽나 |
|---|---|--:|---|
| 프론트 | `shared/api/` | 7 | [./frontend/http.md](./frontend/http.md) |
| 프론트 | `shared/authz/` | 9 | [../knowledge/sys/menu.md](../knowledge/sys/menu.md) |
| 프론트 | `shared/batch/` | 3 | [./backend/batch.md](./backend/batch.md) |
| 프론트 | `shared/code/` | 5 | [../knowledge/sys/code.md](../knowledge/sys/code.md) |
| 프론트 | `shared/components/` | 1 | [./frontend/grid.md](./frontend/grid.md) |
| 프론트 | `shared/excelupload/` | 4 | [../playbook/excel-upload.md](../playbook/excel-upload.md) |
| 프론트 | `shared/favorite/` | 3 | [../knowledge/sys/personalization.md](../knowledge/sys/personalization.md) |
| 프론트 | `shared/formmodal/` | 3 | [../playbook/modal.md](../playbook/modal.md) · [../artifact/screen/overlay/modal.md](../artifact/screen/overlay/modal.md) |
| 프론트 | `shared/grid/` | 44 | [./frontend/declarations.md](./frontend/declarations.md) · [./frontend/grid-columns.md](./frontend/grid-columns.md) · [./frontend/grid-validation.md](./frontend/grid-validation.md) 외 7 |
| 프론트 | `shared/hooks/` | 2 | [./frontend/tabs.md](./frontend/tabs.md) |
| 프론트 | `shared/i18n/` | 7 | [./frontend/i18n.md](./frontend/i18n.md) · [../artifact/screen/auto-completion.md](../artifact/screen/auto-completion.md) |
| 프론트 | `shared/menustat/` | 3 | [../knowledge/sys/personalization.md](../knowledge/sys/personalization.md) |
| 프론트 | `shared/popup/` | 4 | [../playbook/modal.md](../playbook/modal.md) · [../artifact/screen/overlay/modal.md](../artifact/screen/overlay/modal.md) |
| 프론트 | `shared/progress/` | 6 | [./frontend/progress.md](./frontend/progress.md) |
| 프론트 | `shared/routes/` | 2 | [./frontend/tabs.md](./frontend/tabs.md) |
| 프론트 | `shared/screentabs/` | 1 | [./frontend/tabs.md](./frontend/tabs.md) |
| 프론트 | `shared/searchform/` | 9 | [./frontend/declarations.md](./frontend/declarations.md) · [./frontend/search-form.md](./frontend/search-form.md) · [../artifact/screen/overlay/search-condition.md](../artifact/screen/overlay/search-condition.md) |
| 프론트 | `shared/stores/` | 3 | [./frontend/theme.md](./frontend/theme.md) |
| 프론트 | `shared/theme/` | 3 | [./frontend/theme.md](./frontend/theme.md) |
| 프론트 | `shared/tree/` | 4 | [../playbook/tree-screen.md](../playbook/tree-screen.md) |
| 프론트 | `shared/user/` | 1 | [../knowledge/sys/user-role.md](../knowledge/sys/user-role.md) |
| core | `core/domain/` | 2 | [./backend/persistence.md](./backend/persistence.md) |
| core | `core/error/` | 6 | [./backend/exception.md](./backend/exception.md) · [./backend/row-transaction.md](./backend/row-transaction.md) |
| core | `core/grid/` | 1 | [./frontend/grid.md](./frontend/grid.md) |
| core | `core/message/` | 2 | [../knowledge/sys/message.md](../knowledge/sys/message.md) |
| core | `core/response/` | 1 | [./backend/api.md](./backend/api.md) |
| core | `core/search/` | 19 | [./backend/persistence.md](./backend/persistence.md) · [./backend/search-spec.md](./backend/search-spec.md) · [./backend/search.md](./backend/search.md) 외 1 |
| support | `support/config/` | 26 | [../knowledge/sys/config.md](../knowledge/sys/config.md) |
| support | `support/excel/` | 1 | [../playbook/excel-download.md](../playbook/excel-download.md) |
| support | `support/lock/` | 9 | [./backend/batch.md](./backend/batch.md) |
| support | `support/logging/` | 5 | [./backend/logging.md](./backend/logging.md) |
| support | `support/mail/` | 1 | [./backend/mail.md](./backend/mail.md) |
| support | `support/time/` | 1 | [./backend/time.md](./backend/time.md) |

- **「사는 곳」의 뿌리 셋**: `shared/` = `sources/frontend/src/shared/` ·
  `core/` = `sources/backend/core/…/com/aiagent/core/` ·
  `support/` = `sources/backend/support/…/com/aiagent/support/`
- **「파일」은 테스트를 뺀 소스 수**다. 크기의 눈금이지 품질의 눈금이 아니다.
- **「어디를 읽나」는 계산이다** — 가이드 문서의 `sources:` 메타를 뒤집어 얻는다.
  `guide-drift` 훅과 **같은 매처**를 쓰므로, 여기가 빈 공통물은 **그 훅도 가리키지 못한다.**

## 어디를 읽나가 빈 것 — 0 / 33

없다.

**둘 중 하나다.** ① 문서가 정말 없다, 또는 ② 문서는 있는데 그 문서의 `sources:` 가 이
폴더를 적지 않았다. **②가 먼저다** — 적는 것이 한 줄이고, 적으면 `guide-drift` 가 그
소스를 고칠 때부터 문서를 가리킨다. ①이면 [INDEX.md](./INDEX.md) 의 진입 결정 트리에
자리를 먼저 정한다.

## 관련

- [INDEX.md](./INDEX.md) — 표준의 정본 · 고칠 때의 절차
- [frontend/packages.md](./frontend/packages.md) — 언제 `shared/` 로 올리나
- [backend/packages.md](./backend/packages.md) — `core` / `support` 의 경계
