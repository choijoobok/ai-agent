import { post } from '@/shared/api';
import { USER_ENDPOINTS } from '@/features/user/api/endpoints';
import type { PageResponse } from '@/shared/grid/types';
import type { RoleCandidate } from '@/features/user/types';

/**
 * 사용자 관리 — screen/user/requirements.md.
 *
 * <p><b>이 화면이 자기 역할 후보 경로를 갖는다</b>(screen/user/requirements.md). `ROLE_MGMT` 의 목록을 부르면
 * 그 요청이 <b>역할 관리의 `READ`</b> 를 요구하게 되어(backend/api.md) 사용자 관리만 가진
 * 사람이 역할을 부여할 수 없다.
 */
export function getRoleCandidates(): Promise<PageResponse<RoleCandidate>> {
  return post<PageResponse<RoleCandidate>>(USER_ENDPOINTS.getRoleCandidates, {});
}
