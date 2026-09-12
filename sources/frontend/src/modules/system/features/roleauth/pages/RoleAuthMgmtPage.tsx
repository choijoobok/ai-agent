// @feat FEAT-502
import { useCallback, useMemo, useRef, useState } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { App } from 'antd';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { ACTIONS, hasPermission, type Action } from '@/shared/authz/permission';
import { useAuthStore } from '@/shared/stores/authStore';
import { DataGrid } from '@/shared/grid/DataGrid';
import { SplitPane } from '@/shared/grid/SplitPane';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow } from '@/shared/grid/rows';
import type {
  ColumnDef,
  GridButtonControl,
  TitleSuffixSpec,
} from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import type { TreeGridHandle } from '@/shared/tree/types';
import { ROLE_AUTH_ENDPOINTS } from '@/modules/system/features/roleauth/api/endpoints';
import { getRoleAuthTree, saveRoleAuth } from '@/modules/system/features/roleauth/api/roleAuthApi';
import { AuthTree } from '@/modules/system/features/roleauth/components/AuthTree';
import { RoleHolderGrid } from '@/shared/authz/RoleHolderGrid';
import { blockedUsers, fetchAllHolders, useRoleHolders } from '@/shared/authz/roleHolder';
import type { RoleAuthGrant, RoleAuthTreeRow, RolePickRow } from '@/modules/system/features/roleauth/types';

/**
 * `ROLE_AUTH_MGMT` — screen/admin/system/role-auth/requirements.md. <b>저장 대상은 트리뿐이다.</b>
 *
 * <p>screen/user/requirements.md 의 개인 예외와 <b>같은 컴포넌트</b>이며 여기는 <b>덜어 내기만</b> 한다.
 * 거기는 *"목록이 원본이고 트리는 그 투영"* 이었지만 `SYS_ROLE_MENU_AUTH` 에는 기간도 사유도
 * 없으므로(sys/menu.md) <b>넣을 것이 없어 트리가 전부</b>다 — 하단은 <b>영향 인원</b>이고
 * <b>읽기 전용</b>이다.
 *
 * <h2>화면이 셋으로 나뉜다 — 스플리터 둘</h2>
 *
 * 좌우(역할 목록 ↔ 권한 트리) 위에 상하(위 ↔ 영향 인원)가 있다(frontend/grid.md). <b>좌우 축의 첫
 * 실물</b>이며, 역할 목록은 컬럼이 셋이라 위아래로 두면 가로 공간의 대부분이 빈다.
 *
 * <h2>`READ` 는 나머지 셋의 전제다 — 불변식 하나</h2>
 *
 * *다른 액션이 하나라도 켜져 있으면 `READ` 가 켜져 있다*(screen/user/requirements.md). <b>규칙 둘이 아니라
 * 불변식 하나</b>이며 양방향이 거기서 나온다 — `READ` 를 끄면 나머지도 함께 꺼지고,
 * `READ` 가 꺼진 채 다른 액션을 켜면 `READ` 도 함께 켜진다. <b>둘 다 조용히 하지 않는다.</b>
 *
 * <h2>메뉴명은 거르지 않고 찾아간다</h2>
 *
 * screen/admin/system/role-auth/requirements.md 은 메뉴명을 *(트리 조회 조건)* 으로 적었지만 <b>거를 수 없다</b>. 걸러 내려보내면
 * 폴더의 파생 3-state 가 <b>보이는 자식만으로</b> 요약하는데, 그 값은 저장 전 편집에
 * 반응해야 하므로(§2.4 — `SAVE` 를 켜면 `READ` 열의 요약이 바뀐다) <b>자손 전부가 화면에
 * 있어야</b> 다시 계산된다. 그래서 `MENU_TREE`(screen/admin/system/role-auth/requirements.md)와 <b>같은 어휘</b>를 쓴다 —
 * 강조하고 <b>그 경로를 펼치며</b>, 첫 일치로 스크롤한다.
 *
 * <p><b>칸은 트리 ①에 있다</b>(2026-08-31). 브레드크럼 슬롯에 두었더니 값이 <b>한 커밋
 * 늦게</b> 도착해 한글이 두 번 입력됐고, 자리도 <i>조회조건 숨기기</i> 옆이라 무엇을
 * 검색하는지가 화면에 없었다 — screen/user/requirements.md 에서 겪은 그것이며 세 트리 화면이 같은 구조였다.
 */

