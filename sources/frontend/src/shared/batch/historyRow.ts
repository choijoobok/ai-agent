import type { BatchExecType, BatchResultCode } from '@/shared/batch/batchCodes';

/**
 * 실행 이력 한 행 — 65 §4.2. <b>`features/` 가 아니라 `shared/` 다.</b>
 *
 * <p>소비처가 둘이다 — `BATCH_HISTORY` 의 마스터와 `BATCH_SCHEDULE` 의 하단 pane
 * (65 §3.9 가 pane 을 *"§4.2 와 같은 컬럼"* 으로 정했다). frontend-stack.md §2.1 이 <i>두 번째 화면이
 * 쓰는 순간 `shared/` 로 올린다</i> 고 정한 그 자리이며, `features` 끼리 직접 import 하면
 * <b>폴더가 인가 경계라는 규칙</b>도 함께 흐려진다(seed-generation.md §2).
 *
 * <p><b>`BatchHistoryDetail` 은 여기 없다.</b> 그것은 상세 모달만 쓰고 그 모달은
 * `BATCH_HISTORY` 의 것이다 — <b>쓰는 곳이 하나면 올리지 않는다</b>.
 */
export interface BatchHistoryRow {
  /** PK 이자 tie-breaker. 기본 숨김이며 `⚙` 에서 켠다. */
  histId: number;
  /** ISO-8601. <b>기본 정렬</b>(내림)이다. */
  startDtm: string;
  /** 셀 더블 클릭 → `BATCH_SCHEDULE` 을 그 배치로 연다(65 §4.7). */
  batchId: string;
  /**
   * 조인해 온 이름 — <b>`null` 이면 지워진 등록</b>이다(65 §3.8).
   *
   * <p>이력에 FK 가 없으므로(46 §2.2) 등록을 지워도 행은 남으며 남아야 한다. 화면은
   * `(삭제된 배치)` 로 그리고 <b>이름을 지어내지 않는다</b> — 64 §4.4 가 없는 계정에
   * 이름을 붙이지 않기로 한 것과 같은 판단이다.
   */
  batchNm: string | null;
  execTypeCd: BatchExecType;
  rsltCd: BatchResultCode;
  /**
   * <b>ms 원본</b>이다 — 표시만 `duration` 렌더러가 바꾼다(65 §4.4).
   *
   * <p>서버가 포맷한 문자열을 주면 정렬이 문자열 정렬이 되어 `9분` 이 `10분` 보다 뒤에
   * 온다. <b>정렬·필터·엑셀이 전부 이 값을 본다</b>(grid-column-contract.md §5.4).
   *
   * <p>진행 중이면 `null` 이다 — `0` 이 아니다. `SKIP_*` 행이 실제로 `0` 이라(46 §6.1)
   * 둘을 같은 값으로 두면 <b>소요 정렬이 진행 중인 행을 맨 앞에 올린다</b>.
   */
  elapsedMs: number | null;
  /** 한 줄 요약 — `VARCHAR(1000)` 이라 <b>셀에 싣는다</b>(46 §6.3). */
  rsltMsg: string | null;
  /**
   * 상세 모달의 <b>탭 둘 중 하나라도 열 것이 있는가</b>(65 §2.2).
   *
   * <p><b>`false` 면 `[보기]` 자체가 없다</b> — 열 것이 없는데 링크를 두면 *눌러 보고서야
   * 빈 것을 아는 셀*이 된다. 대상 목록을 남기지 않는 배치의 <b>성공 행</b>이 그것이다.
   */
  hasDetail: boolean;
  /** <b>`null` 이면 진행 중</b>이다. */
  endDtm: string | null;
  /** 기본 숨김 — 평소에는 볼 일이 없고 <b>중복이 의심될 때 켠다</b>(65 §4.6). */
  nodeId: string;
  /**
   * 있는데 `rsltCd` 가 아직 `RUNNING` 이면 <b>중단 중</b>이다(46 §6.2).
   *
   * <p>한 컬럼으로는 표현할 수 없는 그 상태이며, 없으면 화면이 요청 직후부터 종료까지
   * `RUNNING` 으로만 보여 <b>운영자가 버튼을 다시 누른다</b>.
   */
  cancelReqDtm: string | null;
}
