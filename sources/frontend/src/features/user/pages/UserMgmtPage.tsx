import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { App } from 'antd';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { useAuthStore } from '@/shared/stores/authStore';
import { accountStatText } from '@/shared/user/accountStat';
import { auditColumns } from '@/shared/grid/auditColumns';
import { DataGrid } from '@/shared/grid/DataGrid';
import { SplitPane } from '@/shared/grid/SplitPane';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow } from '@/shared/grid/rows';
import type { ColumnDef, GridIssue, SelectOption } from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { USER_ENDPOINTS } from '@/features/user/api/endpoints';
import { getRoleCandidates } from '@/features/user/api/userApi';
import { IssuedPasswordModal } from '@/features/user/components/IssuedPasswordModal';
import {
  UserDetailTabs,
  type UserDetailTabsHandle,
} from '@/features/user/components/UserDetailTabs';
import type { IssuedPassword, UserRow } from '@/features/user/types';

/**
 * `USER_MGMT` — screen/user/requirements.md. <b>액션 넷을 모두 갖는 유일한 화면</b>이다(sys/menu.md — `R S E X`).
 *
 * <h2>목록이 곧 상세다</h2>
 *
 * 편집 폼을 두지 않으므로(frontend/grid.md) 이 그리드가 `SYS_USER` 의 모든 컬럼을 갖는다 — 숨김
 * 컬럼도 응답에 들어 있고 그리드 설정에서 켜면 보인다(frontend/grid.md). 그래서 `getDetail` 이 없다.
 *
 * <h2>계정을 못 쓰게 하는 넷을 <b>컬럼이 가른다</b></h2>
 *
 * sys/user-role.md 규칙 3은 넷이 서로 덮지 않아야 한다고 정했다. 그것을 지키는 것은 편집 폼이
 * 아니라 <b>누가 거는 것인가로 컬럼을 가르는 것</b>이다(screen/user/requirements.md) — 관리자가 거는 둘
 * (`USE_YN` · 사용 기간)만 셀이 열리고, 시스템이 거는 셋(`LOCK_YN` · `DORMANT_YN` ·
 * `LOGIN_FAIL_CNT`)은 <b>읽기 전용</b>이며 ①의 버튼이 자기 컬럼만 쓴다.
 *
 * <p><b>읽기 전용 컬럼이 있는 것이 인라인 편집의 약점이 아니라 규칙의 집행 지점이다.</b>
 * 셀 편집을 막으면 *"셀 하나씩 고치다 넷이 뒤섞이는"* 경로가 아예 열리지 않는다.
 *
 * <h2>실행 버튼이 처음 생기는 화면이다</h2>
 *
 * frontend/grid.md 이 *"첫 실행 버튼이 생기는 화면이 `api.actions[]` 를 가져온다"* 고 미뤄 두었던
 * 그것이다. 셋 다 <b>액션은 `SAVE`</b> 인데 버튼이 셋인 것은, 기준이 *버튼이 위험해
 * 보이는가* 가 아니라 <b>우리 테이블의 컬럼을 쓰는가</b>이기 때문이다(screen/user/requirements.md).
 *
 * <h2>디테일 탭 다섯 — 축은 상하다</h2>
 *
 * screen/user/requirements.md 가 정했다. 마스터에 컬럼이 열여덟이라 좌우로 나누면 가로가 모자란다 —
 * 스플리터로 비율을 바꾸고 양쪽 다 접을 수 있다(frontend/grid.md).
 *
 * <p><b>거부할 수 있는 선택이다.</b> 편집이 있는 탭이 둘(보유 역할 · 접속 IP)이라, 미저장
 * 편집을 두고 다른 사용자를 고르면 화면이 묻는다 — 거부권이 없으면 <b>보고 있는 것과 고른
 * 것이 갈리고</b> 그 상태로 저장하면 A 의 역할이 B 에게 나간다(frontend/grid.md · UX-10).
 */

const MENU_CD = 'USER_MGMT';

