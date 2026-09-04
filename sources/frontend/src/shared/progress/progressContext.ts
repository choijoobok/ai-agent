import { createContext, useContext } from 'react';
import type { OpenProgress } from '@/shared/progress/types';

/**
 * 진행률 창을 여는 통로 — {@link ProgressHost} 가 채운다.
 *
 * <p><b>호스트와 파일을 가른다</b> — 팝업·파라미터 모달과 같은 이유다. 여는 쪽은 그리드
 * 컨트롤러이고 호스트는 그 모달을 그린다.
 */
const ProgressContext = createContext<OpenProgress | null>(null);

export const ProgressContextProvider = ProgressContext.Provider;

export function useProgress(): OpenProgress {
  const open = useOptionalProgress();
  if (!open) throw missingHost();
  return open;
}

/**
 * 호스트가 <b>없어도 되는</b> 자리 — 그리드 컨트롤러가 이것을 쓴다.
 *
 * <p><b>훅은 조건부로 부를 수 없다.</b> 컨트롤러는 모든 그리드에서 도는데 진행률을 쓰는
 * 실행은 드물어(선언에 {@code progress: true} 가 있는 것만), 여기서 던지면 <b>진행률과
 * 아무 상관 없는 그리드가 호스트를 요구</b>하게 된다.
 *
 * <p><b>대신 쓰는 순간에 던진다</b>({@link requireProgress}) — 팝업이 <i>여는 쪽</i>에서
 * 던지는 것과 같은 자리이며(`usePopup`), 빠뜨렸을 때 조용히 지나가지 않는 성질은 그대로다.
 */
export function useOptionalProgress(): OpenProgress | null {
  return useContext(ProgressContext);
}

/** 진행률을 <b>실제로 쓸 때</b> — 없으면 그 자리에서 죽는다. */
export function requireProgress(open: OpenProgress | null): OpenProgress {
  if (!open) throw missingHost();
  return open;
}

function missingHost(): Error {
  // 개발자용이라 영어다 — 화면에 나가는 문구가 아니다(eslint 의 43 §3 규칙 주석).
  return new Error('No ProgressHost in the tree: mount it inside AppProviders (30 §6)');
}
