import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  CaretDownOutlined,
  CaretLeftOutlined,
  CaretRightOutlined,
  CaretUpOutlined,
} from '@ant-design/icons';
import { Tooltip, theme } from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';

/**
 * 마스터-디테일의 스플리터 — grid-standard.md §6.3. <b>축은 둘이며 화면이 선언한다.</b>
 *
 * <p><b>화살표는 스플리터가 갈 자리를 가리킨다.</b> {@code ▲} 를 누르면 막대가 <b>맨 위로</b>
 * 가고 그 결과로 <b>마스터가 접힌다</b> — <i>"무엇을 접는가"</i> 로 읽으면 누를 때마다 틀린
 * 쪽이 접힌다. 여기가 유일하게 헷갈리는 자리라 못 박는다.
 *
 * <p><b>접히면 되돌리는 화살표 하나만 남는다.</b> 처음에는 둘을 늘 그려 두고 갈 수 없는
 * 쪽을 비활성으로 두었는데, 그러면 <b>접은 뒤 눌리는 화살표가 이미 있는 상태를 가리켜</b>
 * 아무 일도 일어나지 않는다 — 화살표로 접으면 화살표로 돌아올 수 없었다(2026-08-30 실물).
 * 지금은 위로 올린 뒤에는 <b>내리는 화살표만</b>, 내린 뒤에는 <b>올리는 화살표만</b> 있고
 * 그것이 곧 <i>되돌리기</i> 다. 비활성 상태가 아예 없어진다.
 *
 * <p><b>비율과 접힘은 {@code localStorage} 다.</b> 27인치에서 맞춘 비율이 노트북에서는
 * 틀리므로 <b>사람의 속성이 아니라 기기·화면의 속성</b>이다(41 §4.3의 경계) — 그래서 DB 가
 * 아니고, 직접 조작으로 정해지므로 그리드 설정 창에도 없다.
 *
 * <p><b>좌우 축이 생겼다</b>(2026-08-30 — 62 §2). grid-standard.md §6.3 이 실물로 예고한 자리가
 * {@code ROLE_AUTH_MGMT}(역할 목록 ↔ 권한 트리)이며, 트리는 컬럼이 하나라 위아래로 두면
 * <b>가로 공간의 대부분이 빈다</b>.
 *
 * <p><b>축이 정해지면 나머지가 함께 정해진다</b> — 스플리터의 방향도, 화살표도, 접기
 * 방향도 따로 고르지 않는다(grid-standard.md §6.3). 그래서 선언은 {@code axis} 하나이고 규칙은 <b>둘 다
 * 같다</b>: <i>화살표는 스플리터가 갈 자리를 가리킨다</i> — {@code ◀} 를 누르면 막대가
 * <b>맨 왼쪽으로</b> 가고 그 결과로 왼쪽 pane 이 접힌다. <b>축이 바뀌어도 배울 것이 새로
 * 없다.</b>
 *
 * <p><b>저장 키는 축을 담지 않는다.</b> 한 화면의 한 스플리터가 축을 바꾸는 일은 배포로만
 * 일어나고, 그때 남아 있는 값은 <b>여전히 0~1 의 비율</b>이라 뜻이 통한다.
 */

type Collapsed = 'none' | 'first' | 'second';

/**
 * grid-standard.md §6.3 — <b>마스터가 넓으면 상하, 좁으면 좌우</b>다.
 *
 * <p>이름을 내보내는 것은 <b>접힌 pane 의 제목이 이 값을 봐야</b> 하기 때문이다
 * ({@code <DataGrid collapsedAxis>} · {@code <TreeGrid collapsedAxis>}).
 */
export type SplitAxis = 'vertical' | 'horizontal';

interface SplitPaneProps {
  /** `localStorage` 키의 꼬리. 화면마다 다르다. */
  storageKey: string;
  /**
   * grid-standard.md §6.3 — <b>마스터가 넓으면 상하, 좁으면 좌우</b>다.
   *
   * <p>기본이 상하인 것은 컬럼이 많은 목록이 대부분이기 때문이며, 좌우는 <b>트리처럼 컬럼이
   * 한둘인</b> 마스터의 것이다. <b>축은 데이터가 정하지 취향이 정하지 않는다</b>(62 §3.1).
   */
  axis?: SplitAxis;
  /**
   * 접힘 여부와 <b>제목 줄 클릭으로 되돌리는 길</b>을 함께 넘긴다 — grid-standard.md §6.3.
   *
   * <p><b>축도 함께 넘긴다</b>(2026-08-31). 접힌 pane 이 <i>제목 한 줄</i>만 남기는데, 그
   * 제목이 <b>가로로 눕는가 세로로 서는가</b>는 축이 정한다 — 좌우로 접으면 남는 것이 48px
   * 짜리 <b>세로 띠</b>라 가로 제목은 그 자리에서 잘린다.
   *
   * <p><b>화면이 다시 적지 않는다.</b> {@code axis="horizontal"} 을 이미 선언했으므로 그것을
   * 그리드에 한 번 더 적게 하면 미러링이고, 어긋날 때 어느 쪽이 맞는지 알 수 없다.
   */
  first: (collapsed: boolean, expand: () => void, axis: SplitAxis) => ReactNode;
  second: (collapsed: boolean, expand: () => void, axis: SplitAxis) => ReactNode;
  /** 위쪽의 초기 비율(0~1). */
  defaultRatio?: number;
}