export function UserMgmtPage() {
  const { modal } = App.useApp();
  const searchForm = useRef<SearchFormHandle>(null);
  const tabs = useRef<UserDetailTabsHandle | null>(null);
  /**
   * 방금 발급된 임시 비밀번호 — <b>이 응답에만 있는 값</b>이다(screen/user/requirements.md).
   *
   * <p>재조회로 다시 얻을 수 없어 모달을 닫으면 사라진다. 상태에 담아 두는 것이 아니라
   * <b>모달이 떠 있는 동안만</b> 들고 있으며, 닫을 때 비운다.
   */
  const [issued, setIssued] = useState<IssuedPassword[]>([]);

  /** 자기 자신에게 할 수 없는 것의 기준 — screen/user/requirements.md. */
  const myUserId = useAuthStore((state) => state.user?.userId ?? '');

  const header = useSearchFormHeader();

  // 매 렌더 새 함수를 넘기지 않는다 — 컨트롤러의 조회·저장 콜백이 전부 새것이 된다.
  const collectConditions = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );

  /*
    역할 후보 — <b>조회조건과 보유 역할 탭이 같은 목록을 본다</b>(screen/user/requirements.md 탭 1).

    `ROLE_MGMT` 의 경로를 부르지 않는다. 그 요청은 <b>역할 관리의 `READ`</b> 를 요구하게
    되고(backend/api.md — 매핑이 경로를 따라간다), 그러면 사용자 관리만 가진 사람이 역할을
    부여할 수 없다. 이 화면이 자기 경로를 갖는 이유가 그것이다.

    `staleTime: Infinity` 인 것은 이 목록이 <b>거의 바뀌지 않고</b> 바뀌는 자리가 다른
    화면이기 때문이다 — `CODE_MGMT` 의 참조 코드 후보와 같은 판단이다(screen/code/requirements.md).
  */
  const roleCandidates = useQuery({
    queryKey: ['user', 'roleCandidates'],
    staleTime: Infinity,
    queryFn: () => getRoleCandidates(),
  });

  const roleOptions = useMemo<SelectOption[]>(
    () =>
      (roleCandidates.data?.content ?? []).map((role) => ({
        value: role.roleId,
        /*
          <b>꺼진 역할도 후보다</b>(sys/menu.md 의 AND — 부여는 되고 판정에서 걸린다). 그것을
          말하지 않으면 <i>줬는데 안 된다</i> 가 되므로 이름 뒤에 코드를 붙여 <b>무엇을
          고르는지</b> 를 보이고, 꺼진 것은 자기 컬럼(`역할 사용`)이 말한다.
        */
        text: `${role.roleNm} (${role.roleId})`,
      })),
    [roleCandidates.data],
  );

  const columns = useMemo(() => buildColumns(myUserId), [myUserId]);
  const searchFields = useMemo(() => buildSearchFields(roleOptions), [roleOptions]);

  /**
   * 저장 확인 <b>앞</b>에 서는 경고 — screen/code/requirements.md 가 연 자리다.
   *
   * <p>건수는 <i>얼마나</i> 를 말할 뿐이라 <b>무엇이 일어나는지</b>를 말하지 못한다.
   * 여기서 말해야 하는 것 둘 — <b>신규 행에는 임시 비밀번호가 발급되고</b>(관리자가 값을
   * 정하지 않으므로 그것을 전할 준비가 필요하다), <b>사용 중지는 다음 로그인부터
   * 막는다</b>(지금 세션은 살아 있다 — screen/user/requirements.md).
   */
  const warnSave = useCallback((rows: GridRow<UserRow>[]): string[] => {
    const lines: string[] = [];
    const created = rows.filter((row) => row.state === 'C').length;
    if (created > 0) {
      lines.push(label(MSG.USER_WARN_NEW_PASSWORD, { count: created }));
    }
    const disabled = rows.filter(
      (row) => row.state === 'U' && row.original?.useYn === true && row.data.useYn === false,
    ).length;
    if (disabled > 0) {
      lines.push(label(MSG.USER_WARN_DISABLE, { count: disabled }));
    }
    return lines;
  }, []);

  const api = useMemo(
    () => ({
      read: { url: USER_ENDPOINTS.getList, emptyNotice: true },
      save: {
        url: USER_ENDPOINTS.save,
        validate: { grid: validateUserIds },
        warn: warnSave,
        /*
          <b>저장이 값을 돌려준다</b> — 신규 계정의 임시 비밀번호다(screen/user/requirements.md). 관리자가
          비밀번호를 정하는 자리를 두지 않은 결과이며, DB 에는 해시가 들어가므로 <b>이
          응답을 놓치면 다시 얻을 수 없다</b>: 재조회는 답을 갖고 있지 않다.

          수정만 한 저장에서는 빈 배열이고, 그때는 모달이 뜨지 않는다.
        */
        onSuccess: (result: unknown) => setIssued(asIssued(result)),
      },
      /*
        선언 순서가 곧 화면 순서다(frontend/grid.md). <b>액션 코드를 적지 않는다</b> — `url` 의
        접두가 그것을 말하고(backend/api.md) 헤더가 `actionOfUrl` 로 뽑아 권한을 본다.

        셋 다 <b>`eligible` 을 두지 않는다.</b> 잠기지 않은 계정에 잠금 해제를 눌러도
        실패가 아니라 <i>이미 이뤄진 상태</i>이며(`UserService#unlock`), 대상을
        좁히면 <b>고른 행과 실행되는 행이 갈려</b> 운영자가 무엇을 골랐는지 헷갈린다.
      */
      actions: [
        {
          key: 'unlock',
          label: MSG.USER_ACTION_UNLOCK,
          url: USER_ENDPOINTS.saveUnlock,
          toTargets,
        },
        {
          key: 'dormant',
          label: MSG.USER_ACTION_DORMANT,
          url: USER_ENDPOINTS.saveDormantRelease,
          toTargets,
        },
        {
          key: 'resetPwd',
          label: MSG.USER_ACTION_RESET_PWD,
          url: USER_ENDPOINTS.savePasswordReset,
          toTargets,
          // 발급된 값은 <b>이 응답에만</b> 있다 — 재조회로 다시 얻을 수 없다(screen/user/requirements.md).
          onSuccess: (result: unknown) => setIssued(asIssued(result)),
        },
      ],
    }),
    [warnSave],
  );

  const master = useGridController<UserRow>({
    menuCd: MENU_CD,
    columns,
    api,
    params: collectConditions,
    /*
      <b>`canAdd` 를 두지 않는다</b> — 막을 이유가 없다(frontend/grid.md). 건수 상한도 선행 저장도
      없고, 계정을 만드는 것은 이 화면의 일이다(USER-01).
    */
    addRow: {
      defaults: () => ({
        userId: '',
        userNm: '',
        email: '',
        /*
          <b>신규 행의 상태는 `NORMAL` 이다.</b> 서버가 계산하는 값이라 저장 뒤에 다시
          오지만, 비워 두면 그 칸이 <i>빈 채로</i> 보이고 사용자는 무엇을 채워야 하나
          묻는다 — 채울 수 없는 칸이다(읽기 전용이다).
        */
        accountStat: 'NORMAL',
        // 켜 두는 것이 정상이다 — 만들자마자 못 들어오는 계정을 기본으로 둘 이유가 없다.
        useYn: true,
        validFromDt: null,
        validToDt: null,
        lastLoginDtm: null,
        localeCd: 'ko',
        /*
          시스템 축 셋은 <b>꺼진 상태로</b> 시작한다. `null` 로 두지 않는 것은 이것들이
          `NOT NULL` 컬럼이고 <i>세어 보지 않은 값</i> 이 아니기 때문이다 —
          `RoleRow` 의 건수 셋이 `null` 인 것과 갈리는 자리다(screen/menu/requirements.md 주석 8).
        */
        lockYn: false,
        lockDtm: null,
        loginFailCnt: 0,
        dormantYn: false,
        // 저장하면 서버가 임시 비밀번호를 발급하며 `'Y'` 가 된다(screen/user/requirements.md).
        pwdInitYn: false,
        pwdChgDtm: null,
        regId: null,
        regDtm: null,
        modId: null,
        modDtm: null,
      }),
    },
    toSaveRow: (row) => ({
      rowState: row.state,
      userId: row.data.userId,
      userNm: row.data.userNm,
      email: row.data.email,
      useYn: row.data.useYn,
      validFromDt: row.data.validFromDt,
      validToDt: row.data.validToDt,
      localeCd: row.data.localeCd,
      /*
        <b>시스템 축 셋을 보내지 않는다.</b> 읽기 전용은 화면에서만 읽기 전용이고 요청
        본문은 조작할 수 있다(sys/menu.md 원칙 P1) — 서버의 `UserSaveRow` 에도 그 필드가
        없어서, 보내도 받을 자리가 없다.
      */
    }),
  });

  const issuedDone = useCallback(() => setIssued([]), []);

  /**
   * <b>화면이 묻는다</b> — 그리드가 스스로 묻는 것과 같은 문구이며(frontend/grid.md) 여기로 올라온
   * 이유는 <i>답을 알아야 선택을 받아들일지 정할 수 있기</i> 때문이다.
   */
  const confirmDiscard = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        modal.confirm({
          title: label(MSG.GRID_DISCARD_TITLE),
          content: label(MSG.GRID_DISCARD_BODY),
          okText: label(MSG.GRID_CONFIRM_OK),
          cancelText: label(MSG.COMMON_CANCEL),
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      }),
    [modal],
  );

  /**
   * 사용자 선택 — frontend/grid.md 의 상태 셋을 그대로 편다(screen/user/requirements.md).
   *
   * <p><b>미저장 신규 행은 잠긴 상태</b>다. `SYS_USER_ROLE` 이 `SYS_USER` 를 FK 로
   * 참조하므로(sys/user-role.md) 부모가 저장되기 전에는 자식을 만들 수 없다 — <i>신규 사용자에게
   * 역할을 주는 것은 2단계</i>이며, 한 번에 끝나지 않는 것이 그 규칙의 대가다.
   */
  const selectUser = useCallback(
    async (row: GridRow<UserRow> | null): Promise<boolean> => {
      if (tabs.current?.dirty() && !(await confirmDiscard())) {
        return false;
      }
      const handle = tabs.current;
      if (!handle) return true;
      if (!row) {
        await handle.select(null, false);
      } else if (row.state === 'C') {
        await handle.select(null, true);
      } else {
        await handle.select(row.data.userId, false);
      }
      return true;
    },
    [confirmDiscard],
  );

  /**
   * 마스터 조회는 <b>디테일을 리셋한다</b> — frontend/grid.md.
   *
   * <p>조회는 목록을 통째로 바꾸므로 이전에 보던 행이 결과에 없을 수도 있다. 남아 있으면
   * <b>다른 사람의 데이터를 그 사람 것으로</b> 보게 된다 — 그래서 자동 선택도 하지 않는다.
   */
  const readMaster = useCallback(async () => {
    await tabs.current?.select(null, false);
    await master.read();
  }, [master]);

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
        {/* 축은 상하다 — 마스터에 컬럼이 열여덟이라 좌우로는 가로가 모자란다(screen/user/requirements.md). */}
        <SplitPane
          storageKey="user"
          first={(collapsed, expand) => (
            <DataGrid<UserRow>
              title={MSG.USER_GRID_TITLE}
              menuCd={MENU_CD}
              gridId="master"
              controller={master}
              onSelect={selectUser}
              collapsed={collapsed}
              onExpand={expand}
              /*
                <b>삭제 컬럼이 없다</b>(screen/user/requirements.md) — `SYS_USER` 는 물리 삭제를 하지 않는다
                (sys/user-role.md · USER-02). 못 쓰게 하는 수단은 `USE_YN='N'` 이고 그것은 셀 편집이다.
              */
            />
          )}
          second={(collapsed, expand) => (
            <UserDetailTabs
              menuCd={MENU_CD}
              myUserId={myUserId}
              roleOptions={roleOptions}
              /*
                접히면 <b>탭바가 사라지고 활성 탭의 제목 한 줄</b>만 남는다(frontend/grid.md) —
                그리드 하나짜리 하단과 같은 모양이다. 위 마스터가 같은 쌍을 받는다.
              */
              collapsed={collapsed}
              onExpand={expand}
              /*
                탭 다섯의 제목이 <b>누구의 것인지</b> 를 말한다(frontend/grid.md 의 `titleSuffix`).
                마스터의 컨트롤러를 그대로 넘기며, 읽는 것은 고른 행 하나다 — 하단이
                선택을 따로 들고 있으면 그 둘이 갈리는 날이 온다.
              */
              master={master}
              handleRef={tabs}
            />
          )}
        />
      </div>

      <IssuedPasswordModal issued={issued} onClose={issuedDone} />
    </FillColumn>
  );
}

