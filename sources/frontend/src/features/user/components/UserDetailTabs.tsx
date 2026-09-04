import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Alert } from 'antd';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { auditColumns } from '@/shared/grid/auditColumns';
import { DataGrid } from '@/shared/grid/DataGrid';
import { DetailTabs } from '@/shared/grid/DetailTabs';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow } from '@/shared/grid/rows';
import type {
  ColumnDef,
  DeleteColumnSpec,
  GridControl,
  GridIssue,
  SelectOption,
  TitleSuffixSpec,
  Tone,
} from '@/shared/grid/types';
import { USER_ENDPOINTS } from '@/features/user/api/endpoints';
import { isIpOrCidr, warnRevoke } from '@/features/user/detailRules';
import type {
  ActionCd,
  EffectiveAuthRow,
  GrantState,
  UserGrantRow,
  UserIpRow,
  UserRoleRow,
  UserRow,
  UserSessionRow,
} from '@/features/user/types';
import { VIA_PERSONAL } from '@/features/user/types';

/**
 * `USER_MGMT` 의 디테일 — screen/user/requirements.md. <b>탭 다섯이 다 그리드다.</b>
 *
 * <p>편집 폼을 두지 않으므로(frontend/grid.md) 기본정보 탭이 없고, 그 내용은 마스터 그리드의
 * 컬럼이 됐다. 남은 다섯은 전부 <b>`SYS_USER` 밖</b>의 데이터라 각자 조회 경로를 갖는다.
 *
 * <h2>탭을 열 때 부른다</h2>
 *
 * <p>screen/user/requirements.md 의 표는 *"저장된 행 선택 → 다섯 개 전부 조회"* 라고 적었지만 <b>여는 탭
 * 하나만 부른다</b>(2026-08-31). 마스터를 클릭할 때마다 왕복이 다섯이면 <b>목록을 훑는
 * 동작 자체가 부하</b>가 되고, 그중 유효 권한은 메뉴 전건과 부여 전건을 함께 읽어 가장
 * 비싸다 — screen/menu/requirements.md 이 메뉴 상세 탭 셋에 대해 이미 같은 판단을 내렸고 그 근거가 여기서도
 * 그대로다.
 *
 * <p>표가 말하려던 것은 <b>버튼과 빈 판의 상태</b>이며 그것은 그대로 지킨다: 고르기 전에는
 * 다섯이 다 <i>"사용자를 선택하세요"</i> 이고 ①②③이 함께 잠긴다(`disabled`).
 *
 * <p><b>한 번 부른 탭은 사용자가 바뀔 때까지 다시 부르지 않는다.</b> 탭을 오가는 것은
 * 조회가 아니라 <i>보는 각도를 바꾸는 것</i>이며, 그때마다 다시 부르면 <b>같은 사용자에
 * 대해 같은 답을 반복해서</b> 묻는다.
 *
 * <p><b>저장은 그 규칙을 깬다</b>(2026-08-31 실물). 탭 다섯이 <b>같은 사람의 서로 다른
 * 얼굴</b>이라 한 탭의 저장이 다른 탭의 답을 바꾼다 — 보유 역할에서 회수하면 유효 권한이
 * 줄고, 그것이 이 화면에서 가장 흔한 동선이다. 그런데 <i>사용자가 바뀔 때만 비운다</i> 는
 * 규칙으로는 그 탭이 <b>저장 전의 답을 그대로 들고</b> 있었고, 화면은 <b>끝난 권한을 유효로
 * 보여줬다</b>.
 *
 * <p>그래서 <b>저장하면 나머지 넷을 잊는다.</b> 어느 탭이 어느 탭에 영향을 주는지 표로
 * 적지 않는 것은, 그 표가 틀리는 날 증상이 <b>지금과 똑같이 조용하기</b> 때문이다 —
 * 다시 부르는 값이 그 표를 관리하는 값보다 싸다.
 *
 * <h2>미저장 편집이 있는 탭은 둘뿐이다</h2>
 *
 * <p>보유 역할과 접속 IP 다. 마스터의 선택을 바꿀 때 화면이 그것을 묻고(frontend/grid.md), 그
 * 물음의 답을 알아야 선택을 받아들일지 정할 수 있어 <b>페이지가 묻는다</b> — 여기서는
 * {@link UserDetailTabsHandle.dirty} 로 알려 주기만 한다.
 */

type TabKey = 'role' | 'grant' | 'ip' | 'session' | 'effective';

export interface UserDetailTabsHandle {
  /**
   * 마스터의 선택이 바뀌었다 — frontend/grid.md 의 상태 셋을 여기서 편다.
   *
   * @param userId `null` 이면 <b>빈 상태</b>다(조회 · 행 추가 · 아무도 안 고름)
   * @param locked <b>미저장 신규 행</b>이다 — 조회하지 않는다. `SYS_USER_ROLE` 이
   * `SYS_USER` 를 FK 로 참조하므로 부모가 저장되기 전에는 자식을 만들 수 없다(sys/user-role.md)
   */
  select: (userId: string | null, locked: boolean) => Promise<void>;
  /** 편집이 있는 두 탭 중 하나라도 미저장인가 — 마스터가 선택을 바꾸기 전에 묻는다. */
  dirty: () => boolean;
}

interface Props {
  menuCd: string;
  /** screen/user/requirements.md — 자기 계정의 세션은 끊을 수 없다. */
  myUserId: string;
  /** 역할 후보. 마스터의 조회조건과 <b>같은 목록</b>을 본다(screen/user/requirements.md). */
  roleOptions: SelectOption[];
  /**
   * 마스터 그리드 — <b>탭의 제목이 누구의 것인지 말하는 근거</b>다(frontend/grid.md).
   *
   * <p>{@link UserDetailTabsHandle.select} 가 이미 사용자 ID 를 받지만 그것으로는 모자란다:
   * 제목에 붙는 것은 <b>ID 와 이름</b>이고, 이름을 여기서 또 들면 <b>같은 사실이 두 곳</b>이
   * 된다 — 마스터에서 이름을 고치고 저장하기 전이면 그 둘이 갈린다.
   */
  master: { selected: GridRow<UserRow>[] };
  /**
   * 스플리터가 하단을 <b>접었다</b> — frontend/grid.md.
   *
   * <p>탭바가 사라지고 <b>활성 탭의 그리드 제목 한 줄</b>만 남는다({@code DetailTabs} ·
   * {@code DataGrid collapsed}). 접힘이 <b>표시</b>일 뿐이라 언마운트하지 않으며, 조회한
   * 행과 미저장 편집이 그대로 살아 있다.
   */
  collapsed?: boolean;
  /** 제목 줄 클릭으로 되돌리는 길 — 스플리터가 준다. */
  onExpand?: () => void;
  handleRef: React.RefObject<UserDetailTabsHandle | null>;
}

