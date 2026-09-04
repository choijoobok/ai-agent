import { get, post } from '@/shared/api';
import { PROFILE_ENDPOINTS } from '@/features/profile/api/endpoints';
import type { MyAuthority, MyLoginRecord, MyProfile } from '@/features/profile/types';

/**
 * 탭마다 호출이 하나다 — frontend/tabs.md.
 *
 * <p>넷을 한 번에 받지 않는 이유는 **대부분 첫 탭만 보고 닫기** 때문이다. 여는 순간
 * 로그인 이력과 권한까지 읽으면 그 비용이 매번 든다.
 */
export function getMyProfile(): Promise<MyProfile> {
  return get<MyProfile>(PROFILE_ENDPOINTS.getMyProfile);
}

/** 저장된 결과를 그대로 돌려받는다 — 서버가 다듬은 값(공백·빈 메일)이 무엇인지 보인다. */
export function saveMyProfile(userNm: string, email: string | null): Promise<MyProfile> {
  return post<MyProfile>(PROFILE_ENDPOINTS.saveMyProfile, { userNm, email });
}

export function getMyLoginHistory(): Promise<MyLoginRecord[]> {
  return get<MyLoginRecord[]>(PROFILE_ENDPOINTS.getMyLoginHistory);
}

export function getMyRoles(): Promise<MyAuthority> {
  return get<MyAuthority>(PROFILE_ENDPOINTS.getMyRoles);
}

/**
 * 확인용 재입력은 보내지 않는다 — 두 값이 같은지는 **화면이 판정한다**. 서버는 새
 * 비밀번호 하나만 필요하고, 보내면 왕복 한 번이 그 확인에 쓰인다.
 */
export function changePassword(currentPwd: string, newPwd: string): Promise<void> {
  return post<void>(PROFILE_ENDPOINTS.changePassword, { currentPwd, newPwd });
}