/**
 * 대상 행 → <b>{@code USER_ID} 목록</b>.
 *
 * <p>기본값(행 데이터 그대로)을 쓰지 않는 이유는 서버가 <b>키만 받기</b> 때문이다
 * ({@code UserTargetRequest}) — 행 전체를 보내면 서버가 <b>쓰지 않을 값을 받는 것처럼</b>
 * 보이고, 실제로는 Jackson 이 객체를 문자열에 넣지 못해 <i>요청 본문을 해석할 수 없습니다</i>
 * 로 떨어진다(2026-08-30 실물).
 */
const toTargets = (rows: GridRow<UserRow>[]) => rows.map((row) => row.data.userId);

/**
 * 서버가 준 것이 무엇이든 <b>모양을 확인하고</b> 받는다 — 저장·실행의 응답은 `unknown` 이다.
 *
 * <p>`post` 가 봉투를 벗겨 주므로(`shared/api/request`) 여기 오는 것은 `data` 그 자체다.
 * 배열이 아니면 <b>조용히 빈 배열</b>인데, 그것이 곧 *모달을 띄우지 않는다* 이며 —
 * 수정만 한 저장이 정확히 그 경우다.
 */
function asIssued(result: unknown): IssuedPassword[] {
  return Array.isArray(result) ? (result as IssuedPassword[]) : [];
}