export function UserDetailTabs(props: Props) {
  const { menuCd, myUserId, roleOptions, master, collapsed, onExpand, handleRef } = props;
  const { message } = App.useApp();

  const [tab, setTab] = useState<TabKey>('role');
  /**
   * 지금 보고 있는 사용자 — <b>렌더가 보는 값</b>이다.
   *
   * <p>같은 사실을 {@link userId} 도 담지만 축이 다르다: 저것은 <b>콜백이 그 순간에</b>
   * 읽는 값이고 이것은 <b>화면이 다시 그릴 때</b> 읽는 값이다(screen/code/requirements.md 가 같은 자리에서 같은
   * 쌍을 두었다). ref 하나로 둘을 다 하면 빈 안내가 사용자를 바꿔도 그대로다.
   */
  const [picked, setPicked] = useState<{ userId: string | null; locked: boolean }>({
    userId: null,
    locked: false,
  });

  /*
    조회·저장 콜백이 읽는 값들 — 행을 고른 <b>바로 그 순간</b>에 조회가 나가야 하므로
    상태 갱신을 기다릴 수 없다. 기다리면 첫 조회가 <i>이전 사용자</i>의 것을 가져온다.
  */
  const userId = useRef<string | null>(null);
  const locked = useRef(false);
  const activeTab = useRef<TabKey>('role');
  /** 이미 부른 탭 — 사용자가 바뀔 때 비운다. */
  const loaded = useRef<Set<TabKey>>(new Set());

  const [scope, setScope] = useState<'held' | 'all'>('held');
  const heldOnly = useRef(true);
  /**
   * 유효 권한 탭을 <b>부른 적이 있는가</b> — 배너가 이것을 본다.
   *
   * <p>{@link loaded} 가 같은 사실을 담지만 그것은 ref 라 <b>렌더가 읽을 수 없다</b>
   * (`react-hooks/refs`). 축이 다른 값을 억지로 하나로 두지 않는다 — screen/code/requirements.md 의
   * {@code selectedGrpCd} · {@code savedGrpCd} 쌍과 같은 자리다.
   */
  const [effRead, setEffRead] = useState(false);

  /** 디테일 탭에는 조회조건 폼이 없다 — 대상이 없으면 <b>조회 자체를 하지 않는다</b>(frontend/grid.md). */
  const conditions = useCallback(
    () => Promise.resolve(userId.current && !locked.current ? [] : null),
    [],
  );
  const byUser = useCallback(() => ({ userId: userId.current }), []);
  const byUserAndScope = useCallback(
    () => ({ userId: userId.current, heldOnly: heldOnly.current }),
    [],
  );

  /**
   * 저장했다 — <b>나머지 넷을 잊는다</b>(위 머리말).
   *
   * <p>비우는 것은 <i>부른 적 있다</i> 는 표시뿐이고 행은 그대로 둔다. 지금 보고 있지 않은
   * 탭의 판을 비워 봐야 아무도 보지 못하며, 다음에 그 탭을 열 때 <b>조회가 먼저 돌고</b>
   * 그 결과가 판을 갈아 끼운다.
   */
  const forgetOthers = useCallback((saved: TabKey) => {
    const kept = loaded.current.has(saved);
    loaded.current.clear();
    if (kept) loaded.current.add(saved);
    if (saved !== 'effective') setEffRead(false);
  }, []);

  // ── 탭 1 — 보유 역할 (USER-03) ─────────────────────────────────

  const roleColumns = useMemo(() => buildRoleColumns(roleOptions), [roleOptions]);
  const roleApi = useMemo(
    () => ({
      read: { url: USER_ENDPOINTS.getRoleList },
      save: {
        url: USER_ENDPOINTS.saveRole,
        validate: { grid: validateRoleIds },
        warn: warnRevoke,
        // 유효 권한이 바뀐다 — 그 탭이 들고 있는 답은 이제 저장 전의 것이다.
        onSuccess: () => forgetOthers('role'),
      },
    }),
    [forgetOthers],
  );
  const roles = useGridController<UserRoleRow>({
    menuCd,
    columns: roleColumns,
    api: roleApi,
    params: conditions,
    searchParams: byUser,
    addRow: {
      defaults: () => ({
        roleId: '',
        roleNm: '',
        roleDesc: null,
        // 후보가 꺼진 역할도 포함하므로 신규 행의 기본은 <b>켜진 것</b>으로 둔다.
        roleUseYn: true,
        validFromDt: null,
        validToDt: null,
        // 기간이 비면 언제나 유효다 — `null` 이 무기한이기 때문이다(sys/menu.md).
        grantState: 'ACTIVE',
        regId: null,
        regDtm: null,
        modId: null,
        modDtm: null,
      }),
    },
    toSavePayload: (rows) => ({
      userId: userId.current,
      rows: rows.map((row) => ({
        rowState: row.state,
        roleId: row.data.roleId,
        // 삭제는 대상만 가리킨다 — 나머지를 보내면 서버가 쓰지 않을 값을 검증하게 된다.
        ...(row.state === 'D'
          ? {}
          : { validFromDt: row.data.validFromDt, validToDt: row.data.validToDt }),
      })),
    }),
  });

  /**
   * 지울 수 있는가 — <b>언제나 그렇다</b>(screen/user/requirements.md 의 셋째 줄과 같은 어휘).
   *
   * <p>지우는 것은 <b>잘못 등록한 행 정리</b>이며 <i>회수</i> 가 아니다. 회수는 종료일을
   * 어제로 하는 것이고 그때 행은 남는다 — 변경 이력 테이블이 없으므로(sys/logs.md)
   * <b>누가 언제까지 무슨 역할을 가졌는지</b> 를 남기는 것이 그 컬럼뿐이다(sys/menu.md).
   */
  const roleDeletable = useMemo<DeleteColumnSpec<UserRoleRow>>(
    () => ({ enabled: () => true, reason: () => null }),
    [],
  );

  // ── 탭 2 — 개인 예외 (AUTHZ-07 조회) ───────────────────────────

  const grantColumns = useMemo(() => buildGrantColumns(), []);
  const grantApi = useMemo(() => ({ read: { url: USER_ENDPOINTS.getUserMenuAuth } }), []);
  const grants = useGridController<UserGrantRow>({
    menuCd,
    columns: grantColumns,
    api: grantApi,
    params: conditions,
    searchParams: byUser,
  });

  // ── 탭 3 — 접속 IP (AUTH-08) ───────────────────────────────────

  const ipColumns = useMemo(() => buildIpColumns(), []);
  const ipApi = useMemo(
    () => ({
      read: { url: USER_ENDPOINTS.getIpList },
      save: {
        url: USER_ENDPOINTS.saveIp,
        validate: { grid: validateIps },
        warn: warnFirstRange,
        /*
          허용 IP 는 인가가 아니라 인증의 검사라(sys/user-role.md) 다른 탭의 답을 바꾸지 않는다.
          그래도 같은 규칙을 건다 — <b>어느 저장이 무엇을 바꾸는지</b> 를 화면이 표로
          들고 있으면 그 표가 틀리는 날 증상이 조용하다.
        */
        onSuccess: () => forgetOthers('ip'),
      },
    }),
    [forgetOthers],
  );
  const ips = useGridController<UserIpRow>({
    menuCd,
    columns: ipColumns,
    api: ipApi,
    params: conditions,
    searchParams: byUser,
    addRow: {
      defaults: () => ({
        ipCidr: '',
        useYn: true,
        // 기간이 비면 제한 없음이다 — 역할 부여와 같은 규칙이며 `null` 이 무기한이다(sys/menu.md).
        validFromDt: null,
        validToDt: null,
        regId: null,
        regDtm: null,
        modId: null,
        modDtm: null,
      }),
    },
    toSavePayload: (rows) => ({
      userId: userId.current,
      rows: rows.map((row) => ({
        rowState: row.state,
        ipCidr: row.data.ipCidr,
        ...(row.state === 'D'
          ? {}
          : {
              useYn: row.data.useYn,
              validFromDt: row.data.validFromDt,
              validToDt: row.data.validToDt,
            }),
      })),
    }),
  });

  /** 지우는 것이 정상이다 — 이사한 사무실의 대역을 남겨 둘 이유가 없다(sys/user-role.md). */
  const ipDeletable = useMemo<DeleteColumnSpec<UserIpRow>>(
    () => ({ enabled: () => true, reason: () => null }),
    [],
  );

  // ── 탭 4 — 활성 세션 (AUTH-10) ─────────────────────────────────

  const sessionColumns = useMemo(() => buildSessionColumns(), []);
  const sessionApi = useMemo(
    () => ({
      read: { url: USER_ENDPOINTS.getSessionList },
      actions: [
        {
          key: 'kill',
          label: MSG.USER_SESSION_KILL,
          url: USER_ENDPOINTS.killSession,
          /*
            <b>확인 문구가 계정은 바뀌지 않는다는 것을 말한다</b>(screen/user/requirements.md). *"N건을
            종료합니다"* 만으로는 <b>다시 로그인할 수 있다</b>는 사실이 빠지고, 그러면 이
            버튼이 계정을 잠그는 것으로 읽힌다 — 막으려면 `USE_YN='N'` 이고 그것은 **다른
            축**이다(sys/user-role.md).
          */
          confirm: MSG.USER_SESSION_KILL_CONFIRM,
          /*
            <b>자기 계정이면 대상이 하나도 없다</b>(screen/user/requirements.md). 고른 행을 여기서 걸러 내는
            것이 `toTargets` 가 아니라 `eligible` 인 이유는, 걸러진 결과가 확인 문구의
            건수와 버튼의 활성 상태를 함께 정하기 때문이다(frontend/grid.md).
          */
          eligible: () => userId.current !== myUserId,
          // 비활성 사유가 <i>선택 0건</i> 이 아니므로 말해 준다 — screen/user/requirements.md.
          hint: MSG.USER_SESSION_SELF,
          toTargets: (rows: GridRow<UserSessionRow>[]) =>
            rows.map((row) => row.data.sessionId),
          /*
            <b>고른 수와 끊은 수가 다를 수 있고, 다른 것이 사실이다</b> — 이미 만료된 세션은
            조용히 넘어간다(잠금 해제가 잠기지 않은 계정을 오류로 보지 않는 것과 같다).
          */
          onSuccess: (result: unknown) =>
            message.success(
              label(MSG.USER_SESSION_KILL_DONE, {
                count: typeof result === 'number' ? result : 0,
              }),
            ),
        },
      ],
    }),
    [message, myUserId],
  );
  const sessions = useGridController<UserSessionRow>({
    menuCd,
    columns: sessionColumns,
    api: sessionApi,
    params: conditions,
    searchParams: byUser,
  });

  // ── 탭 5 — 유효 권한 (screen/user/requirements.md) ───────────────────────────────

  const effColumns = useMemo(() => buildEffectiveColumns(), []);
  const effApi = useMemo(() => ({ read: { url: USER_ENDPOINTS.getEffectiveAuthList } }), []);
  const effective = useGridController<EffectiveAuthRow>({
    menuCd,
    columns: effColumns,
    api: effApi,
    params: conditions,
    searchParams: byUserAndScope,
  });

  /**
   * 유효 권한이 <b>공집합</b>인가 — screen/user/requirements.md 이 배너로 먼저 알리라고 한 것.
   *
   * <p>행에서 센다. 서버가 따로 세어 주지 않아도 되는 것은 이 탭이 <b>전건을 내려받기</b>
   * 때문이며(`mode: 'all'`), 범위가 <i>가진 것만</i> 이든 <i>전체 메뉴</i> 든 답이 같다 —
   * 전체 모드의 부여 없는 행은 `effective` 가 거짓이다.
   *
   * <p><b>조회 전에는 말하지 않는다.</b> 아직 안 부른 빈 판을 두고 *"차단됩니다"* 를 내면
   * 그것이 곧 거짓말이다.
   */
  const emptyAuthority = effRead && !effective.rows.some((row) => row.data.effective);

  // ── 탭 전환과 선택 (frontend/grid.md) ───────────────────────────────────

  const controllerOf = useCallback(
    (key: TabKey) => {
      switch (key) {
        case 'role':
          return roles;
        case 'grant':
          return grants;
        case 'ip':
          return ips;
        case 'session':
          return sessions;
        case 'effective':
          return effective;
      }
    },
    [roles, grants, ips, sessions, effective],
  );

  const loadTab = useCallback(
    async (key: TabKey) => {
      if (!userId.current || locked.current || loaded.current.has(key)) return;
      loaded.current.add(key);
      await controllerOf(key).read(true);
      /*
        <b>조회가 끝난 뒤에 세운다</b>(2026-08-31 실물). 앞에 두었더니 아직 빈 판인 상태로
        배너의 조건이 참이 되어, <b>탭을 누른 순간 경고가 번쩍이고 데이터가 오면
        사라졌다</b> — 안내 문구는 <b>기본이 숨김</b>이고 <i>조회 결과에 없을 때</i> 나오는
        것이다.

        조회가 실패하면 이 줄에 닿지 않는다. 그것이 맞다 — 못 물어본 것을 두고
        *"권한이 없습니다"* 라고 말하면 그것이 곧 거짓말이다.
      */
      if (key === 'effective') setEffRead(true);
    },
    [controllerOf],
  );

  const changeTab = useCallback(
    (key: string) => {
      const next = key as TabKey;
      activeTab.current = next;
      setTab(next);
      void loadTab(next);
    },
    [loadTab],
  );

  const select = useCallback(
    async (next: string | null, isLocked: boolean) => {
      userId.current = next;
      locked.current = isLocked;
      loaded.current.clear();
      setEffRead(false);
      setPicked({ userId: next, locked: isLocked });
      /*
        <b>다섯을 다 비운다.</b> 남겨 두면 <i>다른 사람의 데이터를 그 사람 것으로</i> 보게
        되고(frontend/grid.md), 탭을 옮기는 순간 그 오해가 화면에 그대로 남는다.
      */
      roles.setRows([]);
      grants.setRows([]);
      ips.setRows([]);
      sessions.setRows([]);
      effective.setRows([]);
      await loadTab(activeTab.current);
    },
    [roles, grants, ips, sessions, effective, loadTab],
  );

  const dirty = useCallback(() => roles.dirty || ips.dirty, [roles.dirty, ips.dirty]);


  /*
    <b>렌더 중에 ref 를 쓰지 않는다</b>(`react-hooks/refs`). 마스터가 이 핸들을 부르는 것은
    사람이 행을 클릭한 뒤이므로 효과가 이미 돌아 있다.
  */
  useEffect(() => {
    handleRef.current = { select, dirty };
  }, [handleRef, select, dirty]);

  const changeScope = useCallback(
    (next: string) => {
      const held = next === 'held';
      heldOnly.current = held;
      setScope(held ? 'held' : 'all');
      // <b>컨트롤이 스스로 부르지 않는다</b> — 재조회는 화면의 일이다(frontend/grid.md).
      if (userId.current && !locked.current) {
        loaded.current.add('effective');
        void effective.read(true);
      }
    },
    [effective],
  );

  /**
   * ⓐ 의 셀렉트 — <b>frontend/grid.md 의 `select` 첫 실물</b>이다.
   *
   * <p>조회조건 칸이 아닌 이유는 여기서 고르는 것이 <i>거르기</i> 가 아니라 <b>무엇을 행으로
   * 낼지</b>이기 때문이다 — 부여를 세느냐 메뉴를 세느냐. 그리고 이 화면의 검색 폼은
   * <b>마스터의 것</b>이라 접히면 보이지 않는다.
   */
  const effControls = useMemo<GridControl[]>(
    () => [
      {
        key: 'scope',
        slot: 'beforeRead',
        type: 'select',
        label: MSG.USER_EFF_SCOPE,
        value: scope,
        width: 130,
        options: [
          { value: 'held', text: label(MSG.USER_EFF_SCOPE_HELD) },
          { value: 'all', text: label(MSG.USER_EFF_SCOPE_ALL) },
        ],
        onChange: changeScope,
      },
    ],
    [scope, changeScope],
  );

  // ── 그리기 ─────────────────────────────────────────────────────

  const idle = picked.userId === null || picked.locked;
  /** 빈 판의 문구 셋 — <b>같은 빈 판이지만 다음에 할 일이 다르다</b>(frontend/grid.md). */
  const emptyOf = (own: string) =>
    picked.userId === null ? MSG.USER_DETAIL_EMPTY : picked.locked ? MSG.USER_DETAIL_LOCKED : own;

  /**
   * 탭 다섯의 제목 뒤에 붙는 것 — <b>로그인 ID 와 이름</b>이다(frontend/grid.md 의 `titleSuffix`).
   *
   * <p>둘 다인 이유는 각자 부족하기 때문이다. ID 만으로는 <b>누구인지</b> 를 모르고
   * (`u10293`), 이름만으로는 <b>동명이인</b>이 갈리지 않는다 — 조회조건에 이름이 있는
   * 화면에서 그 둘은 실제로 나란히 온다.
   */
  const titleSuffix = useMemo<TitleSuffixSpec>(
    () => ({ parent: master, fields: ['userId', 'userNm'] }),
    [master],
  );

  return (
    <FillColumn>
      <DetailTabs
        activeKey={tab}
        onChange={changeTab}
        collapsed={collapsed}
        items={[
          {
            key: 'role',
            label: label(MSG.USER_TAB_ROLE),
            children: (
              <DataGrid<UserRoleRow>
                title={MSG.USER_ROLE_TITLE}
                menuCd={menuCd}
                titleSuffix={titleSuffix}
                collapsed={collapsed}
                onExpand={onExpand}
                gridId="detailRole"
                controller={roles}
                deletable={roleDeletable}
                emptyText={emptyOf(MSG.USER_ROLE_EMPTY)}
                disabled={idle}
              />
            ),
          },
          {
            key: 'grant',
            label: label(MSG.USER_TAB_GRANT),
            children: (
              <DataGrid<UserGrantRow>
                title={MSG.USER_GRANT_TITLE}
                menuCd={menuCd}
                titleSuffix={titleSuffix}
                collapsed={collapsed}
                onExpand={onExpand}
                gridId="detailGrant"
                controller={grants}
                emptyText={emptyOf(MSG.USER_GRANT_EMPTY)}
                disabled={idle}
              />
            ),
          },
          {
            key: 'ip',
            label: label(MSG.USER_TAB_IP),
            children: (
              <DataGrid<UserIpRow>
                title={MSG.USER_IP_TITLE}
                menuCd={menuCd}
                titleSuffix={titleSuffix}
                collapsed={collapsed}
                onExpand={onExpand}
                gridId="detailIp"
                controller={ips}
                deletable={ipDeletable}
                emptyText={emptyOf(MSG.USER_IP_EMPTY)}
                disabled={idle}
              />
            ),
          },
          {
            key: 'session',
            label: label(MSG.USER_TAB_SESSION),
            children: (
              <DataGrid<UserSessionRow>
                title={MSG.USER_SESSION_TITLE}
                menuCd={menuCd}
                titleSuffix={titleSuffix}
                collapsed={collapsed}
                onExpand={onExpand}
                gridId="detailSession"
                controller={sessions}
                /* 여럿 중에서 고르는 일이라 다중 선택이다 — frontend/grid.md. */
                selection="multiple"
                emptyText={emptyOf(MSG.USER_SESSION_EMPTY)}
                disabled={idle}
              />
            ),
          },
          {
            key: 'effective',
            label: label(MSG.USER_TAB_EFFECTIVE),
            children: (
              /*
                <b>배너가 탭 안에 있다</b>(2026-08-31). 탭바 위에 두었더니 <b>탭 다섯 전체가
                한 줄 밀렸고</b>, 무엇보다 그 줄은 <i>유효 권한 탭의 말</i> 인데 탭 밖에
                있어서 <b>화면 전체에 대한 경고</b>처럼 읽혔다 — screen/user/requirements.md 이 요구한 것은
                *빈 표를 보고 유추하게 두지 않는 것* 이고, 그 자리는 그 표의 위다.
              */
              <div
                style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
              >
                {/* 접히면 배너도 함께 접힌다 — 남는 것은 제목 한 줄뿐이다(frontend/grid.md). */}
                {!collapsed && emptyAuthority && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 8 }}
                    message={label(MSG.USER_EFF_NONE)}
                  />
                )}
                <div style={{ flex: 1, minHeight: 0 }}>
                  <DataGrid<EffectiveAuthRow>
                    title={MSG.USER_EFF_TITLE}
                    menuCd={menuCd}
                    titleSuffix={titleSuffix}
                    collapsed={collapsed}
                    onExpand={onExpand}
                    gridId="detailEffective"
                    controller={effective}
                    controls={effControls}
                    emptyText={emptyOf(MSG.USER_EFF_EMPTY)}
                    disabled={idle}
                  />
                </div>
              </div>
            ),
          },
        ]}
      />
    </FillColumn>
  );
}

