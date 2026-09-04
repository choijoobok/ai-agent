import { post } from '@/shared/api';
import { ROLE_AUTH_ENDPOINTS } from '@/features/roleauth/api/endpoints';
import type { PageResponse } from '@/shared/grid/types';
import type { RoleAuthGrant, RoleAuthTreeRow } from '@/features/roleauth/types';

/**
 * 역할 권한 — screen/menu/requirements.md.
 *
 * <p><b>메뉴 전건이 온다</b> — 부여되지 않은 메뉴도 트리에 있어야 체크할 수 있다.
 */
export function getRoleAuthTree(roleId: string): Promise<PageResponse<RoleAuthTreeRow>> {
  return post<PageResponse<RoleAuthTreeRow>>(ROLE_AUTH_ENDPOINTS.getMenuTree, { roleId });
}

/**
 * 부여 저장 — <b>화면이 든 전건을 보낸다</b>(screen/menu/requirements.md).
 *
 * <p>차이만 보내면 <i>지운 것</i>을 표현할 자리가 없다. 서버는 이 목록을 그 역할의
 * 부여 전부로 보고 맞춘다.
 */
export function saveRoleAuth(roleId: string, grants: RoleAuthGrant[]): Promise<void> {
  return post<void>(ROLE_AUTH_ENDPOINTS.save, { roleId, grants });
}
