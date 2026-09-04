import { post } from '@/shared/api';
import { ACCESS_LOG_ENDPOINTS } from '@/features/accesslog/api/endpoints';
import type { AccessLogDetail } from '@/features/accesslog/types';

/**
 * 사용 이력 — 64 §3.
 *
 * <p><b>목록은 여기 없다.</b> 그리드가 `read.url` 로 직접 부르며(grid-api-contract.md §3) 그 봉투는
 * 컨트롤러가 만든다 — 화면이 조건을 모아 넘기는 자리라 함수로 감싸면 인자가 그대로
 * 다시 나열된다.
 */
export function getAccessLogDetail(accessLogSeq: number): Promise<AccessLogDetail> {
  return post<AccessLogDetail>(ACCESS_LOG_ENDPOINTS.getDetail, { accessLogSeq });
}
