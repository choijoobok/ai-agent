// @feat FEAT-503
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { DataGrid } from '@/shared/grid/DataGrid';
import { DetailTabs } from '@/shared/grid/DetailTabs';
import { useGridController } from '@/shared/grid/useGridController';
import type { ColumnDef, SelectOption } from '@/shared/grid/types';
import { ACTIONS, type Action } from '@/shared/authz/permission';
import { GRANT_TONE, grantDisplay } from '@/shared/authz/grantState';
import { MENU_ENDPOINTS } from '@/modules/system/features/menu/api/endpoints';
import type {
  GrantState,
  MenuApiRow,
  MenuRoleRow,
  MenuTreeRow,
  MenuUserRow,
} from '@/modules/system/features/menu/types';
import { VIA_PERSONAL } from '@/modules/system/features/menu/types';

/**
 * 하단 — <b>탭 셋이 그대로 셋이다</b>(screen/admin/system/menu/requirements.md).
 *
 * <p>screen/admin/system/menu/requirements.md 에서는 탭 셋이 pane 하나가 됐다. <b>여기서는 셋이 서로 다른 것을 본다</b> —
 * 이 화면이 <i>무엇을 쓰는가</i>(탭 1) · <i>누가 닿는가</i>(탭 2) · <i>누가 줬는가</i>(탭 3).
 *
 * <p><b>셋 다 조회 전용이다.</b> 매핑은 시드로만 바뀌고(backend/api.md), 권한 편집은
 * {@code ROLE_AUTH_MGMT}와 개인 예외(screen/admin/system/user/requirements.md)의 일이다 — 여기서 고칠 수 있게 하면
 * <b>같은 사실을 고치는 화면이 둘</b>이 된다.
 *
 * <h2>판이 antd `Table` 이었다 — 2026-08-31 에 그리드가 됐다</h2>
 *
 * <p>탭 셋이 antd 의 표를 직접 쓰고 있었다. 그러면 이 화면의 하단만 <b>다른 세계</b>가
 * 된다: 컬럼 폭·표시 여부를 기억하지 않고(frontend/grid.md), 필터도 정렬도 엑셀도 없고, 머리 색과 행
 * 높이가 설정 창을 따르지 않는다(frontend/tabs.md). 무엇보다 <b>버튼 줄이 없어</b> 마스터-디테일의
 * 규약(frontend/grid.md)을 표현할 자리가 아예 없었다 — <i>고르기 전에는 잠긴다</i> 를 그릴 크롬이
 * 없다.
 *
 * <p>그래서 {@code <DataGrid>} 셋이 됐다. <b>서버는 그대로다</b>({@code PageResponse.all}) —
 * 판만 갈렸고 요청도 응답도 같은 봉투다(backend/api.md).
 *
 * <h2>탭을 열 때 부른다</h2>
 *
 * <p>셋을 한꺼번에 부르면 보지도 않을 계산 둘이 매번 딸려 오고, 그중 <i>사용 가능 사용자</i>
 * 는 두 경로의 합집합이라 가장 비싸다. screen/admin/system/user/requirements.md 이 탭 다섯에 대해 같은 판단을 내렸고 그
 * 근거가 여기서도 그대로다.
 *
 * <p><b>한 번 부른 탭은 메뉴가 바뀔 때까지 다시 부르지 않는다.</b> 탭을 오가는 것은 조회가
 * 아니라 <i>보는 각도를 바꾸는 것</i>이다. 여기에는 {@code USER_MGMT} 의 <i>저장하면 나머지를
 * 잊는다</i> 규칙이 없다 — <b>셋 다 조회 전용</b>이라 서로의 답을 바꿀 저장이 없다.
 *
 * <h2>선택은 <b>prop 으로</b> 온다 — 핸들이 아니다</h2>
 *
 * <p>{@code USER_MGMT} 는 {@code UserDetailTabsHandle.select} 를 마스터가 부른다(screen/admin/system/user/requirements.md).
 * 여기서는 갈린다.
 *
 * <table>
 *   <tr><td><b>물을 것이 없다</b></td><td>디테일 셋이 조회 전용이라 미저장 편집이 없다 —
 *       마스터가 선택을 <i>거부</i> 할 이유가 없고, 그 거부권이 핸들의 존재 이유였다</td></tr>
 *   <tr><td><b>부를 자리가 다섯</b></td><td>이 화면의 선택은 행 클릭 · 조회 · 노드 추가 ·
 *       넘겨받기 · 첫 진입에서 바뀐다. 사건마다 핸들을 부르게 두면 <b>한 곳을 빠뜨려도
 *       조용하다</b> — 고른 메뉴는 <b>매번 트리에서 다시 찾은 값</b>이므로 그것을
 *       그대로 내려받는 편이 원본이 하나다</td></tr>
 * </table>
 *
 * <p>그래서 <b>{@code menu} 가 바뀌면</b> 효과가 셋을 비우고 열린 탭을 부른다. 즉시 저장이
 * 셀마다 트리를 다시 읽지만 <b>선택은 유지되므로</b>(코드가 그대로다) 그때 하단은
 * 조용하다 — 아이콘 하나 바꿨다고 하단이 세 번 깜빡이지 않는다.
 */

