import { post } from '@/shared/api';
import { CODE_ENDPOINTS } from '@/features/code/api/endpoints';
import type { PageResponse } from '@/shared/grid/types';
import type { CodeRefDefRow, CodeRow } from '@/features/code/types';

/**
 * 공통 코드 관리 — 63 §2.
 *
 * <p>그리드 셋의 조회·저장은 선언이 부른다(grid-api-contract.md §3). 여기 있는 것은 <b>그 밖의 둘</b>이다 —
 * 참조 키 화이트리스트와 정의 목록.
 */

/** 한 페이지에 담기는 상한 — 참조 키와 정의 모두 수십 건짜리 목록이다. */
const ALL = { page: 0, size: 100 };

/**
 * 참조 키 후보 — <b>전용 API 를 두지 않는다</b>(63 §2.4).
 *
 * <p>이 화면은 이미 *한 그룹의 코드* 를 읽는 경로를 갖고 있고 화이트리스트도 그 하나다 —
 * 새 경로를 내면 같은 질의가 두 벌이 된다.
 */
export function getRefKeyCodes(): Promise<PageResponse<CodeRow>> {
  return post<PageResponse<CodeRow>>(CODE_ENDPOINTS.getList, {
    conditions: [],
    sorts: [],
    page: ALL,
    params: { grpCd: 'CODE_REF_KEY' },
  });
}

/** 정의 목록 — <b>컬럼 집합의 원본</b>이다. 하단 조회와 병렬로 나간다(63 §2.4). */
export function getRefDefList(grpCd: string): Promise<PageResponse<CodeRefDefRow>> {
  return post<PageResponse<CodeRefDefRow>>(CODE_ENDPOINTS.getRefDefList, {
    conditions: [],
    sorts: [],
    page: ALL,
    params: { grpCd },
  });
}
