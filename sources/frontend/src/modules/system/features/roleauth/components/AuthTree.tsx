// @feat FEAT-502
import { useMemo, type Ref } from 'react';
import { Switch, Tooltip, Typography, theme } from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { ACTIONS, type Action } from '@/shared/authz/permission';
import { menuIconOf } from '@/shared/authz/menuIcons';
import { SWITCH_WIDTH } from '@/shared/grid/columnDefs';
import { TreeGrid } from '@/shared/tree/TreeGrid';
import type {
  TreeColumn,
  TreeGridHandle,
  TreeNode,
  TreeSearch,
} from '@/shared/tree/types';
import type { SplitAxis } from '@/shared/grid/SplitPane';
import type { GridButtonControl } from '@/shared/grid/types';
import type { RoleAuthTreeRow } from '@/modules/system/features/roleauth/types';

/**
 * 권한 트리 — <b>정의는 screen/user/requirements.md 가 갖고 여기는 덜어 내기만 한다</b>(screen/admin/system/role-auth/requirements.md).
 *
 * <p>셀 상태가 <b>일곱에서 넷</b>으로 준다: 켜짐 · 꺼짐 · `—` · 구조 노드. `SYS_ROLE_MENU_AUTH`
 * 에 기간 컬럼이 없으므로(sys/menu.md) *예정*·*만료* 배지가 사라지고, <b>역할 자신이 원본</b>이라
 * *역할 경유 보유* 배지도 사라진다 — <b>배지가 통째로 없다.</b>
 *
 * <h2>`<AuthTree>` 가 `<TreeGrid>` 다</h2>
 *
 * screen/user/requirements.md 는 이것을 <i>AntD Table 의 트리 행</i> 으로 적었다. 그 문장이 쓰였을 때는 판이
 * AG Grid 냐 AntD 냐만 있었는데, 그 뒤 `MENU_TREE`(screen/admin/system/role-auth/requirements.md)가 <b>직접 그린 트리</b>를 어휘로
 * 들여왔다 — 계층 컬럼 · 접힘 · 검색 강조 · 크롬(53)이 이미 거기 있다. 판을 하나 더 들이면
 * <b>같은 화면 두 개가 다른 판으로 그려지고</b>, 53 의 크롬을 두 번 맞춰야 한다.
 *
 * <p>갈리는 것은 <b>저장 모델 하나</b>다 — 저기는 즉시, 여기는 일괄. 그것은 컴포넌트가 갖는
 * 것이 아니라 <b>화면이 선언하는 것</b>이고(frontend/grid.md) 그래서 `save` prop 하나로 표현된다.
 *
 * <h2>폴더는 <b>파생 3-state</b> 이며 누르는 것이 아니다</h2>
 *
 * 구조 노드는 권한을 갖지 않는다(sys/menu.md — `MENU_URL IS NULL` 이면 서버가 거부). 대신 <b>그
 * 아래를 얼마나 줬는지</b>를 액션 열마다 <b>따로</b> 요약한다 — 조회 열이 *전체* 라고 저장
 * 열이 그런 것은 아니다.
 *
 * <p><b>일괄 토글을 두지 않는다 — 어느 화면에도</b>(screen/admin/system/role-auth/requirements.md · screen/user/requirements.md). 3-state 를 그리면
 * *"누르면 자식 전부가 켜지는 것"* 이 자연스러워 보이지만 이유가 셋이다: ① 폴더 하나가 리프
 * 열댓 개이고 그것이 곧 <b>보유자 전원의 유효 권한 변경</b>이다 ② 껐다 켜면 <i>원래 켜져
 * 있던 것만</i> 복원해야 하는데 그 규칙을 정해야 한다 ③ 액션 미정의 건너뛰기와 `READ`
 * 불변식이 함께 도는데 <b>클릭 한 번에 세 규칙이 동시에</b> 돌면 결과를 예측할 수 없다.
 */