type TabKey = 'api' | 'user' | 'role';

interface Props {
  /** 이 화면의 {@code MENU_CD} — 권한 판정과 개인 설정의 키다(frontend/grid.md). */
  menuCd: string;
  /**
   * 고른 메뉴 — <b>트리가 마스터다</b>(frontend/grid.md).
   *
   * <p>{@code null} 이면 <b>빈 상태</b>다: 조회 직후 · 아무도 안 고름 · 넘겨받은 코드가
   * 트리에 없음. 셋 다 <i>고른 것이 없다</i> 이며 화면이 하는 일이 같다.
   */
  menu: MenuTreeRow | null;
  /** 스플리터가 하단을 <b>접었다</b> — 탭바가 사라지고 제목 한 줄이 남는다(frontend/grid.md). */
  collapsed?: boolean;
  /** 제목 줄 클릭으로 되돌리는 길 — 스플리터가 준다. */
  onExpand?: () => void;
}

export function MenuDetailTabs(props: Props) {
  const { menuCd, menu, collapsed, onExpand } = props;
  const [tab, setTab] = useState<TabKey>('api');
  const selected = menu?.menuCd ?? null;

  /*
    조회 콜백이 읽는 값 — 행을 고른 <b>바로 그 순간</b>에 조회가 나가야 하므로 상태 갱신을
    기다릴 수 없다. 기다리면 첫 조회가 <i>이전 메뉴</i>의 것을 가져온다.
  */
  const current = useRef<string | null>(null);
  const activeTab = useRef<TabKey>('api');
  /** 이미 부른 탭 — 메뉴가 바뀔 때 비운다. */
  const loaded = useRef<Set<TabKey>>(new Set());

  /** 디테일 탭에는 조회조건 폼이 없다 — 대상이 없으면 <b>조회 자체를 하지 않는다</b>(frontend/grid.md). */
  const conditions = useCallback(
    () => Promise.resolve(current.current === null ? null : []),
    [],
  );
  /*
    부모 키는 <b>조건이 아니라 봉투의 {@code params}</b> 다(backend/api.md). 조건 목록에 두면
    화이트리스트를 지나며 <b>선택적</b>이 되어, 빠뜨린 요청이 전 메뉴의 자식을 한 판에 쏟는다.
  */
  const byMenu = useCallback(() => ({ menuCd: current.current }), []);

  // ── 탭 1 — 매핑 API (sys/menu.md) ────────────────────────────────────

  const apiColumns = useMemo(() => buildApiColumns(), []);
  const apiApi = useMemo(() => ({ read: { url: MENU_ENDPOINTS.getApiList } }), []);
  const apis = useGridController<MenuApiRow>({
    menuCd,
    columns: apiColumns,
    api: apiApi,
    params: conditions,
    searchParams: byMenu,
  });

  // ── 탭 2 — 사용 가능 사용자 (AUTHZ-13) ─────────────────────────

  const userColumns = useMemo(() => buildUserColumns(), []);
  const userApi = useMemo(() => ({ read: { url: MENU_ENDPOINTS.getAccessibleUsers } }), []);
  const users = useGridController<MenuUserRow>({
    menuCd,
    columns: userColumns,
    api: userApi,
    params: conditions,
    searchParams: byMenu,
  });

  // ── 탭 3 — 매핑된 역할 (screen/admin/system/menu/requirements.md) ─────────────────────────────────

  const roleColumns = useMemo(() => buildRoleColumns(), []);
  const roleApi = useMemo(() => ({ read: { url: MENU_ENDPOINTS.getRoleList } }), []);
  const roles = useGridController<MenuRoleRow>({
    menuCd,
    columns: roleColumns,
    api: roleApi,
    params: conditions,
    searchParams: byMenu,
  });

  const controllerOf = useCallback(
    (key: TabKey) => {
      switch (key) {
        case 'api':
          return apis;
        case 'user':
          return users;
        case 'role':
          return roles;
      }
    },
    [apis, users, roles],
  );

  const loadTab = useCallback(
    async (key: TabKey) => {
      if (current.current === null || loaded.current.has(key)) return;
      loaded.current.add(key);
      // 물을 것이 없으므로 <b>이미 물었다</b>고 알린다 — 편집이 없는 그리드다(frontend/grid.md).
      await controllerOf(key).read(true);
    },
    [controllerOf],
  );

  const clearAll = useCallback(() => {
    /*
      <b>셋을 다 비운다.</b> 남겨 두면 <i>다른 메뉴의 권한을 이 메뉴 것으로</i> 보게 되고
      (frontend/grid.md), 탭을 옮기는 순간 그 오해가 화면에 그대로 남는다.
    */
    apis.setRows([]);
    users.setRows([]);
    roles.setRows([]);
  }, [apis, users, roles]);

  /**
   * 지금 렌더의 조회 절차 — <b>아래 효과가 이것을 부른다</b>.
   *
   * <p>효과가 {@link loadTab}·{@link clearAll} 을 직접 의존할 수 없다. 그 둘은 컨트롤러를
   * 담고 있고 컨트롤러는 <b>행이 도착할 때마다 새 객체</b>라(그것이 조회의 정의다) 의존성에
   * 두면 <b>조회가 조회를 부른다</b>.
   *
   * <p>ref 가 그 순환을 끊는 자리다 — 담긴 것은 <b>가장 최근 렌더의 절차</b>이고, 그 안의
   * {@code setRows}·{@code read} 는 컨트롤러가 이미 안정적으로 들고 있다.
   */
  const procedure = useRef({ clearAll, loadTab });
  useEffect(() => {
    procedure.current = { clearAll, loadTab };
  }, [clearAll, loadTab]);

  /*
    <b>마스터의 선택이 바뀌었다</b> — frontend/grid.md 의 상태 셋을 여기서 편다. 위 효과보다
    <b>뒤에 선언한다</b>: 효과는 선언 순서로 도니 절차를 갱신한 다음에 부르게 된다.
  */
  useEffect(() => {
    /*
      <b>{@code current} 가 곧 *이미 맞춰 놓은 값* 이다.</b> 같으면 할 일이 없다 — 첫 진입의
      빈 상태(둘 다 {@code null})에서 셋을 비우는 헛일이 없고, 같은 행을 두 번 클릭하는 것도
      조회가 아니다.
    */
    if (current.current === selected) return;
    current.current = selected;
    loaded.current.clear();
    procedure.current.clearAll();
    void procedure.current.loadTab(activeTab.current);
  }, [selected]);

  const changeTab = useCallback(
    (key: string) => {
      const next = key as TabKey;
      activeTab.current = next;
      setTab(next);
      void loadTab(next);
    },
    [loadTab],
  );

  // ── 그리기 ─────────────────────────────────────────────────────

  /** 고르기 전에는 <b>①이 통째로 잠긴다</b> — frontend/grid.md · {@code <DataGrid disabled>}. */
  const idle = selected === null;
  /** 빈 판의 문구 — <b>같은 빈 판이지만 다음에 할 일이 다르다</b>(frontend/grid.md). */
  const emptyOf = (own: string) => (idle ? MSG.MENU_DETAIL_EMPTY : own);

  /**
   * 제목 뒤에 붙는 것 — <b>메뉴명과 코드</b>다(frontend/grid.md).
   *
   * <p>둘 다인 이유는 각자 부족하기 때문이다. 이름은 <b>메시지 키를 푼 값</b>이라 아직
   * 이름을 안 채운 메뉴에서는 키 문자열이고(screen/admin/system/menu/requirements.md 의 진단), 코드만으로는 <i>어느 화면인지</i>
   * 를 모른다.
   *
   * <p><b>완성된 글자를 준다</b> — 마스터가 트리라 부모 컨트롤러가 없다({@code DataGrid} 의
   * {@code titleSuffix} 주석).
   */
  const titleSuffix = menu === null ? '' : [menu.menuNm, menu.menuCd].join(' / ');

  return (
    <FillColumn>
      <DetailTabs
        activeKey={tab}
        onChange={changeTab}
        collapsed={collapsed}
        items={[
          {
            key: 'api',
            label: label(MSG.MENU_TAB_API),
            children: (
              <DataGrid<MenuApiRow>
                title={MSG.MENU_TAB_API}
                menuCd={menuCd}
                titleSuffix={titleSuffix}
                collapsed={collapsed}
                onExpand={onExpand}
                gridId="detailApi"
                controller={apis}
                /*
                  <b>0 건이면 진단을 낸다</b> — *"매핑된 API 가 없습니다. 이 화면의
                  기능을 아무도 쓸 수 없습니다."* sys/menu.md 의 미매핑이며, <b>고르기 전에는 그
                  말을 하지 않는다</b>: 안 물어본 것을 두고 없다고 하면 그것이 거짓말이다.
                */
                emptyText={emptyOf(MSG.MENU_TAB_API_EMPTY)}
                disabled={idle}
              />
            ),
          },
          {
            key: 'user',
            label: label(MSG.MENU_TAB_USER),
            children: (
              <DataGrid<MenuUserRow>
                title={MSG.MENU_TAB_USER}
                menuCd={menuCd}
                titleSuffix={titleSuffix}
                collapsed={collapsed}
                onExpand={onExpand}
                gridId="detailUser"
                controller={users}
                emptyText={emptyOf(MSG.GRID_EMPTY)}
                disabled={idle}
              />
            ),
          },
          {
            key: 'role',
            label: label(MSG.MENU_TAB_ROLE),
            children: (
              <DataGrid<MenuRoleRow>
                title={MSG.MENU_TAB_ROLE}
                menuCd={menuCd}
                titleSuffix={titleSuffix}
                collapsed={collapsed}
                onExpand={onExpand}
                gridId="detailRole"
                controller={roles}
                emptyText={emptyOf(MSG.GRID_EMPTY)}
                disabled={idle}
              />
            ),
          },
        ]}
      />
    </FillColumn>
  );
}

