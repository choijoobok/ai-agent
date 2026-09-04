import { post } from '@/shared/api';
import { BATCH_HISTORY_ENDPOINTS } from '@/features/batchhistory/api/endpoints';
import type { BatchHistoryDetail } from '@/features/batchhistory/types';

/** 배치 실행 이력 — screen/batch/schedule/requirements.md. 목록과 중단은 그리드 선언이 부른다(frontend/grid.md). */
export function getBatchHistoryDetail(histId: number): Promise<BatchHistoryDetail> {
  return post<BatchHistoryDetail>(BATCH_HISTORY_ENDPOINTS.getDetail, { histId });
}
