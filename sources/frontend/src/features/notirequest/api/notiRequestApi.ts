import { post } from '@/shared/api';
import { NOTI_REQUEST_ENDPOINTS } from '@/features/notirequest/api/endpoints';
import type { ReqStatus } from '@/features/notirequest/types';

/**
 * 요청 처리 — screen/admin/system/notice/requirements.md.
 *
 * <p><b>여러 건을 한 번에 판정한다.</b> 처리 메모는 셋 다 같은 값이며, 비어 있으면
 * {@code null} 로 보낸다 — 빈 문자열을 넣으면 *메모를 남겼는데 비어 있다* 와 구분되지 않는다.
 */
export function updateHandle(
  targets: number[],
  reqStatCd: ReqStatus,
  handleMemo: string | null,
): Promise<void> {
  return post<void>(NOTI_REQUEST_ENDPOINTS.updateHandle, { targets, reqStatCd, handleMemo });
}
