import { beforeEach, describe, expect, it } from 'vitest';
import {
  DASHBOARD_TAB,
  TAB_LIMIT,
  useTabStore,
  type OpenTarget,
} from '@/shared/stores/tabStore';

/**
 * 멀티탭의 규칙 — frontend/packages.md · frontend/tabs.md.
 *
 * <p>여기서 지키는 것은 <b>탭이 사라지거나 늘어나는 경로가 예측 가능한가</b>이다.
 * 사용자가 잃는 것이 <b>입력 중이던 값</b>이므로, 조용히 닫히는 경로가 하나라도 있으면
 * 그것이 곧 데이터 유실이다.
 */
describe('tabStore', () => {
  const target = (menuCd: string): OpenTarget => ({
    menuCd,
    pathname: `/${menuCd.toLowerCase()}`,
    titleKey: `menu.${menuCd}`,
  });

  beforeEach(() => {
    useTabStore.getState().reset();
  });

  it('대시보드가 언제나 첫 자리에 있다 — 탭바가 사라지는 순간이 없다', () => {
    expect(useTabStore.getState().tabs).toEqual([DASHBOARD_TAB]);
    expect(useTabStore.getState().activeKey).toBe(DASHBOARD_TAB.key);
  });

  it('메뉴를 열면 그 탭이 활성이 된다', () => {
    const outcome = useTabStore.getState().open(target('USER_MGMT'));

    expect(outcome.type).toBe('opened');
    expect(useTabStore.getState().tabs).toHaveLength(2);
    expect(useTabStore.getState().activeKey).not.toBe(DASHBOARD_TAB.key);
  });

  it('이미 열린 메뉴를 다시 열면 전환만 한다 — 인스턴스는 명시적 조작으로만 는다', () => {
    const first = useTabStore.getState().open(target('USER_MGMT'));
    useTabStore.getState().open(target('ROLE_MGMT'));

    const again = useTabStore.getState().open(target('USER_MGMT'));

    expect(again).toEqual({ type: 'activated', key: keyOf(first) });
    expect(useTabStore.getState().tabs).toHaveLength(3);
  });

  it('"새 탭으로 열기" 는 언제나 새 인스턴스다 — 같은 화면 둘을 나란히 보려는 것이다', () => {
    useTabStore.getState().open(target('ORDER'));
    useTabStore.getState().openNewInstance(target('ORDER'));

    const orders = useTabStore.getState().tabs.filter((tab) => tab.menuCd === 'ORDER');
    expect(orders).toHaveLength(2);
    // key 가 pathname 이면 둘을 구분할 수 없다 — 이것이 frontend/packages.md 의 핵심이다.
    expect(orders[0].key).not.toBe(orders[1].key);
    expect(orders.map((tab) => tab.instance)).toEqual([1, 2]);
  });

  it('인스턴스 번호를 다시 매기지 않는다 — 눈앞의 탭 제목이 스스로 바뀌지 않게', () => {
    const first = useTabStore.getState().open(target('ORDER'));
    useTabStore.getState().openNewInstance(target('ORDER'));

    useTabStore.getState().close(keyOf(first));

    expect(useTabStore.getState().tabs.at(-1)?.instance).toBe(2);
  });

  describe('상한', () => {
    it('상한은 비고정 탭 기준이다 — 대시보드가 한 칸을 잡아먹지 않는다', () => {
      openMany(TAB_LIMIT);

      expect(useTabStore.getState().tabs).toHaveLength(TAB_LIMIT + 1);
    });

    it('상한에 닿으면 열지 않고 대상을 알려준다 — 말없이 닫지 않는다', () => {
      openMany(TAB_LIMIT);

      const outcome = useTabStore.getState().open(target('ONE_TOO_MANY'));

      expect(outcome.type).toBe('limit');
      // 취소하면 새 탭을 열지 않는다 — 현재 화면 그대로다(frontend/packages.md).
      expect(useTabStore.getState().tabs).toHaveLength(TAB_LIMIT + 1);
    });

    it('닫을 대상은 위치가 아니라 나이다 — 드래그로 자리를 바꿔도 바뀌지 않아야 한다', () => {
      openMany(TAB_LIMIT);
      const oldest = useTabStore.getState().tabs[1];

      // 드래그 순서 변경을 흉내낸다: 가장 먼저 연 탭을 배열 끝으로 옮긴다.
      const shuffled = [
        ...useTabStore.getState().tabs.filter((tab) => tab.key !== oldest.key),
        oldest,
      ];
      useTabStore.setState({ tabs: shuffled });

      const outcome = useTabStore.getState().open(target('ONE_TOO_MANY'));

      expect(outcome.type === 'limit' && outcome.victim.key).toBe(oldest.key);
    });

    it('확인을 받으면 그 탭을 닫고 연다', () => {
      openMany(TAB_LIMIT);
      const outcome = useTabStore.getState().open(target('ONE_TOO_MANY'));
      if (outcome.type !== 'limit') throw new Error('상한에 닿아야 한다');

      useTabStore.getState().closeAndOpen(outcome.victim.key, target('ONE_TOO_MANY'));

      const tabs = useTabStore.getState().tabs;
      expect(tabs).toHaveLength(TAB_LIMIT + 1);
      expect(tabs.some((tab) => tab.key === outcome.victim.key)).toBe(false);
      expect(tabs.some((tab) => tab.menuCd === 'ONE_TOO_MANY')).toBe(true);
    });
  });

  describe('닫기', () => {
    it('대시보드는 어떤 경로로도 닫히지 않는다', () => {
      useTabStore.getState().open(target('USER_MGMT'));

      useTabStore.getState().close(DASHBOARD_TAB.key);
      useTabStore.getState().closeAll();
      useTabStore.getState().closeOthers('nothing');

      expect(useTabStore.getState().tabs).toEqual([DASHBOARD_TAB]);
    });

    it('"다른 탭 닫기" 는 현재 탭과 대시보드를 남긴다', () => {
      useTabStore.getState().open(target('A'));
      const keep = useTabStore.getState().open(target('B'));
      useTabStore.getState().open(target('C'));

      useTabStore.getState().closeOthers(keyOf(keep));

      expect(useTabStore.getState().tabs.map((tab) => tab.menuCd)).toEqual(['DASHBOARD', 'B']);
    });

    it('활성 탭이 닫히면 첫 탭으로 간다 — 활성 탭이 없는 순간이 없다', () => {
      const opened = useTabStore.getState().open(target('USER_MGMT'));

      useTabStore.getState().close(keyOf(opened));

      expect(useTabStore.getState().activeKey).toBe(DASHBOARD_TAB.key);
    });

    it('비활성 탭이 닫혀도 활성 탭은 그대로다', () => {
      const first = useTabStore.getState().open(target('A'));
      const second = useTabStore.getState().open(target('B'));

      useTabStore.getState().close(keyOf(first));

      expect(useTabStore.getState().activeKey).toBe(keyOf(second));
    });

    it('닫힌 탭의 미저장 표시는 함께 사라진다 — 남으면 유령 탭 때문에 계속 묻는다', () => {
      const opened = useTabStore.getState().open(target('USER_MGMT'));
      useTabStore.getState().setDirty(keyOf(opened), true);

      useTabStore.getState().close(keyOf(opened));

      expect(useTabStore.getState().dirtyKeys).toEqual([]);
    });
  });

  describe('권한 변경 정리', () => {
    it('권한을 잃은 메뉴의 탭을 닫고 무엇을 닫았는지 돌려준다', () => {
      useTabStore.getState().open(target('KEEP'));
      useTabStore.getState().open(target('REVOKED'));

      const closed = useTabStore.getState().retain(['DASHBOARD', 'KEEP']);

      expect(closed.map((tab) => tab.menuCd)).toEqual(['REVOKED']);
      expect(useTabStore.getState().tabs.map((tab) => tab.menuCd)).toEqual(['DASHBOARD', 'KEEP']);
    });

    it('권한이 통째로 사라져도 대시보드는 남는다 — 셸이 빈 화면이 되지 않는다', () => {
      useTabStore.getState().open(target('REVOKED'));

      const closed = useTabStore.getState().retain([]);

      expect(useTabStore.getState().tabs).toEqual([DASHBOARD_TAB]);
      expect(useTabStore.getState().activeKey).toBe(DASHBOARD_TAB.key);
      // 닫힌 목록에도 없어야 한다 — 있으면 "대시보드 탭을 닫았습니다" 라는 거짓 안내가 나간다.
      // 닫기 구현이 고정 탭을 지켜 주므로 실제로 닫히지는 않지만, 그래서 더 조용하다.
      expect(closed.map((tab) => tab.menuCd)).toEqual(['REVOKED']);
    });

    it('잃은 것이 없으면 아무 탭도 닫지 않는다 — 매 응답마다 도는 경로다', () => {
      useTabStore.getState().open(target('KEEP'));

      expect(useTabStore.getState().retain(['DASHBOARD', 'KEEP'])).toEqual([]);
      expect(useTabStore.getState().tabs).toHaveLength(2);
    });
  });

  it('로그아웃 정리는 대시보드 하나로 되돌린다', () => {
    useTabStore.getState().open(target('USER_MGMT'));
    useTabStore.getState().setDirty(useTabStore.getState().activeKey, true);

    useTabStore.getState().reset();

    expect(useTabStore.getState().tabs).toEqual([DASHBOARD_TAB]);
    expect(useTabStore.getState().dirtyKeys).toEqual([]);
  });

  function openMany(count: number) {
    for (let index = 0; index < count; index += 1) {
      useTabStore.getState().open(target(`MENU_${index}`));
    }
  }
});

