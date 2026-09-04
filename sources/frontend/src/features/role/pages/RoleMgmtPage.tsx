import { useCallback, useMemo, useRef, useState } from 'react';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { auditColumns } from '@/shared/grid/auditColumns';
import { DataGrid } from '@/shared/grid/DataGrid';
import { SplitPane } from '@/shared/grid/SplitPane';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow } from '@/shared/grid/rows';
import type { ColumnDef, DeleteColumnSpec, GridIssue } from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { ROLE_ENDPOINTS } from '@/features/role/api/endpoints';
import { RoleHolderGrid } from '@/shared/authz/RoleHolderGrid';
import { blockedUsers, fetchAllHolders, useRoleHolders } from '@/shared/authz/roleHolder';
import type { RoleRow } from '@/features/role/types';

/**
 * `ROLE_MGMT` — screen/menu/requirements.md. <b>역할 자체의 생애를 다룬다.</b>
 *
 * <p>만들고 · 이름을 바꾸고 · 끄고 · 지운다. 권한을 붙이는 것은 `ROLE_AUTH_MGMT`(§2)이고
 * 역할을 사람에게 주는 것은 `USER_MGMT` 의 보유 역할 탭(screen/user/requirements.md)이다 — <b>셋이 각자 다른
 * 테이블을 쓴다.</b>
 *
 * <h2>기본정보 탭이 컬럼이 됐다</h2>
 *
 * sys/menu.md 이 탭 셋을 적었는데 <b>하나가 된다</b>(§3.4). 기본정보는 frontend/grid.md(편집 폼을 두지
 * 않는다)에 따라 <b>마스터 그리드의 셀</b>이 되고, <i>보유 사용자</i> 와 <i>비활성화 시 영향
 * 인원</i> 은 <b>같은 것</b>이라 하단 pane 하나가 된다 — 나누면 같은 조회를 두 번 하고 두
 * 탭이 항상 같은 내용을 보여준다.
 *
 * <h2>삭제 게이트가 처음 실물이 된다 — 자식 둘, 디테일 하나</h2>
 *
 * frontend/grid.md 는 *"디테일이 전부 도착한 뒤 판정"* 이라고만 적었다. <b>디테일이 자식 전부를
 * 보여주지 않는 화면</b>이 여기서 처음 나온다 — `SYS_USER_ROLE` 은 하단이 보여주지만
 * `SYS_ROLE_MENU_AUTH` 는 <b>이 화면에 디테일이 없다</b>. <b>마스터의 건수 컬럼이 그 자리를
 * 대신한다</b>(§3.2.1).
 *
 * <h2>스위치 하나가 확인 세 줄을 낸다</h2>
 *
 * `USE_YN` 을 끄면 보유자 전원의 유효 권한이 바뀐다(backend/security.md). screen/menu/requirements.md 가 권한을 고칠 때 낸
 * 경고를 <b>여기서는 스위치 하나가</b> 낸다 — 둘이 다른 문구를 내면 같은 사고를 두 번 배운다.
 */

const MENU_CD = 'ROLE_MGMT';

