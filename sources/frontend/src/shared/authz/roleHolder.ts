import { useCallback, useMemo, useRef } from 'react';
import { post } from '@/shared/api';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { useGridController, type GridController } from '@/shared/grid/useGridController';
import type { ColumnDef, PageResponse } from '@/shared/grid/types';

/**
 * 역할 보유자 그리드의 어휘 — <b>두 화면이 같은 그리드다</b>(screen/menu/requirements.md).
 *
 * <p>`ROLE_MGMT` 에서는 <i>보유 사용자</i>, `ROLE_AUTH_MGMT` 에서는 <i>영향 인원</i> 이라
 * 부르지만 <b>제목만 다르고 질문은 하나</b>다 — *"이 역할을 가진 사람이 누구인가"*.
 * screen/menu/requirements.md 가 <i>"셋째가 둘째와 같은 그리드"</i> 라고 적었고 §3.7 이 <b>경로까지</b> 하나로
 * 못박았다.
 *
 * <p><b>`shared/` 인 것이 그 결정의 집행이다</b> — frontend/packages.md 은 *"두 번째 화면이 쓰는 순간
 * `shared/` 로 올린다"* 이고, features 끼리 직접 import 하면 <b>한쪽이 다른 쪽의 부품
 * 창고</b>가 된다. 여기 있으면 두 화면이 <b>대등하게</b> 쓴다.
 *
 * <p><b>URL 은 화면이 준다.</b> 호출 URL 은 `features/*&#47;api/endpoints.ts` 에만 두는 것이
 * 규약이고(frontend/packages.md) 그 선언이 곧 `SYS_MENU_API` 시드의 입력이므로(backend/api.md), 여기서 문자열을
 * 들면 <b>시드가 그 매핑을 못 본다</b>. 두 화면이 같은 값을 각자 선언하고 넘기는 것이
 * *경로가 하나* 라는 사실을 <b>두 시드 행</b>으로 만든다.
 */

export type GrantState = 'SCHEDULED' | 'ACTIVE' | 'EXPIRED';

/** 서버 `RoleHolderRow` 와 1:1. <b>읽기 전용이며 저장 대상이 아니다</b>(screen/user/requirements.md 이 고친다). */
export interface RoleHolderRow {
  userId: string;
  userNm: string;
  /** `USE_YN` 과 계정 유효기간만 본다 — 잠금·휴면은 스스로 풀린다(sys/user-role.md). */
  accountUsable: boolean;
  /** **만료도 보여준다** — 지금은 영향이 없지만 다시 유효해질 수 있다(screen/menu/requirements.md). */
  grantState: GrantState;
  validFromDt: string | null;
  validToDt: string | null;
  /** **공집합 판정의 입력 ①** — 유효 권한은 합집합이라 예외가 있으면 차단되지 않는다(backend/security.md). */
  hasPersonalGrant: boolean;
  /** **공집합 판정의 입력 ②** — 확인 문구의 *"다른 역할 없음"* 이 이 값이다(screen/menu/requirements.md). */
  hasOtherRole: boolean;
}

/** 화면이 하단에게 시키는 것 — 조회와 비우기 둘뿐이다(frontend/grid.md 의 세 상태). */
export interface RoleHolders {
  controller: GridController<RoleHolderRow>;
  /** 이 역할의 보유자를 조회한다. <b>행을 고른 그 순간</b> 부른다. */
  readFor: (roleId: string) => Promise<void>;
  /** 빈 상태로 되돌린다 — 선택이 풀렸거나 미저장 신규 행을 골랐다. */
  clear: () => void;
}

/**
 * 컨트롤러를 <b>화면이 든다</b> — 컴포넌트 안에 감추지 않는 것이 결정이다.
 *
 * <p>저장 확인의 셋째 줄(*공집합이 되어 차단될 사람*)을 계산하려면 화면이 그 순간 조회를
 * 걸어야 하고, 선택이 바뀔 때 하단을 비우는 것도 화면의 일이다(frontend/grid.md) — 컨트롤러가
 * 컴포넌트 안에 있으면 그 둘을 위한 <b>두 번째 경로</b>가 생긴다.
 *
 * <h2>고른 역할을 <b>ref 로 든다</b></h2>
 *
 * <b>값으로 두었더니 첫 조회가 언제나 {@code roleId: null} 로 나갔다</b>(2026-08-30 실물 —
 * 서버가 {@code @NotBlank} 로 400 을 냈다). 화면은 행을 고른 <b>그 핸들러 안에서</b>
 * {@code setState} 와 조회를 잇달아 부르는데, 그때 이 훅이 들고 있는 {@code searchParams}
 * 는 <b>아직 이전 렌더의 클로저</b>다 — 상태는 다음 렌더에나 바뀐다.
 *
 * <p>그래서 조회 파라미터는 <b>ref</b> 가 나르고, 화면은 {@link RoleHolders.readFor} 에
 * 값을 직접 넘긴다. {@code CodeMgmtPage} 가 같은 자리에서 내린 결정과 같다 —
 * <i>"행을 고른 바로 그 순간에 하단 조회가 나가야 하므로 상태 갱신을 기다릴 수 없다"</i>.
 *
 * <p><b>페이지 이동에도 ref 가 맞다.</b> 2쪽을 누르면 {@code searchParams} 가 다시 불리는데,
 * 그 사이에 다른 역할을 골랐다면 값 쪽은 <i>어느 렌더의 것인지</i> 를 따져야 한다 —
 * ref 는 언제나 <b>마지막으로 조회한 역할</b>이다.
 *
 * @param url 두 화면이 각자의 `endpoints.ts` 에서 넘긴다 — 같은 값이며 그것이 screen/menu/requirements.md 이다
 */