// ── 공용 어휘 ──────────────────────────────────────────────────────

/** 액션 넷의 라벨 — `authz.action.*` 를 그대로 쓴다(054). */
const ACTION_LABEL: Record<Action, string> = {
  READ: MSG.AUTHZ_ACTION_READ,
  SAVE: MSG.AUTHZ_ACTION_SAVE,
  EXPORT: MSG.AUTHZ_ACTION_EXPORT,
  EXECUTE: MSG.AUTHZ_ACTION_EXECUTE,
};

const ACTION_OPTIONS: SelectOption[] = ACTIONS.map((action) => ({
  value: action,
  text: label(ACTION_LABEL[action]),
}));

const GRANT_LABEL: Record<GrantState, string> = {
  SCHEDULED: MSG.MENU_GRANT_SCHEDULED,
  ACTIVE: MSG.MENU_GRANT_ACTIVE,
  EXPIRED: MSG.MENU_GRANT_EXPIRED,
};

/** 색과 방식은 <b>공통물이 갖는다</b> — 화면 넷이 같은 것을 본다(shared/authz/grantState.ts). */
const grantText = grantDisplay(GRANT_LABEL);

/**
 * 액션 <b>한 칸</b>씩 넷 — 권한은 (메뉴, 액션) 단위이며 <i>"쓸 수 있다"</i> 가 액션마다
 * 갈린다(screen/admin/system/menu/requirements.md).
 *
 * <p>가진 것만 늘어놓지 않고 <b>넷을 다 그린다</b> — 없는 것을 흐리게 두어야 <i>이 행에
 * 무엇이 없는가</i> 가 보인다. 있는 것만 나열하면 두 행을 세로로 비교할 수 없다.
 *
 * <p><b>컬럼 넷이지 태그 넷이 아니다</b>(2026-08-31). 한 칸에 태그 넷을 넣으면 그 컬럼은
 * <b>정렬도 필터도 되지 않고</b> 엑셀에는 배열이 그대로 나간다 — screen/admin/system/user/requirements.md 의 유효 권한
 * 탭이 같은 자리에서 이미 <b>컬럼 넷</b>을 골랐고, 그 판단이 여기서도 그대로다.
 *
 * <p>{@code —} 가 없는 것이 그쪽과 갈리는 자리다. 저기서는 <i>줄 것이 없다</i>(미정의
 * 액션)를 함께 그리는데, 여기서 그 사실을 아는 것은 <b>탭 1</b> 이고 그 탭은 열어야 온다 —
 * 열지도 않은 탭의 답을 이 컬럼이 알고 있으면 <b>탭을 나눈 이유</b>가 사라진다.
 */