export function RoleMgmtPage() {
  const searchForm = useRef<SearchFormHandle>(null);
  /**
   * 하단의 빈 상태 문구 — frontend/grid.md 의 세 상태 중 <b>둘이 여기서 갈린다</b>.
   *
   * <p>*"역할을 선택하세요"* 와 *"저장 후 조회할 수 있습니다"* 는 같은 빈 판이지만 <b>다음에
   * 할 일이 다르다</b> — 하나로 합치면 미저장 신규 행을 고른 사람이 왜 아무것도 못 하는지
   * 알 수 없다.
   */
  const [detailEmpty, setDetailEmpty] = useState<string>(MSG.ROLE_DETAIL_EMPTY);

  /*
    <b>하단이 보는 역할을 상태로 들지 않는다.</b> 조회는 행을 고른 <b>그 핸들러 안에서</b>
    나가므로 그 순간의 값을 직접 넘기고(`useRoleHolders`), 그 뒤로 화면이 그 값을 다시 읽을
    일이 없다 — 하단은 자기가 받아 온 행만 그린다.

    <b>미저장 신규 행이면 아예 조회하지 않는다</b>(frontend/grid.md) — `SYS_USER_ROLE` 이 `SYS_ROLE`
    을 FK 로 참조하므로 <b>부모가 저장되기 전에는 자식이 있을 수 없다</b>.
  */

  const header = useSearchFormHeader();

  /*
    <b>URL 을 여기서 넘긴다</b>(screen/menu/requirements.md). 공용 훅이 경로를 들면 `features/role` 의
    `endpoints.ts` 에 그 줄이 없어지고, 그러면 `SYS_MENU_API` 시드가 <b>`ROLE_MGMT` 행을
    만들지 못해</b> 이 화면의 하단이 403 이 된다(backend/api.md).
  */
  const holders = useRoleHolders(MENU_CD, ROLE_ENDPOINTS.getAffectedUsers);

  // 매 렌더 새 함수를 넘기지 않는다 — 컨트롤러의 조회·저장 콜백이 전부 새것이 된다.
  const collectConditions = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );

  const columns = useMemo(() => buildColumns(), []);
  const searchFields = useMemo(() => buildSearchFields(), []);

  /**
   * <b>끄는 변경에만 둘째·셋째 줄이 붙는다</b>(screen/menu/requirements.md).
   *
   * <p>이름만 고친 저장은 한 줄이다(frontend/grid.md). <b>켜는 방향에는 경고가 없다</b> — 권한이
   * 늘어나는 것은 되돌릴 수 있고, 경고를 양쪽에 두면 읽지 않게 된다.
   *
   * <p><b>비동기다.</b> 셋째 줄이 세는 것(<i>유효 권한이 공집합이 되어 다음 로그인부터
   * 차단될 사람</i>)은 이 그리드가 들고 있지 않다 — 보유자 전원의 <b>다른 역할</b>과
   * <b>개인 예외</b>를 물어야 하고, 그 답이 하단 그리드의 열 둘이다(screen/menu/requirements.md 목업 §4 주석 6).
   * 하단은 <b>고른 역할 하나</b>만 보여주므로 여기서 <b>끄는 역할마다</b> 따로 묻는다.
   */
  const warnDisable = useCallback(async (rows: GridRow<RoleRow>[]): Promise<string[]> => {
    const disabled = rows.filter(
      (row) => row.state === 'U' && row.original?.useYn === true && row.data.useYn === false,
    );
    if (disabled.length === 0) {
      return [];
    }
    const lines: string[] = [];
    for (const row of disabled) {
      lines.push(
        label(MSG.ROLE_DISABLE_IMPACT, {
          name: row.data.roleNm,
          // 여기 오는 것은 <b>저장된 행</b>뿐이라(`state === 'U'`) 서버가 센 수가 들어 있다.
          users: row.data.holderCount ?? 0,
          auths: row.data.authCount ?? 0,
        }),
      );
      const sample = await fetchAllHolders(ROLE_ENDPOINTS.getAffectedUsers, row.data.roleId);
      const blocked = blockedUsers(sample.holders);
      /*
        <b>공집합 인원이 0 이면 그 줄을 내지 않는다</b>(screen/menu/requirements.md) — 항상 보이면 읽히지 않는다.

        <b>이름을 함께 낸다.</b> 건수만 알려주면 *"그 2명이 누구지"* 를 찾으러 다른 화면에
        가야 하고, 그러면 확인 문구가 스스로 완결되지 않는다(§4 주석 5).
      */
      if (blocked.length > 0) {
        lines.push(label(MSG.ROLE_DISABLE_BLOCKED, { count: blocked.length }));
        lines.push(blocked.map((user) => `  · ${user.userNm} (${user.userId})`).join('\n'));
      }
      // 한 장에 다 담기지 않았다 — <b>0명이라고 말하지 않는다</b>(screen/menu/requirements.md 미결).
      if (sample.truncated) {
        lines.push(
          label(MSG.ROLE_BLOCKED_PARTIAL, {
            counted: sample.holders.length,
            total: sample.total ?? sample.holders.length,
          }),
        );
      }
    }
    return lines;
  }, []);

  const api = useMemo(
    () => ({
      read: { url: ROLE_ENDPOINTS.getList, emptyNotice: true },
      save: {
        url: ROLE_ENDPOINTS.save,
        validate: { grid: validateRoleIds },
        warn: warnDisable,
      },
    }),
    [warnDisable],
  );

  const master = useGridController<RoleRow>({
    menuCd: MENU_CD,
    columns,
    api,
    params: collectConditions,
    /*
      <b>`defaults` 만 선언한다</b>(screen/menu/requirements.md · frontend/grid.md).

      `canAdd` 는 <b>막을 이유가 없어</b> 적지 않았다 — 건수 상한도, 선행 저장도, 상태
      의존도 없다. `onAdd` 도 없다: 편집 진입은 컴포넌트가 한다(frontend/grid.md).
      <b>옵션 넷을 다 쓰는 것이 기본이 아니다</b> — 필요 없는 화면이 적지 않는 것이
      *선언이 곧 허용* 이라는 뜻을 지킨다.
    */
    addRow: {
      defaults: () => ({
        roleId: '',
        roleNm: '',
        roleDesc: null,
        // 켜 두는 것이 정상이다 — 만든 직후에는 보유자도 권한도 없어 영향이 없다.
        useYn: true,
        /*
          건수 셋은 <b>`null` 이다</b>(screen/menu/requirements.md 주석 8) — 읽기 전용이고 <b>서버가 센다</b>.
          `0` 으로 채우면 *"세어 보니 0"* 과 구분되지 않는데, 그 구분이 곧 삭제 게이트가
          열리는 이유의 차이다: 신규 행은 <b>게이트를 타지 않고</b> 즉시 제거된다(frontend/grid.md).
        */
        holderCount: null,
        activeHolderCount: null,
        authCount: null,
      }),
    },
    toSavePayload: (rows) => ({
      rows: rows.map((row) => ({
        rowState: row.state,
        roleId: row.data.roleId,
        // 삭제는 대상만 가리킨다 — 나머지를 보내면 서버가 쓰지 않을 값을 검증하게 된다.
        ...(row.state === 'D'
          ? {}
          : {
              roleNm: row.data.roleNm,
              roleDesc: row.data.roleDesc,
              useYn: row.data.useYn,
            }),
      })),
    }),
  });

  /**
   * 역할 선택 — frontend/grid.md 의 상태 셋을 그대로 편다.
   *
   * <p><b>거부하지 않는다.</b> 하단이 읽기 전용이라 <b>잃을 미저장 편집이 없다</b> —
   * screen/code/requirements.md 처럼 묻지 않는 화면이며, 그래서 {@code void} 를 돌려준다(frontend/grid.md).
   */
  const selectRole = useCallback(
    (row: GridRow<RoleRow> | null): void => {
      if (!row) {
        holders.clear();
        setDetailEmpty(MSG.ROLE_DETAIL_EMPTY);
        return;
      }
      if (row.state === 'C') {
        // 부모 키가 아직 DB 에 없다 — 붙이려 하면 FK 위반이다(frontend/grid.md).
        holders.clear();
        setDetailEmpty(MSG.ROLE_DETAIL_LOCKED);
        return;
      }
      setDetailEmpty(MSG.ROLE_DETAIL_EMPTY);
      // 고른 값을 <b>직접 넘긴다</b> — 상태는 아직 이전 렌더의 것이다(`useRoleHolders`).
      void holders.readFor(row.data.roleId);
    },
    [holders],
  );

  /**
   * 마스터 조회는 <b>하단을 리셋한다</b> — frontend/grid.md.
   *
   * <p>조회는 목록을 통째로 바꾸므로 이전에 보던 행이 결과에 없을 수도 있다. 하단이 남아
   * 있으면 <b>다른 역할의 보유자를 이 역할 것으로</b> 보게 된다.
   */
  const readMaster = useCallback(async () => {
    holders.clear();
    setDetailEmpty(MSG.ROLE_DETAIL_EMPTY);
    await master.read();
  }, [holders, master]);

  /**
   * 지울 수 있는가 — <b>매 렌더 새 객체로 만들지 않는다</b>(frontend/grid.md).
   *
   * <p><b>게이트가 건수 컬럼 둘이다</b>(screen/menu/requirements.md). 마스터 응답이 그 수를 갖고 있으므로
   * <b>행마다</b> 답할 수 있고, 하단을 조회해야만 아는 것이 아니다.
   *
   * <p><b>막는 것은 보유 인원이지 유효 인원이 아니다.</b> 만료된 부여도 `SYS_USER_ROLE`
   * 행이며 <b>FK 는 날짜를 보지 않는다</b> — 유효 `0` 인데 막히는 것이 정상이다.
   *
   * <p><b>왜 막히는지 말하고 대안까지 말한다</b> — 회색 아이콘은 이유를 말하지 못하고,
   * 여기서 사람이 실제로 하려는 일은 대개 <b>끄는 것</b>이다(§3.6).
   */
  const deletable = useMemo<DeleteColumnSpec<RoleRow>>(
    () => ({
      /*
        <b>미저장 신규 행은 언제나 지울 수 있다</b>(frontend/grid.md · screen/menu/requirements.md) — 서버에 없으므로
        즉시 제거이며 FK 게이트를 타지 않는다. 건수가 `null` 인 것이 곧 그 사실이지만,
        판정은 <b>행 상태</b>로 한다: 값이 아니라 상태가 그것을 말하는 자리다.
      */
      enabled: (row) =>
        row.state === 'C' || (row.data.holderCount === 0 && row.data.authCount === 0),
      reason: (row) =>
        label(MSG.ROLE_DELETE_BLOCKED, {
          users: row.data.holderCount ?? 0,
          auths: row.data.authCount ?? 0,
        }),
    }),
    [],
  );

  return (
    <FillColumn>
      <SearchForm
        handleRef={searchForm}
        fields={searchFields}
        onSubmit={() => void readMaster()}
        // 조건과 컬럼 필터를 함께 지운다 — frontend/grid.md.
        onReset={master.clearFilters}
        onActiveCountChange={header.onActiveCountChange}
        collapsed={header.collapsed}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        {/*
          <b>축이 상하다</b>(frontend/grid.md 의 기본값 · screen/menu/requirements.md 목업 주석 6) — 마스터 컬럼이 일곱이라
          좌우로 나누면 가로가 모자란다. `ROLE_AUTH_MGMT` 가 좌우인 것은 <b>트리가 좁기</b>
          때문이며, <b>축은 데이터가 정하지 취향이 정하지 않는다.</b>
        */}
        <SplitPane
          storageKey="role"
          first={(collapsed, expand) => (
            <DataGrid<RoleRow>
              title={MSG.ROLE_GRID_TITLE}
              menuCd={MENU_CD}
              // 개인화의 키다 — 같으면 위아래 설정이 서로를 덮는다(frontend/grid.md).
              gridId="master"
              controller={master}
              deletable={deletable}
              onSelect={selectRole}
              collapsed={collapsed}
              onExpand={expand}
            />
          )}
          second={(collapsed, expand) => (
            <RoleHolderGrid
              title={MSG.ROLE_HOLDER_TITLE}
              menuCd={MENU_CD}
              controller={holders.controller}
              emptyText={detailEmpty}
              collapsed={collapsed}
              onExpand={expand}
            />
          )}
        />
      </div>
    </FillColumn>
  );
}

