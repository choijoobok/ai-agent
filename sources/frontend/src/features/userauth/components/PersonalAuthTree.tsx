import { useMemo, type Ref } from 'react';
import { Space, Switch, Tag, Tooltip, Typography, theme } from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { ACTIONS, type Action } from '@/shared/authz/permission';
import { menuIconOf } from '@/shared/authz/menuIcons';
import { TreeGrid } from '@/shared/tree/TreeGrid';
import type { TreeColumn, TreeGridHandle, TreeNode, TreeSearch } from '@/shared/tree/types';
import { SWITCH_WIDTH } from '@/shared/grid/columnDefs';
import type { SplitAxis } from '@/shared/grid/SplitPane';
import type { GridButtonControl } from '@/shared/grid/types';
import { cellKey, type GrantState, type UserAuthTreeRow } from '@/features/userauth/types';

/**
 * 개인 예외의 권한 트리 — <b>screen/user-auth/requirements.md 가 정의를 갖는 그것</b>이다.
 *
 * <p>`<AuthTree>`(screen/menu/requirements.md)가 <b>덜어 낸</b> 쪽이고 여기가 <b>원본</b>이다. 셀 상태가 넷에서
 * 일곱으로 늘고, 는 셋이 전부 <b>배지</b>다 — *예정* · *만료* · *역할 경유*.
 *
 * <h2>체크박스는 *"지금 유효한가"*, 배지는 *"행이 있는가"*</h2>
 *
 * 둘을 한 칸에 겹치지 않게 가른 것이 이 컴포넌트의 전부다(screen/user-auth/requirements.md). **만료를 켜짐으로 두지
 * 않는 이유** — 스위치가 답해야 하는 질문은 *"이 사람 지금 이거 되나"* 이고, 만료 행이 켜져
 * 보이면 **그 질문에 거짓으로 답한다**. 행의 존재는 배지가 말한다.
 *
 * <h2>색을 쓰지 않는다</h2>
 *
 * 같은 화면의 예외 목록에 **읽기 전용 셀(회색)** 이 함께 있다(frontend/grid.md). 회색이 *못 고치는
 * 칸* 과 *역할로 이미 있는 칸* 두 뜻이 되면 **편집할 수 있는 칸을 편집할 수 없다고 읽는다** —
 * frontend/grid.md 의 *"색만으로 말하지 않는다"* 를 여기서는 **색을 아예 쓰지 않는 것**으로 지킨다.
 *
 * <h2>트리 행의 미저장 표시는 하나다</h2>
 *
 * 트리에는 행 상태 컬럼이 없다(그리드가 아니다). 대신 메뉴명 옆에 **`✎` 하나**를 붙이고,
 * *무엇이 바뀌었나* 는 **목록이 말한다**(`＋` · `✎` · `✕`). 셋으로 나누지 않는 것은 **한
 * 행에 액션이 넷**이라 같은 행에서 추가와 삭제가 동시에 일어나기 때문이다(screen/user-auth/requirements.md).
 *
 * <h2>저장 버튼이 여기 없다</h2>
 *
 * `<AuthTree>` 는 트리가 저장 단위였지만 여기는 **예외 목록이 저장 단위**다 — 기간과 사유가
 * 들어가는 곳이 목록뿐이므로 **데이터는 목록에 있고 트리는 그것을 읽어 그린다**(screen/user-auth/requirements.md).
 * frontend/grid.md 가 *"상태 컬럼은 저장 단위 그리드에 달린다"* 고 정한 것과 같은 자리다.
 */

/** 한 칸이 지금 무엇인가 — <b>목록의 행에서 계산해</b> 화면이 넘겨준다. */
export interface CellState {
  /** 기간에서 파생한다 — 조회 시점의 판정을 붙잡아 두지 않는다(screen/user-auth/requirements.md). */
  state: GrantState;
  /** 목록에서 `✕` 를 눌렀다 — <b>스위치는 꺼지고 배지에 취소선</b>이다. */
  deleted: boolean;
}

