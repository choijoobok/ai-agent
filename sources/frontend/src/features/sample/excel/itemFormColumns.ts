import type { ColumnDef } from '@/shared/grid/types';
import { MSG } from '@/shared/i18n/messageKeys';
import type { SampleOrderItem } from '@/features/sample/types';

/**
 * ⑥의 컬럼 열하나 — playbook/INDEX.md. **두 세그먼트가 같은 배열을 쓴다.**
 *
 * <p>같아야 하는 것이 취향이 아니다: ②의 **전체 다운로드가 곧 양식**이고(frontend/grid.md)
 * 업로드가 헤더를 그 선언과 대조하므로(`readWorkbook`), 갈리는 순간 **자기가 방금 내려받은
 * 파일이 양식이 아니게** 된다.
 *
 * <h2>`ITEM_SEQ` 와 `ORD_ID` 가 없다</h2>
 *
 * <p>둘 다 서버가 정하는 값이며, 양식에 있으면 **사람이 채우려 든다**(playbook/INDEX.md). 그래서
 * ③④⑤가 쓰는 `buildItemColumns` 를 그대로 쓸 수 없다 — 저 배열은 `itemSeq` 로 시작하고
 * `ordNo` 가 없다. **같은 테이블인데 배열이 둘인 유일한 자리**이며, 근거는 대상이 아니라
 * **쓰임**이다: 저것은 한 주문 안의 디테일이고 이것은 **평면 양식**이다.
 *
 * <h2>감사 컬럼도 없다</h2>
 *
 * <p>다른 화면은 등록자·수정일시를 `visible:false` 로 싣지만(숨김 두 층의 아래쪽) 여기서는
 * **선언에 있는 것이 곧 양식의 열**이다 — `readWorkbook` 이 선언 전부를 헤더로 기대하므로
 * 숨긴 컬럼도 파일의 열이 되고, 그러면 **사람이 채울 수 없는 칸 넷**이 양식에 생긴다.
 *
 * <h2>`ORD_NO` 가 부모다</h2>
 *
 * <p>사람이 채우는 엑셀에 대리키를 넣을 수 없으므로 업무 키로 나른다(playbook/INDEX.md). 서버가
 * 저장할 때 `ORD_NO → ORD_ID` 를 풀며, 없는 번호면 **그 행이 오류**다(playbook/INDEX.md).
 */
export function buildItemFormColumns(): ColumnDef<SampleOrderItem>[] {
  return [
    {
      field: 'ordNo',
      header: MSG.SAMPLE_COL_ORD_NO,
      type: 'text',
      width: 160,
      pinned: 'left',
      sortable: true,
      /*
        **업무 키다** — 신규 행에서만 열린다(frontend/grid.md). 고치면 *이 품목을 다른 주문으로
        옮긴다* 가 되는데, 그것은 지우고 다시 만드는 일이지 한 칸을 고치는 일이 아니다.
      */
      pk: true,
      required: true,
    },
    {
      field: 'itemCd',
      header: MSG.SAMPLE_COL_ITEM_CD,
      type: 'text',
      width: 140,
      pinned: 'left',
      sortable: true,
      // `ORD_NO` 와 함께 이 표의 키다(playbook/INDEX.md) — 업로드 대조도 저장도 이 쌍으로 가리킨다.
      pk: true,
      required: true,
    },
    {
      field: 'itemNm',
      header: MSG.SAMPLE_COL_ITEM_NM,
      type: 'text',
      width: 200,
      sortable: true,
      required: true,
      editable: true,
    },
    {
      field: 'uomCd',
      header: MSG.SAMPLE_COL_UOM,
      type: 'code',
      width: 100,
      sortable: true,
      grpCd: 'SMPL_UOM',
      editable: true,
      editor: 'select',
    },
    {
      field: 'qty',
      header: MSG.SAMPLE_COL_QTY,
      type: 'number',
      width: 110,
      sortable: true,
      required: true,
      editable: true,
      editor: 'number',
      // 계산은 한 곳에서 한다 — 서버가 다시 센다(frontend/grid.md · 원칙 P1).
      afterEdit: (row) => ({ amt: (row.qty ?? 0) * (row.unitAmt ?? 0) }),
    },
    {
      field: 'unitAmt',
      header: MSG.SAMPLE_COL_UNIT_AMT,
      type: 'number',
      width: 120,
      sortable: true,
      required: true,
      editable: true,
      editor: 'number',
      afterEdit: (row) => ({ amt: (row.qty ?? 0) * (row.unitAmt ?? 0) }),
    },
    {
      /*
        **파생인데 양식에는 있다.** 서버가 다시 세므로 사용자가 채운 값은 쓰이지 않지만,
        빼면 **내려받은 파일에 금액이 없다** — 그 파일은 사람이 읽는 표이기도 하다
        (frontend/grid.md 가 *전체 다운로드가 곧 양식* 이라고 한 것의 다른 쪽 얼굴이다).
      */
      field: 'amt',
      header: MSG.SAMPLE_COL_AMT,
      type: 'number',
      width: 130,
      sortable: true,
    },
    {
      field: 'dlvrDt',
      header: MSG.SAMPLE_COL_DLVR_DT,
      type: 'date',
      width: 120,
      sortable: true,
      precision: 'day',
      editable: true,
    },
    {
      field: 'itemStatCd',
      header: MSG.SAMPLE_COL_ITEM_STAT,
      type: 'code',
      width: 110,
      sortable: true,
      grpCd: 'SMPL_ITEM_STAT',
      renderer: 'badge',
      tone: { WAIT: 'none', PICK: 'warn', SENT: 'ok' },
      editable: true,
      editor: 'select',
    },
    {
      field: 'useYn',
      header: MSG.SAMPLE_COL_USE,
      type: 'ynFlag',
      width: 90,
      sortable: true,
      editable: true,
      editor: 'switch',
    },
    {
      field: 'rmk',
      header: MSG.SAMPLE_COL_RMK,
      type: 'text',
      width: 200,
      fill: true,
      filter: false,
      editable: true,
      editor: 'largeText',
    },
  ];
}

/**
 * 업로드가 기존 행과 대조하는 키 — frontend/grid-advanced.md · playbook/INDEX.md.
 *
 * <p>**서버의 저장이 가리키는 것과 같은 쌍**이며(`SmplFlatItemSaveRow`), 900 의
 * `UK_SMPL_ITEM_CD` 가 그 유일성을 보증한다. 셋이 같은 쌍을 말해야 대조와 저장이 같은
 * 행을 가리킨다.
 */
export const ITEM_KEY_FIELDS = ['ordNo', 'itemCd'];
