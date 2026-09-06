import { useEffect } from 'react';
import { useTabStore } from '@/shared/stores/tabStore';

/**
 * <b>앱이 스스로 떠나는 중인가</b> — 그때는 브라우저에게 묻게 하지 않는다.
 *
 * <p>모듈 변수인 것이 요점이다: 이 값을 읽는 자리가 <b>이벤트 핸들러 안</b>이라 리액트의
 * 렌더 주기 밖이고, 세우는 자리와 읽는 자리 사이에 <b>렌더가 한 번도 없다</b>.
 */
let leaving = false;

/**
 * 다음 이탈 한 번은 묻지 않는다 — <b>앱이 이미 물었을 때</b> 쓴다.
 *
 * <p>로고를 눌러 셸을 새로 띄우는 길이 그 자리다(`ShellLayout.reloadShell`). 거기서는
 * 어느 탭이 미저장인지 <b>이름까지 대며</b> 물었는데, 그 직후 브라우저가 자기 문구로
 * 한 번 더 물으면 <b>같은 결정을 두 번</b> 시키는 꼴이 된다 — 두 번째 창은 무엇을
 * 잃는지 말해 주지도 못한다(문구를 넣을 수 없다).
 */
export function allowNextUnload(): void {
  leaving = true;
}

/**
 * <b>브라우저 이탈</b>에서 미저장을 지킨다 — frontend/tabs.md.
 *
 * <p>셸은 자기가 아는 이탈은 이미 막고 있었다(탭 닫기 · 로그아웃 · 로고 · 언어 변경).
 * 그런데 <b>브라우저가 하는 이탈</b>은 셸이 볼 수 없다:
 *
 * <ul>
 *   <li>새로고침(F5 · Ctrl+R · 새로고침 버튼)
 *   <li>주소창에 주소를 치고 엔터
 *   <li>브라우저 탭·창 닫기
 *   <li>뒤로 가기로 이 앱을 벗어나기
 * </ul>
 *
 * <p>넷 다 <b>같은 한 이벤트</b>로 온다. 앱은 그것을 막을 수 없고 <b>물어 달라고 요청</b>할
 * 수만 있다 — 문구는 브라우저의 것이며 <b>우리가 정할 수 없다</b>(악용을 막으려고
 * 브라우저가 거부한다). 그래서 셸 안의 확인들이 여전히 필요하다: 저쪽은 <i>어느 탭</i> 을
 * 말해 주고 이쪽은 말해 주지 못한다.
 *
 * <h2>미저장일 때만 건다</h2>
 *
 * <p>늘 걸어 두면 <b>bfcache 가 꺼진다</b> — 뒤로 가기가 캐시된 페이지 대신 전체 재적재가
 * 되어 앱이 느려진다. 게다가 브라우저에 따라 <b>깨끗한 상태에서도 창이 뜬다</b>.
 *
 * @return 미저장 탭이 있는가 — 셸의 다른 자리가 같은 사실을 쓴다
 */
export function useUnsavedGuard(): boolean {
  const hasUnsaved = useTabStore((state) => state.dirtyKeys.length > 0);

  useEffect(() => {
    if (!hasUnsaved) return;

    const ask = (event: BeforeUnloadEvent) => {
      // 앱이 이미 물었다 — 한 번 쓰고 내린다.
      if (leaving) {
        leaving = false;
        return;
      }
      /*
        <b>둘 다 필요하다.</b> 표준은 `preventDefault()` 이고, 사파리와 옛 브라우저는
        아직 `returnValue` 가 비어 있지 않은지로 판단한다. 하나만 두면 어느 한쪽에서
        <b>조용히 안 뜬다</b> — 안 뜨는 보호는 없는 보호다.
      */
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', ask);
    return () => window.removeEventListener('beforeunload', ask);
  }, [hasUnsaved]);

  return hasUnsaved;
}
