/** 서버 `MessageKeyRow` · `MessageValue` 와 1:1 — screen/code/requirements.md. */

export type MessageScope = 'FRONT' | 'BACK' | 'BOTH' | 'DATA' | 'NONE';

export interface MessageValue {
  langCd: string;
  /** 비어 있으면 미번역이다. **빈 문자열이 아니라 `null`** 이다(sys/code.md). */
  msgVal: string | null;
}

export interface MessageKeyRow {
  msgKey: string;
  /** 읽기 전용 — 시드가 소유한다(sys/message.md). 저장 DTO 에 필드가 없다. */
  useScope: MessageScope;
  /** 사용처의 파생. 서버가 계산해 내려준다 — 경계의 정의가 한 곳이어야 한다(sys/code.md). */
  bundled: boolean;
  msgDesc: string | null;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
  /** 지원 언어 전부. 값이 없는 언어도 `msgVal: null` 인 항목으로 들어 있다. */
  values: MessageValue[];
}
