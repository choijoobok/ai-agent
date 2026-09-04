/**
 * 모든 응답이 지나가며 남기는 <b>세션 신호</b>.
 *
 * <p>둘을 나른다 — {@code X-Authz-Version}(50 §8.1)과 <b>401</b>(ADR-0021). 둘 다 <i>"어느
 * 화면이 부른 API 인가" 와 무관한 세션 차원의 사건</i>이라 호출부마다 처리하면 새 화면을
 * 만들 때마다 같은 코드를 다시 쓴다.
 *
 * <p><b>신호일 뿐 처리가 아니다.</b> 인터셉터는 응답을 <b>삼키지 않으며</b> 호출부는 평소대로
 * 에러를 받는다 — 401 을 받은 요청을 자동 재시도하지 않기로 했으므로(ADR-0021) 인터셉터가
 * 흐름을 붙잡을 이유가 없다.
 */
export interface ResponseSignal {
  status: number;
  /** 헤더가 없으면 `null` — "권한이 비었다" 가 아니라 "이 응답은 말해 주지 않았다" 이다. */
  authzVersion: string | null;
  /** 서버가 준 실패 코드. 401 의 사유를 가르는 데 쓴다(세션 만료 · 동시 접속으로 밀림). */
  code?: string;
  message?: string;
}

type Listener = (signal: ResponseSignal) => void;

const listeners = new Set<Listener>();

/** 구독을 끊는 함수를 준다 — 셸이 언마운트될 때 남아 있으면 옛 셸이 계속 반응한다. */
export function onResponseSignal(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitResponseSignal(signal: ResponseSignal): void {
  // 복사해서 돈다 — 리스너가 구독을 끊으면 순회 중 집합이 바뀐다.
  for (const listener of [...listeners]) {
    listener(signal);
  }
}
