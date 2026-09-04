import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  LockOutlined,
  MinusCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  StopOutlined,
  SyncOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

/**
 * `renderer: 'icon'` 이 그릴 수 있는 것 — 68 §9.9.
 *
 * <p><b>메뉴 아이콘 집합({@code MENU_ICONS})을 재사용하지 않는 것이 결정이다</b>
 * (2026-09-02 — 68 §11 의 미결을 닫는다). 나눠 보이지만 축이 다르다: 저쪽은 <b>어디로
 * 가는가</b>(대시보드·사용자·이력)이고 이쪽은 <b>이 값이 무엇인가</b>(완료·실패·잠김)다.
 *
 * <p>합쳤을 때 무너지는 쪽이 분명하다. 셀에 <i>완료</i> 아이콘을 하나 더하려면
 * {@code MENU_ICONS} 에 줄을 더해야 하는데, 그 맵은 <b>`SYS_MENU.ICON_CD` 의 값 집합</b>
 * 이다(main-shell.md §4.1) — 그리드 때문에 더한 코드가 <b>메뉴 아이콘 드롭다운에 나타나</b> 운영자가
 * 메뉴에 <i>완료</i> 를 달 수 있게 된다. 반대 방향도 같다: 메뉴에 <i>번역</i> 아이콘이
 * 생겼다고 그리드 셀이 그것을 그릴 이유는 없다.
 *
 * <p><b>모양은 같다</b> — 닫힌 맵이고, 뜻의 코드를 키로 쓰며(판의 컴포넌트 이름을 쓰지
 * 않는다), 모르는 코드는 <b>없는 것</b>이다. 두 집합이 같은 규칙을 따르므로 나중에 합칠
 * 일이 생겨도 합치는 것 자체는 기계적이다.
 *
 * <p><b>색은 여기서 정하지 않는다.</b> {@code tone} 맵이 정한다(grid-column-contract.md §5.4.1) — 같은
 * <i>동그라미에 느낌표</i> 가 어떤 컬럼에서는 경고이고 어떤 컬럼에서는 정보다.
 */
export const CELL_ICONS = {
  ok: <CheckCircleOutlined />,
  fail: <CloseCircleOutlined />,
  warn: <ExclamationCircleOutlined />,
  unknown: <QuestionCircleOutlined />,
  none: <MinusCircleOutlined />,

  waiting: <ClockCircleOutlined />,
  running: <SyncOutlined spin />,
  /*
    <b>{@code running} 과 갈라 둔다.</b> 둘 다 <i>도는 중</i> 이지만 앞은 <b>진척이 있는
    것</b>이고 이것은 <b>붙잡혀 있는 것</b>이다 — 한 아이콘으로 그리면 응답이 없는 작업과
    느린 작업을 화면에서 구별할 수 없다(68 §9.1 이 `STEP_MSG` 를 보이는 것과 같은 이유).
  */
  loading: <LoadingOutlined />,
  paused: <PauseCircleOutlined />,
  started: <PlayCircleOutlined />,
  stopped: <StopOutlined />,

  locked: <LockOutlined />,
  unlocked: <UnlockOutlined />,

  /*
    <b>크기의 축</b> — 68 §3.2 의 우선순위가 열었다(2026-09-02). 위의 것들이 *상태* 라면
    이 둘은 <b>많고 적음</b>이며, 상태 아이콘으로 대신 그리면 <i>낮음</i> 이 `paused` 가
    되어 <b>멈춰 있다</b> 로 읽힌다.

    <b>`none` 이 가운데를 맡는다</b> — 보통 을 위한 아이콘을 따로 두지 않는 것은 그 값이
    <i>치우치지 않았다</i> 이고, 그것이 이미 `none` 의 뜻이기 때문이다.
  */
  high: <ArrowUpOutlined />,
  low: <ArrowDownOutlined />,
} as const satisfies Record<string, ReactNode>;

/** 닫힌 집합이다 — 선언이 모르는 이름을 쓰면 <b>컴파일에서</b> 걸린다(임의 문자열 아님). */
export type CellIcon = keyof typeof CELL_ICONS;

/**
 * 코드 → 아이콘. 모르는 코드면 {@code undefined} 이고, 그리는 쪽은 <b>값을 글자로</b> 낸다.
 *
 * <p>{@code menuIconOf} 처럼 폴백 아이콘을 두지 않는 것이 요점이다. 사이더의 폴백은
 * <i>이 자리에 무언가 있다</i> 를 말해야 하지만(빈 칸이면 트리가 끊겨 보인다), 셀에는
 * <b>이미 값이 있다</b> — 모르는 코드에 물음표를 그리면 <i>값이 물음표</i> 인 것처럼
 * 읽히고, 진짜 값(`XYZ`)은 화면 어디에도 남지 않는다.
 */
export function cellIcon(name: string | null | undefined): ReactNode | undefined {
  if (name === null || name === undefined) return undefined;
  return (CELL_ICONS as Record<string, ReactNode>)[name];
}