const MENU_CD = 'ROLE_AUTH_MGMT';

export function RoleAuthMgmtPage() {
  const { modal, message } = App.useApp();
  const permissions = useAuthStore((state) => state.permissions);
  const canSave = hasPermission(permissions, MENU_CD, 'SAVE');

  const searchForm = useRef<SearchFormHandle>(null);
  const tree = useRef<TreeGridHandle>(null);
  const [role, setRole] = useState<RolePickRow | null>(null);

  /**
   * <b>사람이 만진 메뉴만</b> 든다 — 서버가 준 것을 통째로 복사해 두지 않는다.
   *
   * <p>처음에는 조회 결과를 상태로 옮겨 담았는데, 그러려면 <b>{@code queryFn} 안에서
   * {@code setState}</b> 를 해야 했고 React 가 <i>다른 컴포넌트를 그리는 중에 상태를
   * 바꾼다</i> 고 경고했다(2026-08-30 실물). 조회 결과는 <b>이미 상태다</b> — 그것을 한 벌 더
   * 두면 <i>둘 중 어느 것이 진짜인가</i> 라는 질문이 생긴다.
   *
   * <p>그래서 여기 담는 것은 <b>덮어쓸 것</b>뿐이고, 화면이 쓰는 값은 조회 결과 위에 이것을
   * 얹어 <b>계산</b>한다. 저장 뒤에 비우면 그것으로 <i>미저장 없음</i> 이 되고, 재조회가
   * 늦게 도착해도 <b>덮어쓸 것이 없으니</b> 어긋나지 않는다.
   */
  const [edits, setEdits] = useState<ReadonlyMap<string, ReadonlySet<Action>>>(new Map());

  const header = useSearchFormHeader();
  const [term, setTerm] = useState('');

  const holders = useRoleHolders(MENU_CD, ROLE_AUTH_ENDPOINTS.getAffectedUsers);

  // ── 좌 — 역할 목록 (screen/admin/system/role-auth/requirements.md) ────────────────────────────────────

  const collectConditions = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );
  const roleColumns = useMemo(() => buildRoleColumns(), []);
  const roleApi = useMemo(
    () => ({ read: { url: ROLE_AUTH_ENDPOINTS.getList, emptyNotice: true } }),
    [],
  );

  const roles = useGridController<RolePickRow>({
    menuCd: MENU_CD,
    columns: roleColumns,
    api: roleApi,
    params: collectConditions,
    /*
      <b>읽기 전용이다</b>(screen/admin/system/role-auth/requirements.md) — 생성·비활성화·삭제는 `ROLE_MGMT` 의 일이므로 행 추가
      버튼도 삭제 컬럼도 없다(frontend/grid.md). `addRow` 를 선언하지 않는 것이 그 집행이다.
    */
    editable: false,
  });

  // ── 우 — 권한 트리 (screen/admin/system/role-auth/requirements.md) ────────────────────────────────────

  /**
   * <b>`useGridController` 가 아니라 `useQuery` 다.</b> 저것은 조건·정렬·페이징을 들고 있는데
   * 트리에는 <b>하나도 없다</b>(screen/user/requirements.md) — 쓰면 절반이 죽은 채로 붙어 있게 되고, 다음 사람이
   * *왜 여기서만 안 되나* 를 묻는다. `MENU_TREE` 와 같은 판단이다.
   *
   * <p>{@code enabled} 가 선택 여부다 — 역할을 고르기 전에는 요청이 나가지 않는다.
   */
  const treeQuery = useQuery({
    queryKey: ['roleAuthTree', role?.roleId ?? null],
    queryFn: role === null ? skipToken : () => getRoleAuthTree(role.roleId),
  });
  const rows = useMemo(() => treeQuery.data?.content ?? [], [treeQuery.data]);

  /** 서버 스냅샷 — <b>미저장 여부와 저장 건수</b>가 이것과의 차이다. */
  const original = useMemo(() => toGrantMap(rows), [rows]);

  /** 화면이 그리는 값 — <b>서버 스냅샷 위에 사람이 만진 것을 얹는다</b>. */
  const granted = useMemo<ReadonlyMap<string, ReadonlySet<Action>>>(() => {
    if (edits.size === 0) return original;
    const merged = new Map<string, ReadonlySet<Action>>(original);
    edits.forEach((held, menuCd) => merged.set(menuCd, held));
    return merged;
  }, [original, edits]);

  /**
   * 정의된 조합만 센다 — <b>고아 부여는 화면이 표현하지 못한다</b>(screen/user/requirements.md).
   *
   * <p>API 가 사라져 미정의가 된 부여는 셀이 `—` 라 켜고 끌 수 없고, 저장 페이로드에도
   * 실리지 않는다. 그것을 차이에 넣으면 <b>아무것도 안 만졌는데 미저장</b>이 된다 —
   * 서버는 정의된 조합 안에서만 지우므로 그 행은 그대로 남는다.
   */
  const diff = useMemo(() => countDiff(rows, original, granted), [rows, original, granted]);
  const dirty = diff.added > 0 || diff.removed > 0;
  /**
   * 미저장 변경이 있는 메뉴들 — 메뉴명 옆의 `✎` 다(2026-09-01 요청 · screen/user/requirements.md 와 같은 표시).
   *
   * <p><b>건수와 같은 판정에서 나온다</b>({@link countDiff}) — 저장 확인의 <i>추가 N · 삭제
   * M</i> 과 트리의 표시가 갈리면 <b>어느 쪽이 맞는지 알 수 없다</b>. 그래서 세는 함수가
   * 메뉴 집합까지 함께 낸다: 규칙을 두 번 적으면 정의된 조합만 센다는 예외(아래 주석)를
   * 한쪽만 알게 된다.
   *
   * <p><b>구조 노드에는 붙지 않는다.</b> 폴더의 칸은 파생 3-state 라 고칠 수 있는 값이 없고,
   * 자손이 고쳐졌다고 폴더에 표시를 올리면 <i>접힌 트리에서 무엇이 바뀌었는지</i> 를
   * 말하는 다른 규칙이 하나 더 생긴다 — 개인 예외 화면도 같다.
   */
  const dirtyMenus = diff.menus;

  /**
   * 스위치 하나 — <b>불변식이 함께 돈다</b>(screen/user/requirements.md).
   *
   * <p><b>자동은 줄이는 쪽으로만 연쇄한다.</b> `READ` 를 켠다고 나머지가 켜지지는 않는다 —
   * 끄는 것은 축소라 안전하고 켜는 것은 확장이라 명시해야 한다. 다른 액션을 켤 때 `READ` 가
   * 따라 켜지는 것은 <b>그 조작 자체가 이미 확장의 의사표시</b>이기 때문이다.
   *
   * <p><b>조용히 하지 않는다.</b> 무엇이 함께 켜졌는지·꺼졌는지를 낸다 — 알리지 않으면
   * 관리자는 저장 확인의 건수를 보고서야 알게 되고, 그때는 무엇 때문인지 알 수 없다.
   */
  const toggle = useCallback(
    (menuCd: string, action: Action, next: boolean) => {
      const row = rows.find((candidate) => candidate.menuCd === menuCd);
      if (!row) return;

      /*
        <b>갱신 함수 안에서 알리지 않는다</b>(2026-08-30 실물). 토스트를 {@code setGranted}
        의 콜백에 두었더니 <b>같은 문구가 두 번</b> 떴다 — React 는 갱신 함수를 <b>순수한
        것으로 보고 두 번 부른다</b>(StrictMode). 다음 값을 <b>먼저 계산</b>하고, 상태 갱신과
        알림을 그 밖에서 한 번씩 한다.
      */
      const defined = new Set(row.definedActions);
      const held = new Set(granted.get(menuCd) ?? []);
      let notice: string | null = null;

      if (next) {
        held.add(action);
        // 확장은 명시해야 한다 — 그래도 이 조작 자체가 이미 확장의 의사표시다(screen/user/requirements.md).
        if (action !== 'READ' && !held.has('READ') && defined.has('READ')) {
          held.add('READ');
          notice = label(MSG.ROLE_AUTH_READ_ON);
        }
      } else {
        held.delete(action);
        if (action === 'READ') {
          /*
            도달할 수 없는 권한을 남기면 <b>인가 데이터가 거짓말을 한다</b>(screen/user/requirements.md).

            <b>정의된 액션만 센다.</b> 화면이 {@code —} 로 그리는 고아 부여(API 가 사라진
            조합)까지 세면 <i>화면에 보이지 않는 것</i>을 껐다고 말하게 되고 — 실제로
            *"나머지 2건"* 이라 했는데 스위치는 하나뿐인 화면이 나왔다(2026-08-30 실물).
            지우지도 않는다: 그 행은 사람이 판단할 몫이다(seed.md).
          */
          const dropped = [...held].filter((candidate) => defined.has(candidate));
          if (dropped.length > 0) {
            dropped.forEach((candidate) => held.delete(candidate));
            notice = label(MSG.ROLE_AUTH_READ_OFF, { count: dropped.length });
          }
        }
      }

      const nextEdits = new Map(edits);
      nextEdits.set(menuCd, held);
      setEdits(nextEdits);
      if (notice) message.info(notice);
    },
    [edits, granted, message, rows],
  );

  /**
   * 저장 — <b>확인 문구가 세 줄이다</b>(screen/admin/system/role-auth/requirements.md).
   *
   * <table>
   *   <tr><td>①</td><td>건수 — <b>수정이 없다</b>. 권한은 있거나 없거나라 켜면 추가, 끄면 삭제다</td></tr>
   * <tr><td>②</td><td>이 역할을 가진 <b>N 명</b>에게 적용된다 — backend/security.md</td></tr>
   *   <tr><td>③</td><td>그중 <b>유효 권한이 공집합</b>이 되는 사람 — 다음 로그인부터 차단된다</td></tr>
   * </table>
   *
   * <p><b>셋째 줄은 조건이 맞을 때만 낸다.</b> 이 역할이 저장 뒤에도 <b>살아 있는 리프에</b>
   * 권한을 하나라도 주면 아무도 공집합이 되지 않고, 역할 자체가 꺼져 있으면 이 변경은
   * 지금 아무에게도 영향이 없다(backend/security.md ② — 입력 필터). <b>공집합 인원이 `0` 이어도 내지
   * 않는다</b> — 항상 보이면 읽히지 않는다.
   *
   * <p><b>이름을 함께 낸다.</b> 건수만 알려주면 *"그 2명이 누구지"* 를 찾으러 다른 화면에
   * 가야 한다(§4 주석 5).
   */
  const save = useCallback(async () => {
    if (!role) return;

    const lines = [
      label(MSG.ROLE_AUTH_SAVE_COUNTS, { added: diff.added, removed: diff.removed }),
      label(MSG.ROLE_AUTH_SAVE_HOLDERS, { count: role.holderCount }),
    ];
    const survives = rows.some(
      (row) =>
        row.menuUrl !== null && row.useYn && (granted.get(row.menuCd)?.size ?? 0) > 0,
    );
    if (role.useYn && !survives) {
      const sample = await fetchAllHolders(ROLE_AUTH_ENDPOINTS.getAffectedUsers, role.roleId);
      const blocked = blockedUsers(sample.holders);
      if (blocked.length > 0) {
        lines.push(label(MSG.ROLE_AUTH_SAVE_BLOCKED, { count: blocked.length }));
        lines.push(blocked.map((user) => `  · ${user.userNm} (${user.userId})`).join('\n'));
      }
      // 한 장에 다 담기지 않았다 — <b>0명이라고 말하지 않는다</b>(screen/admin/system/role-auth/requirements.md 미결).
      if (sample.truncated) {
        lines.push(
          label(MSG.ROLE_BLOCKED_PARTIAL, {
            counted: sample.holders.length,
            total: sample.total ?? sample.holders.length,
          }),
        );
      }
    }

    const agreed = await new Promise<boolean>((resolve) => {
      modal.confirm({
        title: label(MSG.GRID_SAVE_CONFIRM_TITLE),
        content: (
          <div style={{ whiteSpace: 'pre-line' }}>{lines.join('\n')}</div>
        ),
        okText: label(MSG.GRID_CONFIRM_OK),
        cancelText: label(MSG.COMMON_CANCEL),
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!agreed) return;

    await saveRoleAuth(role.roleId, toGrantList(rows, granted));
    // 나간 것은 더 이상 <b>덮어쓸 것</b>이 아니다 — 비우는 순간 미저장이 없어진다.
    setEdits(new Map());
    message.success(label(MSG.GRID_SAVE_DONE));
    /*
      <b>다시 읽는다</b>(frontend/grid.md). 서버가 정의 밖의 고아 부여를 그대로 남기므로 화면이 든 값과
      DB 가 완전히 같다고 단정할 수 없고, 무엇보다 <b>다른 사람이 그 사이에 고쳤을 수
      있다</b>. 재조회가 {@code granted} 를 다시 세운다.
    */
    await treeQuery.refetch();
  }, [diff, granted, message, modal, role, rows, treeQuery]);

  // ── 검색 (screen/admin/system/role-auth/requirements.md — 거르지 않고 찾아간다) ───────────────────────

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return [];
    return rows
      .filter((row) => row.menuNm.toLowerCase().includes(needle))
      .map((row) => row.menuCd);
  }, [rows, term]);
  const highlighted = useMemo(() => new Set(matches), [matches]);
  // 첫 일치로 스크롤한다 — 강조가 경로를 펼치므로 나머지도 같은 화면 안에 있다(screen/admin/system/role-auth/requirements.md).
  const focused = matches[0] ?? null;

  /**
   * 트리 ①의 검색 칸 — <b>브레드크럼이 아니라 거기다</b>(2026-08-31 · screen/admin/system/role-auth/requirements.md).
   *
   * <p>근거는 {@code TreeSearch} 에 있다 — 자리도 자리이지만 슬롯에 두면 값이 <b>한 커밋
   * 늦게</b> 도착해 <b>한글이 두 번 입력된다</b>. 개인 예외 화면에서 실물로 겪은 그것이며
   * (screen/user/requirements.md) 여기도 같은 구조였다.
   */
  const treeSearch = useMemo(
    () => ({ placeholder: MSG.ROLE_AUTH_SEARCH_MENU, value: term, onChange: setTerm }),
    [term],
  );

  /**
   * <b>빈 상태</b> — frontend/grid.md. 우(트리)와 하(영향 인원)가 함께 잠긴다.
   *
   * <p>디테일은 마스터의 선택에 종속되므로 고른 역할이 없으면 <b>조회할 대상도 저장할 것도
   * 없다</b> — 트리의 조회 버튼이 눌러도 조용했다({@code enabled: false} 라 요청이 나가지
   * 않는다).
   */
  const idle = role === null;
  /**
   * 제목 뒤에 붙는 <b>고른 역할</b> — frontend/grid.md.
   *
   * <p><b>모양이 둘로 갈리는 것은 컴포넌트의 차이</b>다(screen/user/requirements.md 와 같다). 하단은 컨트롤러를
   * 넘길 수 있어 판정을 {@code DataGrid} 에 두고, 트리는 <b>완성된 글자</b>를 받는다 —
   * 둘이 <b>같은 선택 하나</b>에서 나오므로 갈릴 수 없다.
   */
  const roleSuffix = useMemo<TitleSuffixSpec>(
    () => ({ parent: roles, fields: ['roleNm', 'roleId'] }),
    [roles],
  );
  const roleSuffixText = useMemo(() => {
    if (role === null) return '';
    // 빈 칸은 조용히 빠진다 — `/` 만 남으면 그것이 값처럼 보인다.
    return [role.roleNm, role.roleId].filter((value) => value !== '').join(' / ');
  }, [role]);

  /*
    브레드크럼 슬롯에 남는 것은 <b>조회조건 토글 하나</b>다(frontend/tabs.md · UX-15) — 트리 검색이
    ①로 옮겨 갔다(위 {@code treeSearch}).
  */

  // ── 선택과 조회 ─────────────────────────────────────────────────

  /**
   * 역할 선택 — <b>미저장 편집이 있으면 묻는다</b>(frontend/grid.md · UX-10).
   *
   * <p>거부권이 없으면 <i>보고 있는 것</i>과 <i>고른 것</i>이 갈리고, 그 상태로 저장하면
   * <b>A 역할의 권한이 B 역할로 나간다</b> — 여기서는 그것이 곧 인가 사고다.
   */
  const selectRole = useCallback(
    async (row: GridRow<RolePickRow> | null): Promise<boolean> => {
      if (dirty) {
        const agreed = await new Promise<boolean>((resolve) => {
          modal.confirm({
            title: label(MSG.GRID_DISCARD_TITLE),
            content: label(MSG.GRID_DISCARD_BODY),
            okText: label(MSG.GRID_CONFIRM_OK),
            cancelText: label(MSG.COMMON_CANCEL),
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!agreed) return false;
      }
      setRole(row?.data ?? null);
      setEdits(new Map());
      if (row) {
        // 고른 값을 <b>직접 넘긴다</b> — 상태는 아직 이전 렌더의 것이다(`useRoleHolders`).
        void holders.readFor(row.data.roleId);
      } else {
        holders.clear();
      }
      return true;
    },
    [dirty, holders, modal],
  );

  /**
   * 좌 ① 의 조회 — <b>선택이 풀린다</b>(frontend/grid.md · 목업 RA-06).
   *
   * <p>목록을 통째로 바꾸므로 이전에 보던 행이 결과에 없을 수도 있다. 트리와 영향 인원이
   * 남아 있으면 <b>다른 역할의 권한을 이 역할 것으로</b> 보게 된다.
   */
  const readRoles = useCallback(async () => {
    setRole(null);
    setEdits(new Map());
    holders.clear();
    await roles.read();
  }, [holders, roles]);

  /**
   * 트리 ① 의 조회 — <b>역할 선택은 그대로다</b>(목업 RA-07).
   *
   * <p>좌 ① 과 갈리는 자리다. 저기는 <i>목록이 통째로 바뀌었을 수 있다</i> 가 근거이고,
   * 여기는 <b>같은 역할의 같은 트리</b>를 다시 읽는 것뿐이다.
   */
  const readTree = useCallback(() => {
    void treeQuery.refetch();
  }, [treeQuery]);

  const controls = useMemo<GridButtonControl[]>(
    () => [
      /*
        Ⓑ 의 둘은 <b>`actionCd` 를 선언하지 않는다</b> — 표시를 바꿀 뿐 데이터를 읽지도 쓰지도
        않는다(frontend/grid.md). <b>토글 하나로 두지 않는 것</b>은 일부만 펼친 중간 상태에서 토글이
        무엇을 가리키는지 말할 수 없기 때문이다(screen/admin/system/role-auth/requirements.md).
      */
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
        onSubmit={() => void readRoles()}
        onReset={roles.clearFilters}
        onActiveCountChange={header.onActiveCountChange}
        collapsed={header.collapsed}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        {/* 스플리터 둘 — 좌우(역할 ↔ 트리) 위에 상하(위 ↔ 영향 인원)다(frontend/grid.md). */}
        <SplitPane
          storageKey="roleAuth"
          defaultRatio={0.62}
          first={(collapsed, expand) =>
            /*
              <b>접히면 좌우 스플리터를 그리지 않는다.</b> 접힌 pane 은 제목 줄 높이만
              차지하는데(frontend/grid.md) 그 안에 또 스플리터를 두면 <b>두 그리드가 0 높이로 눌려</b>
              되돌릴 자리가 사라진다 — 화살표로 접고 화살표로 돌아올 수 없었던 그 실패와
              같은 모양이다.

              대신 <b>역할 목록의 제목 줄 하나</b>를 남긴다. 접은 사람이 보려던 것은 아래
              pane 이고, 되돌리는 길은 <i>제목을 누르는 것</i> 하나면 된다.
            */
            collapsed ? (
              <DataGrid<RolePickRow>
                title={MSG.ROLE_AUTH_ROLE_TITLE}
                menuCd={MENU_CD}
                gridId="role"
                controller={roles}
                collapsed
                onExpand={expand}
              />
            ) : (
            <SplitPane
              storageKey="roleAuth.pick"
              // 마스터가 <b>좁다</b> — 컬럼 셋짜리 목록이라 좌우가 맞다(frontend/grid.md).
              axis="horizontal"
              defaultRatio={0.28}
              first={(collapsed, expand, axis) => (
                <DataGrid<RolePickRow>
                  title={MSG.ROLE_AUTH_ROLE_TITLE}
                  menuCd={MENU_CD}
                  gridId="role"
                  controller={roles}
                  onSelect={selectRole}
                  collapsed={collapsed}
                  /*
                    <b>좌우로 접히면 제목이 세로로 선다</b>(frontend/grid.md) — 접힌 폭이 제목 줄의
                    높이와 같아졌으므로(2026-08-31) 가로 제목은 그 자리에서 잘린다.
                  */
                  collapsedAxis={axis}
                  onExpand={expand}
                />
              )}
              second={(collapsed, expand, axis) => (
                <AuthTree
                  handleRef={tree}
                  title={MSG.ROLE_AUTH_TREE_TITLE}
                  menuCd={MENU_CD}
                  rows={rows}
                  granted={granted}
                  onToggle={toggle}
                  canSave={canSave}
                  dirty={dirty}
                  dirtyMenus={dirtyMenus}
                  onSave={() => void save()}
                  onRead={readTree}
                  loading={treeQuery.isFetching}
                  emptyText={MSG.ROLE_AUTH_TREE_EMPTY}
                  disabled={idle}
                  search={treeSearch}
                  titleSuffix={roleSuffixText}
                  collapsed={collapsed}
                  collapsedAxis={axis}
                  onExpand={expand}
                  controls={controls}
                  highlighted={highlighted}
                  focusedId={focused}
                />
              )}
            />
            )
          }
          second={(collapsed, expand) => (
            <RoleHolderGrid
              title={MSG.ROLE_AUTH_AFFECTED_TITLE}
              menuCd={MENU_CD}
              controller={holders.controller}
              emptyText={MSG.ROLE_AUTH_AFFECTED_EMPTY}
              titleSuffix={roleSuffix}
              disabled={idle}
              collapsed={collapsed}
              onExpand={expand}
            />
          )}
        />
      </div>
    </FillColumn>
  );
}

// ── 부여 집합 ─────────────────────────────────────────────────────

function toGrantMap(rows: RoleAuthTreeRow[]): Map<string, Set<Action>> {
  const map = new Map<string, Set<Action>>();
  for (const row of rows) {
    map.set(row.menuCd, new Set(row.grantedActions));
  }
  return map;
}

/**
 * 저장 페이로드 — <b>정의된 조합만 나간다</b>.
 *
 * <p>고아 부여(`definedActions` 에 없는데 `grantedActions` 에 있는 것)는 화면이 `—` 로
 * 그리므로 켜고 끌 수 없고, 여기서도 빠진다. 서버가 <b>정의된 조합 안에서만</b> 지우므로
 * 그 행은 손대지 않은 채 남는다 — screen/user/requirements.md 의 *"배포가 운영 결정을 지우지 않는다"* 다.
 */
function toGrantList(
  rows: RoleAuthTreeRow[],
  granted: ReadonlyMap<string, ReadonlySet<Action>>,
): RoleAuthGrant[] {
  const list: RoleAuthGrant[] = [];
  for (const row of rows) {
    if (row.menuUrl === null) continue;
    const held = granted.get(row.menuCd);
    if (!held) continue;
    for (const action of ACTIONS) {
      if (held.has(action) && row.definedActions.includes(action)) {
        list.push({ menuCd: row.menuCd, actionCd: action });
      }
    }
  }
  return list;
}

/** 추가와 삭제 — <b>수정이 없다</b>(screen/admin/system/role-auth/requirements.md §4 주석 1). 정의된 조합 안에서만 센다. */
function countDiff(
  rows: RoleAuthTreeRow[],
  original: ReadonlyMap<string, ReadonlySet<Action>>,
  granted: ReadonlyMap<string, ReadonlySet<Action>>,
): { added: number; removed: number; menus: ReadonlySet<string> } {
  let added = 0;
  let removed = 0;
  /*
    <b>어느 메뉴가 바뀌었나</b>도 함께 낸다 — 트리의 `✎` 가 이것을 본다(2026-09-01 요청).
    같은 훑기에서 나오므로 <b>건수와 표시가 갈릴 수 없다</b>: 두 번 훑으면 정의된 조합만
    센다는 위 예외를 한쪽만 알게 되고, 그때 화면은 <i>표시는 없는데 저장 건수는 있는</i>
    상태가 된다.
  */
  const menus = new Set<string>();
  for (const row of rows) {
    if (row.menuUrl === null) continue;
    const before = original.get(row.menuCd);
    const after = granted.get(row.menuCd);
    for (const action of row.definedActions) {
      const was = before?.has(action) === true;
      const is = after?.has(action) === true;
      if (!was && is) added += 1;
      if (was && !is) removed += 1;
      if (was !== is) menus.add(row.menuCd);
    }
  }
  return { added, removed, menus };
}

// ── 좌 컬럼 · 조회조건 (screen/menu/requirements.md) ───────────────────────────

/** 역할명 · 사용 여부 · 보유 인원 셋뿐이다 — <b>고르기만 하는 목록</b>이다(screen/admin/system/role-auth/requirements.md). */
function buildRoleColumns(): ColumnDef<RolePickRow>[] {
  return [
    { field: 'roleNm', header: MSG.ROLE_COL_ROLE_NM, type: 'text', width: 160, sortable: true, fill: true },
    {
      field: 'useYn',
      header: MSG.ROLE_COL_USE_YN,
      type: 'ynFlag',
      width: 80,
      sortable: true,
      /*
        <b>편집 선언이 없다.</b> 비활성 역할도 목록에 나오지만 켜고 끄는 것은
        `ROLE_MGMT` 의 일이다 — 여기서 열면 <b>같은 사실을 고치는 화면이 둘</b>이 된다.
      */
    },
    {
      field: 'holderCount',
      header: MSG.ROLE_COL_HOLDER,
      type: 'number',
      width: 90,
      // 파생이라 정렬 대상이 아니다(frontend/grid.md) — 서버 화이트리스트에도 없다.
      filter: false,
    },
  ];
}

/**
 * 역할명 하나다.
 *
 * <p><b>사용 여부가 없다</b> — 비활성 역할의 권한을 고치는 것은 아무에게도 영향이 없어
 * <b>가장 안전한 편집</b>이며, 감추면 *켜기 전에 구성한다* 는 동선이 막힌다(screen/admin/system/role-auth/requirements.md).
 *
 * <p><b>부여 상태도 없다</b> — `SYS_ROLE_MENU_AUTH` 에 기간 컬럼이 없으므로 <b>상태 자체가
 * 없다</b>(sys/menu.md). screen/user/requirements.md 이 개인 예외에서 그것을 넣었다 뺐다 한 것과 갈리는 자리다.
 *
 * <p><b>메뉴명은 폼에 없다.</b> 서버로 나가지 않기 때문이며(클래스 주석), 트리 검색은
 * `MENU_TREE` 와 같은 자리 — 브레드크럼 줄 — 에 둔다. 같은 일을 하는 컨트롤이 화면마다 다른
 * 곳에 있으면 그것이 학습 비용이다.
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
  ];
}