interface Props {
  title: string;
  menuCd: string;
  handleRef?: Ref<TreeGridHandle>;
  rows: RoleAuthTreeRow[];
  /** 지금 켜져 있는 것 — <b>저장 전 상태</b>다. 서버 값이 아니라 화면이 든 값이다. */
  granted: ReadonlyMap<string, ReadonlySet<Action>>;
  /** 스위치 하나. 불변식과 알림은 <b>화면이</b> 처리한다 — 여기는 사건만 올린다. */
  onToggle: (menuCd: string, action: Action, next: boolean) => void;
  canSave: boolean;
  dirty: boolean;
  /**
   * 미저장 변경이 있는 메뉴들 — 메뉴명 옆의 `✎` 다(2026-09-01 요청).
   *
   * <p>{@link dirty} 와 <b>다른 축</b>이다. 저것은 <i>저장 버튼이 살아 있나</i> 이고
   * 이것은 <b>어느 행이 그것을 만들었나</b> 다 — 24행짜리 트리에서 버튼만 켜지면
   * <i>무엇을 만졌는지</i> 를 스위치를 하나씩 훑어 찾아야 한다.
   *
   * <p>화면이 준다. 판정이 <b>저장 건수와 같은 훑기</b>에서 나와야 둘이 갈리지 않는다
   * ({@code countDiff}) — 트리가 스스로 세면 규칙이 둘이 된다.
   */
  dirtyMenus: ReadonlySet<string>;
  onSave: () => void;
  onRead: () => void;
  loading: boolean;
  emptyText?: string;
  /** 제목 뒤 — <b>누구의 트리인가</b>(frontend/grid.md). 역할을 고르기 전에는 빈 문자열이다. */
  titleSuffix?: string;
  /** ①의 검색 칸 — <b>브레드크럼이 아니라 여기다</b>(screen/admin/system/role-auth/requirements.md · {@link TreeSearch}). */
  search?: TreeSearch;
  /** ①을 통째로 잠근다 — <b>역할을 고르기 전</b>이다(frontend/grid.md 의 빈 상태). */
  disabled?: boolean;
  controls?: GridButtonControl[];
  /**
   * 접히면 <b>제목만</b> 남는다 — frontend/grid.md.
   *
   * <p><b>없어서 잘린 트리가 남았다</b>(2026-08-31 — `PersonalAuthTree` 와 같은 자리다).
   * 스플리터를 끝으로 밀면 pane 은 좁아지는데 트리는 그것을 몰라 머리·판·푸터를 그대로
   * 그린다 — 접힌 것이 <i>고장난 것</i> 처럼 읽힌다.
   */
  collapsed?: boolean;
  collapsedAxis?: SplitAxis;
  onExpand?: () => void;
  highlighted?: ReadonlySet<string>;
  focusedId?: string | null;
}