interface Props {
  title: string;
  /** 제목 뒤 — <b>누구의 트리인가</b>(frontend/grid.md). 사용자를 고르기 전에는 빈 문자열이다. */
  titleSuffix?: string;
  menuCd: string;
  handleRef?: Ref<TreeGridHandle>;
  rows: UserAuthTreeRow[];
  /** `${menuCd}|${actionCd}` → 그 칸의 상태. <b>목록이 원본</b>이다(screen/user-auth/requirements.md). */
  cells: ReadonlyMap<string, CellState>;
  /** 미저장 변경이 있는 메뉴들 — 메뉴명 옆의 `✎` 다. */
  dirtyMenus: ReadonlySet<string>;
  /** 스위치 하나. 불변식과 알림은 <b>화면이</b> 처리한다 — 여기는 사건만 올린다. */
  onToggle: (menuCd: string, action: Action, next: boolean) => void;
  canSave: boolean;
  onRead: () => void;
  loading: boolean;
  /**
   * ①을 통째로 잠근다 — <b>사용자를 고르기 전</b>이다(frontend/grid.md 의 빈 상태).
   *
   * <p>{@link canSave} 와 다른 축이다. 저것은 <i>권한이 없다</i> 라 셀의 스위치를 잠그고,
   * 이것은 <i>대상이 없다</i> 라 <b>①의 버튼을 잠근다</b> — 트리가 비어 있어 스위치는
   * 애초에 없다.
   */
  disabled?: boolean;
  /** 접히면 <b>제목만</b> 남는다 — frontend/grid.md. 좌우로 접히면 그 제목이 세로로 선다. */
  collapsed?: boolean;
  collapsedAxis?: SplitAxis;
  onExpand?: () => void;
  emptyText?: string;
  controls?: GridButtonControl[];
  /** ①의 검색 칸 — <b>브레드크럼이 아니라 여기다</b>(screen/menu/requirements.md · {@link TreeSearch}). */
  search?: TreeSearch;
  highlighted?: ReadonlySet<string>;
  focusedId?: string | null;
}

