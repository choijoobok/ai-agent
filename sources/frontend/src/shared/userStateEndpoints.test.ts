// @feat FEAT-510
import { describe, expect, it } from 'vitest';
import { FAVORITE_ENDPOINTS } from '@/shared/favorite/api/endpoints';
import { GRID_PREF_ENDPOINTS } from '@/shared/grid/pref/api/endpoints';
import { SEARCH_COND_ENDPOINTS } from '@/shared/searchform/api/endpoints';
import { MENU_STAT_ENDPOINTS } from '@/shared/menustat/api/endpoints';
import { screenFor } from '@/shared/routes/screenRegistry';
import { DASHBOARD_TAB } from '@/shared/stores/tabStore';

describe('TC-5101 공통 사용자 상태의 system 정식 API 경로', () => {
  it('즐겨찾기·그리드·저장 조회조건은 구 common 경로를 남기지 않는다', () => {
    expect(FAVORITE_ENDPOINTS).toEqual({
      getList: '/common/system/favorite/getList',
      save: '/common/system/favorite/save',
      delete: '/common/system/favorite/delete',
    });
    expect(GRID_PREF_ENDPOINTS).toEqual({
      getOne: '/common/system/gridPref/getOne',
      save: '/common/system/gridPref/save',
      delete: '/common/system/gridPref/delete',
    });
    expect(SEARCH_COND_ENDPOINTS).toEqual({
      getList: '/common/system/searchCond/getList',
      save: '/common/system/searchCond/save',
      delete: '/common/system/searchCond/delete',
    });
    expect(MENU_STAT_ENDPOINTS).toEqual({
      saveSelect: '/common/system/menu/saveSelect',
      getFrequent: '/common/system/menu/getFrequent',
    });
  });

  it('TC-5105 대시보드는 system 경로 하나로 열리고 구 경로를 남기지 않는다', () => {
    expect(DASHBOARD_TAB.pathname).toBe('/admin/system/dashboard');
    expect(screenFor('/admin/system/dashboard')).not.toBeNull();
    expect(screenFor('/dashboard')).toBeNull();
  });
});
