/** 서버 응답 봉투 — backend/api.md. 성공도 실패도 같은 모양으로 온다. */
export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  code?: string;
  message?: string;
  fields?: FieldError[];
  rows?: RowError[];
  /** 성공에도 담긴다 — "저장은 됐는데 값이 이상하다" 는 문의가 이 값으로 요청을 특정한다. */
  traceId?: string;
}

/** 400 의 필드별 오류. 배열인 것이 규약이다 — 관계가 틀리면 같은 문구가 두 필드에 실린다. */
export interface FieldError {
  field: string;
  message: string;
  /**
   * 서버가 보고 거부한 값. <b>행을 되찾은 오류에는 없어도 된다</b> — 그때는 화면이 들고
   * 있는 값을 쓴다(사용자가 지금 보고 있는 것이 그것이므로).
   */
  value?: string;
}

/**
 * 요청 배열의 <b>몇 번째 행</b>이 왜 거부됐나 — 그리드 저장의 것이다(backend/api.md).
 *
 * <p><b>값이 아니라 순번으로 가리킨다.</b> 중복은 <i>같은 값인 행이 둘 이상</i> 이라는
 * 뜻이므로, 값으로 찾게 하면 어느 쪽을 칠할지 고를 수 없다.
 *
 * <p>{@link fields} 가 배열인 것이 복합 키를 나르는 방법이다 — 키가 두 컬럼이면 두 칸이
 * 함께 붉어져야 <i>이 조합이 중복</i> 이 표현된다.
 */
export interface RowError {
  index: number;
  fields: FieldError[];
}

/**
 * <b>행마다 커밋되는 목록</b>의 결과 — backend/row-transaction.md.
 *
 * <p><b>오류가 아니라 데이터로 온다</b>(200 · {@code data}). 부분 성공을 오류 봉투로
 * 보내면 488건이 저장된 요청도 화면에서 <i>실패</i> 로 읽히기 때문이며, <b>전건이 실패해도
 * 같은 모양</b>이다 — 둘 다 사용자가 할 일이 같다(표를 보고 고쳐 다시 낸다).
 *
 * <p>{@link rows} 의 순번은 <b>요청 배열</b>의 것이다({@link RowError}).
 */
export interface RowReport {
  total: number;
  done: number;
  failed: number;
  rows: RowError[];
}

/**
 * 화면이 받는 실패. <b>문구를 조립하지 않는다</b> — 서버가 완성한 {@link message} 를 그대로
 * 표시하고, 분기가 필요할 때만 {@link code} 를 본다(backend/packages.md · frontend/packages.md).
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly traceId?: string;
  readonly fields: FieldError[];
  readonly rows: RowError[];

  constructor(params: {
    code: string;
    message: string;
    status: number;
    traceId?: string;
    fields?: FieldError[];
    rows?: RowError[];
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.traceId = params.traceId;
    this.fields = params.fields ?? [];
    this.rows = params.rows ?? [];
  }
}

/** 네트워크가 끊겼거나 서버가 봉투가 아닌 것을 돌려준 경우. 화면이 구분해 안내할 수 있게 코드를 준다. */
export const TRANSPORT_ERROR_CODE = 'err.transport';
