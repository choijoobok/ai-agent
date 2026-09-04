/** 서버 `ConfigRow` 와 1:1 — screen/code/requirements.md. */

/** 서버 `ConfigValueType` 과 1:1. 화면이 아는 것은 <b>여기까지</b>다(screen/code/requirements.md). */
export type ConfigValueType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';

export interface ConfigRow {
  /** PK. <b>코드가 정한다</b> — 화면이 만들지 않는다. */
  cfgKey: string;
  /** `yml` 기본값. <b>언제나 있다</b> — 없으면 서버가 이미 기동에 실패했다(sys/code.md). */
  defaultVal: string;
  /** 적용값. `SYS_CONFIG` 행이 없으면 <b>기본값을 복사해</b> 내려온다. */
  cfgVal: string;
  cfgType: ConfigValueType;
  /**
   * 필드 Javadoc. <b>오버라이드 행이 없어도 비지 않는다</b> — 원천이 빌드 산출물이다
   * (screen/code/requirements.md). 프로세서가 빠진 배포에서만 `null` 이다.
   */
  cfgDesc: string | null;
  /**
   * `변경됨` 의 근거 — <b>값이 다른가가 아니라 행이 있는가</b>다(screen/code/requirements.md).
   *
   * <p>되돌릴 수 있는 행인지도 이것이 정한다. 값이 기본값과 같아도 행이 있으면
   * <b>되돌릴 것이 있다</b>.
   */
  overridden: boolean;
  /** 감사 4컬럼은 <b>오버라이드 행이 있는 키에만</b> 값이 있다. */
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}