export function PersonalAuthTree(props: Props) {
  const { token } = theme.useToken();
  const { cells, onToggle, canSave } = props;

  const columns = useMemo<TreeColumn<UserAuthTreeRow>[]>(
    () =>
      ACTIONS.map((action) => ({
        header: ACTION_HEADER[action],
        /*
          `<AuthTree>` 보다 넓다 — 배지가 최대 둘(상태 하나 + 역할 하나) 붙는다.

          <b>스위치가 넓어진 만큼 함께 넓혔다</b>(2026-08-31 — 아래 {@code SWITCH_WIDTH}).
          안 늘리면 배지 둘이 붙는 칸에서 태그가 <b>다음 컬럼으로 삐져나온다</b>.
        */
        width: ACTION_WIDTH,
        /*
          <b>스위치는 셀이 곧 편집기다</b> — 판의 {@code ynFlag} 컬럼과 같아 더블 클릭이
          열 것이 없다(frontend/grid.md). 그래도 <b>잠긴 칸이 아니므로</b> 선언한다: 안 하면 읽기
          전용 색조가 깔린다(`TreeColumn.editable` · frontend/grid.md).

          <b>구조 노드는 잠긴다</b> — 그 칸은 파생 3-state 이며(sys/menu.md) 여기서 고칠 수 없다.
          색이 그것을 말해 주는 것이 요점이다: 폴더의 표시를 눌러 보고 <i>왜 안 되나</i> 를
          묻는 일이 없어진다.
        */
        editable: (row) => canSave && row.menuUrl !== null,
        cell: (row, node) =>
          row.menuUrl === null ? (
            <FolderState node={node} action={action} cells={cells} />
          ) : (
            <ActionCell
              row={row}
              action={action}
              cell={cells.get(cellKey(row.menuCd, action))}
              canSave={canSave}
              onToggle={onToggle}
            />
          ),
      })),
    [canSave, cells, onToggle],
  );

  return (
    <TreeGrid<UserAuthTreeRow>
      handleRef={props.handleRef}
      title={props.title}
      menuCd={props.menuCd}
      rows={props.rows}
      idOf={idOf}
      parentOf={parentOf}
      hierarchyHeader={MSG.USER_AUTH_COL_MENU}
      /*
        <b>글자 크기를 적지 않는다</b>(2026-08-31). 설정 창의 <i>그리드 글자 크기</i>를 트리가
        행에 걸고 셀이 물려받는데(frontend/tabs.md), 여기서 한 번 더 적으면 <b>설정이 이 화면만
        비껴간다</b>.
      */
      hierarchy={(row) => (
        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}
        >
          {/* 꺼진 메뉴는 흐리다 — 예외는 남지만 게이트 ④에서 걸린다(backend/security.md). */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              minWidth: 0,
              opacity: row.useYn ? 1 : 0.45,
            }}
          >
            {/*
              <b>사이더와 같은 아이콘</b>이다 — frontend/tabs.md · `menuIconOf`. 폴백까지 공유하므로
              시드가 코드를 비워 둔 메뉴도 두 화면에서 같은 모양이다.

              <b>색은 보조 글자색</b>이다. 이름과 같은 진하기로 두면 아이콘이 이름만큼
              눈에 들어와, 24행짜리 트리에서 <b>읽어야 할 것</b>이 둘이 된다.
            */}
            <span style={{ display: 'inline-flex', color: token.colorTextSecondary }}>
              {menuIconOf(row.iconCd, row.menuUrl === null)}
            </span>
            {/*
              <b>{@code minWidth: 0} 이 말줄임표의 조건</b>이다. 플렉스 항목은 기본이
              {@code min-width: auto} 라 내용보다 좁아지지 않으므로, 그것을 풀지 않으면
              칸이 좁아도 글자가 그대로 밀려 나가 <b>잘리기만</b> 한다.
            */}
            <span
              style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.menuNm}
            </span>
          </span>
          {props.dirtyMenus.has(row.menuCd) && <Typography.Text type="warning">✎</Typography.Text>}
        </span>
      )}
      /* 폭을 내용에서 내고 잘린 이름은 툴팁이 말한다 — screen/menu/requirements.md. */
      hierarchyText={(row) => row.menuNm}
      columns={columns}
      loading={props.loading}
      emptyText={props.emptyText}
      /*
        <b>선택도 드래그도 없다.</b> 행 하나는 그 자체로 편집 대상이고 아래를 정하지 않는다 —
        하단은 <b>고른 사용자</b>의 것이다(screen/user-auth/requirements.md — 둘은 마스터-디테일이 아니라 형제다).
        순서와 부모는 `MENU_TREE` 의 것이다(sys/menu.md).

        <b>저장도 없다</b> — 저장 단위는 예외 목록이다(클래스 주석).
      */
      onRead={props.onRead}
      disabled={props.disabled}
      collapsed={props.collapsed}
      collapsedAxis={props.collapsedAxis}
      onExpand={props.onExpand}
      controls={props.controls}
      search={props.search}
      titleSuffix={props.titleSuffix}
      highlighted={props.highlighted}
      focusedId={props.focusedId}
    />
  );
}

const idOf = (row: UserAuthTreeRow) => row.menuCd;
const parentOf = (row: UserAuthTreeRow) => row.upMenuCd;

/**
 * 액션 한 열의 폭 — <b>스위치 + 배지 둘</b>이 들어간다.
 *
 * <p>{@code SWITCH_WIDTH}(56) + 간격 + 상태 배지 + 역할 배지다. 스위치를 그리드와 같은 폭으로
 * 맞추면서 함께 늘렸다 — 안 늘리면 배지 둘이 붙는 칸에서 <b>태그가 다음 컬럼으로 넘어간다</b>.
 *
 * <p><b>여백이 판과 같아지며 16px 더 늘렸다</b>(2026-08-31 — {@code CELL_PADDING}). 셀의
 * 좌우 여백이 8+8 에서 <b>16+16</b> 이 됐고(판의 {@code cellHorizontalPadding}), 값이
 * 그대로였다면 늘어난 여백만큼 <b>배지가 잘렸다</b> — 이제는 넘치는 것을 감추므로
 * (판의 `.ag-cell` 과 같다) 삐져나오지 않고 <b>조용히 사라진다</b>.
 */