// ── 공용 어휘 ──────────────────────────────────────────────────────

/** 상태 배지의 색 — 세 탭이 같은 맵을 본다(frontend/grid.md). */
const STATE_TONE: Record<string, Tone> = {
  SCHEDULED: 'none',
  ACTIVE: 'ok',
  EXPIRED: 'muted',
};

const STATE_LABEL: Record<GrantState, string> = {
  SCHEDULED: MSG.USER_STATE_SCHEDULED,
  ACTIVE: MSG.USER_STATE_ACTIVE,
  EXPIRED: MSG.USER_STATE_EXPIRED,
};

/** 코드 그대로 두고 <b>글자만</b> 바꾼다 — 그래야 정렬·필터·엑셀이 코드를 본다(frontend/grid.md). */
function stateText(value: unknown): string {
  // `unknown` 을 그대로 잇지 않는다 — 객체가 오면 `[object Object]` 가 셀에 박힌다.
  const code = typeof value === 'string' ? value : '';
  return code in STATE_LABEL ? label(STATE_LABEL[code as GrantState]) : code;
}

/** 액션 넷의 라벨 — `authz.action.*` 를 그대로 쓴다(054). */
const ACTION_LABEL: Record<ActionCd, string> = {
  READ: MSG.AUTHZ_ACTION_READ,
  SAVE: MSG.AUTHZ_ACTION_SAVE,
  EXPORT: MSG.AUTHZ_ACTION_EXPORT,
  EXECUTE: MSG.AUTHZ_ACTION_EXECUTE,
};

