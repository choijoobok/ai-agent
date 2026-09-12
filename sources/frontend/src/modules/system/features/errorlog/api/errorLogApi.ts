// @feat FEAT-507
import { post } from '@/shared/api';
import { ERROR_LOG_ENDPOINTS } from '@/modules/system/features/errorlog/api/endpoints';
import type { ErrorLogDetail } from '@/modules/system/features/errorlog/types';

/** 에러 로그 — screen/admin/system/log/error/requirements.md. 스택은 `nclob` 이라 목록에 실리지 않는다(screen/admin/system/log/error/requirements.md). */
export function getErrorLogDetail(exceptionLogSeq: number): Promise<ErrorLogDetail> {
  return post<ErrorLogDetail>(ERROR_LOG_ENDPOINTS.getDetail, { exceptionLogSeq });
}
