import { useEffect, useRef } from 'react';

interface Params<K extends string> {
  /** 모달이 떠 있는 동안만 듣는다 — 닫힌 모달이 셸의 키를 먹으면 안 된다. */
  open: boolean;
  /** 탭의 <b>차례</b>. 이 배열의 순서가 왼쪽·오른쪽이다. */
  keys: readonly K[];
  active: K;
  onChange: (key: K) => void;
  /**
   * 탭이 <b>그려지지 않는 동안</b> 참 — 옮기지 않되 <b>키는 그대로 삼킨다</b>.
   *
   * <p>알림 모달의 상세 화면(frontend/tabs.md · `NI-09`)과 프로필 모달의 로딩 구간이 그렇다. 삼키는
   * 것을 함께 놓으면 그 순간에만 <b>뒤에 가린 셸의 탭바가 조용히 움직인다</b> — 상세를 보다
   * 닫았더니 다른 화면이 열려 있는 것이 그 증상이다.
   */
  hold?: boolean;
}

/**
 * <b>탭을 가진 모달의 `PageUp`/`PageDown`</b> — frontend/tabs.md.
 *
 * <p>`PageUp`/`PageDown` 은 원래 셸의 탭바를 옮기는데, <b>탭을 가진 모달이 떠 있으면 그
 * 모달의 것</b>이다 — 보고 있는 탭을 두고 뒤에 가린 탭바가 움직이면 무엇이 바뀌었는지 알 수
 * 없다. 탭이 없는 모달(설정·만료 예고)에서는 그대로 셸까지 올라간다.
 *
 * <p><b>진입 모달에 있던 것을 여기로 올렸다</b>(2026-09-01 — 지시). frontend/tabs.md 은 처음부터
 * <i>"탭을 가진 모달"</i> 이라 적었는데 구현은 진입 모달 하나뿐이었다 — 알림·프로필 모달에서는
 * 맨 `PageDown` 이 그 창을 지나 <b>셸로 내려갔다</b>. 셋이 같은 규칙을 따르는 유일한 방법은
 * 규칙을 한 곳에 두는 것이다(frontend/packages.md — 두 번째가 쓰면 `shared/` 로 올린다).
 *
 * <h2>`window` 에서, 캡처로 듣는다</h2>
 *
 * <p>모달의 화살표·Enter 와 다르게 다룬다. 저것들은 <b>모달을 연 키와 같은 키</b>라 `window`
 * 에서 들으면 자기를 연 키를 자기가 듣지만, `PageUp`/`PageDown` 으로 여는 경로는 없으므로 그
 * 함정이 없다. 대신 <b>포커스가 어디에 있든</b> 들어야 한다 — 모달 안의 빈 곳을 한 번 눌러
 * 포커스가 빠지면, 래퍼에서만 듣는 방식은 조용히 셸의 탭바를 옮긴다.
 *
 * <p><b>캡처인 것이 셸보다 먼저인 이유다.</b> 셸도 `window` 에서 듣는데(버블 —
 * `useTabHotkeys`), 캡처가 먼저 돌아 여기서 멈추면 그쪽까지 가지 않는다. 두 곳이 <b>같은
 * 키</b>를 듣게 된 뒤로는 이것이 <i>편의</i> 가 아니라 <b>가르는 규칙 그 자체</b>다 — 셸은
 * <i>"지금 어떤 모달이 떠 있나"</i> 를 알 필요가 없다.
 *
 * <p><b>수정자가 붙은 것은 이 단축키가 아니다</b>(frontend/tabs.md). 셸과 같은 규칙이라 길이 하나다.
 *
 * <p><b>인자는 ref 로 따라간다.</b> `keys` 를 렌더마다 만들어 넘겨도(`TABS.map`) 리스너를 다시
 * 걸지 않게 하려는 것이고, 그래서 효과의 의존성은 `open` 하나다 — 매 렌더 리스너를 떼고 다시
 * 거는 코드는 <b>키 하나가 그 틈에 빠지는</b> 종류의 버그를 남긴다.
 */
export function useModalTabHotkeys<K extends string>(params: Params<K>): void {
  // 커밋 뒤마다 갱신한다 — 키는 커밋이 끝난 다음에 들어오므로 리스너가 읽는 값은 늘 최신이다.
  const latest = useRef(params);
  useEffect(() => {
    latest.current = params;
  });

  const { open } = params;
  useEffect(() => {
    if (!open) {
      return;
    }
    const onTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'PageUp' && event.key !== 'PageDown') {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      // **삼키는 것이 옮기는 것보다 먼저다.** 탭이 가려진 동안(`hold`)에도 이 창의 키다.
      event.preventDefault();
      event.stopPropagation();

      const { keys, active, onChange, hold } = latest.current;
      if (hold || keys.length === 0) {
        return;
      }
      const step = event.key === 'PageDown' ? 1 : -1;
      // 없는 탭이 활성으로 들어와도 멈추지 않는다 — 맨 앞에서 시작한 것으로 본다.
      const from = Math.max(keys.indexOf(active), 0);
      onChange(keys[(from + step + keys.length) % keys.length]);
    };

    window.addEventListener('keydown', onTabKey, true);
    return () => window.removeEventListener('keydown', onTabKey, true);
  }, [open]);
}