const ACTION_OPTIONS: SelectOption[] = (
  ['READ', 'SAVE', 'EXPORT', 'EXECUTE'] as ActionCd[]
).map((action) => ({ value: action, text: label(ACTION_LABEL[action]) }));

// ── 탭 1 — 보유 역할 ──────────────────────────────────────────────

function buildRoleColumns(roleOptions: SelectOption[]): ColumnDef<UserRoleRow>[] {
  return [
    {
      field: 'roleId',
      header: MSG.USER_ROLE_COL_ROLE,
      type: 'text',
      width: 220,
      pinned: 'left',
      sortable: true,
      /*
        <b>PK 의 절반</b>이다(sys/menu.md) — 신규 행에서만 열리고 필수이며 헤더에 표시가 붙는다.
        다른 역할을 주려면 이 행을 정리하고 새로 만든다: 다른 역할은 <b>다른 사실</b>이지
        같은 부여의 수정이 아니다.
      */
      pk: true,
      editor: 'select',
      /*
        후보의 글자가 <b>이름과 코드</b> 둘 다다. 저장된 행에서도 이 맵이 표시에 쓰이므로
        (frontend/grid.md) 목록이 이름으로 읽히고, 코드가 필요한 순간에도 눈으로 확인된다.
      */
      options: roleOptions,
    },
    {
      // 후보 맵이 이름을 그려 주지만 <b>정렬의 기준</b>이라 컬럼 자체가 있어야 한다.
      field: 'roleNm',
      header: MSG.USER_ROLE_COL_ROLE_NM,
      type: 'text',
      width: 160,
      visible: false,
      sortable: true,
    },
    { field: 'roleDesc', header: MSG.USER_ROLE_COL_ROLE_DESC, type: 'text', width: 240, visible: false },
    {
      /*
        <b>역할 자체</b>의 사용 여부다(sys/menu.md 의 AND). 상태 배지는 기간만 보므로, 이 칸이
        없으면 <i>유효라는데 왜 안 되나</i> 에 답할 것이 없다. 읽기 전용인 것은 이것이
        <b>이 부여의 값이 아니라 역할의 값</b>이기 때문이다 — 고치는 곳은 `ROLE_MGMT` 다.
      */
      field: 'roleUseYn',
      header: MSG.USER_ROLE_COL_USE_YN,
      type: 'ynFlag',
      width: 110,
      sortable: true,
    },
    {
      field: 'validFromDt',
      header: MSG.USER_ROLE_COL_FROM,
      type: 'date',
      width: 130,
      sortable: true,
      editable: true,
      validate: (value, row) => periodIssue(value as string | null, row.validToDt),
    },
    {
      /* <b>즉시 회수는 어제 날짜</b>다 — 오늘은 포함되므로 오늘로 두면 오늘까지 유효하다. */
      field: 'validToDt',
      header: MSG.USER_ROLE_COL_TO,
      type: 'date',
      width: 130,
      sortable: true,
      editable: true,
      validate: (value, row) => periodIssue(row.validFromDt, value as string | null),
    },
    {
      field: 'grantState',
      header: MSG.USER_ROLE_COL_STATE,
      type: 'text',
      width: 90,
      renderer: 'badge',
      tone: STATE_TONE,
      display: stateText,
      /*
        <b>꺼진 역할이면 배지가 하나 더 붙는다</b>(screen/code/requirements.md 의 값-뒤 배지). 상태는 기간만
        보므로 <i>유효</i> 인데 아무것도 주지 않는 행이 있고, 그 사실을 말하는 자리가
        여기밖에 없다.
      */
      badge: (row) =>
        row.roleUseYn
          ? null
          : { text: label(MSG.USER_ROLE_COL_USE_YN), tone: 'warn', tip: label(MSG.USER_ROLE_OFF) },
    },
    ...auditColumns<UserRoleRow>({ sortable: true }),
  ];
}