export function AuthTree(props: Props) {
  const { token } = theme.useToken();
  const { granted, onToggle, canSave } = props;

  const columns = useMemo<TreeColumn<RoleAuthTreeRow>[]>(
    () =>
      ACTIONS.map((action) => ({
        header: ACTION_HEADER[action],
        /*
          스위치 하나에 <b>배지가 없다</b> — 기간도 역할 경유도 이 화면에는 없으므로
          (screen/admin/system/role-auth/requirements.md) 개인 예외의 152px 이 필요 없다. 그리드의 스위치 폭(56) + 셀 여백이
          들어가는 값이다.
        */
        width: 92,
        /*
          <b>스위치는 셀이 곧 편집기다</b>(frontend/grid.md) — 더블 클릭이 열 것이 없어도 <b>잠긴
          칸이 아니므로</b> 선언한다(`TreeColumn.editable` · frontend/grid.md).

          잠기는 것이 둘이다: <b>구조 노드</b>(파생 3-state)와 <b>미정의 액션</b>(`—`).
          뒤엣것이 색으로 드러나는 것이 이 화면에서 값이 크다 — <i>줄 것이 없다</i> 를
          툴팁을 띄워 보기 전에 알 수 있다.
        */
        editable: (row) =>
          canSave && row.menuUrl !== null && row.definedActions.includes(action),
        cell: (row, node) =>
          row.menuUrl === null ? (
            <FolderState node={node} action={action} granted={granted} />
          ) : !row.definedActions.includes(action) ? (
            /*
              <b>`—` 는 *안 줬다* 가 아니라 *줄 것이 없다* 다</b>(screen/user/requirements.md). 빈 스위치로 두면
              *"줄 수 있는데 안 준 것"* 으로 읽히고, 관리자가 켜서 저장했는데 사용자는
              여전히 못 한다면 <b>화면이 거짓말을 한 것</b>이다.

              <b>고정이 아니다</b>(backend/api.md) — 그 화면에 그 액션으로 떨어지는 API 가 하나
              생기면 시드 재생성으로 스위치가 선다.
            */
            <Tooltip title={label(MSG.ROLE_AUTH_UNDEFINED)}>
              <Typography.Text type="secondary">—</Typography.Text>
            </Tooltip>
          ) : (
            <Switch
              size="small"
              /*
                <b>그리드의 스위치 컬럼과 같은 폭</b>이다(frontend/grid.md · `SWITCH_WIDTH`). 같은
                화면의 다른 판에 있는 스위치와 크기가 다르면 <i>다른 것</i>으로 읽히고,
                판의 기본 `small`(28px)로는 켜짐·꺼짐의 손잡이 위치가 몇 px 차이다.
              */
              style={{ minWidth: SWITCH_WIDTH }}
              checked={granted.get(row.menuCd)?.has(action) === true}
              /*
                <b>`SAVE` 가 없으면 스위치도 잠긴다</b>(screen/admin/system/role-auth/requirements.md 주석 4). 저장 버튼만 감추면
                <b>체크는 되는데 저장할 수 없는 상태</b>가 된다(frontend/tabs.md).
              */
              disabled={!canSave}
              onChange={(next) => onToggle(row.menuCd, action, next)}
            />
          ),
      })),
    [canSave, granted, onToggle],
  );

  return (
    <TreeGrid<RoleAuthTreeRow>
      handleRef={props.handleRef}
      title={props.title}
      menuCd={props.menuCd}
      rows={props.rows}
      idOf={idOf}
      parentOf={parentOf}
      hierarchyHeader={MSG.ROLE_AUTH_COL_MENU}
      /*
        <b>글자 크기를 적지 않는다.</b> 설정 창의 <i>그리드 글자 크기</i>를 트리가 행에 걸고
        셀이 물려받는다(frontend/tabs.md) — 여기서 한 번 더 적으면 설정이 이 화면만 비껴간다.
      */
      hierarchy={(row) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {/*
            꺼진 메뉴는 흐리다 — 부여는 남지만 게이트 ④에서 걸린다(backend/security.md).

            <b>흐린 것은 이름까지다</b> — `✎` 는 이 안에 두지 않는다(개인 예외 화면과 같다).
            꺼진 메뉴에도 부여는 줄 수 있고, 그것을 방금 만졌다는 사실은 <b>흐려질 이유가
            없다</b>: 저장 확인의 건수에는 그 행도 들어간다.
          */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              minWidth: 0,
              opacity: row.useYn ? 1 : 0.45,
            }}
          >
            {/* <b>사이더와 같은 아이콘</b>이다 — frontend/tabs.md · `menuIconOf`. 폴백까지 공유한다. */}
            <span style={{ display: 'inline-flex', color: token.colorTextSecondary }}>
              {menuIconOf(row.iconCd, row.menuUrl === null)}
            </span>
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
          {/*
            <b>미저장 표시</b> — screen/user/requirements.md 의 개인 예외 트리와 <b>같은 글자·같은 색</b>이다
            (2026-09-01 요청). 두 화면이 같은 일을 하는데 표시가 다르면 그것이 학습 비용이다.

            <b>목록이 아니라 트리가 낸다.</b> 이 화면에는 하단 예외 목록 같은 <i>바뀐 것의
            목록</i>이 없으므로(저장 단위가 트리다 — screen/admin/system/role-auth/requirements.md) 이 표시가 <b>무엇을 만졌나에
            답하는 유일한 자리</b>다.
          */}
          {props.dirtyMenus.has(row.menuCd) && (
            <Typography.Text type="warning">✎</Typography.Text>
          )}
        </span>
      )}
      /* 폭을 내용에서 내고 잘린 이름은 툴팁이 말한다 — screen/admin/system/role-auth/requirements.md. */
      hierarchyText={(row) => row.menuNm}
      columns={columns}
      loading={props.loading}
      emptyText={props.emptyText}
      /*
        <b>선택이 없다.</b> 여기서 행 하나는 그 자체로 편집 대상이고 <b>아래를 정하지
        않는다</b> — 하단은 역할의 것이다(screen/admin/system/role-auth/requirements.md). 선택 하이라이트만 남으면 <i>고르면
        무언가 일어날 것</i> 이라는 기대를 만든다.

        <b>드래그도 없다.</b> 순서와 부모는 `MENU_TREE` 의 것이며(sys/menu.md) 여기서 옮길 수 있게
        하면 <b>구조를 고치는 화면이 둘</b>이 된다.
      */
      onRead={props.onRead}
      save={{ dirty: props.dirty, onSave: props.onSave }}
      collapsed={props.collapsed}
      collapsedAxis={props.collapsedAxis}
      onExpand={props.onExpand}
      disabled={props.disabled}
      search={props.search}
      titleSuffix={props.titleSuffix}
      controls={props.controls}
      highlighted={props.highlighted}
      focusedId={props.focusedId}
    />
  );
}

