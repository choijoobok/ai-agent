/** 서버 응답 봉투 — backend/api.md. 성공도 실패도 같은 모양으로 온다. */
export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  code?: string;
  message?: string;
  fields?: FieldError[];
  /** 성공에도 담긴다 — "저장은 됐는데 값이 이상하다" 는 문의가 이 값으로 요청을 특정한다. */
  traceId?: string;
}

/** 400 의 필드별 오류. 배열인 것이 규약이다 — 관계가 틀리면 같은 문구가 두 필드에 실린다. */
export interface FieldError {
  field: string;
  message: string;
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

  constructor(params: {
    code: string;
    message: string;
    status: number;
    traceId?: string;
    fields?: FieldError[];
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.traceId = params.traceId;
    this.fields = params.fields ?? [];
  }
}

/** 네트워크가 끊겼거나 서버가 봉투가 아닌 것을 돌려준 경우. 화면이 구분해 안내할 수 있게 코드를 준다. */
export const TRANSPORT_ERROR_CODE = 'err.transport';
