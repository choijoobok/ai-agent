import { describe, expect, it } from 'vitest';
import { POLL_MAX_FAILURES, pollJob, type PollDeps } from '@/shared/progress/poll';
import type { JobProgress } from '@/shared/progress/types';

const running = (curCnt: number): JobProgress => ({
  jobId: 'j1', jobStatCd: 'RUNNING', curCnt, totCnt: 100, subTitle: null, stepMsg: null,
  errMsg: null,
  modDtm: '2026-09-02T00:00:00Z',
});
const done: JobProgress = { ...running(100), jobStatCd: 'DONE' };
const failed: JobProgress = { ...running(40), jobStatCd: 'FAILED', errMsg: '단가가 없다' };

/**
 * 진행률 폴링 — backend/crosscutting.md · playbook/INDEX.md.
 *
 * <p><b>시간을 주입으로 받는다.</b> 진짜로 1초를 기다리면 검사가 느려지고, 느린 검사는
 * 곧 <i>가끔 흔들리는</i> 검사가 된다 — 그때부터 붉은 줄을 다시 돌려 보게 되고 진짜
 * 실패도 같은 취급을 받는다(2026-09-02 — 날짜 필터에서 겪었다).
 *
 * <p>여기서 세는 것은 <b>규칙 셋</b>이다: 언제 멈추는가 · 세션 만료를 어떻게 세는가 ·
 * 못 보는 것과 실패한 것을 가르는가.
 */
describe('진행률 폴링', () => {
  const deps = (
    answers: (JobProgress | Error)[],
    overrides: Partial<PollDeps> = {},
  ): PollDeps & { calls: () => number } => {
    let at = 0;
    return {
      fetchOne: () => {
        const answer = answers[Math.min(at, answers.length - 1)];
        at += 1;
        return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
      },
      sleep: () => Promise.resolve(),
      cancelled: () => false,
      isUnauthenticated: () => false,
      calls: () => at,
      ...overrides,
    };
  };

  it('끝날 때까지 훑고 종료 상태를 돌려준다', async () => {
    const settled = await pollJob('j1', deps([running(10), running(50), done]), () => undefined);

    expect(settled?.jobStatCd).toBe('DONE');
  });

  it('받을 때마다 그린다 — 퍼센트가 멈춰 있으면 화면이 멈춘 것으로 읽힌다', async () => {
    const seen: number[] = [];

    await pollJob('j1', deps([running(10), running(50), done]), (p) => seen.push(p.curCnt));

    expect(seen).toEqual([10, 50, 100]);
  });

  it('실패도 종료다 — 사유를 들고 돌아온다', async () => {
    const settled = await pollJob('j1', deps([running(10), failed]), () => undefined);

    expect(settled?.jobStatCd).toBe('FAILED');
    expect(settled?.errMsg).toBe('단가가 없다');
  });

  /*
    <b>창을 닫는 것은 작업을 멈추는 것이 아니다</b>(playbook/INDEX.md). 여기서는 <i>보는 것</i>만
    그만두므로 결과가 {@code null} 이며, 그것을 <i>작업이 끝나지 않았다</i> 로 읽으면 안
    된다 — 부르는 쪽이 {@code onDone} 을 부르지 않는 근거가 이 값이다.
  */
  it('그만두면 null 이다 — 작업의 결과가 아니다', async () => {
    const settled = await pollJob(
      'j1',
      deps([running(10)], { cancelled: () => true }),
      () => undefined,
    );

    expect(settled).toBeNull();
  });

  describe('세션 만료는 실패가 아니다 — playbook/INDEX.md', () => {
    /*
      재인증 모달이 뜨고(backend/session.md) 사람이 비밀번호를 치는 동안 <b>수십 초</b>가 지날 수
      있다. 401 을 실패로 세면 그 사이 예산이 바닥나 <b>멀쩡히 도는 작업을 놓친다</b>.
    */
    it('401 이 이어져도 예산을 쓰지 않고 재개한다', async () => {
      const answers: (JobProgress | Error)[] = [];
      for (let index = 0; index < POLL_MAX_FAILURES + 3; index += 1) {
        answers.push(new Error('401'));
      }
      answers.push(done);

      const settled = await pollJob(
        'j1',
        deps(answers, { isUnauthenticated: () => true }),
        () => undefined,
      );

      expect(settled?.jobStatCd).toBe('DONE');
    });

    it('한 번 성공하면 예산이 되돌아온다 — 일시적 끊김이 누적되지 않는다', async () => {
      const answers: (JobProgress | Error)[] = [];
      for (let index = 0; index < POLL_MAX_FAILURES - 1; index += 1) {
        answers.push(new Error('nope'));
      }
      answers.push(running(10));
      for (let index = 0; index < POLL_MAX_FAILURES - 1; index += 1) {
        answers.push(new Error('nope'));
      }
      answers.push(done);

      const settled = await pollJob('j1', deps(answers), () => undefined);

      expect(settled?.jobStatCd).toBe('DONE');
    });
  });

  /*
    <b>못 보는 것과 실패한 것을 가른다.</b> {@code FAILED} 를 지어내면 사용자는 작업이
    실패했다고 읽고 <b>다시 실행한다</b> — 그때 같은 작업이 두 번 돈다. 던지면 부르는
    쪽이 <i>진행률을 볼 수 없다</i> 로 말할 수 있다.
  */
  it('연속 실패가 예산을 넘으면 던진다 — FAILED 를 지어내지 않는다', async () => {
    const answers: Error[] = [];
    for (let index = 0; index < POLL_MAX_FAILURES; index += 1) {
      answers.push(new Error('down'));
    }

    await expect(pollJob('j1', deps(answers), () => undefined)).rejects.toThrow('down');
  });
});
