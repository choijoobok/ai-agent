/**
 * 공개 메시지 번들의 경로 — 50 §3.2.
 *
 * <p>호출 URL 은 `api/endpoints.ts` 에만 둔다(frontend-stack.md §9). 메시지는 기능이 아니라 셸 전체가 쓰는
 * 것이라 `features/` 가 아니라 `shared/` 에 있으며, ESLint 예외는 파일 이름에 걸려 있어
 * (`**\/api/endpoints.ts`) 위치와 무관하게 성립한다.
 */
export const MESSAGE_ENDPOINTS = {
  getBundle: '/public/message/getBundle',
} as const;
