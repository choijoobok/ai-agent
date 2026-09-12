import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App } from 'antd';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { ACTIONS, hasPermission, type Action } from '@/shared/authz/permission';
import { useAuthStore } from '@/shared/stores/authStore';
import { DataGrid } from '@/shared/grid/DataGrid';
import { SplitPane } from '@/shared/grid/SplitPane';
import { useConfirmDiscard } from '@/shared/grid/useConfirmDiscard';
import { useGridController } from '@/shared/grid/useGridController';
import { addRow as addGridRow, toRows, type GridRow } from '@/shared/grid/rows';
import type {
  ColumnDef,
  GridButtonControl,
  TitleSuffixSpec,
} from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import type { TreeGridHandle } from '@/shared/tree/types';
// @feat FEAT-502
import { USER_AUTH_ENDPOINTS } from '@/modules/system/features/userauth/api/endpoints';
import { getUserAuthTree } from '@/modules/system/features/userauth/api/userAuthApi';
import { accountStatText } from '@/shared/user/accountStat';
import { PersonalAuthTree, type CellState } from '@/modules/system/features/userauth/components/PersonalAuthTree';
import {
  cellKey,
  type GrantRow,
  type GrantState,
  type UserAuthTreeRow,
  type UserPickRow,
} from '@/modules/system/features/userauth/types';

/**
 * `USER_AUTH_MGMT` — screen/admin/system/user-auth/requirements.md. <b>화면이 셋으로 나뉜다.</b>
 *
 * <p>좌(사용자 목록) · 우(권한 트리) · 하(예외 목록). 스플리터가 둘이며 `ROLE_AUTH_MGMT`
 * (screen/menu/requirements.md)와 같은 배치다 — 사용자 목록은 컬럼이 셋이라 위아래로 두면 가로가 대부분 빈다.
 *
 * <h2>목록이 원본이고 트리는 그 투영이다</h2>
 *
 * screen/admin/system/user-auth/requirements.md 가 둘을 *"같은 데이터의 두 표시"* 라 했지만 **대칭이 아니다.** 기간과 사유가
 * 들어가는 곳이 목록뿐이므로 **데이터는 목록에 있고, 트리는 그것을 읽어 그린다.**
 *
 * <p>이 화면의 모든 상태가 그 한 문장에서 나온다 — 스위치의 켜짐도, 폴더의 3-state 도,
 * `✎` 도 전부 **하단 그리드의 행**에서 계산된다. 트리가 자기 상태를 따로 들면 *"지웠는데
 * 위에는 그대로다"* 가 된다.
 *
 * <h2>서버 응답도 하나다</h2>
 *
 * `getMenuTree` 하나가 트리와 목록을 함께 먹인다. 표시가 둘이라고 원본이 둘이 되면 **같은
 * 질문에 답이 둘**이 되고, 그 둘이 갈리는 순간 *"트리에는 있는데 목록에 없다"* 가 된다.
 *
 * <h2>저장 단위는 하단이다</h2>
 *
 * 행 상태(`＋` · `✎` · `✕`)가 거기 있으므로 저장 버튼도 거기 있다(frontend/grid.md). 트리의 ①은
 * **조회와 접기·펼치기**뿐이며, 트리가 말하는 미저장은 메뉴명 옆의 `✎` 하나다(screen/admin/system/user-auth/requirements.md).
 *
 * <h2>회수는 삭제가 아니다</h2>
 *
 * 스위치를 끄면 **종료일이 어제가 된다**(screen/admin/system/user-auth/requirements.md) — 행은 남고 배지가 *만료* 로 바뀐다.
 * 지우는 것은 목록의 `✕` 이며 그것은 **잘못 등록한 행 정리**다. 둘을 같은 제스처로 두면
 * *누구에게 왜 무엇을 언제까지 줬는가* 가 사라진다(sys/logs.md).
 */

const MENU_CD = 'USER_AUTH_MGMT';

/**
 * *역할 신설을 검토하세요* 를 낼 건수 — screen/admin/system/user-auth/requirements.md.
 *
 * <p><b>막지 않고 묻기만 한다.</b> 진짜로 10개가 필요한 예외가 실재하며, 막으면 사용자는
 * **저장을 두 번 나눠** 규칙을 피한다.
 *
 * <p>값은 screen/admin/system/user-auth/requirements.md 이 *실측* 으로 남긴 미결이다. 상수로 두는 것은 <b>`SYS_CONFIG` 로 빼려면
 * 그 값을 무엇으로 정할지 먼저 알아야 하기</b> 때문이며, 지금은 아무도 그 답을 갖고 있지
 * 않다 — 운영에서 이 배너가 얼마나 자주 뜨는지가 그 답이 된다.
 */
const ROLE_SUGGESTION_THRESHOLD = 10;

