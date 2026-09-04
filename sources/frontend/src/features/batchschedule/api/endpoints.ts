/**
 * 배치 스케줄 관리 API — 65 §3.10.
 *
 * <p>호출 URL 은 이 파일에만 둔다(frontend-stack.md §9). <b>이 선언이 `SYS_MENU_API` 시드의 입력</b>이므로
 * (ADR-0020) *선언 = 사용* 이 구조적으로 보장돼야 한다 — `generateApiSeed` 가
 * `screenRegistry` 의 `/batch/schedule` → `@/features/batchschedule` 를 따라와 여기를 읽는다.
 *
 * <p><b>폴더가 인가 경계다</b>(seed-generation.md §2). 실행 이력과 한 폴더에 두면 두 화면의 엔드포인트가
 * 서로에게 매핑되어 <b>조회 전용 화면의 권한이 등록 저장을 연다</b> — `features/log` 를
 * 갈랐던 것이 그 사고였다(64 §7-2.1). 여기서는 특히 나쁘다: `BATCH_HISTORY` 는
 * <b>저장이 없는 화면</b>인데(65 §4.8) 합치면 `save` 가 그쪽에도 붙는다.
 *
 * <p><b>`exportExcel` 이 없다 — 엑셀 자체가 없다.</b> 52 §4.2 의 액션 열이 `R S X` 이며
 * <b>②가 통째로 사라지는 첫 화면</b>이다(grid-standard.md §2.1 · 65 §3.10). 등록이 수십 건이고
 * <b>원본이 화면</b>이라(시드가 아니다) 내려받아도 결국 화면에서 고쳐야 하고,
 * `PARAM_JSON` 중괄호가 셀에 들어간 파일은 읽기도 어렵다.
 */
export const BATCH_SCHEDULE_ENDPOINTS = {
  getList: '/service/batchSchedule/getList',
  save: '/service/batchSchedule/save',
  /**
   * `BEAN_ID` 셀렉트의 후보 — <b>스프링 컨텍스트가 원본</b>이다(65 §3.3).
   *
   * <p>시드가 아니다. 시드로 두면 배포마다 구현과 목록이 어긋날 수 있고, 어긋나면 화면이
   * <i>고를 수 있는데 실행되지 않는</i> 빈을 보여준다.
   */
  getBeanList: '/service/batchSchedule/getBeanList',
  /** 하단 pane — 이 배치의 최근 실행 이력(65 §3.9). 페이징이 없다. */
  getRecentHistory: '/service/batchSchedule/getRecentHistory',
  /**
   * 즉시 실행 — 액션은 <b>`EXECUTE`</b> 다(경로 접두가 정한다 — ADR-0020).
   *
   * <p>`SYS_SCHEDULE_BATCH` 를 <b>읽기만</b> 하고 쓰는 것은 이력이다 — 61 §3.4.1 의
   * 기준(*"우리 테이블의 컬럼을 쓰는가"*)으로 봐도 저장이 아니다(65 §3.10).
   */
  runNow: '/service/batchSchedule/runNow',
} as const;
