import type { JobProgress } from '@/shared/progress/types';

/**
 * 진행률을 <b>끝날 때까지 훑는다</b> — backend/crosscutting.md · playbook/INDEX.md.
 *
 * <p><b>따로 떼어 둔 것은 검사할 수 있게 하기 위해서다.</b> 이 규칙 셋(주기 · 세션 만료의
 * 취급 · 실패 예산)은 화면을 몰아서는 재기 어렵고, 흔들리는 검사는 없는 것보다 나쁘다
 * (2026-09-02 — 날짜 필터에서 겪었다). 시각과 통신을 주입으로 받으므로 <b>진짜 시간을
 * 기다리지 않는다</b>.
 *
 * <h2>주기가 1초인 이유</h2>
 *
 * <p>서버가 <b>진행률 1% 또는 1초 중 늦은 쪽</b>으로 쓴다(backend/crosscutting.md). 더 자주 물으면 같은
 * 값을 다시 받고, 더 뜸하면 서버가 써 둔 것을 놓친다 — <b>쓰는 쪽에 맞춘다</b>.
 *
 * <h2>세션 만료는 실패가 아니다</h2>
 *
 * <p>playbook/INDEX.md 이 <i>"세션이 만료돼도 폴링을 재개한다"</i> 로 적었다. 재인증 모달이 뜨고
 * (backend/session.md) 사람이 비밀번호를 치는 동안 <b>수십 초</b>가 지날 수 있으므로, 401 을 실패로
 * 세면 그 사이에 예산이 바닥나 <b>멀쩡히 도는 작업을 놓친다</b>. 401 은 <i>지금은 못
 * 본다</i> 이지 <i>고장</i> 이 아니다.
 *
 * <h2>못 보는 것과 실패한 것을 가른다</h2>
 *
 * <p>연속 실패가 예산을 넘으면 <b>던진다</b> — {@code FAILED} 를 지어내지 않는다. 그 둘은
 * 사용자에게 다른 사실이다: 작업이 실패한 것과 <b>우리가 진행률을 못 보는 것</b>이며,
 * 후자에서 작업은 <b>여전히 돌고 있을 수 있다</b>. 지어내면 사용자는 다시 실행하고,
 * 그때 같은 작업이 두 번 돈다.
 */
export const POLL_INTERVAL_MS = 1000;

/**
 * 연속 실패 예산 — 401 은 세지 않는다(위).
 *
 * <p>다섯인 것은 <b>일시적 끊김을 넘기되 영영 두드리지 않는</b> 선이다. 무한이면 서버가
 * 내려간 사이 창 하나가 초당 한 번씩 계속 나간다.
 */
export const POLL_MAX_FAILURES = 5;

export interface PollDeps {
  fetchOne: (jobId: string) => Promise<JobProgress>;
  sleep: (ms: number) => Promise<void>;
  /** 창을 닫았거나 화면을 떠났다 — <b>작업을 멈추는 것이 아니다</b>(playbook/INDEX.md). */
  cancelled: () => boolean;
  /** 이 오류가 <b>세션 만료</b>인가 — 실패로 세지 않는 유일한 갈래다. */
  isUnauthenticated: (error: unknown) => boolean;
}

/**
 * @param onUpdate 폴링이 값을 받을 때마다 — 창이 그것을 그린다
 * @return 끝난 상태(`DONE` · `FAILED`). <b>{@code null} 이면 중간에 그만둔 것</b>이며
 *     작업의 결과가 아니다
 * @throws 연속 실패가 예산을 넘었을 때 — <b>마지막 오류를 그대로</b> 던진다
 */
export async function pollJob(
  jobId: string,
  deps: PollDeps,
  onUpdate: (progress: JobProgress) => void,
): Promise<JobProgress | null> {
  let failures = 0;

  for (;;) {
    if (deps.cancelled()) return null;

    try {
      const progress = await deps.fetchOne(jobId);
      failures = 0;
      onUpdate(progress);
      if (progress.jobStatCd !== 'RUNNING') return progress;
    } catch (error) {
      // 세션 만료는 예산을 쓰지 않는다 — 재인증이 끝나면 다음 폴링이 그냥 나간다.
      if (!deps.isUnauthenticated(error)) {
        failures += 1;
        if (failures >= POLL_MAX_FAILURES) throw error;
      }
    }

    await deps.sleep(POLL_INTERVAL_MS);
  }
}
