// @feat FEAT-501
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emitResponseSignal } from '@/shared/api';
import { heartbeat } from '@/modules/system/public/auth/api/authApi';
import { useSessionExpiry } from '@/modules/system/public/auth/useSessionExpiry';

vi.mock('@/modules/system/public/auth/api/authApi', () => ({ heartbeat: vi.fn() }));

const callHeartbeat = vi.mocked(heartbeat);

/**
 * 만료 예고.
 *
 * <p><b>가짜 타이머로 시간을 민다.</b> 실제로 25분을 기다릴 수는 없고, 기다린다 해도
 * <i>"예고가 제때 떴는가"</i> 는 <b>경계에서만</b> 갈리는 판정이라 그 지점을 직접 짚는 편이
 * 정확하다.
 */
describe('세션 만료 예고', () => {
  const BUDGET = 1800;

  beforeEach(() => {
    vi.useFakeTimers();
    callHeartbeat.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mount = (expiresInSeconds = BUDGET, onExpire = vi.fn()) => {
    // 렌더 횟수를 센다 — 이 훅의 성질 하나가 "언제 다시 그리지 않는가" 이기 때문이다.
    const renders = { count: 0 };
    const view = renderHook(() => {
      renders.count += 1;
      return useSessionExpiry({ expiresInSeconds, onExpire });
    });
    return { ...view, onExpire, renders };
  };

  const advance = (seconds: number) => {
    act(() => {
      vi.advanceTimersByTime(seconds * 1000);
    });
  };

  it('세션이 없으면 타이머를 걸지 않는다 — 0 을 "곧 만료" 로 읽지 않는다', () => {
    const { result, onExpire } = mount(0);
    advance(BUDGET + 60);

    expect(result.current.warning).toBe(false);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('만료 5분 전에 예고한다', () => {
    const { result } = mount();

    advance(BUDGET - 301);
    expect(result.current.warning).toBe(false);

    advance(2);
    expect(result.current.warning).toBe(true);
  });

  it('아무 응답이나 오면 시한이 밀린다 — 세션을 미는 것은 요청이다', () => {
    const { result } = mount();
    advance(BUDGET - 200);
    expect(result.current.warning).toBe(true);

    act(() => emitResponseSignal({ status: 200, authzVersion: null }));
    advance(1);

    // 요청 하나가 세션을 밀었으므로 예고가 사라진다.
    expect(result.current.warning).toBe(false);
  });

  it('연장하지 않으면 한 번만 만료 처리한다 — 매초 부르면 로그아웃이 반복된다', () => {
    const { onExpire } = mount();

    advance(BUDGET + 5);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('연장은 서버가 준 값으로 다시 잡는다 — 프론트에 30분을 박아 두지 않는다', async () => {
    callHeartbeat.mockResolvedValue({ expiresInSeconds: 600 });
    const { result } = mount();

    advance(BUDGET - 100);
    expect(result.current.warning).toBe(true);

    await act(async () => {
      await result.current.extend();
    });

    // 새 예산은 600초이므로 예고 문턱(300)까지는 아직 멀다 — 다음 틱을 기다리지 않고 걷힌다.
    expect(result.current.warning).toBe(false);
    expect(result.current.remainingMinutes).toBe(0);
  });

  /*
    아래 둘은 <b>성능이 아니라 계약</b>이다. 비활성 탭을 언마운트하지 않는 구조라
    (frontend/tabs.md) 셸이 다시 그려지면 열려 있는 탭 전부가 함께 그려진다 — 이 훅이 매초
    상태를 갱신하면 그 비용이 탭 수에 비례해 자란다(2026-08-31 실측).
  */
  it('예고 창 밖에서는 다시 그리지 않는다 — 셸의 리렌더가 열린 탭 전부로 내려간다', () => {
    const { result, renders } = mount();
    const before = renders.count;

    // 20분을 민다 — 예고(5분 전)까지는 아직 멀다.
    advance(1200);

    expect(result.current.warning).toBe(false);
    expect(renders.count).toBe(before);
  });

  it('예고 창 안에서도 분이 바뀔 때만 다시 그린다 — 모달이 보여주는 것이 분이다', () => {
    const { result, renders } = mount();

    // 남은 시간 정확히 300초 — 예고가 시작되는 지점이다.
    advance(BUDGET - 300);
    expect(result.current.remainingMinutes).toBe(5);
    const before = renders.count;

    // 같은 분 안에서는 값이 그대로다.
    advance(59);
    expect(result.current.remainingMinutes).toBe(5);
    expect(renders.count).toBe(before);

    // 분이 넘어가면 한 번 그린다.
    advance(1);
    expect(result.current.remainingMinutes).toBe(4);
    expect(renders.count).toBe(before + 1);
  });
});