// ── 컬럼 (screen/user/requirements.md) ────────────────────────────────────────────────

/**
 * 컬럼 열넷 — <b>표시 다섯, 숨김 아홉</b>.
 *
 * <p>`○` 로 적힌 것이 기본 숨김이며(frontend/grid.md) 그리드 설정에서 켠다(frontend/grid.md). <b>이 화면에
 * `hidden` 컬럼은 없다</b> — 운영자가 켜서 보면 안 되는 컬럼이 여기에는 없다.
 *
 * <p><b>비밀번호 컬럼을 두지 않는다.</b> 관리자는 임시 비밀번호를 <b>발급</b>할 뿐 값을
 * 정하지 않는다(backend/security.md · AUTH-07) — 편집 가능한 자리를 두면 <b>관리자가 아는 비밀번호</b>가
 * 생긴다.
 */
function buildColumns(myUserId: string): ColumnDef<UserRow>[] {
  return [
    {
      field: 'userId',
      header: MSG.USER_COL_USER_ID,
      type: 'text',
      width: 160,
      pinned: 'left',
      sortable: true,
      /*
        PK 다 — <b>신규 행에서만</b> 열리고, 필수이고, 헤더에 필수 표시가 붙는다(frontend/grid.md).
        자연키라 등록 후 수정 불가이며(sys/user-role.md), 고치려면 지우고 다시 만드는데 <b>계정은
        지울 수 없으므로</b>(sys/user-role.md) 한 번 정하면 끝이다.
      */
      pk: true,
    },
    {
      field: 'userNm',
      header: MSG.USER_COL_USER_NM,
      type: 'text',
      width: 140,
      sortable: true,
      required: true,
      // 평문이다 — 참조키를 담으면 이름 정렬·LIKE 검색이 막힌다(sys/user-role.md).
      editable: true,
    },
    {
      field: 'email',
      header: MSG.USER_COL_EMAIL,
      type: 'text',
      width: 220,
      sortable: true,
      /*
        <b>필수인 이유가 발송처</b>다(AUTH-07). 관리자가 발급한 임시 비밀번호를 전할 곳이
        없으면 그 계정은 만들어지자마자 들어올 수 없다 — sys/user-role.md 의 컬럼 정의는 `NULL` 을
        허용하지만 <b>이 화면이 만드는 계정</b>에는 필수다.
      */
      required: true,
      editable: true,
    },
    {
      field: 'accountStat',
      header: MSG.USER_COL_STAT,
      headerTooltip: MSG.USER_COL_STAT_TIP,
      /*
        <b>타입이 `code` 가 아니라 `text` 다</b>(screen/user/requirements.md) — `code` 는 공통코드 값을 위한
        것이고(frontend/packages.md) 이것은 서버가 계산하는 파생값이다.

        <b>정렬을 켜지 않는다.</b> SQL 이 모르는 값이라 `ORDER BY` 대상이 아니고, 켜면
        서버 화이트리스트에 없어 400 이다(frontend/grid.md · screen/user/requirements.md 의 미결).
      */
      type: 'text',
      width: 100,
      renderer: 'badge',
      tone: {
        NORMAL: 'ok',
        DISABLED: 'muted',
        EXPIRED: 'warn',
        LOCKED: 'err',
        DORMANT: 'warn',
      },
      /*
        <b>`derive` 가 아니라 `display` 다</b>(2026-08-30). 값을 라벨로 바꿔 넣으면
        <b>`tone` 조회가 라벨 문자열로</b> 가서 색이 하나도 칠해지지 않는다 — 맵의 키는
        코드다. 값은 <b>원본 코드로 남기고</b> 배지의 글자만 라벨로 바꾼다(frontend/grid.md ·
        §5.4.1): 그래야 정렬·필터·엑셀이 전부 코드를 본다.
      */
      display: accountStatText,
    },
    {
      field: 'useYn',
      header: MSG.USER_COL_USE_YN,
      type: 'ynFlag',
      width: 90,
      sortable: true,
      /*
        <b>관리자가 건다</b>(screen/user/requirements.md) — 그래서 셀이 열린다.

        <b>자기 자신만 잠근다</b>(screen/user/requirements.md). 컬럼 전체가 아니라 <b>특정 행의 특정
        컬럼</b>만 막는 첫 자리이며, 감추지 않고 <b>보이되 막고 사유를 붙인다</b> —
        이것은 권한이 아니라 <b>대상 제약</b>이라 frontend/tabs.md(권한 없는 버튼은 감춘다)의
        예외가 아니라 <b>축이 다른 것</b>이다.
      */
      editable: (row) =>
        row.userId === myUserId
          ? { ok: false, message: label(MSG.USER_SELF_DISABLE) }
          : true,
    },
    {
      field: 'validFromDt',
      header: MSG.USER_COL_VALID_FROM,
      type: 'date',
      width: 120,
      sortable: true,
      editable: true,
      // 두 컬럼에 걸친 조건이라 셀 하나를 보는 검증으로는 표현되지 않는다 — 아래 `validate`.
      validate: (value, row) => periodIssue(value as string | null, row.validToDt),
    },
    {
      field: 'validToDt',
      header: MSG.USER_COL_VALID_TO,
      type: 'date',
      width: 120,
      sortable: true,
      editable: true,
      validate: (value, row) => periodIssue(row.validFromDt, value as string | null),
    },
    {
      field: 'lastLoginDtm',
      header: MSG.USER_COL_LAST_LOGIN,
      type: 'dateTime',
      width: 160,
      sortable: true,
    },
    {
      field: 'localeCd',
      header: MSG.USER_COL_LOCALE,
      type: 'code',
      width: 100,
      visible: false,
      editable: true,
      editor: 'select',
      /*
        <b>공통코드가 아니라 상수다.</b> 값에 따라 프로세스가 갈리는 코드는 소스가 값을
        가져야 한다(sys/code.md) — 지원 언어를 늘리는 것은 번들·메시지·`src/locales` 를 함께
        건드리는 일이라(90) 코드 행 하나로 되지 않는다.
      */
      options: LOCALE_OPTIONS,
    },
    /*
      ── 시스템 축 — 전부 <b>읽기 전용</b>이다(screen/user/requirements.md) ──────────────

      `editable` 을 적지 않는 것이 곧 잠그는 것이다(frontend/grid.md — 편집은 명시해야 열린다).
      푸는 것은 ①의 버튼이며 <b>그 API 가 자기 컬럼만 쓴다</b>.
    */
    {
      field: 'lockYn',
      header: MSG.USER_COL_LOCK_YN,
      type: 'ynFlag',
      width: 90,
      visible: false,
      sortable: true,
    },
    {
      field: 'lockDtm',
      header: MSG.USER_COL_LOCK_DTM,
      type: 'dateTime',
      width: 160,
      visible: false,
      sortable: true,
    },
    {
      field: 'loginFailCnt',
      header: MSG.USER_COL_FAIL_CNT,
      type: 'number',
      width: 100,
      visible: false,
      sortable: true,
    },
    {
      field: 'dormantYn',
      header: MSG.USER_COL_DORMANT_YN,
      type: 'ynFlag',
      width: 80,
      visible: false,
      sortable: true,
    },
    {
      field: 'pwdInitYn',
      header: MSG.USER_COL_PWD_INIT,
      type: 'ynFlag',
      width: 110,
      visible: false,
      sortable: true,
    },
    {
      field: 'pwdChgDtm',
      header: MSG.USER_COL_PWD_CHG,
      type: 'dateTime',
      width: 160,
      visible: false,
      sortable: true,
    },
    // 감사 4컬럼 — sys/INDEX.md.
    ...auditColumns<UserRow>({ sortable: true }),
  ];
}