/** 같은 그리드 안의 중복은 클라이언트가 판정할 수 있다 — frontend/grid.md. */
function validateRoleIds(rows: GridRow<UserRoleRow>[]): GridIssue[] {
  const issues: GridIssue[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = row.data.roleId?.trim() ?? '';
    if (key === '') continue;
    if (seen.has(key)) {
      issues.push({ rowId: row.id, field: 'roleId', message: label(MSG.USER_ROLE_DUPLICATE) });
    }
    seen.add(key);
  }
  return issues;
}

/** <b>양끝 포함</b>이라 같은 날은 통과다 — sys/INDEX.md. 서버도 같은 것을 본다(frontend/grid.md). */
function periodIssue(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  return from > to ? label(MSG.USER_PERIOD_REVERSED) : null;
}

// ── 탭 2 — 개인 예외 ──────────────────────────────────────────────

function buildGrantColumns(): ColumnDef<UserGrantRow>[] {
  return [
    {
      field: 'menuPath',
      header: MSG.USER_GRANT_COL_MENU,
      /*
        <b>여기서는 고칠 수 없다</b>는 것을 헤더가 말한다(screen/user/requirements.md). 회색 그리드만 두면
        *"왜 안 고쳐지나"* 가 되고, 그 답은 권한 설계에 있지 화면의 결함이 아니다.
      */
      headerTooltip: MSG.USER_GRANT_READONLY,
      type: 'text',
      width: 280,
      pinned: 'left',
      sortable: true,
    },
    {
      field: 'actionCd',
      header: MSG.USER_GRANT_COL_ACTION,
      type: 'code',
      width: 100,
      sortable: true,
      options: ACTION_OPTIONS,
    },
    {
      field: 'grantState',
      header: MSG.USER_AUTH_COL_STATE,
      type: 'text',
      width: 90,
      renderer: 'badge',
      tone: STATE_TONE,
      display: stateText,
    },
    { field: 'validFromDt', header: MSG.USER_AUTH_COL_FROM, type: 'date', width: 130, sortable: true },
    { field: 'validToDt', header: MSG.USER_AUTH_COL_TO, type: 'date', width: 130, sortable: true },
    {
      /*
        게이트 ④ — 부여는 살아 있는데 <b>대상이 죽었다</b>(backend/security.md). 이 칸이 꺼져 있으면
        상태가 <i>유효</i> 여도 유효 권한에 들어가지 않으며, 그것이 <i>"권한을 줬는데 안
        보인다"</i> 의 답이다.
      */
      field: 'menuAuthorizable',
      header: MSG.USER_GRANT_COL_MENU_OK,
      headerTooltip: MSG.USER_EFF_GATE,
      type: 'ynFlag',
      width: 100,
      sortable: true,
    },
    {
      field: 'grantRsn',
      header: MSG.USER_GRANT_COL_REASON,
      type: 'text',
      width: 240,
      fill: true,
      // 값이 500자까지라 셀에서 잘린다 — 이미 손에 있는 값이므로 툴팁이다(frontend/grid.md).
      cellTooltip: true,
    },
    { field: 'menuCd', header: MSG.USER_AUTH_COL_MENU, type: 'text', width: 160, visible: false },
    ...auditColumns<UserGrantRow>({ sortable: true }),
  ];
}

