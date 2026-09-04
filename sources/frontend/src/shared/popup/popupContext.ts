import { createContext, useContext } from 'react';
import type { OpenPopup } from '@/shared/popup/types';

/**
 * 팝업을 여는 통로 — {@link PopupHost} 가 채운다.
 *
 * <p><b>{@code PopupHost} 와 파일을 가른다.</b> 팝업을 여는 쪽(셀 편집기 · 검색 폼)이
 * 이 훅을 임포트하는데, 호스트는 <b>그리드와 검색 폼을 임포트</b>하므로 한 파일에 두면
 * 순환이 된다 — 그리드가 자기를 여는 모달을 임포트하는 모양이다.
 */
const PopupContext = createContext<OpenPopup | null>(null);

export const PopupContextProvider = PopupContext.Provider;

/**
 * 팝업을 여는 함수.
 *
 * <p><b>없으면 던진다.</b> 조용히 아무 일도 하지 않으면 <i>버튼을 눌렀는데 반응이
 * 없다</i> 가 되고, 그것은 화면에서 고장으로도 보이지 않는다 — 호스트를 앱 루트에
 * 두는 것은 <b>선택이 아니라 전제</b>이며 빠뜨렸으면 그 자리에서 죽는 편이 낫다.
 */
export function usePopup(): OpenPopup {
  const open = useContext(PopupContext);
  if (!open) {
    // 개발자용이라 영어다 — 화면에 나가는 문구가 아니다(eslint 의 sys/code.md 규칙 주석).
    throw new Error('No PopupHost in the tree: mount it inside AppProviders (playbook/INDEX.md)');
  }
  return open;
}
