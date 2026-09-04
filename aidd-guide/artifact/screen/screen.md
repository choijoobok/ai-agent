---
id: LLM-PMT-001
title: "화면 요청 → 승인까지 일곱 단계"
category: "03-prompt"
type: operation
created: 2026-05-04
updated: 2026-09-04
status: active
sources: ["documents/screenaidd-guide/artifact/template/02-requirements.md", "documents/screen/README.md", "CLAUDE.md"]
author: Bong Jong Hyeon
tier: 1
tags: [prompt, requirements, procedure]
---

# 화면 요청 → 승인까지 **일곱 단계**

> **승인 전에는 아무것도 만들지 않는다**(CLAUDE.md §5.3). 이 문서는 *그 승인에 도달하는
> 절차* 이고, 요건서의 **형식은 [`documents/screenaidd-guide/artifact/template/02-requirements.md`](../template/02-requirements.md))**
> 가 갖는다.

## 절차

```
1. 페이지 경로를 정한다        ← 폴더 이름이 여기서 나온다
2. 폴더를 만든다               cp -r aidd-guide/artifact/template/ documents/screen/{경로}
3. 소스에서 확인한다           표 · 컬럼 · 코드그룹 · 비슷한 화면
4. Overlay 를 고른다           화면 특성 → 반드시 채울 절과 물을 질문
5. 초안을 쓰고 미결을 모은다   §9 에 질문을 모아 한 번에 낸다
6. 목업을 그린다               mockup.html — 요건서에서만 나온다
7. 승인을 받는다               "승인 YYYY-MM-DD" 를 §0 문서 상태에 적는다
```

**목업이 이 절차 안에 있다.** 승인은 *요건서와 목업을 함께* 보는 판단이므로
(CLAUDE.md §5.3 — ①과 ②는 한 번에 낸다), 요건서만 승인받고 목업에서 뒤집히면
그 승인이 무효가 된다. **목업을 뒤로 미루면 승인이 두 번 필요해진다.**

## 1. 페이지 경로를 먼저 정한다

**폴더 이름이 페이지 경로이므로**(CLAUDE.md §5.1) 이것이 안 정해지면 문서를 놓을 자리가
없다. `screenRegistry.ts` 의 키가 될 값이며 `menu-tree.yaml` 의 `url` 과 1:1 이다.

- **기존 경로와 겹치는지 본다.** 겹치면 새 화면이 아니라 **기존 화면의 변경**이다.
- **경로를 나중에 바꾸면 폴더도 같은 커밋에서 `git mv` 한다.**

## 2. 템플릿을 복사한다

```bash
cp -r aidd-guide/artifact/template/ documents/screen/{페이지경로}
```

**섹션을 지우지 않는다.** 해당 없으면 **"없음" 이라고 쓴다** — 빈 칸은 *아직 안 정했다* 와
구별되지 않는다.

## 3. 소스에서 확인한다 — **추측이 시작되는 자리**

| 확인할 것 | 어디 |
|---|---|
| 표와 컬럼이 실제로 있나 | `sources/backend/domain/…/entity/` · [09-knowledge/sys/](../../knowledge/sys/INDEX.md) |
| 코드 그룹이 있나 | 시드 changeset · `SYS_CODE_GROUP` |
| 메시지 키를 새로 만드나 | `sources/frontend/src/shared/i18n/messageKeys.ts` · `MsgKey.java` |
| **비슷한 화면이 이미 있나** | `sources/frontend/src/features/` · 샘플 여섯 |
| 페이지 경로가 비었나 | `screenRegistry.ts` |

> **비슷한 화면을 먼저 찾는 것이 이 단계의 절반이다.** 있으면 요건서가 짧아진다 —
> *`/sample/md-vertical` 과 같다* 한 줄이 스무 줄을 대신한다.

**없는 표를 요건서가 만들 수 없다.** 표가 없으면 그것부터가 미결이며 §9 에 적는다.

## 4. Overlay 를 고른다

화면 특성 → [overlays/INDEX.md](./overlay/INDEX.md). Overlay 는 **요건서의 어느 절이
필수가 되는지**와 **무엇을 물어야 하는지**를 준다.

