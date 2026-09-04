import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  DownloadOutlined,
  DownOutlined,
  RightOutlined,
  SaveOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Empty, Input, Space, Spin, Tooltip, Typography, theme } from 'antd';
import { FillColumn } from '@/shared/components/FillColumn';
import { hasPermission } from '@/shared/authz/permission';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { useAuthStore } from '@/shared/stores/authStore';
import { FONT_WEIGHT_VALUE, useUiStore } from '@/shared/stores/uiStore';
import { useResolvedDark } from '@/shared/theme/useResolvedDark';
import { CELL_PADDING, treeSkin, type TreeSkin } from '@/shared/tree/treeSkin';
import { downloadRows } from '@/shared/grid/excel/workbook';
import { headerMinWidth, textWidth } from '@/shared/grid/headerWidth';
import { SEARCH_VALUE_WIDTH } from '@/shared/searchform/fieldWidth';
import type { GridButtonControl } from '@/shared/grid/types';
import {
  buildTree,
  selfAndDescendants,
  visibleRows,
  zoneAt,
} from '@/shared/tree/treeModel';
import type { DropZone, TreeColumn, TreeGridProps, TreeNode } from '@/shared/tree/types';

/**
 * 트리 그리드 — screen/menu/requirements.md. <b>`<DataGrid>` 가 아니다.</b>
 *
 * <p>AG Grid 의 Tree Data 는 Enterprise 이며 어휘 밖이라(frontend/grid.md) 판을 쓰지 않고 직접
 * 그린다. 53 의 크롬·색은 그대로 받는다 — 제목 줄, 버튼 자리 ①·Ⓑ·②, 왼쪽의 건수.
 *
 * <h2>여기 없는 것이 이 컴포넌트의 절반이다</h2>
 *
 * <table>
 *   <tr><td>페이징</td><td>트리를 나누면 <b>부모 없는 자식 페이지</b>가 생긴다(§4.2.2)</td></tr>
 *   <tr><td>컬럼 필터</td><td>헤더 필터가 행을 감추면 트리가 아니게 된다(§4.10)</td></tr>
 *   <tr><td>그리드 설정</td><td>계층 컬럼은 맨 왼쪽 고정이고 남는 것이 표시 여부뿐이다(§4.2)</td></tr>
 *   <tr><td>상태 컬럼 · 삭제 컬럼 · 저장 버튼</td><td><b>즉시 저장</b>이라 미저장 상태가 없다(§4.4)</td></tr>
 * </table>
 *
 * <h2>드래그가 이 컴포넌트의 본체다</h2>
 *
 * 행 하나를 <b>세로로 셋</b>으로 나눈다(§4.5.2) — 위 1/4 는 앞 형제, 가운데 1/2 는 자식 맨 끝,
 * 아래 1/4 는 <i>보이는 다음 행</i> 앞이다. 선과 테두리는 <b>모양이 다르다</b>: 선은
 * <i>사이에 끼운다</i>, 테두리는 <i>안에 넣는다</i> — 같은 표시를 굵기나 색으로만 구분하지
 * 않는다(frontend/grid.md).
 *
 * <p>그 위에 <b>문장</b>을 띄운다. 표시가 최종 판정이 아니라 <b>문장이 최종 판정</b>이며,
 * <b>놓을 수 없는 자리에서도 이유를 낸다</b> — 왜 안 놓이는지 모르면 사용자는 버그로 읽는다.
 *
 * <h2>표시 설정은 <b>그리드와 같은 것</b>을 본다</h2>
 *
 * <p>머리 높이 · 행 높이 · 글자 크기가 {@code uiStore} 의 셋이다(frontend/tabs.md) — 판을 쓰지 않는다고
 * 설정을 따르지 않으면, <b>한 화면의 그리드 둘이 다른 밀도</b>로 보인다(2026-08-31 실물:
 * 하단 예외 목록은 촘촘한데 위 트리만 헐렁했다). 설정 창의 라벨이 <i>그리드</i> 라 트리가
 * 예외라고 읽을 근거도 없다.
 *
 * <p><b>글자 크기는 행에 걸고 셀은 물려받는다.</b> 셀을 그리는 것은 화면이므로(JSX 를 받는다)
 * 컴포넌트가 셀마다 크기를 먹일 수 없고, 화면이 자기 크기를 적으면 <b>설정이 그 화면만 비껴
 * 간다</b> — 물려받게 두는 것이 그 규약이다.
 *
 * <h2>색과 여백도 <b>판의 것</b>을 쓴다</h2>
 *
 * <p>{@code treeSkin} 이 판의 테마 파라미터와 1:1 로 맞춘 값을 낸다 — 머리 배경 · 1px 선 ·
 * 셀 여백 16px · hover · 선택. <b>비슷하게 그린 것이 아니라 같은 값을 계산한 것</b>이며
 * (2026-08-31 요청: <i>"AG Grid 와 너무 이질적"</i>), 그래서 톤·모드를 바꾸면 두 판이 함께
 * 따라온다.
 *
 * <h2>편집은 <b>더블 클릭</b>이다 — 셀에 입력 칸이 서 있지 않다</h2>
 *
 * <p>콤보가 셀에 늘 보였다(2026-08-31 요청). 판의 편집 가능 셀은 <b>평소에 값만 보이고</b>
 * 더블 클릭에서 편집기가 열리는데(frontend/grid.md), 트리만 입력 화면처럼 보였다 — 이 트리에서 자주
 * 하는 일은 구조를 <b>보는</b> 것이다.
 *
 * <p><b>열린 셀은 하나다</b>({@code editing}). 판과 같은 규칙이며, 여럿이 열려 있으면
 * <i>어느 값이 아직 안 저장된 것인지</i> 를 화면이 말하지 못한다 — 이 트리는 즉시 저장이라
 * (§4.4) 더 그렇다: 열린 채로 남은 칸은 <b>아무것도 하지 않은 칸</b>이다. 조회를 누르면
 * 그 칸이 닫힌다.
 *
 * <p><b>잠긴 칸은 칠한다</b>({@code TreeColumn.editable}) — `.bo-cell-readonly` 와 같은 값
 * 이다. 열리는 칸을 표시하는 대신 잠긴 칸을 칠하는 것이 이 프로젝트의 규약이고(frontend/grid.md),
 * 트리만 반대로 두면 그 화면에서 배운 것이 옆 화면에서 틀린다.
 */
