import { post } from '@/shared/api';
import { USER_AUTH_ENDPOINTS } from '@/features/userauth/api/endpoints';
import type { PageResponse } from '@/shared/grid/types';
import type { UserAuthTreeRow } from '@/features/userauth/types';

/**
 * 개인 예외 권한 — screen/admin/system/user/requirements.md.
 *
 * <p><b>메뉴 전건이 온다</b> — 트리의 체크 상태를 그리려면 부여되지 않은 메뉴도 있어야
 * 한다. 사용자 관리의 `getUserMenuAuth` 가 <b>부여된 행만</b> 내는 것과 갈리는 자리다.
 */
export function getUserAuthTree(userId: string): Promise<PageResponse<UserAuthTreeRow>> {
  return post<PageResponse<UserAuthTreeRow>>(USER_AUTH_ENDPOINTS.getMenuTree, { userId });
}