function actionColumn<T extends { actions: Action[] }>(action: Action): ColumnDef<T> {
  return {
    field: `act.${action}`,
    header: ACTION_LABEL[action],
    type: 'text',
    width: 76,
    renderer: 'badge',
    tone: { ON: 'ok', OFF: 'muted' },
    derive: (row) => (row.actions.includes(action) ? 'ON' : 'OFF'),
    display: (value) => (value === 'ON' ? '●' : '·'),
  };
}

// ── 탭 1 — 매핑 API ───────────────────────────────────────────────

function buildApiColumns(): ColumnDef<MenuApiRow>[] {
  return [
    {
      field: 'apiUrl',
      header: MSG.API_CATALOG_COL_API_URL,
      type: 'text',
      width: 280,
      pinned: 'left',
      sortable: true,
    },
    { field: 'apiNm', header: MSG.API_CATALOG_COL_API_NM, type: 'text', width: 200, sortable: true },
    {
      field: 'actionCd',
      header: MSG.API_CATALOG_COL_ACTION_CD,
      // 코드값이 아니라 <b>라벨로 그린다</b>(sys/code.md · frontend/grid.md) — 값은 코드 그대로다.
      type: 'code',
      width: 100,
      sortable: true,
      options: ACTION_OPTIONS,
    },
    {
      field: 'apiDesc',
      header: MSG.API_CATALOG_COL_API_DESC,
      type: 'text',
      width: 240,
      fill: true,
      // 폭보다 긴 값이라 셀에서 잘린다 — 이미 손에 있는 값이므로 툴팁이다(frontend/grid.md).
      cellTooltip: true,
    },
  ];
}

