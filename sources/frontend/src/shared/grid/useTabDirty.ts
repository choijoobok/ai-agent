import { useEffect, useId } from 'react';
import { useTabIdentity } from '@/layouts/ShellLayout/tabContext';
import { useTabStore } from '@/shared/stores/tabStore';

/**
 * 이 그리드의 미저장을 <b>자기 탭에 알린다</b> — frontend/tabs.md.
 *
 * <p>셸은 미저장 보호를 여섯 자리에 이미 갖고 있다(탭 닫기 · 다른 탭 닫기 · 모두 닫기 ·
 * 상한에 걸린 희생 · 로그아웃 · 로고 새로고침). 탭바의 <b>·</b> 표시도 마찬가지다. 그런데
 * <b>{@code setDirty} 를 부르는 곳이 하나도 없어</b> {@code dirtyKeys} 가 언제나 빈
 * 배열이었다 — 준비된 여섯 통로가 <b>한 번도 열리지 않았다</b>.
 *
 * <p>여기가 그 한 자리다. {@code useGridController} 가 이것을 부르므로 <b>화면은 아무것도
 * 하지 않는다</b> — 스물두 화면에 같은 코드를 스물두 번 넣는 대신이다.
 *
 * <h2>왜 {@code useId} 인가</h2>
 *
 * <p>한 탭에 그리드가 여럿이다(사용자 상세는 여섯). 탭 열쇠만으로 알리면 <b>한 그리드가
 * 깨끗해지는 순간 다른 그리드의 미저장이 지워진다</b> — 셀 하나를 고쳐 둔 채 옆의 그리드를
 * 조회하면 경고가 조용히 사라진다. {@code useId} 는 그 인스턴스가 사는 동안 고정이라
 * <b>주장하는 쪽의 이름</b>으로 알맞다.
 *
 * <h2>셸 밖에서는 아무 일도 하지 않는다</h2>
 *
 * <p>로그인 화면의 그리드에는 탭이 없다({@code useTabIdentity} 가 {@code null}). 그 자리에는
 * 지킬 탭이 없으므로 <b>조용히 넘어간다</b>.
 */
export function useTabDirty(dirty: boolean): void {
  const identity = useTabIdentity();
  const source = useId();
  const setDirty = useTabStore((state) => state.setDirty);
  const tabKey = identity?.tabKey;

  useEffect(() => {
    if (tabKey === undefined) return;
    setDirty(tabKey, dirty, source);
  }, [tabKey, dirty, source, setDirty]);

  /*
    <b>지우는 것은 언마운트에서만</b> 한다. 위의 효과에 정리 함수를 달면 `dirty` 가 바뀔
    때마다 <i>거짓 → 참</i> 두 번을 쓰게 되고, 그 사이의 한 순간에 탭이 깨끗해 보인다.

    화면이 탭보다 먼저 사라지는 경로가 있다 — 상세 탭을 갈아 끼우거나 모달을 닫을 때다.
    그때 지우지 않으면 <b>이미 없는 그리드가 미저장을 주장한 채</b> 남는다.
  */
  useEffect(() => {
    if (tabKey === undefined) return;
    return () => setDirty(tabKey, false, source);
  }, [tabKey, source, setDirty]);
}