const LOCALE_OPTIONS: SelectOption[] = [
  { value: 'ko', text: label(MSG.USER_LOCALE_KO) },
  { value: 'en', text: label(MSG.USER_LOCALE_EN) },
];

/** <b>양끝 포함</b>이라 같은 날은 통과다 — sys/INDEX.md. 서버도 같은 것을 본다(frontend/grid.md). */
function periodIssue(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  return from > to ? label(MSG.USER_PERIOD_REVERSED) : null;
}

// ── 조회조건 (screen/user/requirements.md) ────────────────────────────────────────────

/**
 * 여덟 — screen/user/requirements.md 의 표 그대로다.
 *
 * <p><b>기본값을 가진 칸이 하나도 없다</b>(2026-08-31). 계정 상태가 한동안 *사용중* 셋으로
 * 미리 걸려 있었는데, 그러면 첫 조회가 <b>이미 거른 목록</b>인데도 무엇으로 걸렀는지가
 * 폼을 펼쳐야 보인다 — 계정을 끈 뒤 <i>왜 안 보이나</i> 를 확인하러 오는 동선에서 <b>방금
 * 끈 그 계정이 목록에 없다</b>. 거르는 것은 사용자가 고른다.
 *
 * <p><b>역할 만료 예정이 숫자 칸이 아니다.</b> 파생 조건은 부등호를 받지 못하므로
 * (backend/api.md · `FieldSpec#javaType`) *N일 이내* 라는 뜻을 서버의 번역 함수가 갖는다 —
 * 그래서 후보 콤보이고, 그 김에 screen/user/requirements.md 의 *기본값 미결* 이 **기본값 없음**으로 닫힌다.
 */
