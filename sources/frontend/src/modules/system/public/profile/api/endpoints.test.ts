// @feat FEAT-501
import { describe, expect, it } from 'vitest';
import { PROFILE_ENDPOINTS } from '@/modules/system/public/profile/api/endpoints';

describe('TC-5015 프로필 API의 system public 경로', () => {
  it('내 프로필·로그인 이력·역할은 구 common/user 경로를 남기지 않는다', () => {
    expect(PROFILE_ENDPOINTS).toEqual({
      getMyProfile: '/common/system/user/getMyProfile',
      saveMyProfile: '/common/system/user/saveMyProfile',
      getMyLoginHistory: '/common/system/user/getMyLoginHistory',
      getMyRoles: '/common/system/user/getMyRoles',
      changePassword: '/common/system/auth/changePassword',
    });
  });
});
