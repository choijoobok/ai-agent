import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTabStore } from '@/shared/stores/tabStore';
import { useFavoriteStore } from '@/shared/favorite/favoriteStore';
import { useFrequentStore } from '@/shared/menustat/frequentStore';
import { setActiveMenuCode } from '@/shared/api';
import { logout as callLogout } from '@/features/auth/api/authApi';

/**
 * 로그아웃 정리 — 50 §9. <b>네 경로가 이 함수 하나로 수렴한다.</b>
 *
 * <table>
 *   <tr><td>명시적 로그아웃</td><td>헤더 버튼 — main-shell.md §3.2</td></tr>
 *   <tr><td>만료 예고 모달의 "지금 로그아웃"</td><td>아직 없다(50 §7)</td></tr>
 *   <tr><td>재인증 포기</td><td>모달의 "다른 계정으로" · 재인증 불가</td></tr>
 *   <tr><td>유효 권한 공집합</td><td>50 §8.2 — 재인증해도 로그인이 막힌다</td></tr>
 * </table>
 *
 * <p><b>경로마다 다르게 치우면 어느 하나가 빠진다.</b> 실제로 빠지기 쉬운 것은 react-query
 * 캐시다 — 비우지 않으면 다음 사용자가 앞사람의 조회 결과를 잠깐 본다.
 *
 * <p><b>`localStorage` 를 통째로 비우지 않는다.</b> 그러면 테마와 그리드 너비까지 날아가
 * 로그아웃할 때마다 화면이 초기화된다. 지우는 기준은 <i>"계정에 딸린 것인가"</i> 하나이며,
 * 지금 그에 해당하는 것은 <b>최근 사용 메뉴</b>뿐인데 아직 없다 — 진입 모달 슬라이스가
 * 그 목록을 만들 때 여기에 한 줄이 는다.
 */
export function useSessionCleanup() {
  const queryClient = useQueryClient();
  const signOut = useAuthStore((state) => state.signOut);
  const resetTabs = useTabStore((state) => state.reset);

  return useCallback(
    async (options?: { callServer?: boolean }) => {
      if (options?.callServer !== false) {
        // 서버 세션을 끊지 못해도 프론트 정리는 반드시 한다 — 이미 401 이어서 부르는
        // 경우가 있고, 그때 예외가 정리를 건너뛰면 화면이 로그인된 것처럼 남는다.
        await callLogout().catch(() => undefined);
      }
      signOut();
      queryClient.clear();
      resetTabs();
      // 즐겨찾기는 계정에 딸린 것이다 — 남기면 다음 사람이 앞사람의 목록을 본다.
      useFavoriteStore.getState().clear();
      useFrequentStore.getState().clear();
      setActiveMenuCode(null);
    },
    [queryClient, resetTabs, signOut],
  );
}
