import { useEffect, useState } from 'react';
import { useUiStore } from '@/shared/stores/uiStore';

/**
 * `system` 은 OS 설정을 따른다 — UX-08 · main-shell.md §9.7.
 *
 * <p><b>구독을 건다.</b> 최초 값만 읽으면 사용자가 로그인한 채로 OS 를 다크로 바꿔도 앱은
 * 라이트로 남는다 — <i>"시스템 따름"</i> 이 <i>"앱을 켤 때의 시스템"</i> 이 되어 버린다.
 *
 * <p><b>셸과 그리드가 같은 답을 봐야 한다.</b> AG Grid 는 antd 토큰을 자동으로 따라오지
 * 않으므로 어댑터가 모드를 직접 골라야 하는데(grid-standard.md §8), 그 판정이 여기 하나가 아니면
 * <b>셸은 다크인데 그리드만 라이트</b>인 화면이 나온다.
 */
export function useResolvedDark(): boolean {
  const mode = useUiStore((state) => state.themeMode);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  );

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return mode === 'system' ? systemDark : mode === 'dark';
}
