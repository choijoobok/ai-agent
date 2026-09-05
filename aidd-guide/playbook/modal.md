---
id: LLM-PLY-006
title: "창을 띄운다 — 실행 인자 · 참조 팝업 · 배열 · 장문"
category: playbook
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/frontend/src/shared/formmodal/", "sources/frontend/src/shared/popup/", "sources/frontend/src/features/sample/popups.ts", "sources/frontend/src/features/sample/singleoffset/pages/SampleSingleOffsetPage.tsx"]
author: Bong Jong Hyeon
tier: 2
tags: [playbook, modal, popup, editor]
---

# 창을 띄운다 — 실행 인자 · 참조 팝업 · 배열 · 장문

> **파일 이름이 `popup-edit.md` 였다.** *등록/수정 모달* 은 이 템플릿에 **없다** —
> 같은 표에 저장 경로가 둘이 되는 그 모양을 그리드 표준이 없앴다. 실제로 있는 창 넷을
> 여기 적는다(ID 는 그대로).
>
> **실물**: `features/sample/popups.ts` · `singleoffset/`(①) · `mdhorizontal/`(④) ·
> `mdtabs/`(⑤).

## 1. 어느 창인가

| 무엇을 받나 | 창 | 선언 |
|---|---|---|
| **API 호출의 인자** | 실행 파라미터 모달 | `api.actions[].params` |
| **다른 표에서 골라 여러 칸을 채운다** | 참조 팝업 | 컬럼 `type: 'popupRef'` / 조회조건 `type: 'popupRef'` |
| **한 칸에 항목을 쌓는다** | 배열 편집 모달 | 컬럼 `editor: 'listModal'` |
| **한 칸에 긴 글** | 장문 편집 모달 | 컬럼 `editor: 'textModal'` |

**행을 편집하는 폼은 없다.** 그리드 안에서 고친다.

## 2. 실행 파라미터 모달

```ts
{
  key: 'recalc', label: MSG.SAMPLE_ACTION_RECALC, url: E.recalculateOrders,
  target: 'none', progress: true,
  params: () => openParams({
    title: MSG.SAMPLE_ACTION_RECALC_TITLE,
    fields: [
      { name: 'baseDt',  label: MSG.SAMPLE_RECALC_BASE_DT,  type: 'date',   required: true },
      { name: 'vatRate', label: MSG.SAMPLE_RECALC_VAT_RATE, type: 'number', required: true,
        defaultValue: 0.1 },
    ],
  }),
}
```

- **호스트는 `AppProviders` 가 이미 걸어 두었다.** 화면은 `useParamModal()` 을 부른다.
- **`null` 이 취소다 — 예외를 던지지 않는다.** 던지면 취소와 오류가 같은 통로로 와서
  **취소마다 에러 모달이 뜬다.**
- **`confirm` 을 함께 두지 않는다.** 이 모달이 확인을 겸한다(건수 표시 + 실행/취소).
- **`count` 는 `target: 'none'` 인 실행에 두지 않는다** — *0건에 실행합니다* 가 되어
  사용자가 멈춘다.
- **`defaultValue` 를 채운다.** 모달은 *바꿀 수 있다* 를 보이는 자리이지 빈 칸이 아니다.
  날짜는 **`YYYY-MM-DD` 문자열** — 나가는 모양과 같다.
- **칸 타입은 `number`·`date` 둘뿐이다.** 필요한 타입이 생기면 **그것을 요구하는 화면이**
  연다. 미리 열어 두면 선언은 되는데 모달이 모르는 타입이 생기고 **그 칸은 조용히 그려지지
  않는다.**
- **필수는 서버가 다시 본다.** 모달이 막는 것은 왕복을 아끼는 것이다.

## 3. 참조 팝업 — 등록은 모듈 로드에서 일어난다

```ts
// features/{도메인}/popups.ts
registerPopups({
  'sample.customer': { title: MSG.SAMPLE_POPUP_CUSTOMER,
                       read: { url: SAMPLE_OFFSET_ENDPOINTS.getCustomerList },
                       width: 520, columns: [...] },
});
// 쓰는 화면에서:  import '@/features/sample/popups';   ← 이 임포트가 등록이다
```