interface SplitState {
  ratio: number;
  collapsed: Collapsed;
}

/** 헤더 한 줄 + 컬럼 헤더 + 본문 한 행 + 푸터. 그보다 작게 끌면 접힘에 붙는다(grid-standard.md §6.3). */
const MIN_PANE_PX = 140;

/**
 * 막대와 pane 사이의 숨 — <b>좌우 축에만</b> 있다(2026-08-31 요청).
 *
 * <p>상하 축에서는 이 자리가 이미 비어 있다. 위 pane 의 <b>푸터</b>와 아래 pane 의 <b>제목
 * 줄</b>이 각자 8px 여백을 갖고 있어(`GridFooter` · `GridHeader`) 막대는 그 사이에 뜬다.
 *
 * <p><b>좌우에는 그런 여백이 없다.</b> 그리드의 판은 pane 의 폭을 통째로 쓰므로 판의 테두리가
 * 막대의 테두리에 <b>맞닿아 선이 세 줄</b>로 보였다 — 두 판이 한 판처럼 읽히는 자리다.
 *
 * <p><b>막대의 여백으로 준다.</b> pane 에 좌우 패딩을 주면 <b>화면의 바깥쪽 끝</b>도 함께
 * 들여쓰기가 되어, 위아래로 놓인 그리드와 <b>왼쪽 끝이 어긋난다</b>.
 */
const SPLIT_GAP = 8;

/** 막대 자체의 두께 — 테두리 둘(1px씩)에 화살표 버튼의 짧은 변 12px 을 더한 값이다. */
const BAR_PX = 14;