export function useRoleHolders(menuCd: string, url: string): RoleHolders {
  const columns = useMemo(() => holderColumns(), []);
  const api = useMemo(() => ({ read: { url } }), [url]);
  const roleId = useRef<string | null>(null);
  const searchParams = useCallback(() => ({ roleId: roleId.current }), []);

  const controller = useGridController<RoleHolderRow>({
    menuCd,
    columns,
    api,
    searchParams,
    // 부여를 고치는 곳이 아니다 — 편집을 열면 저장할 곳이 없는 셀이 생긴다(screen/menu/requirements.md).
    editable: false,
  });

  const readFor = useCallback(
    async (id: string) => {
      roleId.current = id;
      // `true` 는 <b>이미 물었다</b> — 읽기 전용이라 버릴 편집이 애초에 없다(frontend/grid.md).
      await controller.read(true);
    },
    [controller],
  );

  const clear = useCallback(() => {
    roleId.current = null;
    controller.setRows([]);
  }, [controller]);

  return { controller, readFor, clear };
}

/** 저장 확인이 본 것 — <b>다 봤는가</b>를 함께 나른다. */
export interface HolderSample {
  holders: RoleHolderRow[];
  /** 서버가 센 전체 보유자 수. `null` 이면 서버가 세지 않았다. */
  total: number | null;
  /** 한 장에 담기지 않았다 — <b>확인 문구가 그 사실을 말해야 한다</b>. */
  truncated: boolean;
}

/**
 * 저장 확인이 쓸 보유자 — <b>한 장이고, 다 못 담으면 그렇다고 말한다</b>.
 *
 * <p>컨트롤러의 {@code fetchAll} 을 쓰지 않는 것은 그것이 <b>지금 걸린 조건</b>으로 돌기
 * 때문이다. 저장 확인이 물어야 하는 것은 <i>사용자가 걸어 둔 필터와 무관하게</i> 이 역할을
 * 가진 사람 전부이며, 조건이 걸린 채로 세면 <b>차단될 사람을 적게 센다</b>.
 *
 * <p><b>한 장이 {@code MAX_SIZE} 다</b>(frontend/grid.md — 상한은 상수다). 처음에는 5000 을 보냈는데
 * 그것이 {@code PageSpec} 의 상한을 넘어 <b>저장 확인이 통째로 400 으로 죽었다</b>
 * (2026-08-30 실물) — 전량 조회의 상한({@code ALL_LIMIT})과 <b>한 페이지의 상한</b>은 다른
 * 수다.
 *
 * <p><b>넘치면 조용히 자르지 않는다.</b> screen/menu/requirements.md 가 <i>영향 인원의 규모</i> 를 미결로 남겼고,
 * 그 답이 나오기 전까지 화면이 할 수 있는 정직한 일은 <b>못 본 사람이 있다고 말하는 것</b>
 * 이다 — 세어 보니 0명인 것과 1000명까지만 세어 0명인 것은 다른 사실이다.
 */
export async function fetchAllHolders(url: string, roleId: string): Promise<HolderSample> {
  const page = await post<PageResponse<RoleHolderRow>>(url, {
    conditions: [],
    sorts: [],
    page: { page: 0, size: HOLDER_SAMPLE_SIZE },
    params: { roleId },
  });
  return {
    holders: page.content,
    total: page.totalElements,
    truncated: page.hasNext || (page.totalElements ?? 0) > page.content.length,
  };
}

/** `PageSpec.MAX_SIZE` 와 같은 수다 — 서버가 그보다 큰 값을 400 으로 거절한다. */
const HOLDER_SAMPLE_SIZE = 1000;

/**
 * <b>공집합이 되는 사람</b> — screen/menu/requirements.md 의 셋째 줄이 세는 것.
 *
 * <p>기준은 <i>"역할 미부여"</i> 가 아니라 <b>유효 권한 공집합</b>이다(backend/security.md) — 개인 예외만으로
 * 일하는 사용자가 정당하게 존재하기 때문이다. 그래서 셋을 함께 본다: 이 역할이 <b>지금
 * 실제로 권한을 주고 있고</b>(부여가 유효), 다른 역할이 없고, 개인 예외도 없다.
 *
 * <p><b>예정·만료는 세지 않는다.</b> 그 사람들은 이 역할에서 지금 아무것도 받고 있지 않으므로
 * 이 변경으로 잃을 것이 없다 — 목록에는 그대로 보이며(다시 유효해질 수 있다) 차단 경고에만
 * 들어가지 않는다.
 */