// ── 탭 3 — 접속 IP ────────────────────────────────────────────────

function buildIpColumns(): ColumnDef<UserIpRow>[] {
  return [
    {
      field: 'ipCidr',
      header: MSG.USER_IP_COL_CIDR,
      type: 'text',
      width: 220,
      pinned: 'left',
      sortable: true,
      // PK 의 절반이다 — 다른 대역은 다른 사실이라 고치지 않고 지우고 다시 넣는다(sys/user-role.md).
      pk: true,
      validate: (value) =>
        isIpOrCidr(typeof value === 'string' ? value : '')
          ? null
          : label(MSG.USER_IP_MALFORMED),
    },
    {
      field: 'useYn',
      header: MSG.USER_IP_COL_USE_YN,
      type: 'ynFlag',
      width: 90,
      sortable: true,
      // <b>지우지 않고 끈다</b> — 지웠다 넣으면 감사 4컬럼이 사라진다(sys/user-role.md).
      editable: true,
    },
    /*
      ── 기간 둘 (2026-08-31 · sys/user-role.md) ──────────────────────────────

      <b>사무실이 어디인가</b> 는 예정된 종료를 갖지 않는다고 적어 두었었고, 그래서 이
      테이블에만 기간이 없었다. 그런데 이 목록이 하는 일은 <b>들어올 수 있는 곳을 제한</b>
      하는 것이며 — 파견·출장·외부 감사처럼 <b>기한이 정해진 접근</b>이 이 기능의 흔한
      용도다. 기간이 없으면 그 대역을 <b>사람이 기억해서 지워야</b> 하고, 잊으면 그것은
      끝난 계약의 IP 가 열려 있는 상태다.

      <b>`USE_YN` 과 다른 축이다.</b> 저것은 <i>지금 손으로 끄고 켜는 것</i>이고 이것은
      <i>미리 정해 두는 것</i>이다 — 둘의 AND 가 판정이며, 역할 부여가 이미 같은 모양을
      갖는다(sys/menu.md).

      <b>서버 기준 시간이다.</b> 오늘이 언제인지를 브라우저가 정하면 <b>여행 중인
      관리자의 시계</b>가 접근 정책을 하루 밀 수 있다 — 판정은 `BusinessCalendar` 가 하고
      (sys/batch.md) 화면은 날짜를 <b>그대로</b> 보낸다.
    */
    {
      field: 'validFromDt',
      header: MSG.USER_IP_COL_FROM,
      headerTooltip: MSG.USER_IP_PERIOD_TIP,
      type: 'date',
      width: 130,
      sortable: true,
      editable: true,
      validate: (value, row) => ipPeriodIssue(value as string | null, row.validToDt),
    },
    {
      field: 'validToDt',
      header: MSG.USER_IP_COL_TO,
      headerTooltip: MSG.USER_IP_PERIOD_TIP,
      type: 'date',
      width: 130,
      sortable: true,
      editable: true,
      validate: (value, row) => ipPeriodIssue(row.validFromDt, value as string | null),
    },
    ...auditColumns<UserIpRow>({ sortable: true }),
  ];
}