export function SplitPane(props: SplitPaneProps) {
  const { token } = theme.useToken();
  const storage = `backoffice.split.${props.storageKey}`;
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<SplitState>(() => read(storage, props.defaultRatio ?? 0.55));
  const dragging = useRef(false);
  const horizontal = props.axis === 'horizontal';

  useEffect(() => {
    try {
      window.localStorage.setItem(storage, JSON.stringify(state));
    } catch {
      // 사생활 보호 모드에서 던진다. 비율이 안 남을 뿐 화면은 돈다.
    }
  }, [state, storage]);

  const onPointerMove = useCallback((event: PointerEvent) => {
    if (!dragging.current || !container.current) return;
    const box = container.current.getBoundingClientRect();
    // 축이 <b>어느 좌표를 읽을지</b>만 정한다 — 스냅도 비율도 그 뒤는 같은 식이다.
    const offset = horizontal ? event.clientX - box.left : event.clientY - box.top;
    const extent = horizontal ? box.width : box.height;

    /*
      <b>막대와 그 여백은 flex 분배 밖이다.</b> 비율을 통째 폭으로 나누면 그만큼이 두 번
      세어져 <b>막대가 커서를 못 따라온다</b> — 커서와 막대의 거리가 화면 가운데에서
      가장 벌어진다. 좌우 축에 숨을 8px씩 두면서 그 어긋남이 두 배가 됐다(2026-08-31).

      커서는 <b>막대의 가운데</b>를 잡고 있다고 본다 — 첫 pane 의 끝은 그보다 절반 앞이다.
    */
    const chrome = BAR_PX + (horizontal ? SPLIT_GAP * 2 : 0);
    const shared = Math.max(extent - chrome, 1);
    const first = offset - chrome / 2;

    // 끝까지 끌면 접힘으로 스냅한다 — 손으로 끈 것과 화살표로 접은 것이 같은 상태여야
    // 되돌리는 방법도 하나다(grid-standard.md §6.3).
    if (first < MIN_PANE_PX) {
      setState((current) => ({ ...current, collapsed: 'first' }));
      return;
    }
    if (shared - first < MIN_PANE_PX) {
      setState((current) => ({ ...current, collapsed: 'second' }));
      return;
    }
    setState({ ratio: first / shared, collapsed: 'none' });
  }, [horizontal]);

  useEffect(() => {
    const stop = () => {
      dragging.current = false;
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stop);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stop);
    };
  }, [onPointerMove]);

  const expand = () => setState((current) => ({ ...current, collapsed: 'none' }));
  const firstCollapsed = state.collapsed === 'first';
  const secondCollapsed = state.collapsed === 'second';

  /*
    <b>접힌 pane 의 폭 — 상하로 접었을 때의 높이와 같은 값이다</b>(2026-08-31 요청).

    상하에서는 이 값을 <b>내용이 정한다</b>: 남는 것이 제목 줄 하나이고 그 줄의 바닥값이
    {@code controlHeight + 16} 이다({@code GridHeader}). 좌우에서는 그 자리를 우리가 적어야
    하는데 <b>140px 로 두고 있었다</b> — 가로 제목이 들어갈 폭이었지만, 접힌 pane 이 화면의
    10%를 먹으므로 <b>접은 값이 절반쯤 사라졌다</b>. 제목을 세로로 세우면 같은 값으로
    충분하다(아래 {@code collapsedAxis}).
  */
  const collapsedPx = token.controlHeight + 16;

  return (
    <div
      ref={container}
      style={{
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <div style={paneStyle(firstCollapsed, secondCollapsed, state.ratio, horizontal, collapsedPx)}>
        {props.first(firstCollapsed, expand, props.axis ?? 'vertical')}
      </div>

      <div
        onPointerDown={() => {
          dragging.current = true;
        }}
        style={{
          display: 'flex',
          // 세로 막대에서는 화살표 둘이 위아래로 쌓인다 — 가로 막대의 좌우와 같은 모양이다.
          flexDirection: horizontal ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          // 버튼 둘은 <b>붙어 있다</b> — 사이를 벌리면 두 조각이 아니라 두 컨트롤로 읽힌다.
          gap: 0,
          // 좌우 축에서는 <b>양쪽에 숨을 둔다</b> — 상하는 크롬이 이미 그 자리를 갖는다.
          ...(horizontal
            ? { width: BAR_PX, marginInline: SPLIT_GAP }
            : { height: BAR_PX }),
          cursor: horizontal ? 'col-resize' : 'row-resize',
          userSelect: 'none',
          background: token.colorFillQuaternary,
          /*
            위아래 둘 다 긋는다 — 막대가 <b>두 그리드 사이의 띠</b> 이므로 양쪽에 경계가
            있어야 한다. 한쪽만 두면 막대가 위나 아래 그리드에 <b>붙은 것</b>처럼 보인다.

            두 줄로 보이던 것은 이 선들이 아니라 <b>버튼이 자기 위아래 선을 또 긋고
            있어서</b>였다 — 그쪽을 지웠다(아래 {@code Arrow}).
          */
          ...(horizontal
            ? { borderInline: `1px solid ${token.colorBorderSecondary}` }
            : { borderBlock: `1px solid ${token.colorBorderSecondary}` }),
        }}
      >
        {/*
          접힌 쪽이 있으면 <b>되돌리는 화살표 하나</b>다. 막대가 위에 있으면 내리는 것이,
          아래에 있으면 올리는 것이 유일하게 뜻이 있는 동작이다.
        */}
        {firstCollapsed && (
          <Arrow
            toFirst={false}
            horizontal={horizontal}
            first
            name={MSG.GRID_SPLIT_EXPAND}
            onClick={expand}
          />
        )}
        {secondCollapsed && (
          <Arrow
            toFirst
            horizontal={horizontal}
            first
            name={MSG.GRID_SPLIT_EXPAND}
            onClick={expand}
          />
        )}
        {state.collapsed === 'none' && (
          <>
            <Arrow
              toFirst
              horizontal={horizontal}
              first
              name={MSG.GRID_SPLIT_COLLAPSE_FIRST}
              onClick={() => setState((current) => ({ ...current, collapsed: 'first' }))}
            />
            <Arrow
              toFirst={false}
              horizontal={horizontal}
              name={MSG.GRID_SPLIT_COLLAPSE_SECOND}
              onClick={() => setState((current) => ({ ...current, collapsed: 'second' }))}
            />
          </>
        )}
      </div>

      <div style={paneStyle(secondCollapsed, firstCollapsed, 1 - state.ratio, horizontal, collapsedPx)}>
        {props.second(secondCollapsed, expand, props.axis ?? 'vertical')}
      </div>
    </div>
  );
}

/**
 * <b>{@code flex-grow} 를 백분율로 준다.</b> 비율을 그대로(0.55 · 0.45) 쓰면 합이 1 이라
 * 둘 다 열려 있을 때는 맞는데, <b>한쪽이 접히면 남은 쪽의 {@code flex-grow} 가 1 보다 작아져
 * 여유 공간의 그만큼만 가져간다</b> — 접었더니 반대쪽이 커지지 않고 <b>둘 다 쪼그라든</b>
 * 화면이 나온다. 실제로 그렇게 렌더된 것을 보고 고쳤다.
 */
function paneStyle(
  collapsed: boolean,
  otherCollapsed: boolean,
  ratio: number,
  horizontal: boolean,
  collapsedPx: number,
): CSSProperties {
  /*
    <b>좌우 축에서는 접힌 쪽에 고정 폭을 준다.</b> 상하에서는 제목 한 줄이 그대로 남지만,
    세로로 접으면 폭이 0 이 되어 <b>제목을 눌러 되돌리는 길</b>(grid-standard.md §6.3)이 사라진다.

    그 폭이 <b>상하로 접었을 때의 높이와 같다</b> — 그래야 접은 결과가 <i>축을 바꿨다고
    다른 양</i>이 아니다(2026-08-31 요청).
  */
  if (collapsed) {
    return horizontal
      ? { flex: '0 0 auto', width: collapsedPx, minWidth: collapsedPx, overflow: 'hidden' }
      : { flex: '0 0 auto', minHeight: 0, overflow: 'hidden' };
  }
  return {
    flex: otherCollapsed ? '1 1 0' : `${Math.round(ratio * 100)} 1 0`,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
  };
}

/**
 * <b>보이는 버튼이어야 한다.</b> 처음에는 {@code ▲}{@code ▼} 글리프를 {@code fontSize: 10}
 * · {@code opacity: 0.7} 로 그렸는데, 12px 짜리 막대 안에서 <b>있는 줄도 몰랐다</b>
 * (2026-08-29 실물). 아이콘 · 사각 판 · 호버 배경 셋으로 <i>누를 것</i> 임을 말한다.
 */
function Arrow(props: {
  /** 막대가 <b>첫 pane 쪽으로</b> 가는가 — 위 또는 왼쪽이다. 이름이 방향에서 오지 않는다. */
  toFirst: boolean;
  horizontal: boolean;
  name: string;
  first?: boolean;
  onClick: () => void;
}) {
  const { token } = theme.useToken();
  const [hover, setHover] = useState(false);
  const Icon = props.horizontal
    ? props.toFirst
      ? CaretLeftOutlined
      : CaretRightOutlined
    : props.toFirst
      ? CaretUpOutlined
      : CaretDownOutlined;

  return (
    <Tooltip title={label(props.name)}>
      <button
        type="button"
        // 드래그 시작과 섞이지 않게 한다 — 화살표를 누르는 것은 끄는 것이 아니다.
        onPointerDown={(event) => event.stopPropagation()}
        onClick={props.onClick}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        // 이름이 방향에서 오지 않는다 — 같은 {@code ▼} 가 접기이기도 <b>되돌리기</b>이기도 하다.
        aria-label={label(props.name)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          // 100px 이다 — 12px 짜리 막대 위에서 <b>겨냥해서 누를 수 있어야</b> 하고,
          // 그 높이로는 폭이 유일한 여유다(2026-08-30 실물).
          // 축이 바뀌면 <b>여유가 있는 쪽</b>도 바뀐다 — 세로 막대에서는 높이가 그 자리다.
          ...(props.horizontal ? { width: 12, height: 100 } : { width: 100, height: 12 }),
          padding: 0,
          /*
            막대에서 <b>도려낸 조각</b>처럼 보여야 한다 — 막대의 위아래 선이 이미 경계이므로
            버튼이 자기 위아래 선을 또 그으면 <b>얇은 띠 안에 선이 넉 줄</b>이 된다. 남기는
            것은 좌우 선뿐이고 모서리는 각지다(2026-08-30 실물).
          */
          ...(props.horizontal
            ? { borderInline: 'none', borderBlock: `1px solid ${token.colorBorderSecondary}` }
            : { borderBlock: 'none', borderInline: `1px solid ${token.colorBorderSecondary}` }),
          borderRadius: 0,
          // 맞닿는 선을 겹친다 — 안 그러면 둘 사이가 <b>두 줄</b>이다.
          ...(props.horizontal
            ? { marginBlockStart: props.first ? 0 : -1 }
            : { marginInlineStart: props.first ? 0 : -1 }),
          background: hover ? token.colorFillSecondary : token.colorBgContainer,
          color: token.colorTextSecondary,
          cursor: 'pointer',
          fontSize: 9,
          lineHeight: 1,
        }}
      >
        <Icon />
      </button>
    </Tooltip>
  );
}

function read(key: string, fallback: number): SplitState {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { ratio: fallback, collapsed: 'none' };
    const parsed = JSON.parse(raw) as unknown;
    // 모양이 다른 값은 없는 것으로 친다 — 옛 형식이 남아 있으면 NaN 비율이 된다.
    if (
      typeof parsed === 'object'
      && parsed !== null
      && typeof (parsed as SplitState).ratio === 'number'
      && ['none', 'first', 'second'].includes((parsed as SplitState).collapsed)
    ) {
      return parsed as SplitState;
    }
  } catch {
    // 손상된 값이다.
  }
  return { ratio: fallback, collapsed: 'none' };
}
