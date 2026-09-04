import type { ColumnDef } from '@/shared/grid/types';
import { MSG } from '@/shared/i18n/messageKeys';
import type { SampleOrderItem } from '@/features/sample/types';

/**
 * 주문 품목 그리드의 컬럼 — 48 §4. **인라인 편집과 계산 컬럼**의 자리다.
 *
 * <p>**③과 ④가 같이 쓴다**(2026-09-02 — ④가 둘째 소비자가 되면서 뽑았다). 두 화면이
 * 그리는 디테일은 **같은 표**이며(68 §5.2 · §6.2), 갈리는 것은 마스터와 **축**이다.
 *
 * <p>화면마다 복제하면 컬럼 하나를 늘릴 때 한쪽만 늘고, 그 어긋남은 **두 화면을 나란히
 * 열어 보기 전까지** 아무 신호도 내지 않는다. 폴더가 가르는 것은 인가 경계이지
 * (68 §10.2) 같은 표의 정의가 아니다 — `types.ts` · `popups.ts` 와 같은 자리다.
 */
export function buildItemColumns(): ColumnDef<SampleOrderItem>[] {
  return [
    {
      field: 'itemSeq',
      header: MSG.SAMPLE_COL_ITEM_SEQ,
      type: 'number',
      width: 80,
      pinned: 'left',
      // 서버가 정한다 — 신규 행에서 비어 있고 저장 뒤에 채워진다.
    },
    {
      field: 'itemCd',
      header: MSG.SAMPLE_COL_ITEM_CD,
      type: 'text',
      width: 140,
      pinned: 'left',
      pk: true,
      required: true,
    },
    {
      field: 'itemNm',
      header: MSG.SAMPLE_COL_ITEM_NM,
      type: 'text',
      width: 200,
      required: true,
      editable: true,
    },
    {
      field: 'uomCd',
      header: MSG.SAMPLE_COL_UOM,
      type: 'code',
      width: 90,
      grpCd: 'SMPL_UOM',
      editable: true,
      editor: 'select',
    },
    {
      field: 'qty',
      header: MSG.SAMPLE_COL_QTY,
      type: 'number',
      width: 110,
      required: true,
      editable: true,
      editor: 'number',
      // 마스터와 같은 규칙이다 — 한 곳에서 계산하고 서버가 다시 센다(grid-edit-validation.md §2.3).
      afterEdit: (row) => ({ amt: (row.qty ?? 0) * (row.unitAmt ?? 0) }),
    },
    {
      field: 'unitAmt',
      header: MSG.SAMPLE_COL_UNIT_AMT,
      type: 'number',
      width: 120,
      required: true,
      editable: true,
      editor: 'number',
      afterEdit: (row) => ({ amt: (row.qty ?? 0) * (row.unitAmt ?? 0) }),
    },
    { field: 'amt', header: MSG.SAMPLE_COL_AMT, type: 'number', width: 130 },
    {
      field: 'dlvrDt',
      header: MSG.SAMPLE_COL_DLVR_DT,
      type: 'date',
      width: 120,
      precision: 'day',
      editable: true,
    },
    {
      field: 'itemStatCd',
      header: MSG.SAMPLE_COL_ITEM_STAT,
      type: 'code',
      width: 110,
      grpCd: 'SMPL_ITEM_STAT',
      renderer: 'badge',
      tone: { WAIT: 'none', PICK: 'warn', SENT: 'ok' },
      editable: true,
      editor: 'select',
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
