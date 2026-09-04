import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFavoriteStore } from '@/shared/favorite/favoriteStore';

const api = vi.hoisted(() => ({
  getFavorites: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

vi.mock('@/shared/favorite/api/favoriteApi', () => api);

const row = (menuCd: string, sortNo: number) => ({ menuCd, sortNo, creDtm: '2026-08-30T00:00:00Z' });

/**
 * 즐겨찾기 — UX-03 · sys/menu.md.
 *
 * <p><b>토글의 방향이 조용히 뒤집히는 종류다.</b> 잘못되면 별을 눌렀을 때 <i>추가</i> 가
 * <i>제거</i> 를 부르고, 서버는 <b>없는 것을 지워도 성공</b>이라 아무 오류도 나지 않는다 —
 * 사용자가 보는 것은 <i>눌러도 아무 일이 없는 별</i> 이다.
 */
describe('즐겨찾기 스토어', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFavoriteStore.getState().clear();
  });

  it('없으면 넣는다', async () => {
    api.addFavorite.mockResolvedValue([row('MESSAGE_MGMT', 1)]);

    await useFavoriteStore.getState().toggle('MESSAGE_MGMT');

    expect(api.addFavorite).toHaveBeenCalledWith('MESSAGE_MGMT');
    expect(api.removeFavorite).not.toHaveBeenCalled();
    expect(useFavoriteStore.getState().menuCds).toEqual(['MESSAGE_MGMT']);
  });

  it('있으면 뺀다', async () => {
    api.getFavorites.mockResolvedValue([row('MESSAGE_MGMT', 1), row('CODE_MGMT', 2)]);
    await useFavoriteStore.getState().load();
    api.removeFavorite.mockResolvedValue([row('CODE_MGMT', 2)]);

    await useFavoriteStore.getState().toggle('MESSAGE_MGMT');

    expect(api.removeFavorite).toHaveBeenCalledWith('MESSAGE_MGMT');
    expect(useFavoriteStore.getState().menuCds).toEqual(['CODE_MGMT']);
  });

  it('서버가 준 순서를 그대로 쓴다 — 화면이 스스로 계산하면 다른 탭이 넣은 것과 어긋난다', async () => {
    api.getFavorites.mockResolvedValue([row('B', 1), row('A', 2)]);

    await useFavoriteStore.getState().load();

    expect(useFavoriteStore.getState().menuCds).toEqual(['B', 'A']);
  });

  it('읽기가 실패해도 셸은 선다 — 즐겨찾기 없이도 제 일을 한다', async () => {
    api.getFavorites.mockRejectedValue(new Error('down'));

    await expect(useFavoriteStore.getState().load()).resolves.toBeUndefined();
    expect(useFavoriteStore.getState().menuCds).toEqual([]);
  });

  it('로그아웃이 비운다 — 다음 사람이 앞사람의 목록을 보면 안 된다', async () => {
    api.getFavorites.mockResolvedValue([row('MESSAGE_MGMT', 1)]);
    await useFavoriteStore.getState().load();

    useFavoriteStore.getState().clear();

    expect(useFavoriteStore.getState().menuCds).toEqual([]);
  });
});