const ACTION_WIDTH = 168;

const ACTION_HEADER: Record<Action, string> = {
  READ: MSG.AUTHZ_ACTION_READ,
  SAVE: MSG.AUTHZ_ACTION_SAVE,
  EXPORT: MSG.AUTHZ_ACTION_EXPORT,
  EXECUTE: MSG.AUTHZ_ACTION_EXECUTE,
};

const STATE_LABEL: Record<GrantState, string> = {
  SCHEDULED: MSG.USER_AUTH_STATE_SCHEDULED,
  ACTIVE: MSG.USER_AUTH_STATE_ACTIVE,
  EXPIRED: MSG.USER_AUTH_STATE_EXPIRED,
};

/**
 * 리프의 한 칸 — <b>스위치 + 배지 둘</b>.
 *
 * <p>`—` 가 되는 경우가 둘이고 <b>뜻이 다르다</b>. 정의에 없는 액션은 *줄 것이 없다* 이고
 * (screen/user-auth/requirements.md), 거기에 부여가 남아 있으면 <b>고아</b>다 — API 가 사라진 조합이며 지우는 것은
 * 사람이 판단한다(seed.md). 둘을 같은 툴팁으로 두면 <i>왜 여기만 이러지</i> 를 물을 때
 * 화면이 답하지 못한다.
 */
function ActionCell({
  row,
  action,
  cell,
  canSave,
  onToggle,
}: {
  row: UserAuthTreeRow;
  action: Action;
  cell: CellState | undefined;
  canSave: boolean;
  onToggle: (menuCd: string, action: Action, next: boolean) => void;
}) {
  const roles = row.viaRoles[action];
  const badges = (
    <>
      {cell && cell.state !== 'ACTIVE' && (
        <Tag
          style={{
            marginInlineEnd: 0,
            textDecoration: cell.deleted ? 'line-through' : undefined,
          }}
        >
          {label(STATE_LABEL[cell.state])}
        </Tag>
      )}
      {roles && roles.length > 0 && (
        /*
          <b>역할명을 태그 글자로 쓰지 않는다.</b> 칸이 124px 이고 역할이 여럿일 수 있어
          이름을 그대로 두면 셀이 무너진다 — screen/user-auth/requirements.md 가 *"역할이 여럿이면 배지도 여럿"* 이라
          한 것은 <b>여럿임이 보여야 한다</b>는 뜻이고, 그것은 수로 말할 수 있다.
          이름은 툴팁이 온전히 말한다.
        */
        <Tooltip title={label(MSG.USER_AUTH_VIA_ROLE, { roles: roles.join(', ') })}>
          <Tag color="processing" style={{ marginInlineEnd: 0 }}>
            {label(MSG.USER_AUTH_VIA_ROLE_TAG, { count: roles.length })}
          </Tag>
        </Tooltip>
      )}
    </>
  );

  if (!row.definedActions.includes(action)) {
    /*
      <b>빈 스위치로 두면 안 된다</b>(screen/user-auth/requirements.md) — *"줄 수 있는데 안 준 것"* 으로 읽힌다.
      관리자가 켜서 저장했는데 사용자는 여전히 못 한다면 <b>화면이 거짓말을 한 것</b>이다.

      <b>고정이 아니다</b>(backend/api.md) — 그 화면에 그 액션으로 떨어지는 API 가 하나 생기면
      시드 재생성으로 스위치가 선다.
    */
    return (
      <Space size={4}>
        <Tooltip title={label(cell ? MSG.USER_AUTH_ORPHAN : MSG.ROLE_AUTH_UNDEFINED)}>
          <Typography.Text type={cell ? 'warning' : 'secondary'}>—</Typography.Text>
        </Tooltip>
        {badges}
      </Space>
    );
  }

  return (
    <Space size={4}>
      <Switch
        size="small"
        /*
          <b>그리드의 스위치 컬럼과 같은 폭</b>이다(frontend/grid.md · `SWITCH_WIDTH`). 같은 화면의
          위아래에 스위치가 있는데 크기가 다르면 <i>다른 것</i>으로 읽힌다 — 판의 기본
          `small`(28px)로는 켜짐·꺼짐의 손잡이 위치가 몇 px 차이라는 문제도 그대로다.
        */
        style={{ minWidth: SWITCH_WIDTH }}
        // <b>유효 하나만 켜짐</b>이다 — 예정·만료·삭제는 꺼진 채 배지가 말한다(screen/user-auth/requirements.md).
        checked={cell !== undefined && !cell.deleted && cell.state === 'ACTIVE'}
        /*
          <b>`SAVE` 가 없으면 스위치도 잠긴다</b>(screen/menu/requirements.md 과 같은 판단). 저장 버튼만 감추면
          <b>체크는 되는데 저장할 수 없는 상태</b>가 된다(frontend/tabs.md).
        */
        disabled={!canSave}
        onChange={(next) => onToggle(row.menuCd, action, next)}
      />
      {badges}
    </Space>
  );
}

