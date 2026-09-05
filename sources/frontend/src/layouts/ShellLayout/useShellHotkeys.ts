import { useEffect } from 'react';
import type { EntryTab } from '@/layouts/ShellLayout/entryTabs';

/**
 * 셸 단축키 — <b>진입 모달을 검색 탭으로 연다</b>(frontend/tabs.md).
 *
 * <p><b>두 가지로 연다.</b> `Ctrl/Cmd + K` 와 <b>`Shift` 두 번</b>이다. 뒤쪽은 조합이 아니라
 * <b>같은 키를 잇달아</b> 누르는 것이라 한 손으로 되고 다른 무엇과도 겹치지 않는다 — 어떤
 * 조합을 고르든 브라우저나 OS 가 이미 쓰고 있을 수 있는데, <b>수정자 키 하나에는 아무도
 * 기능을 걸지 않는다</b>.
 *
 * <p><b>사이더의 검색 칸으로 포커스를 옮기던 것을 바꿨다</b>(2026-08-29). 그 칸은 사이더가
 * 접히면 사라지고 자동 숨기기를 켜면 아예 화면에 없다 — <b>단축키가 여는 자리가
 * 그때그때 다르면 단축키가 아니다</b>. 모달은 사이더의 상태와 무관하게 늘 같은 곳에 열린다.
 *
 * <p>`Ctrl+W`·`Ctrl+T`·`Ctrl+N` 은 쓰지 않는다 — 가로챌 수 없거나 가로채면 사용자가
 * 브라우저를 잃는다.
 */

/**
 * 두 번으로 치는 간격(ms).
 *
 * <p>짧으면 <i>빠르게 두 번</i> 이 실제로 어려워지고, 길면 <b>대문자를 잇달아 치다가</b>
 * 열린다 — `Shift+A` 다음 `Shift+B` 사이가 이 안에 들어온다. 그 경우는 <b>사이에 낀 다른
 * 키</b>로 걸러내므로 간격은 여유 있게 잡는다.
 */
const DOUBLE_TAP_MS = 400;

export function useShellHotkeys(openEntry: (tab: EntryTab) => void): void {
  useEffect(() => {
    let lastShiftAt = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        // 누르고 있는 것은 두 번이 아니다 — 키 반복이 저절로 조건을 채워 버린다.
        if (event.repeat) {
          return;
        }
        // 이벤트의 `timeStamp` 가 아니라 지금 시각을 본다 — 둘은 같은 시계이고 차이는
        // 밀리초 몇 개인데, `timeStamp` 는 읽기 전용이라 **테스트에서 시간을 밀 수 없다**.
        // 400ms 를 실제로 기다리는 검사는 두지 않는다.
        const now = performance.now();
        if (now - lastShiftAt <= DOUBLE_TAP_MS) {
          lastShiftAt = 0;
          openEntry('search');
          return;
        }
        lastShiftAt = now;
        return;
      }

      // 사이에 다른 키가 끼면 두 번이 아니다. `Shift+A` 뒤에 `Shift+B` 로 대문자를 잇달아
      // 치는 것이 그 경우이며, 이 한 줄이 없으면 **타이핑 중에 모달이 튀어나온다**.
      lastShiftAt = 0;

      if (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) {
        // 크롬은 Ctrl+K 를 주소창 검색으로 쓴다 — 막지 않으면 포커스를 잃는다.
        event.preventDefault();
        openEntry('search');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openEntry]);
}
