import { createContext, useContext } from 'react';
import type { OpenParamModal } from '@/shared/formmodal/types';

/**
 * 파라미터 모달을 여는 통로 — {@link FormModalHost} 가 채운다.
 *
 * <p><b>호스트와 파일을 가른다</b> — 팝업과 같은 이유다(`popupContext`). 여는 쪽은 화면
 * 코드이고 호스트는 AntD 폼을 임포트하므로, 한 파일에 두면 화면이 폼 구현을 끌고 온다.
 */
const ParamModalContext = createContext<OpenParamModal | null>(null);

export const ParamModalContextProvider = ParamModalContext.Provider;

/**
 * 실행 파라미터를 묻는 함수 — grid-api-contract.md §8.
 *
 * <p><b>없으면 던진다.</b> 조용히 {@code null} 을 돌려주면 <i>버튼을 눌렀는데 아무 일도
 * 없다</i> 가 되고(그것이 정확히 취소의 값이다), 화면에서 고장으로도 보이지 않는다.
 */
export function useParamModal(): OpenParamModal {
  const open = useContext(ParamModalContext);
  if (!open) {
    // 개발자용이라 영어다 — 화면에 나가는 문구가 아니다(eslint 의 43 §3 규칙 주석).
    throw new Error('No FormModalHost in the tree: mount it inside AppProviders (grid-api-contract.md §8)');
  }
  return open;
}
