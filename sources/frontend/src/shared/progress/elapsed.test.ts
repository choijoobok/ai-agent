import { describe, expect, it } from 'vitest';
import { splitElapsed } from '@/shared/progress/elapsed';

/**
 * 경과 시간의 <b>모양</b>만 잰다 — 시각을 어디서 얻는지는 호스트의 일이다
 * ({@code ProgressHost.test.tsx}).
 */
describe('경과 시간 — 분과 초로 가른다', () => {
  it('초를 버림한다 — 1초가 되기 전에는 0초다', () => {
    expect(splitElapsed(0)).toEqual({ min: 0, sec: '00' });
    expect(splitElapsed(999)).toEqual({ min: 0, sec: '00' });
    expect(splitElapsed(1000)).toEqual({ min: 0, sec: '01' });
  });

  // 폭이 흔들리면 1초마다 그 줄이 움직인다 — 그 움직임은 진행률과 아무 상관이 없다.
  it('초를 두 자리로 채운다', () => {
    expect(splitElapsed(65_000)).toEqual({ min: 1, sec: '05' });
  });

  it('60분을 넘겨도 분으로 센다 — 시간 단위를 두지 않았다', () => {
    expect(splitElapsed(90 * 60_000 + 12_000)).toEqual({ min: 90, sec: '12' });
  });

  /*
    <b>시계가 뒤로 갈 수 있다</b>(NTP 보정 · 사용자가 고친 시각). `-1분 -3초` 는 진행률의
    신뢰를 통째로 깎으므로 0 으로 접는다.
  */
  it('음수는 0 이다 — 시계가 뒤로 갔을 때', () => {
    expect(splitElapsed(-5000)).toEqual({ min: 0, sec: '00' });
  });
});
