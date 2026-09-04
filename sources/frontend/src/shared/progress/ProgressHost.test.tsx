import { App } from 'antd';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressHost } from '@/shared/progress/ProgressHost';
import { useProgress } from '@/shared/progress/progressContext';
import { useMessageStore } from '@/shared/i18n/messageStore';
import type { JobProgress } from '@/shared/progress/types';

const get = vi.fn();

vi.mock('@/shared/api/request', () => ({
  get: (url: string) => get(url) as Promise<unknown>,
  post: vi.fn(),
  request: vi.fn(),
}));

/**
 * 진행률 창을 <b>닫은 뒤</b> — playbook/INDEX.md.
 *
 * <p>여기가 재는 것은 창이 아니라 <b>창이 없는 동안</b>이다. 그 구간에 두 가지가 걸려 있다:
 *
 * <ol>
 *   <li><b>{@code onDone} 이 오는가.</b> 오지 않으면 목록이 갱신되지 않고, 사용자는
 *       <i>재계산을 눌렀는데 금액이 그대로</i> 를 본다 — 작업은 성공했으므로 <b>어디에도
 *       오류가 남지 않는다</b>.
 *   <li><b>돌고 있다는 것이 화면에 남는가.</b> 남지 않으면 닫는 순간 작업이 <b>사라진 것처럼</b>
 *       보이고, 그때 사용자가 하는 일은 <b>다시 실행</b>이다.
 * </ol>
 *
 * <p><b>끝난 뒤에 남는 것</b>도 함께 잰다 — 성공은 목록이 증거이므로 접힌 표시가 사라지고,
 * 실패는 <b>그 사유가 다른 어디에도 없으므로</b> 남는다. 반대로 만들면 성공할 때마다 사람이
 * 닫아야 하는 표시가 쌓이고, 실패는 조용히 지워진다.
 */