// ── 컬럼 (screen/menu/requirements.md) ────────────────────────────────────────────────

function buildColumns(): ColumnDef<RoleRow>[] {
  return [
    {
      field: 'roleId',
      header: MSG.ROLE_COL_ROLE_ID,
      type: 'text',
      width: 180,
      pinned: 'left',
      sortable: true,
      /*
        PK 다 — <b>신규 행에서만</b> 열리고, 필수이고, 헤더에 필수 표시가 붙는다(frontend/grid.md).
        등록 후 수정 불가이며(sys/user-role.md) 고치려면 지우고 다시 만드는데, <b>쓰인 역할은 지울 수
        없으므로</b>(§3.5) 실질적으로 한 번 정하면 끝이다.

        그래서 <b>헤더는 필수(*) 인데 저장된 행의 셀은 회색</b>이며 <b>어긋나는 것이
        정상</b>이다(frontend/grid.md) — 헤더는 컬럼 선언을, 셀 배경은 그 행의 실제 상태를 말한다.
      */
      pk: true,
    },
    {
      field: 'roleNm',
      header: MSG.ROLE_COL_ROLE_NM,
      type: 'text',
      width: 200,
      sortable: true,
      required: true,
      // <b>다국어가 아니다</b> — 관리 화면 전용 명칭이라 컬럼 값이다(sys/code.md).
      editable: true,
    },
    {
      field: 'roleDesc',
      header: MSG.ROLE_COL_ROLE_DESC,
      type: 'text',
      width: 240,
      fill: true,
      filter: false,
      editable: true,
      editor: 'largeText',
    },
    {
      field: 'useYn',
      header: MSG.ROLE_COL_USE_YN,
      type: 'ynFlag',
      width: 90,
      sortable: true,
      /*
        값이 둘인 데이터 칸은 전부 스위치다(frontend/grid.md). <b>끄면 보유자 전원이 바뀌므로</b>
        저장 확인이 세 줄이 된다(§3.6) — 스위치가 즉시 저장을 뜻하지는 않는다.
      */
      editable: true,
    },
    {
      field: 'holderCount',
      header: MSG.ROLE_COL_HOLDER,
      type: 'number',
      width: 100,
      // 파생이라 정렬 대상이 아니다(frontend/grid.md) — 서버 화이트리스트에도 없다.
      filter: false,
      /*
        <b>신규 행에서는 `—` 다</b>(screen/menu/requirements.md 주석 8). 읽기 전용이고 <b>서버가 센다</b> —
        `0` 으로 그리면 *"세어 보니 0"* 과 구분되지 않고, 그 구분이 곧 삭제 게이트가
        열리는 이유의 차이다(신규 행은 게이트를 타지 않는다).
      */
      // `null` 은 <b>아직 세지 않았다</b> 이며 `0` 과 다른 사실이다(screen/menu/requirements.md 주석 8).
      derive: (row) => row.holderCount ?? '—',
    },
    {
      field: 'activeHolderCount',
      header: MSG.ROLE_COL_ACTIVE_HOLDER,
      type: 'number',
      width: 100,
      filter: false,
      /*
        <b>보유와 유효를 하나로 접지 않는다</b>(screen/menu/requirements.md). 게이트가 보는 것은 <b>보유</b>이고
        운영자가 궁금한 것은 <b>유효</b>다 — 접으면 *"0명인데 왜 못 지우나"* 가 된다.
      */
      derive: (row) => row.activeHolderCount ?? '—',
    },
    {
      field: 'authCount',
      header: MSG.ROLE_COL_AUTH,
      type: 'number',
      width: 100,
      filter: false,
      // <b>디테일이 없는 자식</b>의 건수다 — 이 컬럼이 게이트의 다른 한쪽을 대신한다(§3.5).
      derive: (row) => row.authCount ?? '—',
    },
    // 감사 4컬럼은 켤 수 있다 — 이 행은 사람이 만들고 사람이 고치므로 감사가 실제로 갈린다.
    ...auditColumns<RoleRow>({ sortable: true }),
  ];
}

