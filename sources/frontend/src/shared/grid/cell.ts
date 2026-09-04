import { label } from '@/shared/i18n/label';
import type { ColumnDef } from '@/shared/grid/types';

/**
 * 컬럼 하나가 <b>행에서 값을 읽고 쓰는 방법</b> — grid-column-contract.md §2.2 · §3.
 *
 * <p>어댑터·검증·엑셀이 각자 {@code row[column.field]} 를 하고 있었다. 컬럼 대부분은 그것이
 * 맞지만 <b>파생 컬럼</b>(값이 계산된다)과 <b>동적 컬럼</b>(값이 맵의 한 칸이다)은 아니며,
 * 세 곳이 각자 알면 <b>한 곳만 고쳐졌을 때 조용히 갈린다</b> — 셀에는 보이는데 엑셀에는
 * 빈 칸인 식이다.
 */

/** 이 컬럼이 그 행에서 보여줄 값. {@code derive} 가 있으면 그것이 값이다(grid-column-contract.md §3). */
export function cellValue<T>(column: ColumnDef<T>, data: T): unknown {
  return column.derive
    ? column.derive(data)
    : (data as Record<string, unknown>)[column.field];
}

/**
 * 편집한 값을 행에 되쓰는 패치 — {@code patch} 가 없으면 {@code field} 에 그대로 쓴다.
 *
 * <p>동적 컬럼은 저장되는 컬럼이 하나가 아니라 <b>맵의 한 칸</b>이라 그 맵을 통째로 새로
 * 만들어야 한다(grid-column-contract.md §2.2).
 */
export function cellPatch<T>(column: ColumnDef<T>, data: T, value: unknown): Partial<T> {
  return column.patch
    ? column.patch(data, value)
    : ({ [column.field]: value } as Partial<T>);
}

/**
 * 헤더 문자열 — <b>동적 컬럼만 메시지 키가 아니다</b>(grid-column-contract.md §2.2).
 *
 * <p>그 헤더는 정의 행의 {@code REF_NM} 이며 <b>관리 화면 전용 명칭</b>이라 다국어가 아니다
 * (43 §5.2). {@code label()} 에 그대로 넣어도 대개는 키를 못 찾아 원문이 나오지만, <b>대개</b>
 * 로 두면 어느 날 {@code REF_NM} 이 실재하는 키와 같아졌을 때 <b>남의 번역</b>이 헤더에 뜬다.
 */
export function headerText<T>(column: ColumnDef<T>): string {
  return column.dynamic ? column.header : label(column.header);
}