export function TreeGrid<T>(props: TreeGridProps<T>) {
  const { token } = theme.useToken();
  const dark = useResolvedDark();
  /*
    판이 테마에서 계산해 주던 색과 여백 — <b>같은 파라미터를 손으로 계산한다</b>(`treeSkin`).
    모드를 함께 보는 것은 hover 가 다크에서 두 배로 진하기 때문이다(판의 `colorSchemeDark`).
  */
  const skin = useMemo(() => treeSkin(token, dark), [token, dark]);
  const permissions = useAuthStore((state) => state.permissions);
  /*
    그리드와 <b>같은 설정</b>을 본다 — frontend/tabs.md · 클래스 주석. 판(AG Grid)이 테마 파트로 받는
    셋을 여기서는 손으로 먹인다: 머리 높이는 머리 줄의 최소 높이, 행 높이는 행의 최소 높이,
    글자 크기는 <b>물려받게</b> 머리와 행에 건다.
  */
  const headerHeight = useUiStore((state) => state.gridHeaderHeight);
  const rowHeight = useUiStore((state) => state.gridRowHeight);
  const fontSize = useUiStore((state) => state.gridFontSize);
  const fontWeight = useUiStore((state) => state.fontWeight);
  const fontFamily = useUiStore((state) => state.fontFamily);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [drag, setDrag] = useState<{ node: TreeNode<T>; forbidden: Set<string> } | null>(null);
  const [hover, setHover] = useState<{ id: string; zone: DropZone; ok: boolean; text: string } | null>(
    null,
  );
  /**
   * <b>지금 열린 셀 하나</b> — 판과 같은 규칙이다(frontend/grid.md).
   *
   * <p>컬럼을 <b>헤더 키로</b> 가리킨다. {@code TreeColumn} 에 식별자가 없고(그리드 설정이
   * 없어 필요한 적이 없었다 — screen/menu/requirements.md) 헤더는 메시지 키라 <b>한 트리 안에서 유일</b>하다 —
   * 판의 컬럼 목록도 같은 값을 {@code key} 로 쓰고 있다.
   */
  const [editing, setEditing] = useState<{ id: string; column: string } | null>(null);
  const body = useRef<HTMLDivElement>(null);
  /** hover 자동 펼침의 타이머 — 접힌 폴더 위에 잠시 머무르면 펼친다(§4.5.1). */
  const expandTimer = useRef<{ id: string; handle: number } | null>(null);

  const roots = useMemo(
    () => buildTree(props.rows, props.idOf, props.parentOf),
    [props.rows, props.idOf, props.parentOf],
  );
  const nodes = useMemo(() => {
    const map = new Map<string, TreeNode<T>>();
    const walk = (list: TreeNode<T>[]) => list.forEach((node) => {
      map.set(node.id, node);
      walk(node.children);
    });
    walk(roots);
    return map;
  }, [roots]);

  /**
   * 검색은 <b>접힘을 이긴다</b>(§4.10) — 일치 노드의 경로를 펼친다. 강조만 하고 펼치지 않으면
   * <i>접힌 채로 "찾았다"</i> 가 된다.
   *
   * <p><b>접힘을 고쳐 쓰지 않고 덮어 읽는다.</b> {@code collapsed} 는 <i>사람이 접은 것</i>
   * 이고 이것은 <i>지금 무엇이 보이는가</i> 라 축이 다르다 — 상태를 고치면 검색어를 지웠을
   * 때 <b>접어 두었던 폴더가 돌아오지 않는다</b>. 검색은 잠시 젖히는 것이지 접힘을 푸는
   * 것이 아니다.
   */
  const shown = useMemo(() => {
    if (!props.highlighted || props.highlighted.size === 0) return collapsed;
    const next = new Set(collapsed);
    for (const id of props.highlighted) {
      let cursor = nodes.get(id)?.parentId ?? null;
      while (cursor) {
        next.delete(cursor);
        cursor = nodes.get(cursor)?.parentId ?? null;
      }
    }
    return next;
  }, [collapsed, nodes, props.highlighted]);

  const visible = useMemo(() => visibleRows(roots, shown), [roots, shown]);

  /** 글자를 재는 글꼴 — <b>실제로 그려지는 값</b>이어야 한다(`headerWidth` 와 같은 규약). */
  const font = useMemo(
    () =>
      `${String(FONT_WEIGHT_VALUE[fontWeight])} ${String(fontSize)}px `
      + `${fontFamily ?? token.fontFamily}`,
    [fontFamily, fontSize, fontWeight, token.fontFamily],
  );

  /**
   * 계층 컬럼의 폭 — <b>내용에서 낸다</b>(screen/menu/requirements.md · {@code hierarchyText}).
   *
   * <p><b>접힌 행까지 전부 잰다.</b> 보이는 것만 재면 폴더를 펼칠 때마다 컬럼이 넓어지고
   * 좁아져 <i>표가 숨을 쉬는</i> 것처럼 보인다 — 트리는 이미 조립돼 있어 접힌 행의 깊이도
   * 공짜로 안다(sys/menu.md).
   *
   * <p><b>헤더도 함께 본다.</b> 이름이 전부 짧은 트리에서 헤더가 잘리면 그것도 잘린 것이다.
   *
   * <p>{@code null} 은 <i>선언하지 않았다</i> 이며 옛 모양({@code flex: 1})으로 남는다.
   */
  const hierarchyWidth = useMemo(() => {
    const textOf = props.hierarchyText;
    if (!textOf) return null;

    let widest = 0;
    nodes.forEach((node) => {
      const glyphs = textWidth(textOf(node.data), font);
      if (glyphs === 0) return;
      widest = Math.max(widest, indentOf(node.depth) + HIERARCHY_CHROME + glyphs);
    });
    // 캔버스가 없는 환경(jsdom)이다 — 잴 수 없으면 <b>고정 폭</b>으로 떨어진다.
    if (widest === 0) return HIERARCHY_FALLBACK;

    const header = headerMinWidth(label(props.hierarchyHeader), font, {
      sortable: false,
      required: false,
    });
    return Math.ceil(Math.min(Math.max(widest, header, HIERARCHY_MIN), HIERARCHY_MAX));
  }, [font, nodes, props.hierarchyHeader, props.hierarchyText]);

  /** 화면이 가리킨 행으로 스크롤한다 — <b>첫 일치</b>다(screen/menu/requirements.md). 못 보면 못 찾은 것이다. */
  const { focusedId } = props;
  useEffect(() => {
    if (!focusedId || !body.current) return;
    body.current
      .querySelector(`[data-tree-row="${CSS.escape(focusedId)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [focusedId, visible]);

  /**
   * 편집을 연다 · 닫는다 — <b>여는 것은 더블 클릭이고 닫는 것은 고른 값과 {@code Escape} 다</b>.
   *
   * <p>즉시 저장이라(§4.4) 값을 고르는 순간 화면이 {@code done} 을 부르고, 그래서 <b>저장
   * 뒤의 다시 읽기에는 열린 셀이 없다</b>.
   */
  const openEdit = useCallback((id: string, column: string) => {
    setEditing({ id, column });
  }, []);
  const closeEdit = useCallback(() => setEditing(null), []);

  /**
   * ① 의 <b>조회</b> — 누르면 <b>열린 편집기를 닫는다</b>.
   *
   * <p>조회는 판을 통째로 갈아 끼우므로(§4.10 에서도 전건이다) 열어 둔 칸이 <i>어느 행의
   * 것</i>인지가 흔들린다. 판도 데이터가 갈릴 때 편집을 멈춘다 — <b>사건에서 닫는 것</b>이
   * 요점이다: 효과로 두면 조회가 끝날 때마다 상태가 한 번 더 바뀐다.
   */
  const read = useCallback(() => {
    setEditing(null);
    props.onRead();
  }, [props]);

  const loading = props.loading === true;

  const toggle = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  /**
   * 모두 접기 · 펼치기 — <b>드래그의 전제</b>다(§4.5.1).
   *
   * <p>24행이 전부 펼쳐진 트리에서 노드 하나를 다른 폴더로 끄는 것은 어렵다. 접으면 폴더 몇
   * 줄만 남고, 그 상태에서 끄는 것이 트리 이동의 정상 동선이다 — <b>접기가 놓을 수 있는
   * 자리를 바꾼다</b>(§4.5.2 의 <i>펼친 폴더의 아래 1/4</i>).
   *
   * <p><b>저장하지 않는다.</b> 접힘은 그 순간의 작업 상태이지 개인화가 아니다(frontend/grid.md).
   */
  const collapseAll = useCallback(() => {
    const folders = new Set<string>();
    nodes.forEach((node) => {
      if (node.children.length > 0) folders.add(node.id);
    });
    setCollapsed(folders);
  }, [nodes]);
  const expandAll = useCallback(() => setCollapsed(new Set()), []);

  /*
    <b>토글 하나로 두지 않는다</b>(§4.5.1) — 일부만 펼친 중간 상태에서 토글이 무엇을
    가리키는지 말할 수 없다. 버튼 둘은 누르면 무슨 일이 일어나는지가 라벨 그대로다.
  */
  useImperativeHandle(props.handleRef, () => ({ collapseAll, expandAll }), [collapseAll, expandAll]);

  // ── 드래그 (screen/menu/requirements.md) ────────────────────────────────────────────

  const clearExpandTimer = () => {
    if (expandTimer.current) {
      window.clearTimeout(expandTimer.current.handle);
      expandTimer.current = null;
    }
  };

  const startDrag = (node: TreeNode<T>) => {
    // 자손 계산이 공짜다 — 트리를 이미 갖고 있다(sys/menu.md 의 프론트 층).
    setDrag({ node, forbidden: selfAndDescendants(node) });
  };

  const endDrag = () => {
    clearExpandTimer();
    setDrag(null);
    setHover(null);
  };

  const over = (event: React.DragEvent<HTMLDivElement>, target: TreeNode<T>) => {
    if (!drag) return;
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    let zone = zoneAt(event.clientY - rect.top, rect.height);
    // 자식을 가질 수 없는 행은 <b>가운데 구역이 죽는다</b> — 위·아래는 살아 있다(§4.5.2).
    if (zone === 'inside' && props.canHaveChildren && !props.canHaveChildren(target.data, target)) {
      zone = event.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
    }
    const verdict = judge(drag, target, zone, props);
    setHover({ id: target.id, zone, ok: verdict.ok, text: verdict.text });

    /*
      접힌 폴더 위에 잠시 머무르면 펼친다 — 접어 두고 끌기 시작하면 목적지가 접혀 있다.
      **되돌리지 않는다**(§4.5.1): 드래그가 끝나도 펼쳐진 채로 둔다. 되돌리면 방금 놓은
      노드가 눈앞에서 사라진다.
    */
    if (zone === 'inside' && shown.has(target.id)) {
      if (expandTimer.current?.id !== target.id) {
        clearExpandTimer();
        expandTimer.current = {
          id: target.id,
          handle: window.setTimeout(() => {
            setCollapsed((current) => {
              const next = new Set(current);
              next.delete(target.id);
              return next;
            });
            expandTimer.current = null;
          }, HOVER_EXPAND_MS),
        };
      }
    } else {
      clearExpandTimer();
    }
  };

  const drop = (event: React.DragEvent<HTMLDivElement>, target: TreeNode<T>) => {
    event.preventDefault();
    const current = drag;
    const zone = hover?.zone;
    const ok = hover?.ok;
    endDrag();
    if (!current || !zone || !ok || !props.onDrop) return;

    const place = resolve(target, zone, roots, shown);
    void props.onDrop({ dragId: current.node.id, targetId: target.id, zone, ...place });
  };

  // ── 엑셀 (screen/menu/requirements.md) ──────────────────────────────────────────────

  const { excel } = props;
  const [downloading, setDownloading] = useState(false);
  const download = useCallback(async () => {
    if (!excel) return;
    setDownloading(true);
    try {
      const table = excel.build();
      await downloadRows(excel.fileName, table.columns, table.rows, stamp());
    } finally {
      setDownloading(false);
    }
  }, [excel]);

  const canSave = hasPermission(permissions, props.menuCd, 'SAVE');
  /*
    <b>①이 잠기는 이유가 둘</b>이다 — 조회 중(곧 풀린다)이거나 <b>대상이 없다</b>
    (frontend/grid.md 의 빈 상태). 한 값으로 모으는 것은 ①의 <b>모든</b> 컨트롤이 같은 상태를
    봐야 하기 때문이다: 조회만 잠그고 접기·펼치기를 열어 두면 <i>빈 트리를 접는</i> 버튼이
    남는다.
  */
  const locked = loading || props.disabled === true;
  /*
    <b>접힌 것과 없는 것은 다르다</b>(frontend/grid.md) — 제목 줄을 남겨야 그 둘이 구분되고, 되돌리는
    길이 그 제목 하나다. 세로로 서는 것은 <b>좌우로 접혔을 때뿐</b>이다.
  */
  /* 이름이 {@code collapsed} 가 아니다 — 그것은 <b>접힌 폴더들</b>이다(위 상태). */
  const paneCollapsed = props.collapsed === true;
  const upright = paneCollapsed && props.collapsedAxis === 'horizontal';
  const controls = (props.controls ?? []).filter(
    (control) => !control.actionCd || hasPermission(permissions, control.menuCd ?? props.menuCd, control.actionCd),
  );

  return (
    <FillColumn>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 4px',
          minHeight: token.controlHeight + 16,
          // 세로 띠에서는 <b>제목이 위에서 시작</b>한다 — {@code GridHeader} 와 같은 모양이다.
          ...(upright ? { flexDirection: 'column', height: '100%', paddingInline: 0 } : {}),
        }}
      >
        <Space size={6} style={{ minWidth: 0 }} orientation={upright ? 'vertical' : 'horizontal'}>
          <Typography.Text
            strong
            style={{
              cursor: paneCollapsed ? 'pointer' : 'default',
              /*
                <b>세로쓰기다 — 돌린 것이 아니다.</b> {@code rotate} 는 자리를 잡는 것이
                변환 전 상자라 띠 밖으로 삐져나가고 한글이 <b>옆으로 눕는다</b>.

                <b>{@code inline-block} 이 함께 있어야 한다</b> — 판이 제목을 {@code span}
                으로 그리는데, {@code writing-mode} 는 <b>인라인 상자에서 무시된다</b>
                (CSS Writing Modes §3.1: 부모의 값을 그대로 쓴다). 그래서 아무 일도 일어나지
                않는다.
              */
              ...(upright ? { display: 'inline-block', writingMode: 'vertical-rl' } : {}),
            }}
            onClick={paneCollapsed ? props.onExpand : undefined}
          >
            {label(props.title)}
          </Typography.Text>
          {/*
            <b>지금 보고 있는 대상</b> — frontend/grid.md. 제목과 굵기·색이 갈린다: 이것은 제목이
            아니라 <i>누구의 트리인가</i> 이고, 같은 굵기로 두면 그리드 이름이 사람마다
            바뀌는 것처럼 보인다. 없으면 아무것도 붙지 않는다.
          */}
          {/*
            <b>접히면 접미를 뺀다.</b> 띠에 남을 자리가 제목 하나뿐이고, 세로로 두 줄을
            세우면 <i>어느 쪽이 그리드 이름인지</i> 가 흐려진다 — 펼치면 다시 붙는다.
          */}
          {!paneCollapsed && props.titleSuffix !== undefined && props.titleSuffix !== '' && (
            <Typography.Text type="secondary" ellipsis>
              {props.titleSuffix}
            </Typography.Text>
          )}
        </Space>
        {/* 보이지 않는 트리의 버튼을 누를 이유가 없다 — 버튼도 함께 접힌다(frontend/grid.md). */}
        {paneCollapsed ? null : (
        <Space size={8}>
          {/* ①의 왼쪽 — 트리 검색이다(screen/menu/requirements.md). 조회 <b>앞</b>인 것이 일의 순서다. */}
          {props.search && (
            <Input
              allowClear
              // 조회조건 값 칸과 <b>같은 크기</b>다 — frontend/search-form.md · `fieldWidth`.
              style={{ width: SEARCH_VALUE_WIDTH }}
              placeholder={label(props.search.placeholder)}
              value={props.search.value}
              /*
                <b>칸도 함께 잠근다.</b> 대상이 없으면 트리가 비어 있어 찾을 이름이 없고,
                칠 수 있는 칸을 남겨 두면 <i>쳤는데 아무 일도 없다</i> 가 된다.
              */
              disabled={locked}
              onChange={(event) => props.search?.onChange(event.target.value)}
            />
          )}
          <Button icon={<SearchOutlined />} disabled={locked} onClick={read}>
            {label(MSG.GRID_READ)}
          </Button>
          {/*
            <b>저장 버튼은 선언이 있을 때만 선다</b>(screen/menu/requirements.md). 이 컴포넌트를 쓰는 화면 둘의
            저장 모델이 반대라(screen/menu/requirements.md) 여기에 고정으로 두면 메뉴 트리에 <i>누를 수 없는
            버튼</i> 이 하나 생긴다 — frontend/grid.md 이 <b>화면이 선언한다</b> 고 정한 그대로다.
          */}
          {props.save && canSave && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              disabled={locked || !props.save.dirty}
              onClick={() => void props.save?.onSave()}
            >
              {label(MSG.GRID_SAVE)}
            </Button>
          )}
          {controls.map((control) => (
            <ControlButton key={control.key} control={control} locked={locked} />
          ))}
          {/*
            ② — 도구는 언제나 맨 오른쪽이다(frontend/grid.md). <b>항목이 하나라</b> 드롭다운을 열지
            않고 아이콘이 바로 내린다 — 페이지가 없어 *현재 페이지* 와 *전체* 가 같다(§4.9).
          */}
          {excel && hasPermission(permissions, props.menuCd, 'EXPORT') && (
            <Tooltip title={label(MSG.GRID_EXCEL)}>
              <Button
                icon={<DownloadOutlined />}
                loading={downloading}
                disabled={locked}
                onClick={() => void download()}
              />
            </Tooltip>
          )}
        </Space>
        )}
      </div>

      {/* 접힌 트리는 <b>판도 푸터도 그리지 않는다</b> — 좁은 띠 안에서 잘린 표가 남는다. */}
      {paneCollapsed ? null : (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          // 판의 {@code wrapperBorder} 와 같은 색이다 — `treeSkin`.
          border: `1px solid ${skin.border}`,
          borderRadius: token.borderRadius,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 1,
            /*
              색과 굵기가 <b>판의 머리와 같은 값</b>이다 — {@code headerBackgroundColor} ·
              {@code headerFontWeight}(`treeSkin` 의 표). 굵기가 600 이었는데 판은 500 이라,
              위아래로 놓인 두 판의 머리가 <b>다른 글씨</b>로 보였다(2026-08-31 요청).
            */
            background: skin.headerBackground,
            borderBottom: `1px solid ${skin.border}`,
            fontWeight: skin.headerFontWeight,
            // 설정 창의 <b>그리드 머리 높이 · 글자 크기</b>다(frontend/tabs.md · 클래스 주석).
            minHeight: headerHeight,
            fontSize,
          }}
        >
          <div
            style={{
              ...hierarchyCell(hierarchyWidth),
              ...headerCell(skin),
            }}
          >
            {label(props.hierarchyHeader)}
          </div>
          {props.columns.map((column) => (
            <div
              key={column.header}
              style={{
                width: column.width,
                flex: `0 0 ${column.width}px`,
                ...headerCell(skin),
                textAlign: column.align ?? 'left',
              }}
            >
              {label(column.header)}
            </div>
          ))}
        </div>

        <div ref={body}>
          {props.loading && visible.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Spin />
            </div>
          ) : visible.length === 0 ? (
            <div style={{ padding: 48 }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={label(props.emptyText ?? MSG.GRID_EMPTY)}
              />
            </div>
          ) : (
            visible.map((node) => (
              <Row
                key={node.id}
                node={node}
                props={props}
                skin={skin}
                hierarchyWidth={hierarchyWidth}
                rowHeight={rowHeight}
                fontSize={fontSize}
                editing={editing?.id === node.id ? editing.column : null}
                onEdit={openEdit}
                onEditDone={closeEdit}
                selected={props.selectedId === node.id}
                highlighted={props.highlighted?.has(node.id) === true}
                collapsed={shown.has(node.id)}
                onToggle={toggle}
                draggable={canSave && props.onDrop !== undefined}
                dragging={drag?.node.id === node.id}
                forbidden={drag?.forbidden.has(node.id) === true}
                hover={hover?.id === node.id ? hover : null}
                onDragStart={startDrag}
                onDragEnd={endDrag}
                onDragOver={over}
                onDrop={drop}
              />
            ))
          )}
        </div>
      </div>
      )}

      {/*
        푸터가 한 칸이 된다 — 트리에는 페이지가 없으므로 중앙(네비게이션)과 오른쪽(페이지
        사이즈)이 사라지고 <b>왼쪽의 건수만</b> 남는다(§4.2.2).

        <b>높이는 그리드 푸터와 같다</b>(2026-08-31 실물). 칸이 하나라고 낮게 두면, 위아래로
        놓인 트리와 그리드의 <b>판 바닥이 어긋나</b> 스플리터를 옮길 때마다 그 차이가 눈에
        띈다 — 두 컴포넌트가 같은 바닥값({@code controlHeight + 16})을 선언한다.
      */}
      {paneCollapsed ? null : (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 8px',
          minHeight: token.controlHeight + 16,
          color: token.colorTextSecondary,
          fontSize: token.fontSizeSM,
        }}
      >
        {label(MSG.GRID_FOOTER_COUNT, { count: props.rows.length })}
      </div>
      )}
    </FillColumn>
  );
}

/** 접힌 폴더를 펼치기까지 머무르는 시간. 지나가다 스치는 것으로는 펼쳐지지 않아야 한다. */
const HOVER_EXPAND_MS = 700;

/** 한 단 들여쓰기 — screen/menu/requirements.md. 최상위가 1단이므로 그 단은 들여쓰지 않는다. */
const INDENT_STEP = 16;
/** 펼침 버튼의 자리. 리프도 <b>같은 폭을 먹는다</b> — 없으면 이름이 형제보다 왼쪽으로 밀린다. */
const TOGGLE_WIDTH = 20;

/**
 * 계층 셀이 <b>글자 말고 쓰는 폭</b> — 오른쪽 여백 · 펼침 버튼 · 그 사이 간격, 그리고
 * <b>화면이 이름 옆에 붙이는 것들</b>(아이콘 하나 · 미저장 표시 하나)이다.
 *
 * <p>왼쪽 여백은 여기 없다 — {@link indentOf} 가 이미 그것을 들고 있다.
 *
 * <p>화면이 무엇을 얼마나 붙이는지는 컴포넌트가 알 수 없다({@code hierarchy} 가 JSX 다).
 * 지금 이 컴포넌트를 쓰는 셋이 <b>많아도 둘</b>을 붙이므로 그 몫을 상수로 둔다 — 셋째가
 * 생기면 이 값이 아니라 <b>선언</b>이 갈려야 한다(그때가 폭을 화면이 정해야 하는 때다).
 */
const HIERARCHY_CHROME = CELL_PADDING + TOGGLE_WIDTH + 4 + 40;

/** 헤더도 이름도 짧은 트리에서 <b>그 아래로는 내려가지 않는다</b>. */
const HIERARCHY_MIN = 180;
/**
 * 여기서 <b>멈추고 툴팁에 맡긴다</b>. 이름 하나가 길다고 컬럼이 화면을 밀면 액션 열이
 * 스크롤 밖으로 나가는데, 그것이 이 화면에서 <b>일을 할 수 없게 되는</b> 것이다.
 */
const HIERARCHY_MAX = 420;
/** 잴 수 없을 때(jsdom · 캔버스 없음)의 폭 — 재지 않고도 대개 들어가는 값이다. */
const HIERARCHY_FALLBACK = 300;

/** 그 단의 왼쪽 여백 — <b>셀 여백에</b> 단만큼 더한다. */
function indentOf(depth: number): number {
  return CELL_PADDING + (depth - 1) * INDENT_STEP;
}

/**
 * 머리 칸 하나 — <b>여백은 판의 {@code cellHorizontalPadding}</b> 이고 넘치면 말줄임표다.
 *
 * <p>세로 여백을 주지 않는 것이 요점이다: 높이는 <b>설정 창의 머리 높이</b>가 정하고
 * (frontend/tabs.md) 줄은 그 안에서 가운데 정렬된다 — 여백을 함께 주면 <b>선언한 높이보다
 * 커진다</b>.
 */
function headerCell(skin: TreeSkin): React.CSSProperties {
  return {
    paddingInline: skin.cellPaddingInline,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
}

/**
 * 값 칸 하나 — 머리와 <b>같은 여백</b>이다. 갈리면 세로줄이 어긋난다.
 *
 * <p>넘치는 것을 감추는 것도 판과 같다(`.ag-cell` 이 {@code overflow: hidden} 이다) —
 * 셀 하나가 긴 값을 들었다고 다음 컬럼 위로 삐져나오면 표가 아니게 된다.
 */
function bodyCell(skin: TreeSkin, editable: boolean): React.CSSProperties {
  return {
    paddingInline: skin.cellPaddingInline,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    // <b>잠긴 칸을 칠한다</b> — `.bo-cell-readonly` 와 같은 값이다(frontend/grid.md).
    background: editable ? undefined : skin.readonlyCell,
  };
}

/** 이 셀이 열리는가 — {@code ColumnDef.editable} 과 <b>같은 방향</b>이다(기본은 닫힘). */
function editableAt<T>(column: TreeColumn<T>, node: TreeNode<T>): boolean {
  if (column.editable === undefined) return false;
  return typeof column.editable === 'function'
    ? column.editable(node.data, node)
    : column.editable;
}

/**
 * 계층 컬럼의 칸 스타일 — <b>폭이 있으면 고정, 없으면 남는 폭을 먹는다</b>.
 *
 * <p>머리와 행이 같은 함수를 쓴다. 둘이 갈리면 <b>헤더와 값의 세로줄이 어긋나는</b> 표가
 * 되는데, 그것은 눈으로 찾기 전에는 보이지 않는다.
 */
function hierarchyCell(width: number | null): React.CSSProperties {
  return width === null
    ? { flex: 1, minWidth: 260 }
    : // 잘린 이름은 <b>툴팁</b>이 말한다 — 그래서 넘치는 것을 잘라도 된다(screen/menu/requirements.md).
      { width, flex: `0 0 ${String(width)}px`, minWidth: 0, overflow: 'hidden' };
}

/**
 * 구역 → <b>부모와 자리</b> — screen/menu/requirements.md 의 표를 그대로 편다.
 *
 * <table>
 *   <tr><th>대상 행</th><th>위 1/4</th><th>가운데</th><th>아래 1/4</th></tr>
 *   <tr><td>리프 · <b>접힌</b> 폴더</td><td>앞 형제</td><td>자식 맨 끝</td><td><b>다음 형제</b></td></tr>
 *   <tr><td><b>펼친</b> 폴더</td><td>앞 형제</td><td>자식 맨 끝</td><td><b>자식 맨 앞</b></td></tr>
 * </table>
 *
 * <p>아래 1/4 가 갈리는 것은 <b>가로선이 화면에 보이는 두 행 사이를 뜻하기</b> 때문이다 —
 * 폴더가 펼쳐져 있으면 그 아래에 보이는 행이 <b>첫 자식</b>이므로, 그 사이의 선은
 * <i>첫 자식 앞</i>이다. 그래서 <b>펼친 폴더의 다음 형제 자리에 놓으려면 그 폴더를 접는다</b> —
 * 접기가 보기 좋으라고 있는 것이 아니라 <b>놓을 수 있는 자리를 바꾼다</b>(§4.5.1).
 */
function resolve<T>(
  target: TreeNode<T>,
  zone: DropZone,
  roots: TreeNode<T>[],
  shown: ReadonlySet<string>,
): { parentId: string | null; index: number } {
  const siblingsOf = (parentId: string | null): TreeNode<T>[] => {
    if (parentId === null) return roots;
    const find = (list: TreeNode<T>[]): TreeNode<T> | undefined => {
      for (const node of list) {
        if (node.id === parentId) return node;
        const found = find(node.children);
        if (found) return found;
      }
      return undefined;
    };
    return find(roots)?.children ?? [];
  };

  if (zone === 'inside') {
    // 자식 맨 끝 — 신규 노드가 가는 자리와 같다(§4.6).
    return { parentId: target.id, index: target.children.length };
  }
  const expandedFolder = target.children.length > 0 && !shown.has(target.id);
  if (zone === 'after' && expandedFolder) {
    return { parentId: target.id, index: 0 };
  }
  const siblings = siblingsOf(target.parentId);
  const at = siblings.findIndex((node) => node.id === target.id);
  return { parentId: target.parentId, index: zone === 'before' ? at : at + 1 };
}

function stamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/**
 * frontend/grid.md 의 컨트롤 하나. 비활성이면 사유를 붙인다 — screen/code/requirements.md 와 같은 규약이다.
 *
 * <p><b>`button` 만 받는다.</b> 트리 화면의 ①에 셀렉트가 필요해진 적이 없고, 필요해지면
 * 그때 이 함수가 `DataGrid` 의 `renderControl` 처럼 갈라진다 — 미리 갈라 두면 아무도
 * 쓰지 않는 가지가 생긴다.
 */
function ControlButton({ control, locked }: { control: GridButtonControl; locked: boolean }) {
  const button = (
    <Button disabled={locked || control.disabled} onClick={control.onClick}>
      {label(control.label)}
    </Button>
  );
  return control.disabled && control.hint && !locked ? (
    <Tooltip title={label(control.hint)}>
      <span style={{ display: 'inline-block' }}>{button}</span>
    </Tooltip>
  ) : (
    button
  );
}

/**
 * 드롭이 성립하는가 · 무엇이라 말할 것인가.
 *
 * <p><b>금지를 먼저 본다.</b> 자기 자손이면 어느 구역이든 놓이지 않으며, 그것은 화면이
 * 트리를 갖고 있어 <b>공짜로</b> 판정된다(sys/menu.md 의 첫째 층). 서버가 같은 검사를 다시 하는
 * 것은 <i>화면의 방어는 UX 이지 방어가 아니기</i> 때문이다(backend/security.md).
 */
function judge<T>(
  drag: { node: TreeNode<T>; forbidden: Set<string> },
  target: TreeNode<T>,
  zone: DropZone,
  props: TreeGridProps<T>,
) {
  if (drag.forbidden.has(target.id)) {
    return { ok: false, text: label(MSG.MENU_DROP_SELF) };
  }
  return props.verdict
    ? props.verdict(drag.node, target, zone)
    : { ok: true, text: '' };
}

interface RowProps<T> {
  node: TreeNode<T>;
  props: TreeGridProps<T>;
  /** 판의 테마 파라미터에서 온 색과 여백 — `treeSkin`. */
  skin: TreeSkin;
  /** 계층 컬럼의 폭 — `null` 이면 남는 폭을 먹는다(screen/menu/requirements.md). */
  hierarchyWidth: number | null;
  /** 설정 창의 <b>그리드 행 높이 · 글자 크기</b>(frontend/tabs.md). */
  rowHeight: number;
  fontSize: number;
  /** 이 행에서 열린 컬럼의 헤더 — `null` 이면 이 행에는 열린 셀이 없다. */
  editing: string | null;
  onEdit: (id: string, column: string) => void;
  onEditDone: () => void;
  selected: boolean;
  highlighted: boolean;
  collapsed: boolean;
  onToggle: (id: string) => void;
  draggable: boolean;
  dragging: boolean;
  forbidden: boolean;
  hover: { zone: DropZone; ok: boolean; text: string } | null;
  onDragStart: (node: TreeNode<T>) => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>, node: TreeNode<T>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>, node: TreeNode<T>) => void;
}

/**
 * 행 하나. <b>표시가 셋</b>이다 — 위·아래는 가로선, 가운데는 테두리(§4.5.2).
 *
 * <p><b>금지 대상은 끄는 동안 회색</b>이 된다(§4.5) — 놓아 본 뒤 에러를 내는 것보다 낫다.
 */
function Row<T>({ node, props, ...state }: RowProps<T>) {
  const { token } = theme.useToken();
  /*
    <b>행 하나의 상태다.</b> 판은 hover 를 CSS 로 칠하지만 이 트리에는 스타일시트가 없고
    (frontend/packages.md — CSS-in-JS), 위로 올리면 <b>마우스가 지날 때마다 트리 전체가 다시 그려진다</b>.
  */
  const [hovered, setHovered] = useState(false);
  const indent = indentOf(node.depth) - CELL_PADDING;
  const isFolder = node.children.length > 0;
  /*
    <b>이름을 툴팁으로 한 번 더 낸다</b>(2026-08-31 — screen/menu/requirements.md). 계층 컬럼은 폭이 내용에서
    나되 상한이 있고(`HIERARCHY_MAX`) 깊은 단은 들여쓰기가 폭을 먹으므로, <b>잘리는 이름이
    실제로 있다</b> — 잘린 채로 두면 그 행이 무엇인지 화면이 답하지 못한다.
  */
  const text = props.hierarchyText?.(node.data);
  const drawn = props.hierarchy(node.data, node);

  const line = `2px solid ${state.hover?.ok ? token.colorPrimary : token.colorError}`;

  return (
    /*
      <b>구분선이 이 바깥 상자에 있다.</b> 행 자신의 위·아래 테두리는 <b>드롭 표시</b>의
      자리라(2px 투명) 거기에 1px 선을 함께 두면, 끌 때 선의 굵기가 바뀌며 <b>행 높이가
      1px 씩 흔들린다</b>. 판은 행마다 아래 선을 하나 긋고({@code rowBorder}) 우리도 같은
      값으로 긋는다 — 선이 없어서 트리는 <i>표</i> 라기보다 <i>목록</i> 으로 보였다.
    */
    <div style={{ position: 'relative', borderBottom: `1px solid ${state.skin.border}` }}>
      <div
        data-tree-row={node.id}
        draggable={state.draggable}
        onDragStart={() => props.onDrop && state.onDragStart(node)}
        onDragEnd={state.onDragEnd}
        onDragOver={(event) => state.onDragOver(event, node)}
        onDrop={(event) => state.onDrop(event, node)}
        // 선택이 없는 화면이 있다 — screen/menu/requirements.md 의 권한 트리에서 행 하나는 그 자체로 편집
        // 대상이고 아래를 정하지 않는다.
        onClick={props.onSelect ? () => props.onSelect?.(node.data) : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          // 설정 창의 <b>그리드 행 높이 · 글자 크기</b>다 — 셀은 물려받는다(클래스 주석).
          minHeight: state.rowHeight,
          fontSize: state.fontSize,
          cursor: state.draggable ? 'grab' : props.onSelect ? 'pointer' : 'default',
          opacity: state.forbidden || state.dragging ? 0.4 : 1,
          /*
            셋의 순서가 <b>판의 우선순위</b>와 같다(frontend/grid.md) — 선택이 hover 를 이기고,
            검색 강조는 그 둘 사이다: 강조는 <i>찾은 것</i> 이라 <b>고른 것</b>보다 약하고
            지나가는 마우스보다는 세다.
          */
          background: state.selected
            ? state.skin.rowSelected
            : state.highlighted
              ? token.colorWarningBg
              : hovered
                ? state.skin.rowHover
                : undefined,
          borderTop: state.hover?.zone === 'before' ? line : '2px solid transparent',
          borderBottom: state.hover?.zone === 'after' ? line : '2px solid transparent',
          // 테두리는 <b>행 전체를 감싼다</b> — 선과 모양이 달라야 한다(frontend/grid.md).
          outline: state.hover?.zone === 'inside' ? line : undefined,
          outlineOffset: -2,
        }}
      >
        {/*
          <b>계층 칸에는 읽기 전용 색조를 깔지 않는다.</b> 이 칸이 드는 것은 값이 아니라
          <b>행의 정체</b>이며(펼침 버튼 · 드래그 손잡이 · 선택 대상) 판에서 그 자리에
          해당하는 것은 행 번호와 자동 그룹 컬럼이다 — 둘 다 크롬이라 칠하지 않는다.

          이름을 고치는 곳이 여기가 아니라는 사실은(`MESSAGE_MGMT` 하나다 — screen/menu/requirements.md) 색이
          아니라 <b>더블 클릭이 아무 일도 하지 않는 것</b>으로 이미 드러난다.
        */}
        <div
          style={{
            ...hierarchyCell(state.hierarchyWidth),
            paddingInline: CELL_PADDING,
            paddingLeft: CELL_PADDING + indent,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {isFolder ? (
            <Button
              type="text"
              size="small"
              style={{ width: TOGGLE_WIDTH, height: TOGGLE_WIDTH, minWidth: TOGGLE_WIDTH }}
              icon={state.collapsed ? <RightOutlined /> : <DownOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                state.onToggle(node.id);
              }}
            />
          ) : (
            // 리프도 같은 폭을 먹는다 — 없으면 이름이 형제보다 왼쪽으로 밀린다.
            <span style={{ display: 'inline-block', width: TOGGLE_WIDTH }} />
          )}
          {/*
            <b>펼침 버튼은 감싸지 않는다.</b> 툴팁이 이름을 말하는 것이므로 버튼 위에서도
            뜨면 <i>버튼이 그 이름인가</i> 로 읽힌다 — 감싸는 것은 이름 쪽 하나다.
          */}
          {text === undefined || text === '' ? (
            drawn
          ) : (
            <Tooltip title={text}>
              <span style={{ minWidth: 0, overflow: 'hidden', display: 'inline-flex' }}>
                {drawn}
              </span>
            </Tooltip>
          )}
        </div>
        {props.columns.map((column) => {
          const editable = editableAt(column, node);
          const open = state.editing === column.header;
          return (
          <div
            key={column.header}
            /*
              <b>선택을 막지 않는다.</b> 한때 여기서 {@code stopPropagation} 을 했는데, 셀 안의
              컨트롤을 누르는 것이 행 선택으로 번지지 않게 하려던 것이었다 — 그 대가로
              <b>이름 칸 말고는 어디를 눌러도 행이 안 골라졌다</b>(2026-08-30 실물).

              막을 이유가 애초에 없었다. 이 그리드에서 셀을 만지는 것은 <b>그 메뉴를 고치는
              일</b>이고, 그때 하단이 그 메뉴를 보여주는 것은 어긋남이 아니라 맞는 동작이다.
            */
            /*
              <b>더블 클릭이 편집기를 연다</b> — 판과 같은 제스처다(frontend/grid.md). 열 것이 없는
              컬럼(스위치처럼 셀이 곧 편집기이거나 아예 잠긴 칸)에서는 <b>아무 일도 하지
              않는다</b>: 판도 그 자리에서 조용하다.
            */
            onDoubleClick={
              editable && column.editor && !open
                ? () => state.onEdit(node.id, column.header)
                : undefined
            }
            /*
              {@code Escape} 는 <b>어느 편집기에서나 같은 뜻</b>이라 컴포넌트가 받는다 —
              화면마다 적으면 빠뜨린 편집기가 <b>닫히지 않는 칸</b>으로 남는다.
            */
            onKeyDown={
              open
                ? (event) => {
                    if (event.key === 'Escape') state.onEditDone();
                  }
                : undefined
            }
            style={{
              width: column.width,
              flex: `0 0 ${column.width}px`,
              ...bodyCell(state.skin, editable),
              /*
                <b>열린 셀은 감추지 않는다.</b> 값 칸은 넘치는 것을 자르지만(판과 같다)
                편집기는 셀보다 큰 팝업을 띄우고, 여기서 자르면 <b>드롭다운이 셀 안에서
                잘린다</b>.
              */
              ...(open ? { overflow: 'visible' } : {}),
              textAlign: column.align ?? 'left',
            }}
          >
            {open && column.editor
              ? column.editor(node.data, node, state.onEditDone)
              : column.cell(node.data, node)}
          </div>
          );
        })}
      </div>

      {/*
        <b>문장이 최종 판정이다</b>(§4.5.2). 선과 테두리 위에 그 자리를 문장으로 띄우며,
        <b>놓을 수 없는 자리에서도 이유를 낸다</b> — 왜 안 놓이는지 모르면 버그로 읽힌다.
      */}
      {state.hover && state.hover.text && (
        <div
          style={{
            position: 'absolute',
            left: CELL_PADDING + indent,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 2,
            pointerEvents: 'none',
            padding: '2px 8px',
            borderRadius: token.borderRadiusSM,
            fontSize: token.fontSizeSM,
            color: token.colorTextLightSolid,
            background: state.hover.ok ? token.colorPrimary : token.colorError,
          }}
        >
          {state.hover.text}
        </div>
      )}
    </div>
  );
}
