import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import { onResponseSignal } from '@/shared/api';
import { useAuthStore } from '@/shared/stores/authStore';
import { tabTitle, useTabStore } from '@/shared/stores/tabStore';
import { fetchMe } from '@/features/auth/api/authApi';
import { useSessionCleanup } from '@/features/auth/session';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';

export interface SessionSignalsState {
  /** 401 을 받았고 복구를 시도할 수 있다 — `null` 이면 모달을 띄우지 않는다. */
  reauth: { reason?: string } | null;
  dismissReauth: () => void;
  giveUp: () => Promise<void>;
}

/**
 * 세션 차원의 사건 둘을 처리한다 — <b>401</b>(ADR-0021)과 <b>권한 변경</b>(50 §8.1).
 *
 * <p>둘 다 <i>어느 화면이 부른 API 인가와 무관</i>하므로 호출부마다 두면 새 화면을 만들 때마다
 * 같은 코드를 다시 쓴다. <b>앱 최상단에 하나</b>만 둔다.
 *
 * <p><b>셸 안이 아니라 앱 최상단인 것이 필요하다.</b> 권한 버전의 <b>기준값</b>은 로그인
 * 응답이 실어 오는데(50 §8.1) 그 순간 셸은 아직 없다 — 셸 안에 두면 기준값을 놓치고,
 * 셸이 뜬 뒤 처음 본 헤더를 "바뀌었다" 로 오해한다.
 */
export function useSessionSignals(): SessionSignalsState {
  const [reauth, setReauth] = useState<{ reason?: string } | null>(null);
  const { message } = App.useApp();
  const cleanup = useSessionCleanup();

  // 재조회가 겹치지 않게 한다. 헤더는 모든 응답에 실리므로 한 화면이 여러 API 를 동시에
  // 쏘면 같은 재조회가 그 수만큼 걸린다.
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const session = await fetchMe();
      useAuthStore.getState().signIn(session);

      if (session.menus.length === 0) {
        // 유효 권한이 공집합이면 로그인 자체가 차단되는 상태다 — 재인증해도 들어올 수 없다.
        message.warning(label(MSG.SESSION_NO_AUTHORITY));
        await cleanup();
        return;
      }

      // 권한을 잃은 메뉴의 탭은 이제 403 만 낸다 — 50 §8.2.
      const closed = useTabStore.getState().retain(session.menus);
      if (closed.length > 0) {
        // 활성 탭이 말없이 닫히면 사용자는 자기가 뭘 잘못 눌렀다고 생각한다.
        message.warning(
          label(MSG.SESSION_AUTHZ_CHANGED, {
            tabs: closed.map((tab) => tabTitle(tab, label)).join(', '),
          }),
        );
      }
    } catch {
      // 재조회가 실패하면 옛 트리로 남는다. 서버 판정은 이미 최신이므로 데이터가 새지는
      // 않는다 — 보이는데 누르면 403 인 상태로 되돌아갈 뿐이다.
    } finally {
      refreshing.current = false;
    }
  }, [cleanup, message]);

  useEffect(
    () =>
      onResponseSignal((signal) => {
        const state = useAuthStore.getState();

        if (signal.status === 401) {
          // F5 후에는 `authStore` 가 비어 있고 유지할 탭도 없다 — 그때는 로그인 화면이다.
          // 두 조건이 항상 함께 움직이므로 판정에 별도 플래그가 필요 없다(ADR-0021).
          if (state.user) {
            setReauth({ reason: signal.message });
          }
          return;
        }

        if (!signal.authzVersion) {
          return;
        }
        if (state.authzVersion === null) {
          // 첫 관찰은 기준값이다. "바뀌었다" 가 아니다.
          state.observeAuthzVersion(signal.authzVersion);
          return;
        }
        if (state.authzVersion !== signal.authzVersion) {
          state.observeAuthzVersion(signal.authzVersion);
          void refresh();
        }
      }),
    [refresh],
  );

  return {
    reauth,
    dismissReauth: () => setReauth(null),
    giveUp: async () => {
      setReauth(null);
      await cleanup();
    },
  };
}