/**
 * 기간이 뒤집혔는가 — <b>양끝 포함</b>이라 같은 날은 통과다(sys/INDEX.md).
 *
 * <p>보유 역할의 {@link periodIssue} 와 같은 판정을 한다. 한 함수로 합치지 않는 것은
 * <b>문구가 갈리는 날</b>을 위해서다 — 역할은 *부여* 이고 이것은 *접근 허용* 이라, 같은
 * 규칙이어도 사용자가 읽는 말이 달라질 수 있다. 지금은 같은 메시지를 쓴다.
 */
function ipPeriodIssue(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  return from > to ? label(MSG.USER_PERIOD_REVERSED) : null;
}

function validateIps(rows: GridRow<UserIpRow>[]): GridIssue[] {
  const issues: GridIssue[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = row.data.ipCidr?.trim() ?? '';
    if (key === '') continue;
    if (seen.has(key)) {
      issues.push({ rowId: row.id, field: 'ipCidr', message: label(MSG.USER_IP_DUPLICATE) });
    }
    seen.add(key);
  }
  return issues;
}

/**
 * <b>첫 대역 하나가 정책을 켜는 스위치</b>다 — sys/user-role.md.
 *
 * <p>행이 없으면 제한 없음이므로, 아무것도 없던 계정에 하나를 더하는 순간 <b>나머지 모든
 * IP 가 막힌다</b>. 건수는 <i>얼마나</i> 를 말할 뿐이라 그것을 말하지 못한다(screen/code/requirements.md).
 */
function warnFirstRange(rows: GridRow<UserIpRow>[]): string[] {
  const added = rows.filter((row) => row.state === 'C').length;
  const existing = rows.filter((row) => row.state !== 'C' && row.state !== 'D').length;
  return added > 0 && existing === 0 ? [label(MSG.USER_IP_WARN_FIRST)] : [];
}

// ── 탭 4 — 활성 세션 ──────────────────────────────────────────────

function buildSessionColumns(): ColumnDef<UserSessionRow>[] {
  return [
    {
      field: 'sessionId',
      header: MSG.USER_SESSION_COL_ID,
      type: 'text',
      width: 140,
      pinned: 'left',
      /*
        <b>앞 8자만 그린다</b>(screen/user/requirements.md).

        `display` 가 아니라 `derive` 인 것은 어댑터가 `display` 를 <b>렌더러가 있는 칸</b>
        (`list` · `link` · `badge`)에만 태우기 때문이다(frontend/grid.md) — 평범한 텍스트 칸에서는
        아무 일도 하지 않는다(2026-08-31 실물: 전체 ID 가 그대로 보였다).

        <b>실행이 보내는 값은 그대로다</b> — `toTargets` 가 행 데이터의 `sessionId` 를
        읽으므로 파생은 표시에만 걸린다. 엑셀은 짧은 쪽을 받는데, 온전한 세션 ID 는
        <b>화면 밖에서 쓸 데가 없다</b>(끊는 것은 이 화면의 일이다).
      */
      derive: (row) => row.sessionId.slice(0, 8),
    },
    {
      field: 'current',
      header: MSG.USER_SESSION_COL_CURRENT,
      type: 'ynFlag',
      width: 110,
    },
    { field: 'createdDtm', header: MSG.USER_SESSION_COL_CREATED, type: 'dateTime', width: 170, sortable: true },
    {
      // 목록의 기본 정렬이 이것이다 — *끊을까 말까* 를 가르는 값이다(screen/user/requirements.md).
      field: 'lastAccessedDtm',
      header: MSG.USER_SESSION_COL_ACCESS,
      type: 'dateTime',
      width: 170,
      sortable: true,
    },
    { field: 'expiryDtm', header: MSG.USER_SESSION_COL_EXPIRY, type: 'dateTime', width: 170, sortable: true },
    /*
      ── 어디서 들어왔나 (2026-08-31) ──────────────────────────────

      <b>세션 스토어에는 없는 값이다.</b> 로그인 이력({@code SYS_LO_LOGIN})에서 온다 —
      그래서 헤더에 <b>출처를 적는다</b>(screen/log/access/requirements.md 과 같은 규약: 이 컬럼을 어디까지 믿을
      수 있나를 화면이 말한다).

      <b>같은 사실이 두 곳이 되는 것이 아니다.</b> 값의 원본은 여전히 이력 하나이고 세션은
      그것을 <b>담지 않는다</b> — 조회 시점에 <i>그 세션이 만들어진 무렵의 로그인</i>을
      찾아 붙일 뿐이다. 그래서 이력을 파기하면(retention.md) 이 칸이 빈다: 그것이 맞다.

      <b>왜 필요한가.</b> 이 탭이 하는 일이 <i>끊을까 말까</i> 인데, 세션 ID 앞 8자와 시각
      셋만으로는 <b>어느 것이 내 것이고 어느 것이 남의 것인지</b> 를 가릴 수 없다 —
      *"모르는 곳에서 들어온 세션을 끊는다"* 가 이 버튼의 첫 용도다.
    */
    {
      field: 'clientIp',
      header: MSG.USER_SESSION_COL_IP,
      headerTooltip: MSG.USER_SESSION_FROM_LOGIN,
      type: 'text',
      width: 140,
      sortable: true,
    },
    {
      field: 'userAgent',
      header: MSG.USER_SESSION_COL_AGENT,
      headerTooltip: MSG.USER_SESSION_FROM_LOGIN,
      type: 'text',
      width: 240,
      sortable: true,
      fill: true,
      // `VARCHAR(500)` 이라 셀에서 잘린다 — 이미 손에 있는 값이므로 툴팁이다(frontend/grid.md).
      cellTooltip: true,
    },
  ];
}