function buildSearchFields(roleOptions: SelectOption[]): SearchField[] {
  return [
    {
      field: 'userId',
      label: MSG.USER_SEARCH_USER_ID,
      type: 'text',
      // 앞 일치가 기본이다 — PK 인덱스를 타는 유일한 형태다(screen/user/requirements.md).
      op: 'startsWith',
      ops: ['eq', 'startsWith', 'contains'],
    },
    {
      field: 'userNm',
      label: MSG.USER_SEARCH_USER_NM,
      type: 'text',
      op: 'contains',
      ops: ['eq', 'startsWith', 'contains', 'endsWith'],
    },
    {
      field: 'email',
      label: MSG.USER_SEARCH_EMAIL,
      type: 'text',
      op: 'contains',
      ops: ['eq', 'startsWith', 'contains', 'endsWith'],
    },
    {
      /*
        <b>화면이 보내는 값과 SQL 컬럼이 1:1 이 아니다</b>(screen/user/requirements.md) — 서버가 다섯 값을 네
        컬럼의 조건으로 번역한다. backend/api.md 가 *"와이어의 문제가 아니라 화이트리스트의
        문제"* 로 답한 그 자리이며, 로그인 이력의 결과 묶음(screen/log/access/requirements.md)에 이은 셋째다.
      */
      field: 'accountStat',
      label: MSG.USER_SEARCH_STAT,
      type: 'select',
      op: 'in',
      ops: ['in'],
      options: [
        { value: 'NORMAL', text: label(MSG.USER_STAT_NORMAL) },
        { value: 'DISABLED', text: label(MSG.USER_STAT_DISABLED) },
        { value: 'EXPIRED', text: label(MSG.USER_STAT_EXPIRED) },
        { value: 'LOCKED', text: label(MSG.USER_STAT_LOCKED) },
        { value: 'DORMANT', text: label(MSG.USER_STAT_DORMANT) },
      ],
      /*
        <b>비워 둔다</b>(2026-08-31). 한동안 기본이 *사용중* 셋(`NORMAL`+`LOCKED`+`DORMANT`)
        이었고 근거는 <i>물리 삭제가 없어 미사용 계정이 영구 누적된다</i> 였다 — 그런데
        누적되는 것은 <b>미사용 계정만이 아니다</b>: 기본이 걸려 있으면 첫 조회가 이미
        <b>거른 목록</b>인데, 조건 칸에 값이 있다는 것을 보려면 폼을 펼쳐야 한다(frontend/tabs.md 의
        조건 수 표시가 그것을 세지만, 그 숫자가 <i>무엇으로 걸렀나</i> 는 말하지 않는다).

        <b>퇴사자를 찾는 일이 예외적인 일이 아니다.</b> 계정을 끈 뒤 <i>왜 안 보이나</i> 를
        확인하러 오는 것이 이 화면의 흔한 동선이고, 그때 <b>방금 끈 그 계정이 목록에
        없다</b>. 거르는 것은 사용자가 고르게 두고, 화면은 <b>있는 것을 다 보이는 데서</b>
        시작한다.
      */
    },
    {
      field: 'roleId',
      label: MSG.USER_SEARCH_ROLE,
      type: 'select',
      op: 'eq',
      ops: ['eq'],
      /*
        <b>후보가 공통코드가 아니다</b> — 역할은 `SYS_ROLE` 의 행이고 운영 중에 늘어난다.
        `grpCd` 도 상수 배열도 쓸 수 없는 첫 칸이며, 그래서 화면이 조회해서 채운다
        (`getRoleCandidates`). <b>보유 역할 탭과 같은 목록</b>이다 — 같은 후보를 두 곳이
        따로 물으면 그 둘이 갈리는 날이 온다(screen/user/requirements.md 탭 1).
      */
      options: roleOptions,
    },
    {
      field: 'roleExpiringInDays',
      label: MSG.USER_SEARCH_ROLE_EXPIRING,
      type: 'select',
      op: 'eq',
      ops: ['eq'],
      options: [7, 14, 30, 60, 90].map((days) => ({
        value: String(days),
        text: label(MSG.USER_SEARCH_DAYS, { days }),
      })),
    },
    /*
      <b>기간 둘은 비워 둔다</b>(2026-08-30 · screen/user/requirements.md — 기본값이 없다). 적지 않으면 폼이
      시스템 기본 기간으로 채우는데, 그것은 <b>기간이 부하의 상한인 화면</b>의 규약이고
      (screen/log/access/requirements.md) 여기 둘은 <b>선택 필터</b>다.

      미리 채우면 <b>한 번도 로그인하지 않은 계정이 첫 조회에서 통째로 빠진다</b> — 그리고
      그 계정들이야말로 이 화면에서 찾을 일이 많다.

      <b>연산자가 셋이다</b>(2026-08-31 — 범위 · 이상 · 이하). 이 둘이 `gte`·`lte` 를 처음
      요구한 칸이며, 폼의 기본이 `between` 하나인 것은 그대로다(frontend/search-form.md — 여는 것이 선언
      이어야 이력 화면이 빠뜨렸을 때 덜 위험한 쪽으로 떨어진다).

      <b>선택 필터라 열 수 있다.</b> 여기서 실제로 묻는 것이 *이 날짜 이후로 한 번도 안
      들어온 계정* 이고 그것이 `lte` 다 — 범위로 쓰려면 반대쪽 끝에 <b>사람이 아무 값이나</b>
      넣어야 하며, 그 값이 곧 조건이 되어 <i>묻지 않은 것을 거른다</i>. 기간 상한 검사가
      단측 조건을 그대로 통과하는 것은 <b>이 화면에서는 문제가 아니다</b>: `SYS_USER` 는
      계정 수만큼이지 이력만큼이 아니고, 조건을 아예 비운 조회가 이미 기본이다.
    */
    {
      field: 'lastLoginDtm',
      label: MSG.USER_SEARCH_LAST_LOGIN,
      type: 'dateRange',
      op: 'between',
      ops: ['between', 'gte', 'lte'],
      defaultValue: '',
    },
    {
      field: 'regDtm',
      label: MSG.USER_SEARCH_REG_DTM,
      type: 'dateRange',
      op: 'between',
      ops: ['between', 'gte', 'lte'],
      defaultValue: '',
    },
  ];
}

// ── 검증 (frontend/grid.md 의 3층) ─────────────────────────────────────────

/** 같은 그리드 안의 중복은 클라이언트가 판정할 수 있다. DB 에 이미 있는 값은 서버다. */
function validateUserIds(rows: GridRow<UserRow>[]): GridIssue[] {
  const issues: GridIssue[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const key = row.data.userId?.trim() ?? '';
    if (key === '') continue;
    if (seen.has(key)) {
      issues.push({ rowId: row.id, field: 'userId', message: label(MSG.USER_DUPLICATE) });
    }
    seen.add(key);
  }
  return issues;
}