/**
 * 폴더 한 칸 — <b>전체 · 부분 · 없음</b>(AUTHZ-03).
 *
 * <p>문구를 `roleAuth.tri.*` 에서 그대로 가져온다 — screen/user-auth/requirements.md 가 <i>"읽는 것은 마찰의 대상이
 * 아니므로 표시는 양쪽 공통"</i> 이라고 정했다. 같은 트리를 두 화면에서 다른 말로 부르면
 * 그것이 학습 비용이다.
 *
 * <p><b>세는 것은 *유효* 뿐이다.</b> 예정과 만료는 <i>지금 되는 것</i> 이 아니므로 요약에서
 * 켜진 것으로 세면 폴더가 거짓을 말한다 — 셀의 스위치가 꺼져 있는데 폴더는 *전체* 라고
 * 하는 일이 생긴다.
 *
 * <p><b>액션이 없는 자식(`—`)은 요약에서 뺀다</b> — *줄 수 없는 것* 을 *안 줬다* 로 세면
 * 폴더가 영영 *전체* 가 되지 않는다. 셀 수 있는 자식이 아예 없으면 아무것도 그리지 않는다.
 *
 * <p><b>일괄 토글을 두지 않는다</b>(screen/admin/system/user/requirements.md). 여기서는 backend/security.md 가 *"개인 예외를 폴더 단위로
 * 확장하면 제2의 역할 체계가 된다"* 며 막은 자리이고, <b>한 칸씩 체크해야 하는 마찰이 그
 * 방어의 본체</b>다.
 */
function FolderState({
  node,
  action,
  cells,
}: {
  node: TreeNode<UserAuthTreeRow>;
  action: Action;
  cells: ReadonlyMap<string, CellState>;
}) {
  const leaves = countableLeaves(node, action);
  if (leaves.length === 0) {
    return null;
  }
  const on = leaves.filter((menuCd) => {
    const cell = cells.get(cellKey(menuCd, action));
    return cell !== undefined && !cell.deleted && cell.state === 'ACTIVE';
  }).length;

  const key =
    on === 0
      ? MSG.ROLE_AUTH_TRI_NONE
      : on === leaves.length
        ? MSG.ROLE_AUTH_TRI_ALL
        : MSG.ROLE_AUTH_TRI_SOME;

  return (
    <Typography.Text type={on === 0 ? 'secondary' : undefined} style={{ fontSize: 12 }}>
      {label(key)}
    </Typography.Text>
  );
}

/** 이 폴더 아래에서 <b>그 액션을 줄 수 있는</b> 리프들 — 요약의 분모다. */
function countableLeaves(node: TreeNode<UserAuthTreeRow>, action: Action): string[] {
  const found: string[] = [];
  const walk = (current: TreeNode<UserAuthTreeRow>) => {
    for (const child of current.children) {
      if (child.data.menuUrl !== null && child.data.definedActions.includes(action)) {
        found.push(child.data.menuCd);
      }
      walk(child);
    }
  };
  walk(node);
  return found;
}