**둘 이상 겹치는 것이 정상이다** — 마스터-디테일 + 조회조건 + 엑셀은 흔한 조합이다.

## 5. 초안을 쓴다 — 세 가지를 구분해서

| 표기 | 뜻 |
|---|---|
| 그대로 | **사용자가 준 것** — 바꾸지 않는다 |
| 🤖 | **AI 가 보완한 것** — 검토 대상([auto-completion.md](./auto-completion.md)) |
| §9 | **모르는 것** — 미결로 모은다 |

**질문을 한 번에 낸다.** 초안을 다 쓰고 §9 에 모아서 묻는다 — 한 항목마다 멈추면
사용자가 같은 문맥을 여러 번 복원해야 한다.

### 적지 않는 것

- **어떻게** — 컴포넌트명·prop·훅·함수명. 그것은 표준과 구현의 몫이다.
- **이미 표준인 공통 동작** — 그리드 크롬·푸터·페이징·컬럼 필터·감사 넷·조회/저장 흐름·
  권한 게이팅·HTTP 호출 방식. **적으면 표준이 둘이 된다.**

### 반드시 적는 것

**해석 여지를 없애는 식별자**: DB 테이블·컬럼명 · 공통코드 그룹 · 메시지 키 · 페이지 경로 ·
메뉴코드. 조건·검증·상태 전이는 **컬럼명(+값) 기준**으로 쓴다.

## 6. 목업을 그린다

**요건서에서만 나온다.** 목업이 요건서에 없는 것을 그리게 되면 **요건서를 먼저 고친다** —
그러지 않으면 승인받은 것과 만들 것이 갈린다.

- 형식은 [`documents/screenaidd-guide/artifact/template/03-mockup.html`](../template/03-mockup.html)) 이 갖는다.
  `<style>` 블록을 **그대로 복사**한다.
- 담는 것은 **배치 · 상태 · 테스트케이스**(정상 · 경계 · 거부)다.
  구현 코드와 실제 데이터는 담지 않는다(CLAUDE.md §5.2).
- **근거를 적지 않는다.** 근거는 요건서가 갖고 목업은 그것을 그림으로 옮긴 것이다 —
  둘이 어긋나면 요건서가 맞다.
- 메뉴얼이 실을 화면에는 `id="키" data-manual="키"` 를 단다.

**`manual.md` 는 여기서 쓰지 않는다** — 화면이 선 뒤다(CLAUDE.md §5.3 ④).

## 7. 승인

- §0 의 **문서 상태**에 `승인 YYYY-MM-DD` 를 적는다.
- **§9 가 비어야 승인이다.** 미결이 남은 채 착수하면 그 항목은 **구현이 임의로 정하게 된다.**
- 승인 뒤에는 [11-playbook](../../playbook/INDEX.md) 으로 넘어간다.

## 요청이 모호할 때 — 묻는 다섯

```
- 페이지 경로: /{...} 로 하면 되나?
- 화면 유형: 단일 그리드 / 마스터-디테일(상하·좌우) / 디테일 탭 / 대시보드?
- 처리 유형: 조회 전용 / CRUD / 실행?
- 대상 표: {...} 가 맞나? 없으면 새로 만드나?
- 쓰는 액션: R · S · E · X 중 무엇인가?
```

**이 다섯이 정해지지 않으면 §0 을 채울 수 없고, §0 이 비면 나머지 절이 전부 흔들린다.**

## 기존 화면을 고칠 때

**새 문서를 만들지 않는다.** 그 화면의 셋을 열어 **달라지는 절만** 고치고, §10 변경 이력에
한 줄 적는다. 소스와 **같은 커밋**에 담는다.

## 관련

- [crud.md](./crud.md) — 가장 흔한 요청의 실제 대화
- [auto-completion.md](./auto-completion.md) — 채울 것과 물을 것
- [overlays/INDEX.md](./overlay/INDEX.md) — 화면 특성별 질문
- [`documents/screen/README.md`](../../../documents/screen/README.md) — 셋의 역할