function keyOf(outcome: { type: string } & Record<string, unknown>): string {
  if (outcome.type === 'limit') throw new Error('열리지 않았다');
  return outcome.key as string;
}

/**
 * 드래그 순서 변경 — frontend/packages.md.
 *
 * <p><b>고정 탭은 두 방향을 다 막아야 한다.</b> 집는 것만 막으면 대시보드는 못 옮기는데
 * <b>다른 탭이 그 왼쪽으로 들어간다</b> — 결과는 같다: 대시보드가 맨 왼쪽이 아니게 된다.
 */
describe('탭 순서 바꾸기', () => {
  const seed = () => {
    const store = useTabStore.getState();
    store.reset();
    store.open({ menuCd: 'A', pathname: '/a', titleKey: 'A' });
    store.open({ menuCd: 'B', pathname: '/b', titleKey: 'B' });
    store.open({ menuCd: 'C', pathname: '/c', titleKey: 'C' });
    return useTabStore.getState().tabs;
  };
  const order = () => useTabStore.getState().tabs.map((tab) => tab.menuCd);

  it('끌어다 놓은 자리로 간다', () => {
    const tabs = seed();
    // 맨 오른쪽(C)을 A 자리로.
    useTabStore.getState().move(tabs[3].key, tabs[1].key);

    expect(order()).toEqual(['DASHBOARD', 'C', 'A', 'B']);
  });

  it('고정 탭은 집히지 않는다', () => {
    const tabs = seed();
    useTabStore.getState().move(tabs[0].key, tabs[2].key);

    expect(order()).toEqual(['DASHBOARD', 'A', 'B', 'C']);
  });

  it('고정 탭의 자리로는 들어갈 수 없다 — 대시보드는 언제나 맨 왼쪽이다', () => {
    const tabs = seed();
    useTabStore.getState().move(tabs[2].key, tabs[0].key);

    expect(order()).toEqual(['DASHBOARD', 'A', 'B', 'C']);
  });

  it('없는 탭이나 제자리는 아무 일도 아니다', () => {
    const tabs = seed();
    useTabStore.getState().move(tabs[1].key, tabs[1].key);
    useTabStore.getState().move('없다', tabs[1].key);

    expect(order()).toEqual(['DASHBOARD', 'A', 'B', 'C']);
  });
});
