import { useCallback, useEffect, useRef, useState } from 'react';
import { onResponseSignal } from '@/shared/api';
import { heartbeat } from '@/features/auth/api/authApi';

/**
 * 만료 예고 — 50 §7. <b>주기적 하트비트를 두지 않는다.</b>
 *
 * <p>화면을 열어 둔 것만으로 세션이 갱신되면 30분 타임아웃이 사실상 무한이 되고, 자리를
 * 비운 PC 가 계속 로그인 상태로 남는다. <b>연장은 사람이 누르는 것</b>이어야 한다.
 *
 * <p><b>남은 시간을 서버에 묻지 않고 센다.</b> 물으면 그 물음 자체가 세션을 연장한다 —
 * 셀 수 있는 이유는 <b>세션을 미는 것이 요청이기 때문</b>이며, 그래서 모든 응답이
 * 시한을 다시 잡는다(`onResponseSignal`).
 *
 * <p><b>{@code setTimeout} 이 아니라 1초 간격이다.</b> 타임아웃은 절전·탭 백그라운드에서
 * 늦게 깨어나 <i>이미 만료된 뒤에</i> 예고를 띄운다. 매초 시각을 비교하면 그 지연이
 * <b>한 번의 늦은 판정</b>으로 끝난다.
 *
 * <p><b>세는 것은 매초, 내는 것은 분이다.</b> 매초 상태를 갱신하면 셸이 <b>초당 한 번</b>
 * 다시 그려지고, 비활성 탭을 언마운트하지 않는 구조라(ADR-0005) 그 리렌더가 <b>열려 있는
 * 탭 전부</b>로 내려간다 — 초당 비용이 탭 수에 비례해 자라는 것이 <i>"쓰면 쓸수록
 * 느려진다"</i> 였다(2026-08-31: 간격을 60초로 늘리자 체감이 사라져 원인이 확정됐다).
 * 그때 <b>간격을 늘리는 것은 답이 아니다</b> — 위 단락의 늦은 판정을 되살린다. 화면에
 * 남는 값이 {@link SessionExpiryState.remainingMinutes} 하나뿐이므로 <b>그것만 낸다</b>.
 */

/** 만료 5분 전 — 50 §7 의 표. */
const WARN_BEFORE_SECONDS = 300;

export interface SessionExpiryState {
  /** 예고 모달을 띄울 때다. 세션이 없으면 언제나 거짓이다. */
  warning: boolean;
  /** 예고 모달이 보여주는 남은 시간(분, 올림). <b>예고 창 밖에서는 0</b> 이다. */
  remainingMinutes: number;
  /** "연장" — 하트비트가 세션을 밀고, 그 응답이 시한을 다시 잡는다. */
  extend: () => Promise<void>;
}

/**
 * 남은 초를 <b>화면에 남는 값</b>으로 접는다.
 *
 * <p>예고 창 밖은 전부 0 이다 — 남은 시간이 29분이든 12분이든 <b>화면이 같다</b>. 창
 * 안에서도 모달은 분으로 올림해 보여주므로 초는 화면에 남지 않는다. 이렇게 접으면 매초
 * 들어오는 값이 <b>대개 직전과 같은 값</b>이 되고, 같은 값을 다시 넣는 {@code setState} 는
 * React 가 리렌더 없이 버린다 — 셸의 초당 리렌더가 사라지는 자리가 여기다.
 */
function warnMinutesOf(remainingSeconds: number): number {
  if (remainingSeconds <= 0 || remainingSeconds > WARN_BEFORE_SECONDS) {
    return 0;
  }
  return Math.ceil(remainingSeconds / 60);
}

export function useSessionExpiry(options: {
  /** 0 이면 세션이 없다 — 타이머를 걸지 않는다. */
  expiresInSeconds: number;
  /** 연장하지 않아 시한이 지났을 때. */
  onExpire: () => void;
}): SessionExpiryState {
  const { expiresInSeconds, onExpire } = options;

  const [warnMinutes, setWarnMinutes] = useState(0);
  /*
    <b>낸 값을 우리가 기억한다.</b> 같은 값을 다시 넣으면 React 가 리렌더를 건너뛰지만,
    바뀐 직후의 <b>첫 번째 같은 값</b> 하나는 새어 나온다(실측). 그 한 번은 무해하나,
    "값이 바뀔 때만 그린다" 는 이 훅의 계약이므로 React 의 내부 최적화에 맡기지 않고
    여기서 못 박는다 — 테스트가 재는 것도 그 계약이다.
  */
  const shown = useRef(0);
  const deadline = useRef(0);
  const budget = useRef(expiresInSeconds);
  // 만료 처리는 한 번뿐이다 — 매초 부르면 로그아웃이 반복해서 돈다.
  const expired = useRef(false);

  /** 값이 바뀔 때만 상태로 낸다 — 그대로면 셸을 다시 그리지 않는다. */
  const publish = useCallback((minutes: number) => {
    if (minutes === shown.current) return;
    shown.current = minutes;
    setWarnMinutes(minutes);
  }, []);

  /** 모든 응답이 세션을 밀었다 — 시한을 다시 잡는다. */
  const push = useCallback(() => {
    if (budget.current <= 0) return;
    deadline.current = Date.now() + budget.current * 1000;
    expired.current = false;
  }, []);

  useEffect(() => {
    if (expiresInSeconds <= 0) {
      deadline.current = 0;
      return;
    }
    // 예산을 렌더 중이 아니라 여기서 쓴다 — 렌더 본문의 대입은 StrictMode 의 두 번 렌더에서
    // 순서가 보장되지 않는다.
    budget.current = expiresInSeconds;
    push();
    return onResponseSignal(push);
  }, [expiresInSeconds, push]);

  useEffect(() => {
    if (expiresInSeconds <= 0) return;

    const tick = window.setInterval(() => {
      if (deadline.current === 0) return;

      const left = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      publish(warnMinutesOf(left));

      if (left === 0 && !expired.current) {
        expired.current = true;
        onExpire();
      }
    }, 1000);

    return () => window.clearInterval(tick);
  }, [expiresInSeconds, onExpire, publish]);

  const extend = useCallback(async () => {
    const result = await heartbeat();
    // 서버가 준 값이 정본이다 — 프론트에 30분을 박아 두면 설정과 어긋난다(60 §5).
    budget.current = result.expiresInSeconds;
    push();
    // 다음 틱을 기다리지 않고 예고를 걷는다 — 누른 사람은 지금 사라지는 것을 봐야 한다.
    publish(warnMinutesOf(result.expiresInSeconds));
  }, [publish, push]);

  return {
    // 창 밖은 0 이므로 이 하나로 갈린다 — 두 값이 어긋날 자리가 없다.
    warning: warnMinutes > 0,
    remainingMinutes: warnMinutes,
    extend,
  };
}
