/**
 * 실행 파라미터 모달 — grid-api-contract.md §8 · 68 §9.13. frontend-stack.md §7 의 `<FormModal>` 이 이것이다.
 *
 * <p><b>그리드 행을 편집하는 폼이 아니다.</b> grid-standard.md §1.1 이 없앤 것은 <i>같은 테이블에
 * 저장 경로가 둘</i> 이 되는 등록/수정 모달이고, 여기서 받는 것은 <b>API 호출의 인자</b>다 —
 * 그 값이 어디에 저장되는지는 그 API 가 정하며 그리드는 모른다.
 *
 * <p><b>확인을 겸한다</b>(grid-api-contract.md §8) — 건수를 표시하고 실행/취소를 두므로 {@code confirm} 을
 * 함께 켜면 같은 것을 두 번 묻는다. 그래서 {@code count} 가 선택이 아니라 <b>이 모달의
 * 일부</b>다.
 */

/**
 * 칸 하나 — <b>구현된 것만 담는다</b>.
 *
 * <p>둘뿐인 것은 68 §3.4 의 <i>일괄 재계산</i> 이 기준일과 세율을 받기 때문이며, 나머지는
 * <b>그것을 처음 요구하는 화면</b>이 가져온다(search-form-contract.md §3.4 와 같은 규칙). 어휘를 미리 열어 두면
 * 선언할 수 있는데 모달이 모르는 타입이 생기고, 그 칸은 <b>조용히 그려지지 않는다</b>.
 */
export interface ParamField {
  /** 페이로드의 키 — 서버가 `params.{name}` 으로 읽는다(grid-api-contract.md §8). */
  name: string;
  /** 메시지 키. */
  label: string;
  type: 'number' | 'date';
  /** 비우고 실행할 수 없다. 모달이 막으며 <b>서버가 다시 본다</b>(grid-edit-validation.md §3.4). */
  required?: boolean;
  /**
   * 처음 채워지는 값. <b>날짜는 `YYYY-MM-DD` 문자열</b>이다 — 나가는 모양과 같다.
   *
   * <p>기본값이 있으면 <i>흔한 쪽</i>이 이미 채워져 있어 사용자가 확인만 하면 된다.
   */
  defaultValue?: string | number;
}

export interface ParamModalSpec {
  /** 메시지 키 — 대개 그 버튼의 이름이다. */
  title: string;
  fields: ParamField[];
  /**
   * 대상 건수 — <b>이 모달이 확인을 겸하므로</b> 보인다(grid-api-contract.md §8).
   *
   * <p>{@code target: 'none'} 인 실행에는 없다. 그때 건수를 쓰면 <i>0건에 실행합니다</i> 가
   * 되어 사용자가 멈춘다.
   */
  count?: number;
}

/**
 * 모달을 열고 값을 기다린다. <b>{@code null} 이 취소</b>다(grid-api-contract.md §8).
 *
 * <p>예외를 던지지 않는 것이 규약이다 — 던지면 취소와 오류가 같은 통로로 오고, 취소마다
 * 에러 모달이 뜬다.
 */
export type OpenParamModal = (spec: ParamModalSpec) => Promise<Record<string, unknown> | null>;