| 규칙 | 왜 |
|---|---|
| **키에 네임스페이스를 준다**(`sample.customer`) | 없으면 그 기능을 걷어낼 때 **공통 목록에서 줄을 지워야** 한다 |
| **`popups.ts` 는 도메인 폴더 바로 밑**이다 | 화면마다 등록하면 같은 창이 화면마다 다른 컬럼을 갖는다 |
| **조회 URL 은 그 화면의 `endpoints.ts` 에 남는다** | 그것이 인가의 근거다. **쓰는 화면은 자기 `endpoints.ts` 에도 적는다** — 적지 않으면 그 메뉴에 매핑이 없어 **403** |
| **팝업이 자기 `menuCd` 를 갖지 않는다** | 팝업의 조회는 **부르는 화면의 것**이다 |
| **후보가 몇 안 되면 조회조건을 붙이지 않는다** | *고르러 왔는데 먼저 찾아야* 하는 창이 된다 |
| **`tone` 맵을 그리드와 같게 쓴다** | 고르는 창과 고른 뒤의 색이 갈리면 **같은 값이 다른 것으로** 읽힌다 |
| **`sortable` 을 습관으로 켜지 않는다** | 후보가 아홉이고 서버가 이름순으로 준다 — 켜면 **고르러 온 창에서 정렬을 만진다** |

### `apply` 가 여러 칸을 함께 채운다

```ts
popup: { key: 'sample.customer',
         apply: (_row, picked) => picked === null ? { custId: '', custNm: '' }
                                                  : { custId: text(picked.custId),
                                                      custNm: text(picked.custNm) } }
```

- **이름만 고칠 수 있게 두면 아이디와 이름이 어긋난 행이 저장된다** — 그 사고를 구조로 막는
  것이 참조 팝업의 존재 이유다.
- **여는 칸과 담는 칸을 갈라 두지 않는다.** ①은 아이디 칸이 열고(둘 다 그린다) ④는 이름
  칸이 연다(이름만 그린다). 갈리면 사용자는 **보이지 않는 칸을 고치는** 셈이 된다.
- **팝업 행에는 타입이 없다.** 타입이 필요한 자리는 `apply` 이며 좁히는 함수를 하나 둔다.
- **함께 들어오는 값은 창에 보여준다.** 등급까지 채운다면 등급 컬럼을 낸다 — 안 보이면
  **무엇이 함께 들어오는지 모른 채** 고른다.

### 조회조건의 팝업 칸

```ts
{ field: 'custId', label: MSG.SAMPLE_COND_CUST_ID, type: 'popupRef',
  op: 'eq', ops: ['eq'], popup: 'sample.customer' }
```

- **칠 수 없어야 한다.** 칠 수 있으면 목록에 없는 키가 만들어지고, 그 조건은 *걸었는데
  0건* 이 되어 사용자가 **자기 오타를 의심할 근거가 없다.**
- **보내는 것은 키 하나다.** 이름까지 보내면 *이름으로도 걸러 달라* 는 뜻이 되어 버린다.

## 4. 배열 · 장문 편집 모달

```ts
{ field: 'tagList', type: 'list',  editor: 'listModal', listModal: { key: 'sample.tag' } }
{ field: 'memo',    type: 'text',  editor: 'textModal', maxLength: 2000 }
```

- **`listModal` 의 후보 창도 같은 레지스트리에 있다.** `popup` 과 따로 목록을 가지면 **같은
  창을 두 곳에 등록**하게 된다.
- **레지스트리에 없는 키로 열면 아무 일도 일어나지 않는다.** 호스트가 *취소* 로 돌려주므로
  사용자에게는 **눌렀는데 반응이 없는** 버튼이 되고 진짜 원인은 콘솔에만 남는다.
- **후보 마스터가 없으면 창에서 새로 만들 수 없다.** 타이핑을 열지 않는 것이 규약이며,
  마스터가 생기면 바뀌는 것은 **서버의 `from` 하나**다.

## 5. 화면이 직접 여는 창 — `controls`

```ts
{ key: 'help', slot: 'beforeTools', type: 'button', label: MSG.SAMPLE_CONTROL_HELP,
  onClick: () => modal.info({ ... }) }
```

**서버를 부르지 않는 것만 여기 둔다.** 부르면 `api.actions` 다. 화면 밖으로 데이터를
내보내는 버튼에는 `actionCd` 를 준다 — **권한이 없으면 버튼이 아예 없다.**

## 6. 커밋 전 체크리스트

- [ ] 팝업을 쓰는 화면이 그 조회 URL 을 **자기 `endpoints.ts` 에도** 적었는가
- [ ] 팝업 키에 네임스페이스가 있는가
- [ ] `params` 모달을 쓰는 액션에 `confirm` 이 **없는가**
- [ ] `apply` 가 짝이 되는 칸을 **함께** 채우는가(비울 때도)

## 관련

- [crud-screen.md §5](./crud-screen.md) — 실행 두 갈래
- [standard/frontend/grid-advanced.md](../standard/frontend/grid-advanced.md) — 컬럼 계약
- [standard/frontend/search-form.md](../standard/frontend/search-form.md) — 조회조건 칸
