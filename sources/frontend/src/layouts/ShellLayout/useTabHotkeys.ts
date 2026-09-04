import { useEffect } from 'react';
import { useTabStore } from '@/shared/stores/tabStore';

/**
 * `PageUp`/`PageDown` — main-shell.md §10.1.
 *
 * <p><b>브라우저 뒤로/앞으로와 다른 이동이다.</b> 그쪽은 <b>방문 순서</b>(아까 보던 탭)이고
 * 이것은 <b>위치 순서</b>(바로 왼쪽·오른쪽 탭)다. 열린 탭들을 훑을 때 쓴다.
 *
 * <p><b>수정자 없이도 듣는다</b>(2026-08-29 — 지시). 처음에는 <i>"그리드와 긴 폼의 페이지
 * 스크롤을 잃는다"</i> 를 이유로 `Alt` 를 요구했는데, PC 에서 탭을 넘기는 데 손가락 둘을
 * 쓰는 것은 <b>단축키의 값을 절반으로 깎는다</b>.
 *
 * <p><b>이제는 수정자 없는 것만 듣는다</b>(2026-08-31 — 지시). 그 뒤로 한동안 `Alt` 를 붙여도
 * 같이 들었는데, <b>같은 일에 길이 둘이면 어느 것이 정본인지 손과 문서가 갈린다</b> — 표에는
 * 둘이 적히고 사람은 하나만 쓰며 고칠 때는 둘 다 고쳐야 한다. 남는 것은 <b>짧은 쪽</b>이다.
 *
 * <p><b>대신 화면이 그 키를 쓰는 자리는 비켜 간다</b> — 셋이다. ① 화면이 <b>이미 처리한</b>
 * 키(`defaultPrevented`), ② <b>글을 쓰는 자리</b>(입력·편집 영역), ③ <b>그리드 안</b>.
 * 그리드는 이 키로 행을 넘긴다([53](53-grid-standard.md)).
 *
 * <p>이것이 예전에 거부한 <i>"포커스 위치로 분기"</i> 다. 그때 걱정한 것은 <i>"어떤 때는
 * 스크롤되고 어떤 때는 탭이 바뀐다"</i> 였는데, <b>가르는 선이 눈에 보이는 것</b>이면
 * 예측할 수 있다 — 입력 칸 안인지, 그리드 안인지는 커서가 어디 있는지로 안다.
 *
 * <p><b>`Ctrl`·`Cmd` 가 눌려 있으면 비켜 간다.</b> 그쪽은 브라우저의 탭 전환이라, 우리가
 * 함께 움직이면 <b>브라우저 탭과 화면 탭이 한 번에</b> 바뀐다.
 *
 * <p>`Ctrl + PageUp/PageDown` 은 브라우저의 탭 전환이라 쓸 수 없고, 탭 <b>닫기</b> 단축키는
 * 아직 정해지지 않았다 — `Ctrl+W` 를 브라우저가 선점하기 때문이다(main-shell.md §12 미결).
 */
export function useTabHotkeys(selectTab: (key: string) => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'PageUp' && event.key !== 'PageDown') {
        return;
      }
      // 수정자가 붙은 것은 이 단축키가 아니다. `Ctrl`·`Cmd` 는 **브라우저의 탭 전환**이라
      // 우리까지 움직이면 둘이 한 번에 바뀌고, 나머지는 **길이 하나여야 하기** 때문이다.
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      // 화면이 이미 썼거나, 화면이 쓰는 자리에서 났다.
      if (event.defaultPrevented || screenOwnsKey(event.target)) {
        return;
      }
      const { tabs, activeKey } = useTabStore.getState();
      const current = tabs.findIndex((tab) => tab.key === activeKey);
      if (current < 0) {
        return;
      }
      event.preventDefault();

      // 끝에서 순환한다 — 마지막 탭에서 오른쪽으로 가면 첫 탭(대시보드)으로 돌아온다.
      const step = event.key === 'PageUp' ? -1 : 1;
      const next = (current + step + tabs.length) % tabs.length;
      // 위치 이동도 탭 전환이므로 pushState 가 쌓인다 — 방문 순서에 기록되고 뒤로가기로
      // 되짚을 수 있다(main-shell.md §10.1).
      selectTab(tabs[next].key);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectTab]);
}

/**
 * 이 키가 <b>화면의 것</b>인가.
 *
 * <p>글을 쓰는 자리에서는 캐럿이 움직여야 하고, 그리드 안에서는 행이 넘어가야 한다. 둘 다
 * <b>커서가 어디 있는지로 눈에 보이는</b> 경계라 사용자가 예측할 수 있다.
 */
function screenOwnsKey(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  // `closest` 로 본다 — 그리드는 실제 포커스가 셀 안쪽 요소에 있다.
  return target.closest('input, textarea, select, .ag-root-wrapper') !== null;
}