const idOf = (row: RoleAuthTreeRow) => row.menuCd;
const parentOf = (row: RoleAuthTreeRow) => row.upMenuCd;

const ACTION_HEADER: Record<Action, string> = {
  READ: MSG.AUTHZ_ACTION_READ,
  SAVE: MSG.AUTHZ_ACTION_SAVE,
  EXPORT: MSG.AUTHZ_ACTION_EXPORT,
  EXECUTE: MSG.AUTHZ_ACTION_EXECUTE,
};

/**
 * 폴더 한 칸 — <b>전체 · 부분 · 없음</b>(AUTHZ-03).
 *
 * <p><b>액션이 없는 자식(`—`)은 요약에서 뺀다</b>(screen/admin/system/role-auth/requirements.md 목업 §3 주석 4) — <i>줄 수 없는
 * 것</i>을 <i>안 줬다</i> 로 세면 폴더가 영영 *전체* 가 되지 않는다. 셀 수 있는 자식이 아예
 * 없으면 <b>아무것도 그리지 않는다</b>: 그 자리에 *없음* 을 두면 <i>줄 수 있는데 안 줬다</i>
 * 로 읽힌다.
 *
 * <p><b>색만으로 말하지 않는다</b>(frontend/grid.md) — 글자를 그대로 낸다.
 *
 * <p><b>파생이라 저장 전 편집을 따라온다.</b> `SAVE` 를 켜서 `READ` 가 함께 켜지면 `READ`
 * 열의 요약이 바뀌며, 그것이 자연스러운 이유는 이 값이 <b>어디에도 저장되지 않기</b>
 * 때문이다(구조 노드에는 행이 생기지 않는다 — sys/menu.md).
 */
function FolderState({
  node,
  action,
  granted,
}: {
  node: TreeNode<RoleAuthTreeRow>;
  action: Action;
  granted: ReadonlyMap<string, ReadonlySet<Action>>;
}) {
  const leaves = countableLeaves(node, action);
  if (leaves.length === 0) {
    return null;
  }
  const on = leaves.filter((leaf) => granted.get(leaf)?.has(action) === true).length;
  const key =
    on === 0 ? MSG.ROLE_AUTH_TRI_NONE : on === leaves.length ? MSG.ROLE_AUTH_TRI_ALL : MSG.ROLE_AUTH_TRI_SOME;

  return (
    <Typography.Text type={on === 0 ? 'secondary' : undefined} style={{ fontSize: 12 }}>
      {label(key)}
    </Typography.Text>
  );
}

/** 이 폴더 아래에서 <b>그 액션을 줄 수 있는</b> 리프들 — 요약의 분모다. */
function countableLeaves(node: TreeNode<RoleAuthTreeRow>, action: Action): string[] {
  const found: string[] = [];
  const walk = (current: TreeNode<RoleAuthTreeRow>) => {
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
