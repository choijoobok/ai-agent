import { post } from '@/shared/api';
import { ERROR_LOG_ENDPOINTS } from '@/features/errorlog/api/endpoints';
import type { ErrorLogDetail } from '@/features/errorlog/types';

/** 에러 로그 — 64 §5. 스택은 `nclob` 이라 목록에 실리지 않는다(64 §2.4). */
export function getErrorLogDetail(exceptionLogSeq: number): Promise<ErrorLogDetail> {
  return post<ErrorLogDetail>(ERROR_LOG_ENDPOINTS.getDetail, { exceptionLogSeq });
}