// ── 탭 2 — 사용 가능 사용자 ───────────────────────────────────────

function buildUserColumns(): ColumnDef<MenuUserRow>[] {
  return [
    {
      field: 'userNm',
      header: MSG.PROFILE_USER_NM,
      type: 'text',
      width: 120,
      pinned: 'left',
      sortable: true,
    },
    { field: 'userId', header: MSG.PROFILE_USER_ID, type: 'text', width: 140, sortable: true },
    {
      /*
        <b>`USE_YN` 과 계정 유효기간만 본다</b> — 잠금·휴면은 일시적이라 여기서 세지 않는다
        (sys/user-role.md). 그래서 이 칸은 <i>지금 못 들어온다</i> 가 아니라 <b>계정이 살아 있나</b> 다.
      */
      field: 'accountUsable',
      header: MSG.MENU_COL_ACCOUNT,
      type: 'ynFlag',
      width: 100,
      sortable: true,
    },
    {
      /*
        <b>역할명 또는 개인 예외</b> — backend/security.md 의 메뉴→사용자 식이 두 갈래의 합집합이며, 이
        칸이 <i>어느 쪽을 회수해야 하나</i> 에 답한다.

        {@code display} 가 아니라 {@code derive} 인 이유는 screen/admin/system/user/requirements.md 의 같은 칸과 같다 —
        텍스트 칸에서는 {@code display} 가 걸리지 않아 `PERSONAL` 이 그대로 보인다. 정렬·
        필터·엑셀이 보아야 하는 것도 <i>개인 예외</i> 라는 글자이지 서버의 자리 표시자가
        아니며, 원본 코드가 필요한 칸은 {@code roleId} 다.
      */
      field: 'via',
      header: MSG.MENU_COL_VIA,
      type: 'text',
      width: 180,
      sortable: true,
      derive: (row) => (row.via === VIA_PERSONAL ? label(MSG.MENU_VIA_PERSONAL) : row.via),
    },
    actionColumn<MenuUserRow>('READ'),
    actionColumn<MenuUserRow>('SAVE'),
    actionColumn<MenuUserRow>('EXPORT'),
    actionColumn<MenuUserRow>('EXECUTE'),
    {
      field: 'grantState',
      header: MSG.MENU_COL_GRANT_STATE,
      type: 'text',
      width: 90,
      renderer: 'badge',
      tone: GRANT_TONE,
      display: grantText,
    },
    /*
      기간이 <b>두 칸</b>이다 — 한 칸에 `~` 로 이으면 그 컬럼의 정렬이 문자열 정렬이 되고
      <i>제한 없음</i> 이 어디로 가는지 말할 수 없다(frontend/grid.md). `null` 은 <b>제한 없음</b>이며
      양끝을 포함한다(sys/INDEX.md).
    */
    {
      field: 'validFromDt',
      header: MSG.USER_AUTH_COL_FROM,
      type: 'date',
      width: 130,
      sortable: true,
    },
    { field: 'validToDt', header: MSG.USER_AUTH_COL_TO, type: 'date', width: 130, sortable: true },
    /*
      <b>기본은 감춘다</b>(frontend/grid.md). 경유가 역할일 때만 값이 있고 화면에서 읽는 것은
      {@code via} 의 <i>이름</i> 이다 — 코드가 필요한 사람은 설정 창에서 켠다.
    */
    { field: 'roleId', header: MSG.MENU_COL_ROLE_ID, type: 'text', width: 160, visible: false },
  ];
}

// ── 탭 3 — 매핑된 역할 ────────────────────────────────────────────

function buildRoleColumns(): ColumnDef<MenuRoleRow>[] {
  return [
    {
      field: 'roleNm',
      header: MSG.MENU_COL_ROLE_NM,
      type: 'text',
      width: 200,
      pinned: 'left',
      sortable: true,
    },
    { field: 'roleId', header: MSG.MENU_COL_ROLE_ID, type: 'text', width: 160, sortable: true },
    {
      /*
        <b>`USE_YN='N'` 인 역할도 나온다</b> — 권한 행은 살아 있고 FK 도 살아 있다.
        삭제 게이트가 막는 것은 <b>행의 존재</b>이지 역할의 상태가 아니다.
      */
      field: 'useYn',
      header: MSG.MENU_COL_USE_YN,
      type: 'ynFlag',
      width: 90,
      sortable: true,
    },
    actionColumn<MenuRoleRow>('READ'),
    actionColumn<MenuRoleRow>('SAVE'),
    actionColumn<MenuRoleRow>('EXPORT'),
    actionColumn<MenuRoleRow>('EXECUTE'),
  ];
}
