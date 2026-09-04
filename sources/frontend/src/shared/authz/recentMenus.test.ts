import { beforeEach, describe, expect, it } from 'vitest';
import { RECENT_LIMIT, readRecentMenus, rememberRecentMenu } from '@/shared/authz/recentMenus';

/**
 * 최근 연 메뉴 — frontend/tabs.md.
 *
 * <p><b>여기서 지키는 것 셋이다.</b> ① 최근이 맨 앞이다, ② 같은 메뉴는 <b>옮기는 것</b>이지
 * 쌓는 것이 아니다, ③ <b>모양이 깨진 저장소를 믿지 않는다</b>.
 *
 * <p>③이 조용히 깨진다 — `localStorage` 는 사람 손이 닿는 곳이고, 배열이 아닌 것을 그대로
 * 돌리면 목록을 그리는 자리에서 터진다.
 */
describe('최근 연 메뉴', () => {
  beforeEach(() => window.localStorage.clear());

  it('최근이 맨 앞이다', () => {
    rememberRecentMenu('A');
    rememberRecentMenu('B');

    expect(readRecentMenus()).toEqual(['B', 'A']);
  });

  it('같은 메뉴는 옮긴다 — 쌓으면 목록이 한 메뉴로 채워진다', () => {
    rememberRecentMenu('A');
    rememberRecentMenu('B');
    rememberRecentMenu('A');

    expect(readRecentMenus()).toEqual(['A', 'B']);
  });

  it('상한을 넘기면 오래된 것부터 떨어진다', () => {
    for (let i = 0; i <= RECENT_LIMIT; i += 1) {
      rememberRecentMenu(`M${i}`);
    }

    const recent = readRecentMenus();
    expect(recent).toHaveLength(RECENT_LIMIT);
    expect(recent[0]).toBe(`M${RECENT_LIMIT}`);
    // 가장 먼저 넣은 것이 밀려났다.
    expect(recent).not.toContain('M0');
  });

  it('모양이 깨진 저장소는 없는 것으로 친다', () => {
    window.localStorage.setItem('backoffice.recentMenus', '{"not":"an array"}');
    expect(readRecentMenus()).toEqual([]);

    window.localStorage.setItem('backoffice.recentMenus', 'not json at all');
    expect(readRecentMenus()).toEqual([]);
  });

  it('배열 안의 이물질만 골라 뺀다 — 하나가 섞였다고 전부 버리지 않는다', () => {
    window.localStorage.setItem('backoffice.recentMenus', '["A", 3, null, "B"]');
    expect(readRecentMenus()).toEqual(['A', 'B']);
  });
});