export function blockedUsers(holders: RoleHolderRow[]): RoleHolderRow[] {
  return holders.filter(
    (holder) => holder.grantState === 'ACTIVE' && !holder.hasOtherRole && !holder.hasPersonalGrant,
  );
}

/**
 * 컬럼 — screen/menu/requirements.md 의 표에 <b>하나를 더한다</b>.
 *
 * <p>표는 <i>사용자 · 부여 상태 · 개인 예외 보유</i> 셋을 적었고 §3.4 가 <i>부여 기간</i> 을
 * 더했다. 여기 <b>다른 역할 보유</b>가 하나 더 서는데, screen/menu/requirements.md 의 확인 문구가
 * *"다른 역할 없음 · 개인 예외 없음"* <b>두 사유를 나란히</b> 내기 때문이다 — 같은 판정의
 * 입력 둘 중 하나만 보여줄 근거가 없다(2026-08-30).
 *
 * <p><b>편집 선언이 하나도 없다.</b> 읽기 전용은 컨트롤러의 {@code editable: false} 가
 * 집행하지만, 컬럼이 스스로도 열지 않는 것이 <i>선언이 곧 허용</i> 이라는 뜻을 지킨다.
 */
function holderColumns(): ColumnDef<RoleHolderRow>[] {
  return [
    { field: 'userNm', header: MSG.ROLE_COL_USER_NM, type: 'text', width: 140, sortable: true },
    { field: 'userId', header: MSG.ROLE_COL_USER_ID, type: 'text', width: 140, sortable: true },
    {
      field: 'accountUsable',
      header: MSG.ROLE_COL_ACCOUNT,
      type: 'text',
      width: 110,
      renderer: 'badge',
      derive: (row) =>
        label(row.accountUsable ? MSG.ROLE_ACCOUNT_USABLE : MSG.ROLE_ACCOUNT_BLOCKED),
      tone: {
        [label(MSG.ROLE_ACCOUNT_USABLE)]: 'ok',
        [label(MSG.ROLE_ACCOUNT_BLOCKED)]: 'muted',
      },
    },
    {
      field: 'grantState',
      header: MSG.ROLE_COL_GRANT_STATE,
      type: 'text',
      width: 100,
      renderer: 'badge',
      /*
        <b>예정 · 유효 · 만료를 구분 표시한다</b> — AUTHZ-13 의 요구다(screen/menu/requirements.md). 만료를
        감추지 않는 것이 요점이며, *지금은 영향이 없지만 다시 유효해질 수 있다*.
      */
      derive: (row) => label(GRANT_LABEL[row.grantState]),
      tone: {
        [label(GRANT_LABEL.SCHEDULED)]: 'warn',
        [label(GRANT_LABEL.ACTIVE)]: 'ok',
        [label(GRANT_LABEL.EXPIRED)]: 'muted',
      },
    },
    {
      field: 'period',
      header: MSG.ROLE_COL_PERIOD,
      type: 'text',
      width: 200,
      filter: false,
      // 양끝 포함이고 `null` 은 제한 없음이다(sys/INDEX.md · sys/menu.md).
      derive: (row) =>
        row.validFromDt === null && row.validToDt === null
          ? label(MSG.ROLE_PERIOD_UNLIMITED)
          : `${row.validFromDt ?? '—'} ~ ${row.validToDt ?? '—'}`,
    },
    {
      field: 'hasPersonalGrant',
      header: MSG.ROLE_COL_PERSONAL,
      type: 'text',
      width: 120,
      renderer: 'badge',
      // <b>공집합 판정의 입력 ①</b> — 개인 예외가 있으면 이 변경이 영향이 없다(backend/security.md).
      derive: (row) => label(row.hasPersonalGrant ? MSG.ROLE_HAS_YES : MSG.ROLE_HAS_NO),
      tone: { [label(MSG.ROLE_HAS_YES)]: 'ok', [label(MSG.ROLE_HAS_NO)]: 'none' },
    },
    {
      field: 'hasOtherRole',
      header: MSG.ROLE_COL_OTHER_ROLE,
      type: 'text',
      width: 120,
      renderer: 'badge',
      // <b>공집합 판정의 입력 ②</b> — 확인 문구의 *"다른 역할 없음"* 이 이 값이다.
      derive: (row) => label(row.hasOtherRole ? MSG.ROLE_HAS_YES : MSG.ROLE_HAS_NO),
      tone: { [label(MSG.ROLE_HAS_YES)]: 'ok', [label(MSG.ROLE_HAS_NO)]: 'none' },
    },
  ];
}

const GRANT_LABEL: Record<GrantState, string> = {
  SCHEDULED: MSG.ROLE_GRANT_SCHEDULED,
  ACTIVE: MSG.ROLE_GRANT_ACTIVE,
  EXPIRED: MSG.ROLE_GRANT_EXPIRED,
};
