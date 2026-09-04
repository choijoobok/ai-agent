import { get, post } from '@/shared/api';
import { GRID_PREF_ENDPOINTS } from '@/shared/grid/pref/api/endpoints';

/** 서버가 주는 것 — 시그니처가 맞는 것만 온다. 다르면 `null` 이다(UX-13). */
export interface StoredGridPref {
  prefJson: string;
}

export function getGridPref(
  menuCd: string,
  gridId: string,
  signature: string,
): Promise<StoredGridPref | null> {
  return get<StoredGridPref | null>(GRID_PREF_ENDPOINTS.getOne, {
    params: { menuCd, gridId, signature },
  });
}

export function saveGridPref(
  menuCd: string,
  gridId: string,
  prefJson: string,
  signature: string,
): Promise<void> {
  return post<void>(GRID_PREF_ENDPOINTS.save, { menuCd, gridId, prefJson, signature });
}

export function resetGridPref(menuCd: string, gridId: string): Promise<void> {
  return post<void>(GRID_PREF_ENDPOINTS.delete, { menuCd, gridId });
}
