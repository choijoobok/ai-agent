import { post } from '@/shared/api';
import { BATCH_SCHEDULE_ENDPOINTS } from '@/features/batchschedule/api/endpoints';

/**
 * 배치 스케줄 — screen/batch/schedule/requirements.md.
 *
 * <p><b>빈 목록은 배포마다 고정이다.</b> 스프링 컨텍스트에 등록된 {@code BatchJob} 을
 * 그대로 내므로 화면이 살아 있는 동안 바뀌지 않는다 — 그래서 부르는 쪽이
 * {@code staleTime: Infinity} 를 준다.
 */
export function getBeanList(): Promise<string[]> {
  return post<string[]>(BATCH_SCHEDULE_ENDPOINTS.getBeanList, {});
}