// ── 조회조건 (screen/menu/requirements.md) ────────────────────────────────────────────

/**
 * 둘뿐이다 — 역할명과 사용 여부.
 *
 * <p><b>사용 여부의 기본값을 `Y` 로 두지 않는다.</b> 끈 역할을 감추면 <b>같은 것을 또
 * 만드는</b> 사고가 나고, 그때 `ROLE_ID` 가 PK 라 저장이 실패한다(§3.9) — 운영자는
 * *"왜 저장이 안 되나"* 만 본다. 역할은 많아야 수십 건이라 전부 내려도 무겁지 않다.
 *
 * <p><b>역할 ID 조건이 없다.</b> 역할 ID 는 사람이 외워 다니는 값이 아니라 <b>이름으로
 * 찾는 것</b>이고, 목록이 수십 건이라 컬럼 필터로 충분하다(frontend/grid.md).
 */
function buildSearchFields(): SearchField[] {
  return [
    {
      field: 'roleNm',
      label: MSG.ROLE_SEARCH_ROLE_NM,
      type: 'text',
      op: 'contains',
      ops: ['eq', 'startsWith', 'contains', 'endsWith'],
    },
    {
      /*
        <b>`select` 이지 `ynFlag` 가 아니다</b>(frontend/search-form.md — 폼의 타입은 셋뿐이다). 값이 둘인
        칸을 폼에서는 <b>후보 둘짜리 콤보</b>로 낸다: 스위치로 두면 <i>끄기 = N</i> 이 되어
        <b>*전체* 를 표현할 자리가 없다</b>. 그리드 컬럼과 어휘가 갈리는 것이 아니라
        <b>묻는 것이 다르다</b> — 저기는 값이고 여기는 <i>무엇을 걸러 볼까</i> 다.

        <b>기본값이 없다(*전체*)</b>(screen/menu/requirements.md) — 끈 역할을 감추면 <b>같은 것을 또 만드는</b>
        사고가 나고, 그때 `ROLE_ID` 가 PK 라 저장이 실패한다(§3.9).
      */
      field: 'useYn',
      label: MSG.ROLE_SEARCH_USE_YN,
      type: 'select',
      // 서버가 `Boolean` 컬럼에 붙인다 — 열거값이라 부등호가 뜻을 갖지 않는다.
      ops: ['eq'],
      op: 'eq',
      options: [
        { value: 'Y', text: label(MSG.ROLE_USE_ON) },
        { value: 'N', text: label(MSG.ROLE_USE_OFF) },
      ],
    },
  ];
}

// ── 검증 (frontend/grid.md 의 3층) ─────────────────────────────────────────

/** 같은 그리드 안의 중복은 클라이언트가 판정할 수 있다. DB 에 이미 있는 값은 서버다. */
function validateRoleIds(rows: GridRow<RoleRow>[]): GridIssue[] {
  const issues: GridIssue[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const key = row.data.roleId?.trim() ?? '';
    if (key === '') continue;
    if (seen.has(key)) {
      issues.push({ rowId: row.id, field: 'roleId', message: label(MSG.ROLE_DUPLICATE) });
    }
    seen.add(key);
  }
  return issues;
}
