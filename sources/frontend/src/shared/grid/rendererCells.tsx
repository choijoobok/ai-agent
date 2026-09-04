import { Progress, theme, Tooltip } from 'antd';
import type { ReactNode } from 'react';
import type { Tone } from '@/shared/grid/types';

/**
 * 셀 렌더러 중 <b>테마 색이 필요한 것들</b> — 68 §9.9.
 *
 * <p><b>어댑터에서 갈라 둔 파일이다.</b> {@code columnDefs.tsx} 는 함수만 내보내는
 * 어댑터이고 거기에 컴포넌트를 하나라도 두면 {@code react-refresh} 가 <i>파일이
 * 컴포넌트만 내보내야 한다</i> 고 경고한다 — {@code asideTag} 가 컴포넌트가 아니라
 * 함수인 것도 같은 이유였다.
 *
 * <p><b>컴포넌트여야 하는 이유는 훅 하나</b>다. 색이 {@code theme.useToken()} 에서
 * 와야 하는데 어댑터 함수는 훅을 부를 수 없고, 상수 팔레트를 따로 두면 <b>테마를 바꿔도
 * 여기만 옛 색</b>으로 남는다(main-shell.md §9 의 주색 설정이 그 자리다).
 *
 * <p><b>{@code Tag} 의 색 이름({@code TONE_COLOR})을 쓸 수 없다.</b> 저 맵은 배지의
 * <i>배경</i> 을 고르는 AntD 이름 집합이고, 여기 칠하는 것은 <b>막대와 글자색</b>이다.
 */

/** {@link Tone} → 실제 색. 훅 안에서만 만들 수 있으므로 컴포넌트마다 그 자리에서 짓는다. */
function toneColors(token: { colorSuccess: string; colorWarning: string; colorError: string; colorTextDisabled: string }): Record<Tone, string | undefined> {
  return {
    // 칠하지 않는다 — 판의 기본색이 그대로다(grid-column-contract.md §5.4.1 의 <i>맵에 없는 값</i>과 같은 자리).
    none: undefined,
    ok: token.colorSuccess,
    warn: token.colorWarning,
    err: token.colorError,
    muted: token.colorTextDisabled,
  };
}

/** 막대 굵기(px) — <b>행 높이 설정을 따라가지 않는다</b>(68 §9.9 · §11 의 미결을 닫는다). */
const PROGRESS_STROKE = 6;

/**
 * 진행률 막대 하나 — {@code renderer: 'progress'}.
 *
 * <p><b>굵기가 고정</b>이고 세로 가운데에 놓인다. 판의 행 높이는 사용자가 40px 까지
 * 올릴 수 있는데(main-shell.md §9) 굵기를 거기 매면 <b>셀을 가득 채운 색 덩어리</b>가 되어 옆 칸의
 * 글자를 눌러 버린다 — 진행률은 <i>값</i> 이지 <i>배경</i> 이 아니다.
 */
export function ProgressCell(props: { percent: number; tone: Tone }) {
  const { token } = theme.useToken();
  return (
    <Progress
      percent={Math.max(0, Math.min(100, props.percent))}
      size="small"
      /*
        <b>둥근 끝을 쓰지 않는다.</b> 굵기가 6px 이라 반지름이 3px 이고, 그러면 3% 와
        6% 가 <b>같은 알약 모양</b>으로 보인다 — 작은 값이 실제보다 커 보인다.
      */
      strokeLinecap="butt"
      strokeWidth={PROGRESS_STROKE}
      strokeColor={toneColors(token)[props.tone]}
      // 값이 곧 글자다 — 막대만 있으면 43% 와 47% 를 눈으로 가를 수 없다(grid-column-contract.md §5.4).
      format={(value) => `${value ?? 0}%`}
    />
  );
}

/**
 * 아이콘 한 칸 — {@code renderer: 'icon'}.
 *
 * <p><b>툴팁이 선택이 아니다.</b> 아이콘만 남으면 색맹·흑백 인쇄·모르는 아이콘 셋 다에서
 * 그 칸이 읽히지 않는다 — 그래서 {@code aria-label} 까지 함께 단다: 툴팁은 마우스에만 난다.
 */
export function IconCell(props: { glyph: ReactNode; text: string; tone: Tone }) {
  const { token } = theme.useToken();
  return (
    <Tooltip title={props.text}>
      <span
        aria-label={props.text}
        style={{ color: toneColors(token)[props.tone], display: 'inline-flex' }}
      >
        {props.glyph}
      </span>
    </Tooltip>
  );
}
