// @feat FEAT-508
/**
 * 상세 모달이 받는 것 — screen/admin/system/batch/history/requirements.md. <b>탭 둘을 한 번에</b>.
 *
 * <p>`ErrorLogDetail` 과 달리 `*Found` 짝이 없다. 저기는 전문이 <b>다른 테이블</b>에 있어
 * *파기됐다* 와 *원래 없다* 를 갈라야 했지만(screen/admin/system/log/access/requirements.md), 여기는 <b>같은 행의 두 컬럼</b>이라
 * `null` 이면 곧 *남기지 않았다* 이다.
 */
export interface BatchHistoryDetail {
  histId: number;
  /** 처리한 대상 목록 등 — sys/batch.md. 대개 `null` 이다. */
  rsltDtlMsg: string | null;
  /** 실패 시 예외 스택. */
  errMsg: string | null;
}

/** 중단 요청의 응답 — frontend/grid.md. */
export interface BatchCancelResult {
  /** 이번에 세운 것. */
  requested: number;
  /**
   * 이미 요청돼 있던 것 — <b>오류가 아니다</b>(screen/admin/system/batch/history/requirements.md).
   *
   * <p>둘을 가르지 않으면 두 번 누른 사람이 <b>두 번 다 먹었다</b> 고 믿는다.
   */
  alreadyRequested: number;
}
