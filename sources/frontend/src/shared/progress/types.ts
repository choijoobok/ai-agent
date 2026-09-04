/**
 * 진행률 — backend/crosscutting.md · sys/batch.md · playbook/INDEX.md.
 *
 * <p><b>화면이 폴링 코드를 쓰지 않는다.</b> 실행({@code ActionApi})이 {@code progress: true}
 * 를 적으면 그리드가 응답의 {@code jobId} 를 이 훅에 넘긴다 — frontend/grid.md 이 렌더 함수를 열지
 * 않은 것과 같은 이유다: 화면마다 폴링 주기·중단 조건·실패 처리가 갈리면 <b>같은 기능이
 * 화면 수만큼</b> 생긴다.
 */

/** 서버가 아는 상태 셋 — sys/batch.md 의 `JOB_STAT_CD`. */
export type JobStatus = 'RUNNING' | 'DONE' | 'FAILED';

export interface JobProgress {
  jobId: string;
  jobStatCd: JobStatus;
  curCnt: number;
  /**
   * <b>{@code null} 일 수 있다</b>(sys/batch.md) — 전체를 모르는 작업이 있다.
   *
   * <p>그때 화면은 <b>불확정 막대</b>를 그린다. 0 으로 치환하면 {@code 0/0} 이라
   * <i>완료</i> 로 보인다.
   */
  totCnt: number | null;
  /**
   * 지금 <b>어느 구간</b>인가 — 창의 소제목이 된다. <b>서버가 임의로 정한다</b>.
   *
   * <p>한 실행이 구간으로 갈릴 때만 온다. 고른 행마다 딸린 디테일 수천 건을 처리하는
   * 실행이 그것이며, 그때 <b>하나의 퍼센트로는 둘 중 하나만 말할 수 있다</b> — 소제목이
   * <i>어느 행</i>을 말하고 막대가 <i>그 행이 어디까지</i> 를 말한다.
   *
   * <p>{@code stepMsg} 와 <b>갈라야 한다</b>. 그쪽은 구간 안에서 계속 바뀌므로 한 줄에
   * 둘을 쓰면 <b>어느 행을 보고 있는지가 1초마다 사라진다</b>.
   */
  subTitle: string | null;
  /** 지금 무엇을 하는 중인가 — 퍼센트만 있으면 <i>멈춘 것</i>과 <i>느린 것</i>이 같다. */
  stepMsg: string | null;
  /** 실패 사유. `FAILED` 에서만 있다. */
  errMsg: string | null;
  modDtm: string;
}

export interface ProgressOptions {
  /** 창의 제목 — 메시지 키다. 대개 그 실행의 이름이다. */
  title: string;
  /**
   * <b>{@code DONE} 뒤에</b> 부른다(playbook/INDEX.md) — 도는 중에 재조회하면 <b>절반만 반영된
   * 목록</b>을 본다.
   */
  onDone?: () => void;
  /** 실패. 모달은 사유를 표시한 채 남는다 — 닫는 것은 사용자다. */
  onFail?: (message: string) => void;
}

/**
 * 진행률 창을 열고 <b>끝날 때까지</b> 기다린다.
 *
 * <p><b>모달을 닫아도 약속은 계속 산다</b>(playbook/INDEX.md — <i>모달은 닫을 수 있고 작업은 계속
 * 돈다</i>). 닫는 것은 <i>보는 것</i>을 그만두는 일이지 작업을 멈추는 일이 아니며,
 * 그래서 {@code onDone} 은 창이 닫힌 뒤에도 온다 — 목록은 갱신되어야 한다.
 */
export type OpenProgress = (jobId: string, options: ProgressOptions) => Promise<void>;