export function UserAuthMgmtPage() {
  const { modal, message } = App.useApp();
  const permissions = useAuthStore((state) => state.permissions);
  const canSave = hasPermission(permissions, MENU_CD, 'SAVE');

  const searchForm = useRef<SearchFormHandle>(null);
  const tree = useRef<TreeGridHandle>(null);
  const [user, setUser] = useState<UserPickRow | null>(null);
  const [treeRows, setTreeRows] = useState<UserAuthTreeRow[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  /*
    <b>저장이 보는 사용자를 상태에서 읽지 않는다.</b> 저장 페이로드를 만드는 것은
    컨트롤러가 부르는 콜백이고, 그 콜백이 만들어진 시점의 상태를 붙잡고 있으면
    <b>A 사용자의 예외가 B 사용자에게 나간다</b> — screen/code/requirements.md 가 하단 저장에서 같은 자리를
    ref 로 닫았다.
  */
  const selectedUserId = useRef<string | null>(null);

  const header = useSearchFormHeader();
  const [term, setTerm] = useState('');

  const today = useMemo(() => isoToday(), []);

  // ── 좌 — 사용자 목록 (screen/admin/system/user-auth/requirements.md) ──────────────────────────────────

  const collectConditions = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );
  const userColumns = useMemo(() => buildUserColumns(), []);
  const userApi = useMemo(
    () => ({ read: { url: USER_AUTH_ENDPOINTS.getList, emptyNotice: true } }),
    [],
  );

  const users = useGridController<UserPickRow>({
    menuCd: MENU_CD,
    columns: userColumns,
    api: userApi,
    params: collectConditions,
    /*
      <b>읽기 전용이다</b>(screen/admin/system/user-auth/requirements.md) — 계정 생성은 `USER_MGMT` 의 일이므로 행 추가 버튼도
      삭제 컬럼도 없다. `addRow` 를 선언하지 않는 것이 그 집행이다.
    */
    editable: false,
  });

  /**
   * 우와 하의 제목 뒤에 붙는 것 — <b>이름과 ID</b>(frontend/grid.md 의 `titleSuffix`).
   *
   * <p>둘 다인 이유는 각자 부족하기 때문이다. ID 만으로는 <b>누구인지</b> 를 모르고
   * (`u10293`), 이름만으로는 <b>동명이인</b>이 갈리지 않는다 — `USER_MGMT` 의 탭 다섯이
   * 같은 둘을 붙이는 것과 같은 판단이다(screen/admin/system/user-auth/requirements.md).
   *
   * <p><b>여기서는 그것이 안전 장치다.</b> 좌 pane 이 스크롤되거나 조회조건을 펼치면 고른
   * 행이 화면에서 벗어나는데, 그 상태로 트리의 스위치를 켜는 것은 <b>누군지 모르는 사람에게
   * 권한을 주는</b> 일이다.
   *
   * <p><b>모양이 둘로 갈리는 것은 컴포넌트의 차이</b>다. 하단은 컨트롤러를 넘길 수 있어
   * 판정을 {@code DataGrid} 에 두고(부모 그리드가 있다), 트리는 <b>완성된 글자</b>를 받는다 —
   * 이 둘이 <b>같은 선택 하나</b>에서 나오므로 갈릴 수 없다({@code setRows} 가 선택을 함께
   * 버린다).
   */
  /**
   * <b>빈 상태</b> — frontend/grid.md. 우(트리)와 하(예외 목록)가 함께 잠긴다.
   *
   * <p>디테일은 마스터의 선택에 종속되므로 고른 사용자가 없으면 <b>조회할 대상도 저장할
   * 것도 없다</b>. 트리의 조회 버튼이 그 실물이었다 — 눌러도 조용했고(대상이 없어
   * 함수가 곧 돌아온다) 사용자가 보는 것은 <b>아무 일도 일어나지 않는 클릭</b>이다.
   *
   * <p><b>리셋은 이미 있었다</b> — 마스터 조회와 선택 해제가 트리와 목록을 비운다
   * ({@code readUsers} · {@code selectUser}). 없던 것은 <b>버튼을 잠그는 쪽</b> 하나다.
   */
  const idle = user === null;

  const userSuffix = useMemo(() => {
    if (user === null) return '';
    // 빈 칸은 조용히 빠진다 — `/` 만 남으면 그것이 값처럼 보인다({@code titleSuffixOf} 와 같다).
    return [user.userNm, user.userId].filter((value) => value !== '').join(' / ');
  }, [user]);
  const grantTitleSuffix = useMemo<TitleSuffixSpec>(
    () => ({ parent: users, fields: ['userNm', 'userId'] }),
    [users],
  );

  // ── 하 — 예외 목록 (screen/admin/system/user-auth/requirements.md — 저장 단위다) ──────────────────────

  const grantColumns = useMemo(() => buildGrantColumns(today), [today]);

  /**
   * 저장 확인 <b>앞</b>에 서는 배너 — screen/admin/system/user-auth/requirements.md 의 <i>마찰을 남겨 두고 묻는다</i>.
   *
   * <p><b>새로 준 것만 센다.</b> 기간을 고치거나 회수하는 것은 예외를 <i>늘리는</i> 일이
   * 아니므로 여기 세면 <b>정리하는 저장에서 신설을 권하게</b> 된다.
   */
  const warnThreshold = useCallback((rows: GridRow<GrantRow>[]): string[] => {
    const added = rows.filter((row) => row.state === 'C').length;
    return added >= ROLE_SUGGESTION_THRESHOLD
      ? [label(MSG.USER_AUTH_THRESHOLD, { count: added })]
      : [];
  }, []);

  const readTree = useCallback(async (userId: string) => {
    setTreeLoading(true);
    try {
      const page = await getUserAuthTree(userId);
      setTreeRows(page.content);
      return page.content;
    } finally {
      setTreeLoading(false);
    }
  }, []);

  /**
   * 저장이 끝난 뒤 트리를 다시 읽는 자리 — <b>ref 로 미룬다</b>.
   *
   * <p>{@code onSuccess} 는 {@code grantApi} 안에 있고 {@code grantApi} 는 {@code grants} 를
   * 만드는 입력인데, 다시 읽는 일은 <b>{@code grants.setRows} 를 부른다</b> — 그대로 쓰면
   * 순환이다. 참조 하나를 두고 <b>만들어진 뒤에 채운다</b>.
   */
  const afterSave = useRef<() => void>(() => undefined);

  const grantApi = useMemo(
    () => ({
      /*
        <b>{@code read} 가 없다</b> — 이 그리드를 먹이는 것은 트리 조회 하나다(screen/admin/system/user-auth/requirements.md).
        {@code reloadAfter} 도 끈다: 다시 읽을 자기 경로가 없고, 저장 뒤에 트리를 다시
        읽으면 <b>목록도 함께</b> 채워진다.
      */
      save: {
        url: USER_AUTH_ENDPOINTS.save,
        warn: warnThreshold,
        reloadAfter: false,
        onSuccess: () => afterSave.current(),
      },
    }),
    [warnThreshold],
  );

  const grants = useGridController<GrantRow>({
    menuCd: MENU_CD,
    columns: grantColumns,
    api: grantApi,
    /*
      <b>행 추가 버튼이 없다</b>(screen/admin/system/user-auth/requirements.md). 부여는 <b>트리에서 켜는 것</b>이며, 목록에 빈
      행을 만들 수 있게 하면 <i>메뉴 코드를 손으로 적는</i> 경로가 열린다 — screen/admin/system/user-auth/requirements.md 가
      *"목록만 두면 메뉴를 코드로 찾아야 한다"* 며 트리를 둔 이유가 그것이다.
    */
    toSaveRow: (row) => ({
      rowState: row.state,
      menuCd: row.data.menuCd,
      actionCd: row.data.actionCd,
      // 삭제는 대상만 가리킨다 — 나머지를 보내면 서버가 쓰지 않을 값을 검증하게 된다.
      ...(row.state === 'D'
        ? {}
        : {
            validFromDt: row.data.validFromDt,
            validToDt: row.data.validToDt,
            grantRsn: row.data.grantRsn,
          }),
    }),
    saveEnvelope: (rows) => ({ userId: selectedUserId.current, rows }),
  });

  /*
    저장이 끝나면 <b>트리를 다시 읽어</b> 목록까지 갈아 끼운다. `onSuccess` 를 `grantApi`
    안에 두지 않는 것은 그 콜백이 `grants` 를 봐야 하는데 `grants` 가 `grantApi` 를
    받아서 만들어지기 때문이다 — 순환이라 한쪽을 밖으로 뺀다.
  */
  const setGrantRows = grants.setRows;
  const refill = useCallback(
    (rows: UserAuthTreeRow[]) => setGrantRows(toRows(flatten(rows))),
    [setGrantRows],
  );

  const loadFor = useCallback(
    async (userId: string) => {
      selectedUserId.current = userId;
      refill(await readTree(userId));
    },
    [readTree, refill],
  );

  // ── 트리가 읽는 값 — 전부 하단 그리드에서 계산한다 ──────────────

  /** `${menuCd}|${actionCd}` → 그 칸의 상태. <b>트리는 이것만 본다</b>(screen/admin/system/user-auth/requirements.md). */
  const cells = useMemo<ReadonlyMap<string, CellState>>(() => {
    const map = new Map<string, CellState>();
    for (const row of grants.rows) {
      map.set(cellKey(row.data.menuCd, row.data.actionCd), {
        state: stateOf(row.data, today),
        deleted: row.state === 'D',
      });
    }
    return map;
  }, [grants.rows, today]);

  /** 메뉴명 옆의 `✎` — <b>무엇이 바뀌었나는 목록이 말한다</b>(screen/admin/system/user-auth/requirements.md). */
  const dirtyMenus = useMemo(() => {
    const menus = new Set<string>();
    grants.rows.filter((row) => row.state !== null).forEach((row) => menus.add(row.data.menuCd));
    return menus;
  }, [grants.rows]);

  const pathOf = useMemo(() => menuPaths(treeRows), [treeRows]);

  // ── 스위치 하나 (screen/admin/system/user-auth/requirements.md) ───────────────────────────────────────

  /**
   * 트리의 스위치는 <b>목록에 행을 만들라는 지시</b>다 — screen/admin/system/user-auth/requirements.md.
   *
   * <table>
   *   <tr><td>부여 없음 → 켬</td><td>목록에 <b>추가(`＋`) 행</b>이 생긴다. 시작일은 오늘, 종료일과 사유는 빈칸</td></tr>
   *   <tr><td>만료 → 켬</td><td><b>이전 값을 보여주고</b> 대체를 확인한 뒤 그 행을 되살린다</td></tr>
   *   <tr><td>예정 → 켬</td><td><b>값을 건드리지 않는다</b> — 사람이 정해 둔 기간이 이미 들어 있다</td></tr>
   *   <tr><td>삭제 표시 → 켬</td><td>삭제를 <b>되돌린다</b></td></tr>
   *   <tr><td>유효 → 끔</td><td><b>회수</b> — 종료일을 어제로. 행은 남는다</td></tr>
   * <tr><td>미저장 신규 → 끔</td><td><b>즉시 제거</b> — 서버에 없는 행이다(frontend/grid.md)</td></tr>
   * </table>
   *
   * <p><b>어느 길로 켜든 `READ` 불변식이 함께 돈다</b>(screen/admin/system/user-auth/requirements.md · 2026-09-01) — 위에서
   * <i>실제로 켜지는</i> 길 셋이 그렇다(예정은 스위치가 켜지지 않으므로 아무것도 딸려오지
   * 않는다). 역할 화면(screen/menu/requirements.md)과 <b>같은 규칙</b>이며, 다른 것은 여기서는 부여마다
   * <b>행</b>이라 그 연쇄가 <b>행 하나를 더 만드는 일</b>이라는 점뿐이다.
   */
  const toggle = useCallback(
    (menuCd: string, action: Action, next: boolean) => {
      const treeRow = treeRows.find((row) => row.menuCd === menuCd);
      if (!treeRow) return;
      const target = grants.rows.find(
        (row) => row.data.menuCd === menuCd && row.data.actionCd === action,
      );

      if (!next) {
        if (!target) return;
        revoke(target);
        /*
          <b>불변식은 줄이는 쪽으로 연쇄한다</b>(screen/admin/system/user-auth/requirements.md). `READ` 를 회수하면 그 메뉴의
          나머지도 함께 회수된다 — 도달할 수 없는 권한을 남기면 <b>인가 데이터가 거짓말을
          한다</b>. 다만 <b>역할이 조회를 주고 있으면 연쇄하지 않는다</b>: 그 사람은 여전히
          화면에 들어갈 수 있어 나머지가 도달 가능하다.
        */
        if (action === 'READ' && !hasRoleRead(treeRow)) {
          const others = grants.rows.filter(
            (row) =>
              row.data.menuCd === menuCd
              && row.data.actionCd !== 'READ'
              && row.data.defined
              && row.state !== 'D'
              && stateOf(row.data, today) === 'ACTIVE',
          );
          others.forEach(revoke);
          if (others.length > 0) {
            message.info(label(MSG.USER_AUTH_READ_OFF, { count: others.length }));
          }
        }
        return;
      }

      /*
        ── 켠다 — <b>갱신을 한 번에 모은다</b>(2026-09-01 실물) ────────────────────

        {@code grant()} 를 두 번 불렀다. 누른 액션과 함께 켜지는 `READ` 다. 둘이 <b>같은
        스냅샷</b>({@code grants.rows})에서 다음 배열을 만들어 각자 {@code setRows} 를
        부르므로 <b>뒤엣것이 앞엣것을 덮었다</b> — 조회만 켜지고 <b>정작 누른 스위치는 꺼진
        채로</b> 남았다.

        역할 화면에는 없던 사고다: 그쪽은 한 메뉴의 부여가 {@code Set} 하나라 둘을 더해도
        갱신이 <b>한 번</b>이고, 이 화면은 부여마다 <b>행</b>이라 둘을 더하는 것이 갱신 둘이
        된다(screen/admin/system/user-auth/requirements.md 의 <i>목록이 원본</i>).

        그래서 <b>새로 만들 행을 먼저 모으고 한 번만</b> 넣는다. 순서가 규칙이다 —
        <b>통째로 넣는 갱신({@code setRows})이 먼저, 이어 붙는 갱신({@code edit} ·
        {@code toggleDelete})이 나중</b>: 뒤엣것은 갱신 함수라 앞의 결과 위에 얹히지만,
        거꾸로 두면 통째로 넣는 쪽이 <b>앞의 것을 지운다</b>.
      */
      const readRow =
        action === 'READ'
          ? undefined
          : grants.rows.find(
              (row) => row.data.menuCd === menuCd && row.data.actionCd === 'READ',
            );
      const readOn =
        readRow !== undefined
        && readRow.state !== 'D'
        && stateOf(readRow.data, today) === 'ACTIVE';
      /**
       * `READ` 를 함께 켜야 하는가 — screen/admin/system/user-auth/requirements.md 의 불변식이다.
       *
       * <p><b>어느 길로 켜든 함께 돈다</b>(2026-09-01). 전에는 <i>새 행을 만드는 길</i>
       * 하나에만 걸려 있어서, 삭제 표시를 되돌리거나 만료를 되살려 켜면 <b>조회 없는 저장</b>
       * 이 조용히 남았다 — 그 부여는 도달할 수 없고, 인가 데이터가 거짓말을 하게 된다.
       */
      const chain = action !== 'READ' && treeRow.definedActions.includes('READ') && !readOn;
      /*
        <b>역할이 조회를 주고 있으면 켜지 않는다</b>: 합집합이므로 그것으로 충분하고, 굳이
        개인 예외를 하나 더 만들면 <b>회수할 것이 둘</b>이 된다. 대신 말해 준다.
      */
      const viaRole = chain && hasRoleRead(treeRow);

      if (target) {
        if (target.state === 'D') {
          turnOn([]);
          grants.toggleDelete(target.id);
          return;
        }
        const state = stateOf(target.data, today);
        if (state === 'SCHEDULED') {
          // 사람이 정해 둔 기간이 이미 들어 있다 — 고치려면 목록에서 고친다(screen/admin/system/user-auth/requirements.md).
          message.info(label(MSG.USER_AUTH_SCHEDULED_KEEP));
          return;
        }
        if (state === 'EXPIRED') {
          void revive(target);
        }
        return;
      }
      turnOn([action]);

      /**
       * 스위치를 켠 결과를 <b>한 번에</b> 판에 넣는다 — 위 주석의 순서 규칙이 여기 있다.
       *
       * @param fresh 이 조작이 <b>새로 만드는</b> 행들. 있던 행을 되살리는 길에서는 비어 있다
       */
      function turnOn(fresh: Action[]) {
        const list = [...fresh];
        let notice: string | null = null;

        if (chain) {
          if (viaRole) {
            notice = label(MSG.USER_AUTH_READ_VIA_ROLE);
          } else {
            notice = label(MSG.USER_AUTH_READ_ON);
            // 있던 행이 없다 — 새로 만드는 목록에 실어 <b>한 번의 갱신</b>으로 들어간다.
            if (readRow === undefined) list.push('READ');
          }
        }

        if (list.length > 0) {
          let next = grants.rows;
          list.forEach((act) => {
            next = addGridRow(next, {
              menuCd,
              menuPath: pathOf.get(menuCd) ?? menuCd,
              actionCd: act,
              // 시작일은 <b>거의 항상 오늘</b>이다(screen/admin/system/user-auth/requirements.md). 종료일과 사유는 새 판단이라 빈칸이다.
              validFromDt: today,
              validToDt: null,
              grantRsn: null,
              defined: true,
            });
          });
          setGrantRows(next);
        }

        /*
          있던 `READ` 행을 되살린다 — 새로 만드는 것보다 낫다(PK 가 하나다). 갱신 함수라
          위의 {@code setRows} 결과 위에 얹힌다.
        */
        if (chain && !viaRole && readRow !== undefined) {
          if (readRow.state === 'D') grants.toggleDelete(readRow.id);
          else grants.edit(readRow.id, { validFromDt: today, validToDt: null, grantRsn: null });
        }
        if (notice) message.info(notice);
      }

      function revive(row: GridRow<GrantRow>) {
        return confirmReplace(row).then((agreed) => {
          if (!agreed) return;
          // 불변식이 <b>먼저</b>다 — 통째로 넣는 갱신이 아래 {@code edit} 뒤에 오면 그것을 지운다.
          turnOn([]);
          /*
            <b>종료일을 지우는 것이 아니라 다시 받는다</b>(screen/admin/system/user-auth/requirements.md). 역할 부여는 `null` 이
            무기한이지만 개인 예외는 기간이 필수라(sys/menu.md) 비워 두면 검증에 걸린다 —
            무기한이라는 선택지가 없으므로 되살리려면 새 종료일을 받는 수밖에 없다.
          */
          grants.edit(row.id, { validFromDt: today, validToDt: null, grantRsn: null });
        });
      }

      function confirmReplace(row: GridRow<GrantRow>) {
        return new Promise<boolean>((resolve) => {
          modal.confirm({
            title: label(MSG.USER_AUTH_REVIVE_TITLE),
            content: label(MSG.USER_AUTH_REVIVE_BODY, {
              from: row.data.validFromDt ?? '',
              to: row.data.validToDt ?? '',
              reason: row.data.grantRsn ?? '',
            }),
            okText: label(MSG.GRID_CONFIRM_OK),
            cancelText: label(MSG.COMMON_CANCEL),
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
      }

      /** 회수 — <b>종료일을 어제로</b>. 미저장 신규 행은 지울 것이 서버에 없어 즉시 제거다. */
      function revoke(row: GridRow<GrantRow>) {
        if (row.state === 'C') {
          grants.toggleDelete(row.id);
          return;
        }
        grants.edit(row.id, { validToDt: yesterday(today) });
      }
    },
    [grants, message, modal, pathOf, setGrantRows, today, treeRows],
  );

  // ── 검색 (screen/admin/system/user-auth/requirements.md — 거르지 않고 찾아간다) ───────────────────────

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return [];
    return treeRows
      .filter((row) => row.menuNm.toLowerCase().includes(needle))
      .map((row) => row.menuCd);
  }, [treeRows, term]);
  const highlighted = useMemo(() => new Set(matches), [matches]);
  /*
    <b>첫 일치로 스크롤한다</b>(2026-08-31 — 이동 버튼을 뺐다). 트리가 강조와 함께 그
    경로를 펼치므로 나머지 일치도 같은 화면 안에 있고, <i>다음</i> 을 눌러 옮겨 다닐
    거리가 아니다 — <b>첫 하나만 데려다 놓으면</b> 눈이 그 아래를 읽는다.
  */
  const focused = matches[0] ?? null;

  /**
   * 트리 ①의 검색 칸 — <b>브레드크럼이 아니라 거기다</b>(2026-08-31 요청 · screen/menu/requirements.md).
   *
   * <p>frontend/tabs.md 의 슬롯에 두었더니 두 가지가 어긋났다. <b>자리</b>는 줄 오른쪽 끝의 <i>조회조건
   * 숨기기</i> 옆이라 <b>무엇을 검색하는지</b>가 화면 어디에도 없었고 — 이 화면은 검색 칸이
   * 둘이다(사용자는 조회조건, 메뉴는 트리) — <b>입력</b>은 한 글자가 <b>두 번 들어갔다</b>.
   *
   * <p>그 둘째가 구조의 결과다. 슬롯은 노드를 스토어에 등록해 <b>셸이 그리는</b> 것이라
   * (포털이 아니다 — frontend/tabs.md) 값이 <b>한 커밋 늦게</b> 도착하고, 그 사이 리액트가 DOM 을
   * <i>아직 옛 props</i> 로 되돌린다. 라틴 글자에서는 깜빡임이지만 <b>한글은 매 타가 조합
   * 중</b>이라 그 되돌림이 조합을 깨고 글자가 중복됐다 — 조회조건 칸이 멀쩡했던 것은 그쪽은
   * 상태와 칸이 <b>같은 렌더</b>에 있기 때문이다.
   *
   * <p><b>칸 하나다</b>(2026-08-31 요청) — 건수와 이동 버튼 둘을 뺐다. 근거는
   * {@code TreeSearch} 에 있으며, 여기서 남는 것은 <b>첫 일치로 스크롤하는 것</b> 하나다
   * (위 {@code focused}).
   */
  const treeSearch = useMemo(
    () => ({
      placeholder: MSG.USER_AUTH_SEARCH_MENU,
      value: term,
      onChange: setTerm,
    }),
    [term],
  );

  /*
    브레드크럼 슬롯에 남는 것은 <b>조회조건 토글 하나</b>다(frontend/tabs.md · UX-15) — 트리 검색이
    ①로 옮겨 갔다(위 {@code treeSearch}).
  */

  // ── 선택과 조회 ─────────────────────────────────────────────────

  const confirmDiscard = useConfirmDiscard();

  /**
   * 사용자 선택 — <b>미저장 편집이 있으면 묻는다</b>(frontend/grid.md · UX-10).
   *
   * <p>거부권이 없으면 <i>보고 있는 것</i>과 <i>고른 것</i>이 갈리고, 그 상태로 저장하면
   * <b>A 의 예외가 B 에게 나간다</b> — 여기서는 그것이 곧 인가 사고다.
   */
  const selectUser = useCallback(
    async (row: GridRow<UserPickRow> | null): Promise<boolean> => {
      if (grants.dirty && !(await confirmDiscard())) {
        return false;
      }
      setUser(row?.data ?? null);
      if (!row) {
        selectedUserId.current = null;
        setTreeRows([]);
        setGrantRows([]);
        // 트리가 비었으므로 검색어도 남을 이유가 없다 — 잠긴 칸에 남은 글자는 잡음이다.
        setTerm('');
        return true;
      }
      // 고른 값을 <b>직접 넘긴다</b> — 상태는 아직 이전 렌더의 것이다.
      await loadFor(row.data.userId);
      return true;
    },
    [confirmDiscard, grants.dirty, loadFor, setGrantRows],
  );

  /**
   * 좌 ①의 조회 — <b>선택이 풀린다</b>(frontend/grid.md).
   *
   * <p>목록을 통째로 바꾸므로 이전에 보던 행이 결과에 없을 수도 있다. 트리와 예외 목록이
   * 남아 있으면 <b>다른 사람의 권한을 이 사람 것으로</b> 보게 된다.
   */
  const readUsers = useCallback(async () => {
    if (grants.dirty && !(await confirmDiscard())) {
      return;
    }
    setUser(null);
    selectedUserId.current = null;
    setTerm('');
    setTreeRows([]);
    setGrantRows([]);
    await users.read(true);
  }, [confirmDiscard, grants.dirty, setGrantRows, users]);

  /**
   * <b>트리 ①과 하단 ①</b>의 조회 — <b>사용자 선택은 그대로다</b>.
   *
   * <p>좌 ①과 갈리는 자리다. 저기는 <i>목록이 통째로 바뀌었을 수 있다</i> 가 근거이고,
   * 여기는 <b>같은 사람의 같은 트리</b>를 다시 읽는 것뿐이다.
   *
   * <p><b>둘이 같은 함수를 부른다</b>(2026-09-01 — frontend/grid.md). 트리와 하단 목록은 조회
   * 하나(`getMenuTree`)의 <b>두 표시</b>이므로(screen/admin/system/user-auth/requirements.md) 한쪽만 다시 읽을 수가 없다 —
   * 읽으면 <b>같은 데이터가 화면에서 갈린다</b>.
   *
   * <p><b>미저장 확인을 여기서 한다.</b> 컨트롤러의 {@code read()} 를 거치지 않으므로
   * frontend/grid.md 의 재조회 규약이 자동으로 돌지 않는다.
   */
  const reloadTree = useCallback(() => {
    const userId = selectedUserId.current;
    if (!userId) return;
    void (async () => {
      if (grants.dirty && !(await confirmDiscard())) return;
      refill(await readTree(userId));
    })();
  }, [confirmDiscard, grants.dirty, readTree, refill]);

  /**
   * 저장이 끝나면 <b>다시 읽는다</b>(frontend/grid.md) — 서버가 정리한 결과와 화면을 맞춘다.
   *
   * <p>참조에 넣는 것은 <b>효과에서</b> 한다. 렌더 중에 넣으면 React 가 <i>렌더에서 참조를
   * 건드린다</i> 고 막는데, 그 규칙이 맞다 — 렌더는 순수해야 하고 여기 담기는 것은
   * <b>나중에 부를 함수</b>이지 그려질 값이 아니다.
   */
  const reload = useCallback(() => {
    const userId = selectedUserId.current;
    if (userId) {
      void readTree(userId).then(refill);
    }
  }, [readTree, refill]);

  useEffect(() => {
    afterSave.current = reload;
  }, [reload]);

  const treeControls = useMemo<GridButtonControl[]>(
    () => [
      {
        key: 'collapseAll',
        slot: 'beforeTools',
        type: 'button',
        label: MSG.MENU_COLLAPSE_ALL,
        onClick: () => tree.current?.collapseAll(),
      },
      {
        key: 'expandAll',
        slot: 'beforeTools',
        type: 'button',
        label: MSG.MENU_EXPAND_ALL,
        onClick: () => tree.current?.expandAll(),
      },
    ],
    [],
  );

  const searchFields = useMemo(() => buildSearchFields(), []);

  return (
    <FillColumn>
      <SearchForm
        handleRef={searchForm}
        fields={searchFields}
        onSubmit={() => void readUsers()}
        onReset={users.clearFilters}
        onActiveCountChange={header.onActiveCountChange}
        collapsed={header.collapsed}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        {/* 스플리터 둘 — 좌우(사용자 ↔ 트리) 위에 상하(위 ↔ 예외 목록)다(frontend/grid.md). */}
        <SplitPane
          storageKey="userAuth"
          defaultRatio={0.62}
          first={(collapsed, expand) =>
            /*
              <b>접히면 좌우 스플리터를 그리지 않는다.</b> 접힌 pane 은 제목 줄 높이만
              차지하는데 그 안에 또 스플리터를 두면 <b>두 그리드가 0 높이로 눌려</b>
              되돌릴 자리가 사라진다(screen/menu/requirements.md 에서 겪은 그것이다).
            */
            collapsed ? (
              <DataGrid<UserPickRow>
                title={MSG.USER_AUTH_USER_TITLE}
                menuCd={MENU_CD}
                gridId="user"
                controller={users}
                collapsed
                onExpand={expand}
              />
            ) : (
              <SplitPane
                storageKey="userAuth.pick"
                // 마스터가 <b>좁다</b> — 컬럼 셋짜리 목록이라 좌우가 맞다(frontend/grid.md).
                axis="horizontal"
                defaultRatio={0.28}
                first={(innerCollapsed, innerExpand, innerAxis) => (
                  <DataGrid<UserPickRow>
                    title={MSG.USER_AUTH_USER_TITLE}
                    menuCd={MENU_CD}
                    gridId="user"
                    controller={users}
                    onSelect={selectUser}
                    collapsed={innerCollapsed}
                    /*
                      <b>좌우로 접히면 제목이 세로로 선다</b>(frontend/grid.md). 축을 화면이 다시
                      적지 않고 <b>스플리터의 콜백에서 받는다</b> — 두 번 적으면 미러링이다.
                    */
                    collapsedAxis={innerAxis}
                    onExpand={innerExpand}
                  />
                )}
                second={(innerCollapsed, innerExpand, innerAxis) => (
                  <PersonalAuthTree
                    handleRef={tree}
                    title={MSG.USER_AUTH_TREE_TITLE}
                    /*
                      <b>누구의 트리인가</b>(2026-08-31 요청 · frontend/grid.md). 좌 pane 이 스크롤되어
                      고른 행이 화면에서 벗어나면 <b>지금 누구를 보고 있는지가 화면 어디에도
                      없었다</b> — 그 상태로 스위치를 켜는 것이 이 화면에서는 곧 인가 사고다.
                    */
                    titleSuffix={userSuffix}
                    menuCd={MENU_CD}
                    rows={treeRows}
                    cells={cells}
                    dirtyMenus={dirtyMenus}
                    onToggle={toggle}
                    canSave={canSave}
                    onRead={reloadTree}
                    loading={treeLoading}
                    emptyText={MSG.USER_AUTH_TREE_EMPTY}
                    disabled={idle}
                    /*
                      <b>트리가 자기가 접혔다는 것을 몰랐다</b>(2026-08-31 실물) — pane 만
                      좁아지고 머리·판·푸터는 그대로 그려져 <b>잘린 표</b>가 남았다.
                    */
                    collapsed={innerCollapsed}
                    collapsedAxis={innerAxis}
                    onExpand={innerExpand}
                    controls={treeControls}
                    search={treeSearch}
                    highlighted={highlighted}
                    focusedId={focused}
                  />
                )}
              />
            )
          }
          second={(collapsed, expand) => (
            <DataGrid<GrantRow>
              title={MSG.USER_AUTH_GRANT_TITLE}
              /*
                <b>좌 pane 의 선택을 그대로 읽는다</b>(frontend/grid.md 의 `titleSuffix`). 트리는
                문자열을 받지만(부모 그리드가 없다) 여기는 컨트롤러를 넘길 수 있으므로
                <b>판정을 한 곳에</b> 둔다 — 둘이 같은 선택에서 나오므로 갈릴 수 없다.
              */
              titleSuffix={grantTitleSuffix}
              /*
                <b>빈 상태에서는 ①②③이 함께 잠긴다</b>(frontend/grid.md). 저장 버튼만 잠그면
                <i>대상이 없는 빈 판</i>의 엑셀과 컬럼 설정이 열린 채로 남는다.
              */
              disabled={idle}
              menuCd={MENU_CD}
              gridId="grant"
              controller={grants}
              /*
                <b>①의 조회</b> — frontend/grid.md(2026-09-01). `api.read` 를 선언할 수 없는
                그리드다: 이 목록을 먹이는 것은 `getMenuTree` 하나이고(screen/admin/system/user-auth/requirements.md) 그 응답은
                `PageResponse` 가 아니다. 그래도 <b>다시 읽을 길은 있어야 한다</b> —
                남이 고친 예외를 되읽거나 저장 실패 뒤 서버 상태를 확인하는 자리다.

                <b>트리의 ①과 같은 함수를 부른다.</b> 둘이 같은 조회의 두 표시이므로
                (screen/admin/system/user-auth/requirements.md) 한쪽만 다시 읽으면 <b>같은 데이터가 화면에서 갈린다</b> —
                표시가 둘이라고 원본이 둘이 되지 않는다는 이 화면의 전제가 깨진다.
              */
              onRead={reloadTree}
              /*
                <b>삭제 컬럼이 있다</b> — screen/admin/system/user-auth/requirements.md 의 셋째 수단(잘못 등록한 행 정리)이다.
                <b>회수가 아니다</b>: 회수는 트리의 스위치이거나 종료일 편집이며 행을
                남긴다. 라벨이 *삭제* 인 것이 그 구분을 말한다.
              */
              deletable
              emptyText={user ? MSG.USER_AUTH_GRANT_EMPTY : MSG.USER_AUTH_TREE_EMPTY}
              collapsed={collapsed}
              onExpand={expand}
            />
          )}
        />
      </div>
    </FillColumn>
  );
}

// ── 트리 → 목록 ───────────────────────────────────────────────────

/**
 * 트리 응답을 <b>예외 목록의 행</b>으로 편다 — screen/admin/system/user-auth/requirements.md.
 *
 * <p>순서는 트리 그대로다(전위 순회). 다시 정렬하면 <b>목록에서 찾은 행이 트리의 어디인지</b>
 * 를 눈으로 잇기 어려워진다 — 둘이 같은 데이터의 두 표시이므로 순서도 같은 편이 낫다.
 */
function flatten(rows: UserAuthTreeRow[]): GrantRow[] {
  const paths = menuPaths(rows);
  const flat: GrantRow[] = [];

  for (const row of rows) {
    for (const action of ACTIONS) {
      const grant = row.grants.find((candidate) => candidate.actionCd === action);
      if (!grant) continue;
      flat.push({
        menuCd: row.menuCd,
        menuPath: paths.get(row.menuCd) ?? row.menuCd,
        actionCd: action,
        validFromDt: grant.validFromDt,
        validToDt: grant.validToDt,
        grantRsn: grant.grantRsn,
        defined: row.definedActions.includes(action),
      });
    }
  }
  return flat;
}

/** `사용자 > 사용자 관리` — frontend/tabs.md 의 검색 결과와 같은 형식이다(screen/admin/system/user/requirements.md). */
function menuPaths(rows: UserAuthTreeRow[]): Map<string, string> {
  const byCode = new Map(rows.map((row) => [row.menuCd, row]));
  const paths = new Map<string, string>();

  for (const row of rows) {
    const names: string[] = [];
    let current: UserAuthTreeRow | undefined = row;
    // 순환이 들어온 데이터에서도 멈춘다 — 깊이 상한은 sys/menu.md 의 5단보다 넉넉히 잡는다.
    for (let depth = 0; current && depth < 10; depth += 1) {
      names.unshift(current.menuNm);
      current = current.upMenuCd ? byCode.get(current.upMenuCd) : undefined;
    }
    paths.set(row.menuCd, names.join(' > '));
  }
  return paths;
}

// ── 기간에서 상태를 낸다 (screen/admin/system/user-auth/requirements.md) ────────────────────────────────

/**
 * <b>조회 시 계산</b>이며 배치가 컬럼을 갱신하지 않는다 — 계정 잠금 자동 해제와 같은 구조다.
 *
 * <p><b>종료일이 비어 있으면 만료가 아니다.</b> 방금 켠 신규 행이 그 상태이고, 그 행은
 * 사용자가 종료일을 채우기 전까지 <i>유효</i> 로 보인다 — 스위치를 켠 사람이 기대하는
 * 그림이며, 저장은 검증에서 막힌다(sys/menu.md — 기간이 필수다).
 */
function stateOf(row: GrantRow, today: string): GrantState {
  /*
    <b>빈 문자열도 비어 있는 것이다.</b> 날짜 셀을 지우면 {@code null} 이 아니라 {@code ''}
    이 들어오고, 그대로 비교하면 <i>오늘 &gt; ''</i> 가 참이라 <b>방금 비운 칸이 만료로
    보인다</b>(2026-08-30 실물). 저장은 어차피 필수 검증에서 막히지만, 그 사이에 화면이
    거짓을 말한다 — 스위치도 함께 꺼진다.
  */
  const from = row.validFromDt || null;
  const to = row.validToDt || null;

  if (from !== null && today < from) {
    return 'SCHEDULED';
  }
  return to !== null && today > to ? 'EXPIRED' : 'ACTIVE';
}

function hasRoleRead(row: UserAuthTreeRow): boolean {
  return (row.viaRoles.READ?.length ?? 0) > 0;
}

/** `YYYY-MM-DD` — 업무 시간대는 서버의 것이지만 <b>화면이 만드는 기본값</b>은 브라우저의 오늘이다. */
function isoToday(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 즉시 회수 — <b>어제</b>다. 오늘로 두면 양끝 포함이라 오늘까지 유효하다(screen/admin/system/user-auth/requirements.md). */
function yesterday(today: string): string {
  const date = new Date(`${today}T00:00:00`);
  date.setDate(date.getDate() - 1);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ── 컬럼 ──────────────────────────────────────────────────────────

/** 좌 — 넷뿐이다. <b>고르기만 하는 목록</b>이다(screen/admin/system/user-auth/requirements.md). */
function buildUserColumns(): ColumnDef<UserPickRow>[] {
  return [
    { field: 'userNm', header: MSG.USER_COL_USER_NM, type: 'text', width: 110, sortable: true },
    { field: 'userId', header: MSG.USER_COL_USER_ID, type: 'text', width: 110, sortable: true },
    {
      /*
        <b>부여하는 자리에서 계정 상태가 보여야 한다</b>(screen/admin/system/user-auth/requirements.md). 못 쓰는 계정에 예외를
        열심히 주고 나서 <i>왜 안 되나</i> 를 묻는 일을 여기서 막는다.

        <b>정렬을 켜지 않는다</b> — 파생값이라 서버 화이트리스트에 없다(screen/admin/system/user-auth/requirements.md).
      */
      field: 'accountStat',
      header: MSG.USER_COL_STAT,
      headerTooltip: MSG.USER_COL_STAT_TIP,
      type: 'text',
      width: 90,
      derive: (row) => accountStatText(row.accountStat),
    },
    {
      /*
        <b>누구에게 이미 예외가 있는가</b>(2026-08-31 요청). 없으면 그것을 알려면 <i>한
        사람씩 골라 트리를 읽어야</i> 했고, 그것이 이 화면에서 가장 자주 하는 일이다.

        <b>지금 유효한 것만 센다</b> — 하단 그리드의 <i>상태</i> 컬럼과 같은 규칙이며
        (screen/admin/system/user-auth/requirements.md), 전건을 세면 만료가 쌓인 계정이 <b>영영 큰 수</b>로 남아 화면의 어느
        수와도 맞지 않는다. 세지 않는 것이 무엇인지는 <b>툴팁</b>이 말한다.

        <b>정렬을 켜지 않는다</b> — 두 번째 쿼리가 세는 값이라 서버 화이트리스트에
        `ORDER BY` 로 걸 컬럼이 없다(screen/admin/system/user-auth/requirements.md · `ApiCatalog` 의 매핑 수와 같은 자리).

        <b>배지를 붙이지 않는다.</b> 0 은 <i>결함이 아니라 정상</i>이다 — 예외는 예외이며,
        screen/admin/system/user-auth/requirements.md 가 열 건에서야 <i>역할 신설을 검토하세요</i> 를 내는 것과 같은 태도다.
      */
      field: 'activeGrantCnt',
      header: MSG.USER_AUTH_COL_GRANT_CNT,
      headerTooltip: MSG.USER_AUTH_COL_GRANT_CNT_TIP,
      type: 'number',
      width: 90,
      filter: false,
    },
  ];
}

const ACTION_LABEL: Record<Action, string> = {
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
 * 하 — <b>기간과 사유가 들어가는 유일한 자리</b>다(screen/admin/system/user-auth/requirements.md).
 *
 * <p>메뉴와 액션은 <b>읽기 전용</b>이다. 그 둘은 PK 의 일부이고(sys/menu.md) 고치는 것은
 * <i>다른 행을 만드는 일</i> 이며, 만드는 자리는 트리다 — 목록에서 메뉴 코드를 고칠 수 있게
 * 하면 screen/admin/system/user-auth/requirements.md 가 트리를 둔 이유가 사라진다.
 */
function buildGrantColumns(today: string): ColumnDef<GrantRow>[] {
  return [
    {
      field: 'menuPath',
      header: MSG.USER_AUTH_COL_MENU,
      type: 'text',
      width: 260,
      fill: true,
      sortable: false,
      /*
        <b>고아 배지</b> — API 가 사라져 그 액션이 미정의가 된 부여다(screen/admin/system/user/requirements.md · seed.md).
        트리에서는 `—` 로 보여 켜고 끌 수 없고, 목록에서만 <b>지울 수 있다</b>.

        screen/admin/system/user-auth/requirements.md 이 <i>"고아 배지의 모양"</i> 을 미결로 남겼다 — 여기서 <b>값 뒤에 붙는
        배지</b>로 정한다(frontend/grid.md 의 `badge` 축). 일괄 정리는 두지 않는다: 몇 건 되지 않고,
        <b>한 건씩 보고 지우는 것이 그 판단의 본체</b>다.
      */
      badge: (row) => (row.defined ? null : { text: label(MSG.USER_AUTH_ORPHAN), tone: 'warn' }),
    },
    {
      field: 'actionCd',
      header: MSG.USER_AUTH_COL_ACTION,
      type: 'text',
      width: 90,
      // 코드값이 아니라 <b>라벨로 그린다</b>(sys/code.md · frontend/grid.md).
      derive: (row) => label(ACTION_LABEL[row.actionCd]),
    },
    {
      field: 'grantState',
      header: MSG.USER_AUTH_COL_STATE,
      type: 'text',
      width: 80,
      filter: false,
      /*
        <b>값에서 다시 계산한다</b>(screen/admin/system/user-auth/requirements.md) — 조회 시점의 판정을 붙잡아 두지 않는다.
        종료일을 어제로 바꾼 순간 그 행은 <i>만료</i> 이며, 트리의 스위치도 같은 계산을
        보고 함께 꺼진다.
      */
      derive: (row) => label(STATE_LABEL[stateOf(row, today)]),
    },
    {
      field: 'validFromDt',
      header: MSG.USER_AUTH_COL_FROM,
      type: 'date',
      width: 130,
      editable: true,
      required: true,
      validate: (value, row) => periodIssue(value as string | null, row.validToDt),
    },
    {
      field: 'validToDt',
      header: MSG.USER_AUTH_COL_TO,
      type: 'date',
      width: 130,
      editable: true,
      // <b>무기한이라는 선택지가 없다</b>(sys/menu.md) — 역할 부여와 갈리는 자리다.
      required: true,
      validate: (value, row) => periodIssue(row.validFromDt, value as string | null),
    },
    {
      field: 'grantRsn',
      header: MSG.USER_AUTH_COL_REASON,
      type: 'text',
      width: 280,
      fill: true,
      filter: false,
      editable: true,
      // 변경 이력 테이블이 없으므로 <b>이 칸이 곧 감사 기록</b>이다(sys/logs.md · screen/admin/system/user/requirements.md).
      required: true,
      editor: 'largeText',
    },
  ];
}

/** <b>양끝 포함</b>이라 같은 날은 통과다 — sys/INDEX.md. 서버도 같은 것을 본다(frontend/grid.md). */
function periodIssue(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  return from > to ? label(MSG.USER_AUTH_PERIOD_REVERSED) : null;
}

// ── 조회조건 (screen/admin/system/user-auth/requirements.md) ────────────────────────────────────────────

/**
 * <b>하나뿐이다.</b>
 *
 * <p>screen/admin/system/user-auth/requirements.md 의 표에 둘이 적혀 있지만 <b>서버로 나가는 것은 하나</b>다 — 메뉴명은 트리
 * 필터이고 트리는 <b>거르지 않는다</b>(브레드크럼 줄의 검색 칸이 그 자리다).
 *
 * <p><b>ID 와 이름을 한 칸이 함께 본다.</b> 사람을 찾을 때 손에 있는 것은 <i>ID 이거나
 * 이름</i> 이고 <b>어느 쪽인지는 대개 상관없다</b> — `USER_MGMT` 와 갈리는 자리이며,
 * 그쪽은 <b>목록 자체가 일</b>이라 칸이 여덟이다(screen/admin/system/user-auth/requirements.md).
 *
 * <p><b>부여 상태가 없다</b>(screen/admin/system/user-auth/requirements.md) — 트리는 만료 배지를 그려야 하므로 전건을 보고,
 * 목록만 걸러져 있으면 *"같은 데이터의 두 표시"* 라는 원칙이 성립하지 않는다.
 */
function buildSearchFields(): SearchField[] {
  return [
    {
      field: 'user',
      label: MSG.USER_AUTH_SEARCH_USER,
      type: 'text',
      op: 'contains',
      ops: ['eq', 'startsWith', 'contains', 'endsWith'],
    },
  ];
}