// ── 탭 5 — 유효 권한 ──────────────────────────────────────────────

/**
 * screen/user/requirements.md 의 컬럼 표 그대로다 — <b>메뉴 · 액션 4열 · 출처 · 상태</b>.
 *
 * <p>액션 넷이 <b>파생 컬럼</b>이다. 값이 `actions` 배열의 원소 여부이고 정의 밖이면
 * `—` 인데, 그 셋(있음 · 없음 · 줄 것 없음)을 한 칸에 담는 방법이 배지의 글자다 —
 * screen/user/requirements.md 가 트리에서 쓴 것과 <b>같은 어휘</b>다.
 */
function buildEffectiveColumns(): ColumnDef<EffectiveAuthRow>[] {
  const actionColumn = (action: ActionCd): ColumnDef<EffectiveAuthRow> => ({
    field: `act.${action}`,
    header: ACTION_LABEL[action],
    type: 'text',
    width: 76,
    renderer: 'badge',
    tone: { ON: 'ok', OFF: 'muted', NONE: 'muted' },
    /*
      <b>정의되지 않은 액션은 `—` 다</b>(sys/menu.md) — *안 줬다* 와 *줄 것이 없다* 는 다르며,
      뒤엣것은 <b>부여할 칸 자체가 없는</b> 것이다(sys/menu.md).
    */
    derive: (row) =>
      !row.definedActions.includes(action)
        ? 'NONE'
        : row.actions.includes(action)
          ? 'ON'
          : 'OFF',
    display: (value) => (value === 'ON' ? '●' : value === 'OFF' ? '·' : '—'),
  });

  return [
    {
      field: 'menuPath',
      header: MSG.USER_EFF_COL_MENU,
      type: 'text',
      width: 300,
      pinned: 'left',
      sortable: true,
      /*
        <b>지금 효력이 없는 행은 흐리다</b>. 게이트 ④에 걸렸거나 부여가 예정·만료인
        것들이며, 배지가 그중 어느 쪽인지 말한다 — screen/user/requirements.md 의 *전체 모드에서 권한 없는
        행은 회색* 을 <b>모든 모드로</b> 넓힌 것이다: 가진 것만 모드에도 만료된 부여가 있다.
      */
      emphasis: (row) => row.effective,
      badge: (row) =>
        row.via === null
          ? null
          : !row.menuAuthorizable
            ? { text: label(MSG.USER_GRANT_COL_MENU_OK), tone: 'warn', tip: label(MSG.USER_EFF_GATE) }
            : row.grantState !== 'ACTIVE'
              ? { text: stateText(row.grantState), tone: 'warn', tip: label(MSG.USER_EFF_INACTIVE) }
              : null,
    },
    actionColumn('READ'),
    actionColumn('SAVE'),
    actionColumn('EXPORT'),
    actionColumn('EXECUTE'),
    {
      field: 'via',
      header: MSG.USER_EFF_COL_VIA,
      type: 'text',
      width: 180,
      sortable: true,
      /*
        <b>역할명이거나 개인 예외</b>다(backend/security.md 의 두 갈래). 부여가 없는 행은 <i>없음</i> 인데,
        빈 칸으로 두면 *조회가 덜 된 것* 으로 읽힌다.

        `display` 가 아니라 `derive` 인 이유는 세션 ID 칸과 같다 — 텍스트 칸에서는
        `display` 가 걸리지 않아 `PERSONAL` 이 그대로 보였다(2026-08-31 실물). 여기서는
        <b>파생이 맞기도 하다</b>: 정렬·필터·엑셀이 보아야 하는 것도 <i>개인 예외</i> 라는
        글자이지 서버의 자리 표시자가 아니다 — 원본 코드가 필요한 칸은 `roleId` 다.
      */
      derive: (row) =>
        row.via === VIA_PERSONAL
          ? label(MSG.USER_EFF_VIA_PERSONAL)
          : row.via !== null && row.via !== ''
            ? row.via
            : label(MSG.USER_EFF_VIA_NONE),
    },
    {
      field: 'grantState',
      header: MSG.USER_EFF_COL_STATE,
      type: 'text',
      width: 90,
      renderer: 'badge',
      tone: STATE_TONE,
      display: stateText,
    },
    { field: 'validFromDt', header: MSG.USER_AUTH_COL_FROM, type: 'date', width: 130, sortable: true },
    { field: 'validToDt', header: MSG.USER_AUTH_COL_TO, type: 'date', width: 130, sortable: true },
    {
      // 역할 부여에는 사유가 없다(sys/menu.md) — 개인 예외 경유일 때만 값이 있다.
      field: 'grantRsn',
      header: MSG.USER_EFF_COL_REASON,
      type: 'text',
      width: 240,
      fill: true,
      cellTooltip: true,
    },
    { field: 'menuCd', header: MSG.USER_AUTH_COL_MENU, type: 'text', width: 160, visible: false },
    { field: 'roleId', header: MSG.USER_ROLE_COL_ROLE, type: 'text', width: 140, visible: false },
  ];
}