describe('진행률 — 창을 닫아도 작업은 산다(playbook/INDEX.md)', () => {
  const TITLE = '일괄 재계산';

  function running(step: string): JobProgress {
    return {
      jobId: 'J1',
      jobStatCd: 'RUNNING',
      curCnt: 10,
      totCnt: 100,
      subTitle: null,
      stepMsg: step,
      errMsg: null,
      modDtm: '2026-09-02T00:00:00Z',
    };
  }

  function settled(status: 'DONE' | 'FAILED', errMsg: string | null = null): JobProgress {
    return { ...running('끝'), jobStatCd: status, curCnt: 100, errMsg };
  }

  function Harness({ onDone }: { onDone?: () => void }) {
    const open = useProgress();
    return (
      <button
        type="button"
        onClick={() => void open('J1', { title: 'sample.recalc.title', onDone })}
      >
        start
      </button>
    );
  }

  function mount(onDone?: () => void) {
    return render(
      <App>
        <ProgressHost>
          <Harness onDone={onDone} />
        </ProgressHost>
      </App>,
    );
  }

  /** 한 주기 — 폴링이 다음 값을 받는다. */
  async function tick() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }

  /** 누르고 <b>붙어 있는 비동기까지</b> 흘린다 — 폴링의 첫 왕복이 여기서 돈다. */
  async function press(element: HTMLElement) {
    await act(async () => {
      fireEvent.click(element);
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  async function start() {
    await press(screen.getByRole('button', { name: 'start' }));
  }

  /** 창의 닫기 — 이것이 <b>작업을 멈추는 것이 아니어야</b> 한다. */
  async function closeWindow() {
    await press(screen.getByRole('button', { name: 'Close' }));
  }

  /** 접힌 표시 — 실행의 이름이 적혀 있다. */
  function chip() {
    return screen.queryByRole('button', { name: new RegExp(TITLE) });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    get.mockReset();
    get.mockResolvedValue(running('1단계'));
    useMessageStore.setState({
      status: 'ready',
      messages: {
        'sample.recalc.title': TITLE,
        'progress.count': '{cur} / {tot}건 ({percent}%)',
        'progress.count.unknown': '{cur}건 처리',
        'progress.elapsed': '경과 {min}분 {sec}초',
        'progress.failed': '작업이 실패했습니다',
        'progress.unreachable': '진행률을 확인할 수 없습니다.',
        'progress.background': '창을 닫아도 작업은 계속됩니다.',
        'progress.reopen': '진행률 다시 열기',
        'progress.done': '{title} 작업이 완료되었습니다.',
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /*
    <b>이것이 이 파일의 이유다.</b> 닫는 것이 폴링을 죽이면 {@code onDone} 이 영영 오지
    않고, 그 고장은 <i>목록이 갱신되지 않는다</i> 로만 보인다 — 오류도 없고 실패한 작업도
    없어서, 화면을 의심할 근거가 사용자에게 하나도 없다.
  */
  it('닫아도 DONE 이 오면 onDone 이 불린다 — 목록은 갱신되어야 한다', async () => {
    const onDone = vi.fn();
    mount(onDone);
    await start();
    await closeWindow();

    get.mockResolvedValue(settled('DONE'));
    await tick();

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('닫으면 진행 중 표시가 남고, 누르면 창이 다시 열린다', async () => {
    mount();
    await start();
    await closeWindow();

    const folded = chip();
    expect(folded).not.toBeNull();
    await press(folded as HTMLElement);

    // 창이 돌아왔다 — 닫기 버튼이 다시 있다.
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  /*
    <b>접혀 있는 동안에도 폴링은 값을 받는다.</b> 멈춰 있으면 다시 열었을 때 닫던 순간의
    화면이 나오고, 그것은 <i>작업이 그때 멈췄다</i> 로 읽힌다.
  */
  it('다시 열면 접혀 있는 동안 받은 값이 보인다', async () => {
    mount();
    await start();
    await closeWindow();

    get.mockResolvedValue(running('3단계'));
    await tick();

    await press(screen.getByRole('button', { name: new RegExp(TITLE) }));

    expect(screen.getByText('3단계')).toBeTruthy();
  });

  /*
    성공은 <b>목록이 증거</b>다(onDone 이 재조회한다). 표시를 남기면 작업할 때마다 사람이
    닫아야 하는 것이 쌓이고, 그러면 실패 표시도 같은 손짓으로 지워진다.
  */
  it('접힌 채 끝나면 표시가 사라진다', async () => {
    mount();
    await start();
    await closeWindow();

    get.mockResolvedValue(settled('DONE'));
    await tick();

    expect(chip()).toBeNull();
  });

  /*
    실패는 <b>사유가 다른 어디에도 없다</b>. 접힌 채 지우면 사용자는 아무 일도 없었다고
    믿고, 그 작업은 <b>하지 않은 채로 잊힌다</b>.
  */
  it('접힌 채 실패하면 표시가 남고, 열면 사유가 보인다', async () => {
    mount();
    await start();
    await closeWindow();

    get.mockResolvedValue(settled('FAILED', '세율이 범위를 벗어났습니다'));
    await tick();

    await press(screen.getByRole('button', { name: new RegExp(TITLE) }));

    expect(screen.getByText('세율이 범위를 벗어났습니다')).toBeTruthy();
  });

  /*
    <b>끝난 작업의 닫기는 버리는 것이다.</b> 접으면 다시 열어도 보여 줄 것이 없는 표시가
    남고, 그것은 <i>아직 돌고 있다</i> 로 읽힌다.
  */
  it('끝난 뒤에 닫으면 표시가 남지 않는다', async () => {
    mount();
    await start();

    get.mockResolvedValue(settled('FAILED', '세율이 범위를 벗어났습니다'));
    await tick();
    await closeWindow();

    expect(chip()).toBeNull();
  });
});

/**
 * 창이 <b>무엇을 말하는가</b> — backend/crosscutting.md · playbook/INDEX.md.
 *
 * <p>위의 describe 가 <i>창이 없는 동안</i>을 쟀다면 여기는 <b>창이 열려 있는 동안</b>이다.
 * 재는 것은 넷이고, 넷이 같은 한 질문에 답한다 — <b>기다릴까 접을까</b>:
 *
 * <ol>
 *   <li><b>지금 어느 구간인가</b>(소제목). 고른 행마다 딸린 디테일을 도는 실행에서 창의
 *       제목은 50행을 도는 동안 한 글자도 바뀌지 않는다.
 *   <li><b>몇 건 중 몇 건이고 몇 퍼센트인가.</b>
 *   <li><b>전체를 모를 때도 건수가 있는가</b> — 없으면 도는 막대만 남고, 그것은
 *       <i>멈춘 것</i>과 구별되지 않는다.
 *   <li><b>뜬 지 얼마나 지났는가.</b> 3초 지난 24% 와 5분 지난 24% 는 결정이 정반대다.
 * </ol>
 */
describe('진행률 — 창이 말하는 것(backend/crosscutting.md)', () => {
  const TITLE = '일괄 재계산';

  function phase(over: Partial<JobProgress>): JobProgress {
    return {
      jobId: 'J1',
      jobStatCd: 'RUNNING',
      curCnt: 10,
      totCnt: 100,
      subTitle: null,
      stepMsg: null,
      errMsg: null,
      modDtm: '2026-09-02T00:00:00Z',
      ...over,
    };
  }

  function Harness() {
    const open = useProgress();
    return (
      <button type="button" onClick={() => void open('J1', { title: 'sample.recalc.title' })}>
        start
      </button>
    );
  }

  function mount() {
    return render(
      <App>
        <ProgressHost>
          <Harness />
        </ProgressHost>
      </App>,
    );
  }

  /** 폴링 한 주기 — 초를 흘리면 경과 시간도 함께 간다. */
  async function tick(seconds = 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(seconds * 1000);
    });
  }

  async function start() {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'start' }));
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    get.mockReset();
    useMessageStore.setState({
      status: 'ready',
      messages: {
        'sample.recalc.title': TITLE,
        'progress.count': '{cur} / {tot}건 ({percent}%)',
        'progress.count.unknown': '{cur}건 처리',
        'progress.elapsed': '경과 {min}분 {sec}초',
        'progress.background': '창을 닫아도 작업은 계속됩니다.',
        'progress.reopen': '진행률 다시 열기',
        'progress.done': '{title} 작업이 완료되었습니다.',
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('건수와 완료율을 한 줄로 말한다 — 천 단위를 끊는다', async () => {
    get.mockResolvedValue(phase({ curCnt: 1200, totCnt: 3000 }));
    mount();
    await start();

    expect(screen.getByText(/1,200 \/ 3,000건 \(40%\)/)).toBeTruthy();
  });

  /*
    <b>전체를 모르는 작업이 있다</b>(sys/batch.md — 스트리밍 파싱). 그때 줄을 없애면 창에 도는
    막대만 남고, 사용자는 그것을 <i>멈췄다</i> 로 읽는다 — 건수라도 올라가는 것이
    <b>돌고 있다는 유일한 증거</b>다.
  */
  it('전체를 모르면 처리 건수만 말한다 — 퍼센트를 지어내지 않는다', async () => {
    get.mockResolvedValue(phase({ curCnt: 4200, totCnt: null }));
    mount();
    await start();

    expect(screen.getByText(/4,200건 처리/)).toBeTruthy();
    // 0% 도 NaN% 도 없다 — 나눌 수가 없으면 그런 값이 없는 것이다.
    expect(screen.queryByText(/%/)).toBeNull();
  });

  /*
    <b>이것이 소제목의 이유다.</b> 창의 제목은 그 실행의 이름이라 50행을 도는 동안 한
    글자도 바뀌지 않는다 — 행이 넘어가고 있다는 사실을 말하는 것은 이 줄뿐이다.

    <b>건수가 함께 되돌아가는 것</b>도 같은 자리에서 잰다(백엔드의 {@code reset}). 소제목만
    바뀌고 전체가 앞 구간의 것으로 남으면 화면은 <b>100% 를 넘긴 막대</b>를 그린다.
  */
  it('구간이 바뀌면 소제목과 건수가 함께 바뀐다 — 앞 구간의 전체를 물고 있지 않다', async () => {
    get.mockResolvedValue(phase({ subTitle: '주문 A-1023 (1/50)', curCnt: 2900, totCnt: 3000 }));
    mount();
    await start();
    expect(screen.getByText('주문 A-1023 (1/50)')).toBeTruthy();

    // 다음 행 — 전체가 더 작다. 되돌아가지 않으면 2,900 / 1,200 이 된다.
    get.mockResolvedValue(phase({ subTitle: '주문 A-1024 (2/50)', curCnt: 5, totCnt: 1200 }));
    await tick();

    expect(screen.getByText('주문 A-1024 (2/50)')).toBeTruthy();
    expect(screen.getByText(/5 \/ 1,200건 \(0%\)/)).toBeTruthy();
  });

  it('구간이 없는 작업은 소제목 줄이 없다', async () => {
    get.mockResolvedValue(phase({ stepMsg: '집계하는 중' }));
    mount();
    await start();

    // 단계 문구는 있고 소제목은 없다 — 둘은 다른 줄이다.
    expect(screen.getByText('집계하는 중')).toBeTruthy();
    expect(screen.getByText(/경과 0분 00초/)).toBeTruthy();
  });

  it('뜬 지 지난 시간이 분과 초로 흐른다', async () => {
    get.mockResolvedValue(phase({}));
    mount();
    await start();
    expect(screen.getByText(/경과 0분 00초/)).toBeTruthy();

    await tick(65);

    expect(screen.getByText(/경과 1분 05초/)).toBeTruthy();
  });

  /*
    <b>접는 것은 작업이 다시 시작되는 것이 아니다.</b> 다시 열었을 때 0분 00초 가 보이면
    화면이 <b>없던 사실</b>을 말한 셈이고, 그러면 오래 도는 작업을 접어 둔 사용자는
    <i>얼마나 기다렸는지</i> 를 영영 알 수 없다.
  */
  it('접었다 다시 열어도 경과 시간이 0 으로 돌아가지 않는다', async () => {
    get.mockResolvedValue(phase({}));
    mount();
    await start();
    await tick(30);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await vi.advanceTimersByTimeAsync(0);
    });
    await tick(30);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(TITLE) }));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText(/경과 1분 0[01]초/)).toBeTruthy();
  });
});
