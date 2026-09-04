import { describe, expect, it } from 'vitest';
import {
  editableOf,
  isEditable,
  marksRequired,
  requiredOf,
} from '@/shared/grid/columnRules';
import type { ColumnDef, EditContext } from '@/shared/grid/types';

interface Row {
  grpCd: string;
}

const row: Row = { grpCd: 'ORDER_KIND' };
const isNew: EditContext = { state: 'C' };
const saved: EditContext = { state: null };
const edited: EditContext = { state: 'U' };

const column = (extra: Partial<ColumnDef<Row>>): ColumnDef<Row> => ({
  field: 'grpCd',
  header: 'x',
  type: 'text',
  ...extra,
});

/**
 * 편집·필수 판단 — frontend/grid.md.
 *
 * <p><b>이 규칙이 두 곳에 있었다</b> — 어댑터와 검증이 각자 같은 것을 썼다. 그 상태에서
 * 규칙을 하나 더하면 한쪽만 알게 되고, 그러면 <b>셀은 잠기는데 검증은 값을 요구한다</b>:
 * 저장이 안 되는데 이유가 화면 어디에도 없다. 이 파일이 그 규칙의 유일한 자리다.
 */
describe('컬럼 규칙', () => {
  describe('pk — 셋을 한 번에 정한다', () => {
    it('신규 행에서 열린다', () => {
      expect(editableOf(column({ pk: true }), row, isNew)).toBe(true);
    });

    it('저장된 행에서는 잠긴다 — 고치는 것은 다른 행을 만드는 일이다', () => {
      expect(isEditable(column({ pk: true }), row, saved)).toBe(false);
    });

    it('고친 행에서도 잠긴다 — 상태가 U 여도 그 행은 이미 DB 에 있다', () => {
      expect(isEditable(column({ pk: true }), row, edited)).toBe(false);
    });

    it('거부에 이유가 붙는다 — 잠긴 칸은 왜 잠겼는지를 말해야 한다(frontend/grid.md)', () => {
      const verdict = editableOf(column({ pk: true }), row, saved);

      expect(verdict).not.toBe(false);
      expect(typeof verdict === 'object' && verdict.message).toBeTruthy();
    });

    it('신규 행에서 필수다 — 따로 선언하지 않는다', () => {
      expect(requiredOf(column({ pk: true }), row, isNew)).toBe(true);
    });

    it('저장된 행에서는 필수가 아니다 — 값은 이미 있고 다시 물을 수 없다', () => {
      expect(requiredOf(column({ pk: true }), row, saved)).toBe(false);
    });

    /**
     * <b>화면이 덮어쓸 수 없다.</b> 덮을 수 있으면 기본이 기본이 아니고, `editable: true`
     * 한 줄이 저장된 PK 를 여는 경로가 된다 — 그 저장은 서버에서 <i>없는 행 수정</i> 이다.
     */
    it('editable 선언이 pk 를 열지 못한다', () => {
      expect(isEditable(column({ pk: true, editable: true }), row, saved)).toBe(false);
    });

    it('renamable 이면 저장된 행에서도 열린다 — 예외는 명시해야 한다', () => {
      expect(editableOf(column({ pk: { renamable: true } }), row, saved)).toBe(true);
      expect(requiredOf(column({ pk: { renamable: true } }), row, saved)).toBe(true);
    });
  });

  describe('editable · required — pk 가 아닌 컬럼', () => {
    it('선언이 없으면 닫혀 있다 — 편집은 명시해야 열린다(frontend/grid.md)', () => {
      expect(isEditable(column({}), row, isNew)).toBe(false);
    });

    it('함수 선언을 그대로 태운다', () => {
      const only = column({ editable: (_row, ctx) => ctx.state === 'C' });

      expect(isEditable(only, row, isNew)).toBe(true);
      expect(isEditable(only, row, saved)).toBe(false);
    });

    it('편집할 수 없는 칸은 필수가 아니다 — 채울 방법이 없다(frontend/grid.md)', () => {
      expect(requiredOf(column({ required: true, editable: false }), row, isNew)).toBe(false);
    });

    it('필수도 함수일 수 있다', () => {
      const when = column({ editable: true, required: (_row, ctx) => ctx.state === 'C' });

      expect(requiredOf(when, row, isNew)).toBe(true);
      expect(requiredOf(when, row, saved)).toBe(false);
    });
  });

  /**
   * 헤더의 `*` — <b>컬럼 하나에 대한 답이라 행을 보지 않는다.</b>
   *
   * <p>그래서 행마다 갈리는 선언에는 붙일 수 없다. 붙이면 필수가 아닌 행에서도 별표가
   * 보이고, 헤더가 <b>거짓말을 한다.</b>
   */
  describe('헤더의 필수 표시', () => {
    it('pk 에는 붙는다', () => {
      expect(marksRequired(column({ pk: true }))).toBe(true);
    });

    it('required: true 이고 편집할 수 있으면 붙는다', () => {
      expect(marksRequired(column({ required: true, editable: true }))).toBe(true);
    });

    it('편집할 수 없으면 안 붙는다 — 채우려 해도 열리지 않는 칸이다', () => {
      expect(marksRequired(column({ required: true, editable: false }))).toBe(false);
      expect(marksRequired(column({ required: true }))).toBe(false);
    });

    it('필수가 함수면 안 붙는다 — 행마다 갈리므로 헤더가 말할 수 없다', () => {
      expect(marksRequired(column({ editable: true, required: () => true }))).toBe(false);
    });

    it('필수가 아니면 안 붙는다', () => {
      expect(marksRequired(column({ editable: true }))).toBe(false);
    });
  });
});
