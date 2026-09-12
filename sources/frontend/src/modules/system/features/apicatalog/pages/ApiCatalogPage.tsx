// @feat FEAT-503
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { DataGrid } from '@/shared/grid/DataGrid';
import { SplitPane } from '@/shared/grid/SplitPane';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow } from '@/shared/grid/rows';
import type { ColumnDef, SearchCondition, SelectOption } from '@/shared/grid/types';
import { ACTIONS, hasPermission, type Action } from '@/shared/authz/permission';
import { useAuthStore } from '@/shared/stores/authStore';
import { handOff, onHandoff, useHandoff } from '@/shared/routes/handoffStore';
import { useShellNavigation } from '@/layouts/ShellLayout/useShellNavigation';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { API_CATALOG_ENDPOINTS } from '@/modules/system/features/apicatalog/api/endpoints';
import type { ApiCatalogRow, ApiMenuRow } from '@/modules/system/features/apicatalog/types';

/**
 * `API_CATALOG` — screen/admin/system/api-catalog/requirements.md. <b>이 화면은 데이터를 고치지 않는다.</b>
 *
 * <p>원본이 시드이고 시드는 생성된다(backend/api.md) — 여기서 고칠 수 있게 하면 <b>다음 배포에서
 * 사라진다</b>(screen/admin/system/api-catalog/requirements.md). 그래서 `api.save` 도 `addRow` 도 `deletable` 도 없고, 그것이 없으므로
 * 상태 컬럼도 삭제 컬럼도 저장 버튼도 붙지 않는다(frontend/grid.md) — <b>이 화면의
 * 절반은 선언하지 않은 것으로 이루어져 있다.</b>
 *
 * <h2>그러면 무엇을 하는 화면인가 — 403 을 진단한다</h2>
 *
 * <pre>
 * 로그(64)에서 URL 하나를 얻어 여기서 찾는다
 *   ├ 목록에 없다        → 미등록   : 컨트롤러 + 시드 재생성   ← 빈 상태가 답한다
 *   ├ 있는데 매핑 0      → 미매핑   : endpoints.ts + 시드 재생성 ← 배지와 하단이 답한다
 *   └ 있고 매핑이 있다   → 권한 문제 : 역할 권한 또는 개인 예외   ← 하단이 넘겨준다
 * </pre>
 *
 * <p><b>세 갈래가 이 화면의 설계를 전부 정한다.</b> 마스터가 첫째와 둘째를 답하고 하단이
 * 셋째로 넘겨준다 — 컬럼 하나하나가 그 셋 중 하나에 매여 있다.
 *
 * <p><b>첫째 갈래는 화면이 <i>보여줄 수</i> 없다.</b> 없는 행을 목록에 낼 방법이 없기
 * 때문이며, 그래서 <b>0건의 빈 상태가 곧 진단</b>이 된다 — 이 화면에서 가장 공들인
 * 자리가 데이터가 아니라 <b>데이터 없음</b>인 이유다.
 *
 * <p><b>엑셀이 있다</b>(액션이 `R E` 다 — sys/menu.md). 조회 전용은 *쓰기* 에 관한 말이지
 * *내보내기* 에 관한 말이 아니며, `매핑 상태 = 미매핑` 으로 조회한 뒤 *전체* 를 뽑으면
 * <b>결함 목록이 그대로 파일이 된다</b>.
 */

const MENU_CD = 'API_CATALOG';

/** 미등록 진단을 낼 조건 — screen/admin/system/api-catalog/requirements.md. <b>이 칸에만 값이 있을 때</b>다. */
const URL_FIELD = 'apiUrl';

/** 넘겨줄 화면 — screen/admin/system/api-catalog/requirements.md. 여기 있는 것은 <b>메뉴 코드 하나</b>다. */
const MENU_TREE_CD = 'MENU_TREE';

const ACTION_LABEL: Record<Action, string> = {
  READ: MSG.AUTHZ_ACTION_READ,
  SAVE: MSG.AUTHZ_ACTION_SAVE,
  EXPORT: MSG.AUTHZ_ACTION_EXPORT,
  EXECUTE: MSG.AUTHZ_ACTION_EXECUTE,
};

export function ApiCatalogPage() {
  const searchForm = useRef<SearchFormHandle>(null);
  const shell = useShellNavigation();
  const permissions = useAuthStore((state) => state.permissions);

  /**
   * 마스터의 빈 상태 문구 — <b>둘로 갈린다</b>(screen/admin/system/api-catalog/requirements.md).
   *
   * <p><i>URL 을 정확히 넣었는데 0건</i> 과 <i>조건이 안 맞아 0건</i> 은 다른 사건이다.
   * 하나로 합치면 조건을 잘못 준 사람에게 <i>"컨트롤러를 추가하라"</i> 고 말하게 되고,
   * 반대로 합치는 쪽을 보통의 문구로 정하면 <b>이 화면의 세 갈래 중 하나가 사라진다</b>.
   */
  const [masterEmpty, setMasterEmpty] = useState<string>(MSG.API_CATALOG_EMPTY);

  /**
   * 하단의 빈 상태 문구 — frontend/grid.md 의 세 상태 중 <b>둘이 여기서 갈린다</b>.
   *
   * <p><i>"API 를 선택하세요"</i> 와 <i>미매핑 진단</i> 은 같은 빈 판이지만 <b>다음에 할 일이
   * 다르다</b> — 앞엣것은 고를 것이 남았다는 말이고, 뒤엣것은 <b>이미 다 했고 결함을
   * 찾았다</b>는 말이다.
   */
  const [menuEmpty, setMenuEmpty] = useState<string>(MSG.API_CATALOG_MENU_EMPTY);

  /*
    <b>선택된 API 를 ref 로도 든다.</b> 하단 조회 콜백이 이 값을 읽는데, 행을 고른 <b>바로 그
    순간</b>에 조회가 나가야 하므로 상태 갱신을 기다릴 수 없다 — 기다리면 첫 조회가
    <i>이전 API</i> 의 매핑을 가져온다. screen/code/requirements.md 의 코드 화면과 같은 자리다.
  */
  const selectedApiUrl = useRef<string | null>(null);

  const header = useSearchFormHeader();

  // 매 렌더 새 함수를 넘기지 않는다 — 컨트롤러의 조회 콜백이 전부 새것이 된다.
  const collectConditions = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );

  /**
   * 하단은 조회조건 폼을 <b>나눠 갖지 않는다</b> — screen/code/requirements.md 의 코드 화면과 갈리는 자리다.
   *
   * <p>거기서는 <i>"이 코드값이 어느 그룹에 있더라"</i> 가 실제 질문이라 하단 조건이 마스터를
   * 걸렀다. 여기 하단에 있는 것은 <b>메뉴 경로 · 사용 여부 · 인원</b>뿐이고 그 셋으로 API 를
   * 거꾸로 찾는 동선은 이 화면의 것이 아니다 — 그것을 묻는 자리는 `MENU_TREE`다.
   */
  const menuConditions = useCallback(() => Promise.resolve([] as SearchCondition[]), []);

  const menuSearchParams = useCallback(() => ({ apiUrl: selectedApiUrl.current }), []);

  const masterColumns = useMemo(() => buildApiColumns(), []);
  const menuColumns = useMemo(() => buildMenuColumns(), []);
  // 매 렌더 새 배열이면 폼의 콜백도 새것이 되고, 저장된 조건이 그때마다 서버를 부른다.
  /**
   * 건네받은 URL — <b>마운트할 때 한 번 읽고 지운다</b>(handoffStore).
   *
   * <p>효과가 아니라 <b>초기값</b>인 것이 요점이다. 효과로 읽으면 <i>첫 렌더는 빈 칸,
   * 두 번째 렌더에서 채워짐</i> 이 되어 사람이 그 깜빡임을 보고, 무엇보다 효과 본문의
   * 동기 상태 변경은 연쇄 렌더다 — {@code MenuTreePage} 가 같은 자리에서 같은 모양을 쓴다.
   */
  const handoff = useHandoff(MENU_CD);

  /*
    <b>건네받은 URL 이 이 탭의 기본값이 된다.</b> 폼의 상태는 첫 렌더에 한 번 만들어지므로
    (frontend/search-form.md) 마운트 경로는 선언으로 흘러야 한다 — 효과로 얹으면 깜빡임과 연쇄 렌더다.

    <b>초기화가 빈 칸이 아니라 그 URL 로 돌아간다.</b> §3.6 이 <i>초기화는 기본값으로</i> 라고
    정했고, 넘겨받아 열린 탭의 기본값은 <b>그 URL</b> 이다 — 이 탭은 그것을 보러 열렸다.
  */
  const searchFields = useMemo(() => buildSearchFields(handoff ?? ''), [handoff]);

  /*
    <b>`save` 가 없다.</b> frontend/grid.md 이 `api.save` 로 저장 버튼을 만드는데, 선언하지 않았으므로
    버튼이 나오지 않는다 — 감추는 코드가 한 줄도 없다는 것이 screen/admin/system/api-catalog/requirements.md 의 집행 방식이다.

    <b>`emptyNotice` 도 없다.</b> frontend/grid.md 는 마스터에서 켜라고 하지만 이 화면은 <b>0건이 답</b>인
    유일한 화면이다 — <i>"조회 결과가 없습니다"</i> 모달이 먼저 뜨면 진단을 읽기 전에
    확인을 한 번 눌러야 하고, 그 문장은 뒤에 나올 진단과 어긋난다.
  */
  const masterApi = useMemo(() => ({ read: { url: API_CATALOG_ENDPOINTS.getList } }), []);
  const menuApi = useMemo(() => ({ read: { url: API_CATALOG_ENDPOINTS.getMenuList } }), []);

  const master = useGridController<ApiCatalogRow>({
    menuCd: MENU_CD,
    columns: masterColumns,
    api: masterApi,
    params: collectConditions,
  });

  const menus = useGridController<ApiMenuRow>({
    menuCd: MENU_CD,
    columns: menuColumns,
    api: menuApi,
    params: menuConditions,
    searchParams: menuSearchParams,
  });

  const clearMenus = useCallback(() => {
    selectedApiUrl.current = null;
    menus.setRows([]);
    setMenuEmpty(MSG.API_CATALOG_MENU_EMPTY);
  }, [menus]);

  /**
   * API 선택 — 하단을 그 API 로 다시 읽는다.
   *
   * <p><b>거부하지 않는다 — 그래서 `void` 를 돌려준다</b>(frontend/grid.md · `<DataGrid>` 의 `onSelect`).
   * screen/code/requirements.md 의 코드 화면은 하단에 미저장 편집이 있을 수 있어 물었고 그 답에 따라 선택을 되돌려야
   * 해서 `Promise<boolean>` 이었다. 여기 하단은 <b>잃을 것이 없다</b> — 편집이 없는 화면에서
   * 확인 모달은 순수한 마찰이고, 되돌릴 이유가 없으므로 돌려줄 답도 없다.
   *
   * <p>고르는 순간 하단의 빈 상태를 <b>미매핑 진단</b>으로 바꿔 둔다. 조회가 0건으로 돌아오면
   * 그 문구가 그대로 서고(§5.4 가 <i>"배지와 같은 말을 pane 에서도 한다"</i> 고 적었다),
   * 1건이라도 오면 판이 행을 그리므로 빈 상태는 보이지 않는다.
   */
  const selectApi = useCallback(
    (row: GridRow<ApiCatalogRow> | null) => {
      if (!row) {
        clearMenus();
        return;
      }
      selectedApiUrl.current = row.data.apiUrl;
      setMenuEmpty(MSG.API_CATALOG_MENU_UNMAPPED);
      // 물을 것이 없으므로 이미 물었다고 알린다 — 편집이 없는 그리드다.
      void menus.read(true);
    },
    [clearMenus, menus],
  );

  /**
   * 하단 행 더블 클릭 → <b>`MENU_TREE` 를 그 메뉴로 연다</b>(screen/admin/system/api-catalog/requirements.md · UX-02 멀티탭).
   *
   * <p>§5.2 의 <b>셋째 갈래로 넘어가는 경로</b>다 — API 도 있고 매핑도 있는데 403 이면
   * 남은 것은 <i>권한 문제</i> 이고, 거기서 볼 것은 <b>그 메뉴에 누가 닿는가</b>(§4.11 탭 2)와
   * <b>어느 역할이 줬는가</b>(탭 3)다. 이 화면은 <b>넘겨주기까지</b>가 자기 일이다.
   *
   * <p><b>메뉴 트리를 볼 권한이 없으면 열지 않는다</b>(frontend/tabs.md). 열어 놓고 403 을 보여주는
   * 것보다 <b>아무 일도 일어나지 않는 편</b>이 낫다 — 더블 클릭은 눌러야만 알 수 있는
   * 제스처라 실패가 더 혼란스럽다.
   */
  const openMenuTree = useCallback(
    (row: GridRow<ApiMenuRow>) => {
      const node = shell.index.byCode.get(MENU_TREE_CD);
      if (!node || !hasPermission(permissions, MENU_TREE_CD, 'READ')) {
        return;
      }
      // 여는 쪽이 아는 것은 `MENU_CD` 하나이고 받는 쪽은 아직 마운트되지 않았다.
      handOff(MENU_TREE_CD, row.data.menuCd);
      shell.openMenu(node);
    },
    [permissions, shell],
  );

  /**
   * 마스터 조회 — <b>하단을 리셋하고</b>, 빈 상태 문구를 이번 조건에 맞춰 정한다(frontend/grid.md).
   *
   * <p>조회는 마스터 목록을 통째로 바꾸므로 이전에 보던 행이 결과에 없을 수도 있다. 하단이
   * 남아 있으면 <b>다른 API 의 매핑을 이 API 것으로 보게 된다</b>.
   */
  const readMaster = useCallback(async () => {
    clearMenus();
    setMasterEmpty(
      urlOnly(searchForm.current?.collect() ?? [])
        ? MSG.API_CATALOG_NOT_REGISTERED
        : MSG.API_CATALOG_EMPTY,
    );
    await master.read();
  }, [clearMenus, master]);

  /**
   * 건네받은 URL 로 <b>스스로 조회한다</b> — screen/log/access/requirements.md 가 이 화면을 도착지로 정했다.
   *
   * <p>사용 이력·에러 로그의 `요청 URI` 를 더블 클릭하면 그 URL 이 건네져 온다. 여기가
   * 403 세 갈래의 <b>가운데 칸</b>이다 — 등록됐나(§5.2 첫째) · 어느 메뉴에 매핑됐나(둘째)를
   * 답하고, 남으면 하단이 `MENU_TREE` 로 다시 넘긴다.
   *
   * <p><b>조회까지 해 준다.</b> 칸만 채우고 멈추면 사람이 조회를 한 번 더 눌러야 하는데,
   * 더블 클릭은 <i>가서 보겠다</i> 는 제스처이지 <i>조건을 옮겨 적겠다</i> 가 아니다.
   *
   * <p><b>`eq` 가 아니라 선언된 기본 연산자로 넣는다.</b> `apply` 가 `op` 를 적지 않으면
   * 폼이 §3.5 의 기본(여기서는 `contains`)을 쓰는데, 그것이 §5.4 가 말한 <i>뒷마디로
   * 찾는</i> 동선의 입구다 — 완전 일치로 박아 두면 로그의 URL 에 쿼리스트링이 붙어 있을 때
   * 0건이 되고, 그 0건은 <b>미등록으로 읽힌다</b>.
   */
  const applyHandoff = useCallback(
    (apiUrl: string) => {
      searchForm.current?.apply({ [URL_FIELD]: { value: apiUrl } });
      void readMaster();
    },
    [readMaster],
  );


  /*
    <b>이미 열려 있을 때</b>의 넘겨주기 — 위의 초기값과 짝이다(handoffStore 의 Javadoc).
    frontend/tabs.md 대로 같은 메뉴를 다시 열면 새 탭이 아니라 이미 있는 탭이 활성화되고, 비활성
    탭도 마운트된 채이므로(frontend/tabs.md) 이 화면은 다시 마운트되지 않는다 — 초기값 하나로 두면
    탭만 바뀌고 목록은 그대로다.

    <b>효과가 하는 일은 구독을 걸고 푸는 것뿐이다.</b> 값을 얹는 것은 콜백이며 그것은 렌더가
    아니라 사건이다 — 효과 본문에서 곧장 상태를 바꾸면 연쇄 렌더가 된다.
  */
  useEffect(() => onHandoff(MENU_CD, applyHandoff), [applyHandoff]);

  /*
    <b>건네받고 들어왔으면 스스로 한 번 조회한다.</b> 칸만 채우고 멈추면 사람이 조회를 한 번
    더 눌러야 하는데, 더블 클릭은 <i>가서 보겠다</i> 는 제스처이지 <i>조건을 옮겨 적겠다</i>
    가 아니다.

    <b>마운트 한 번뿐이다</b> — 그 뒤의 넘겨주기는 위 구독이 받는다.
  */
  useEffect(() => {
    if (handoff === null) {
      return;
    }
    /*
      규칙(`set-state-in-effect`)이 허용하는 <b>바로 그 경우</b>인데 린터가 볼 수 없는
      자리다 — 이 효과가 동기화하는 외부 시스템은 `handoffStore` 이고, 다만 그 값이
      <b>구독을 걸기 전에</b> 들어와 있었다(여는 쪽이 탭을 열기 직전에 넣는다). 위 구독과
      같은 사건을 다루며, 첫 값만 경로가 다르다.
    */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void readMaster();
    // 마운트 1회다. readMaster 를 의존으로 두면 조회할 때마다 다시 조회한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <SplitPane
          storageKey="apiCatalog"
          first={(collapsed, expand) => (
            <DataGrid
              title={MSG.API_CATALOG_GRID_TITLE}
              menuCd={MENU_CD}
              // 개인화의 키다 — 같으면 위아래 설정이 서로를 덮는다(frontend/grid.md).
              gridId="master"
              controller={master}
              emptyText={masterEmpty}
              onSelect={selectApi}
              collapsed={collapsed}
              onExpand={expand}
            />
          )}
          second={(collapsed, expand) => (
            <DataGrid
              title={MSG.API_CATALOG_MENU_TITLE}
              menuCd={MENU_CD}
              gridId="menu"
              controller={menus}
              emptyText={menuEmpty}
              onRowDoubleClick={openMenuTree}
              /*
                <b>설정 창을 끈다</b>(frontend/grid.md). 컬럼이 넷이고 <b>넷 다 봐야 한다</b> — 경로가
                어느 메뉴인지, 사용 여부와 인원이 왜 못 쓰는지를 말한다. 끄면 저장된 설정을
                읽지도 않으므로 왕복 하나가 준다.
              */
              settings={false}
              collapsed={collapsed}
              onExpand={expand}
            />
          )}
        />
      </div>
    </FillColumn>
  );
}

/**
 * 지금 걸린 조건이 <b>URL 하나뿐인가</b> — screen/admin/system/api-catalog/requirements.md 의 빈 상태를 가르는 근거다.
 *
 * <p>URL 칸에 값이 있고 <b>다른 칸이 비었을 때</b>만 미등록 문구를 낸다. 아니면 조건을 잘못
 * 준 사람에게 <i>"컨트롤러를 추가하라"</i> 고 말하게 된다.
 */
function urlOnly(conditions: SearchCondition[]): boolean {
  return conditions.length === 1 && conditions[0].field === URL_FIELD;
}

// ── 컬럼 ──────────────────────────────────────────────────────────

/**
 * <b>`editable` 을 하나도 선언하지 않는다</b> — frontend/grid.md 는 편집이 명시해야 열린다고 정했으므로
 * 이 함수에 없는 것이 곧 전 컬럼 읽기 전용이다(screen/admin/system/api-catalog/requirements.md).
 */
function buildApiColumns(): ColumnDef<ApiCatalogRow>[] {
  return [
    {
      field: 'apiUrl',
      header: MSG.API_CATALOG_COL_API_URL,
      type: 'text',
      width: 300,
      pinned: 'left',
      sortable: true,
      /*
        <b>`pk: true` 가 아니다.</b> frontend/grid.md 의 `pk` 는 <i>신규 행에서만 열린다</i> 를 뜻하는데
        이 화면에는 신규 행이 없다 — 채울 수 없는 칸에 필수 표시를 붙이면 <i>왜 안 되나</i> 를
        묻게 된다(screen/code/requirements.md 의 `msgKey` 와 같은 자리다).
      */
      editable: false,
    },
    {
      field: 'apiNm',
      header: MSG.API_CATALOG_COL_API_NM,
      type: 'text',
      width: 220,
      sortable: true,
      // 원본이 `@Operation.summary` 다 — 고치는 곳은 컨트롤러이지 여기가 아니다(screen/admin/system/api-catalog/requirements.md).
      editable: false,
    },
    {
      /*
        <b>공통코드가 아니다</b>(sys/code.md) — <b>API 의 속성</b>이며 값에 따라 프로세스가
        갈리므로 소스가 값을 갖는다. `grpCd` 가 아니라 `options` 에 상수를 적는 자리이며,
        그 둘을 가르는 것이 frontend/search-form.md 이 말한 것이다.

        `type: 'code'` 인 것은 <b>코드값이 아니라 이름을 보여주기</b> 위해서다(sys/code.md ·
        frontend/grid.md) — 값 집합이 닫혀 있어 컬럼 필터도 고르는 필터가 된다.
      */
      field: 'actionCd',
      header: MSG.API_CATALOG_COL_ACTION_CD,
      type: 'code',
      width: 110,
      sortable: true,
      options: actionOptions(),
      editable: false,
    },
    {
      /*
        <b>빌 수 있다</b> — `description` 은 선택이다(screen/admin/system/api-catalog/requirements.md). 필요하면 컨트롤러에 채운다.

        필터를 끈다 — 훑어 읽는 칸이지 거르는 칸이 아니고, 500자라 한 줄로는 다 못 읽는다.
      */
      field: 'apiDesc',
      header: MSG.API_CATALOG_COL_API_DESC,
      type: 'text',
      // 남는 폭을 이 칸이 먹는다 — 최소는 작게 둔다(screen/code/requirements.md 이 같은 자리에서 겪었다).
      width: 200,
      fill: true,
      filter: false,
      editable: false,
      // 읽기 전용인데 셀에서 다 볼 수 없다 — 펼쳐 <b>읽는다</b>. 편집기가 아니다(frontend/grid.md).
      viewer: 'largeText',
    },
    {
      /*
        <b>`0` 이 곧 진단이다</b>(screen/admin/system/api-catalog/requirements.md). `SYS_MENU_API` 에 행이 없으면 유효 권한의 원소가
        되는 (MENU_CD, ACTION_CD) 쌍이 만들어지지 않아 <b>아무도 이 API 를 부를 수 없다</b>.

        배지의 색은 <b>값이 `0` 인가</b>가 정한다. `err` 인 것은 §5.4 의 제목이
        <i>"경고가 아니라 대개 결함이다"</i> 이기 때문이며, <b>대개</b> 인 것은 배포 예정
        화면의 API 가 먼저 들어오는 정상 경로가 있어서다 — 그래서 <b>막지는 않는다</b>.
      */
      field: 'menuCount',
      header: MSG.API_CATALOG_COL_MENU_COUNT,
      type: 'number',
      width: 120,
      // 파생이라 정렬 대상이 아니다(frontend/grid.md) — 두 번째 쿼리가 세는 값이라 ORDER BY 에 넣을
      // 컬럼이 없다. 전량을 물어야 하므로 `매핑 상태` 를 <b>서버 조건</b>으로 두었다.
      filter: false,
      badge: (row) =>
        row.menuCount === 0 ? { text: label(MSG.API_CATALOG_UNMAPPED), tone: 'err' } : null,
    },
    {
      /*
        <b>감사 컬럼이 아니라 `최종 시드 반영` 이다</b>(screen/admin/system/api-catalog/requirements.md). 시드는 전건 삭제 후 전건
        삽입이라(seed.md) <b>전 행이 같은 값</b>이며, <i>등록일</i> 로 보여주면 거짓말이 된다.

        <b>`hidden` 이 아니라 `visible: false` 다</b> — <i>배포가 언제 반영됐나</i> 를 물을
        자리가 실제로 있다(*"어제 배포했는데 왜 아직 미등록인가"*). 켤 수 있어야 한다(frontend/grid.md).
      */
      field: 'regDtm',
      header: MSG.API_CATALOG_COL_SEED_DTM,
      type: 'dateTime',
      width: 160,
      sortable: true,
      visible: false,
    },
  ];
}

/** 하단 pane — 이 API 를 쓰는 메뉴(screen/admin/system/api-catalog/requirements.md). <b>행 추가도 삭제도 없다.</b> */
function buildMenuColumns(): ColumnDef<ApiMenuRow>[] {
  return [
    {
      /*
        <b>전체 경로다</b> — 메뉴명만으로는 어느 것인지 모른다(screen/admin/system/api-catalog/requirements.md). 이 화면에 오는 사람은
        403 하나를 들고 왔을 뿐이라 그 메뉴를 <b>모르는 상태</b>다.
      */
      field: 'menuPath',
      header: MSG.API_CATALOG_COL_MENU_PATH,
      type: 'text',
      width: 260,
      fill: true,
      sortable: true,
      editable: false,
    },
    {
      field: 'menuCd',
      header: MSG.API_CATALOG_COL_MENU_CD,
      type: 'text',
      width: 160,
      sortable: true,
      editable: false,
    },
    {
      /*
        메뉴가 꺼져 있으면 이 매핑은 <b>살아 있어도 소용없다</b>(backend/security.md 게이트 ④). 옆 칸의
        인원과 <b>다른 것을 말한다</b> — 이 칸은 <i>대상이 살아 있나</i>, 저 칸은 <i>줄 사람이
        있나</i> 다.
      */
      field: 'useYn',
      header: MSG.API_CATALOG_COL_MENU_USE_YN,
      type: 'ynFlag',
      width: 100,
      sortable: true,
      editable: false,
    },
    {
      /*
        AUTHZ-13 — screen/admin/system/api-catalog/requirements.md 탭 2 와 같은 계산이다. <b>게이트 ④를 먹이지 않은 수</b>이며 그
        이유는 서버가 적었다(`ApiCatalogQueryService`).

        <b>`0` 이면 셋째 갈래의 답이다</b> — API 도 있고 매핑도 있는데 아무도 못 부른다면
        고칠 곳은 역할 권한이나 개인 예외(screen/user/requirements.md)다.
      */
      field: 'accessibleUserCount',
      header: MSG.API_CATALOG_COL_USER_COUNT,
      type: 'number',
      width: 130,
      // 파생이라 정렬 대상이 아니다(frontend/grid.md) — 서버 화이트리스트에도 없다.
      filter: false,
    },
  ];
}

function actionOptions(): SelectOption[] {
  return ACTIONS.map((action) => ({ value: action, text: label(ACTION_LABEL[action]) }));
}

// ── 조회조건 (screen/admin/system/api-catalog/requirements.md) ────────────────────────────────────────────

/**
 * 넷이고 <b>넷째가 진단의 입구</b>다.
 *
 * <p>`매핑 상태` 를 컬럼 필터로 두면 <b>현재 페이지 안에서만</b> 걸린다(frontend/grid.md). 미매핑만
 * 골라 보는 것이 이 화면에서 가장 자주 하는 일이고 그 답은 <b>전량</b>에 대한 것이라야
 * 하므로 <b>서버 조건</b>이다 — §5.6 이 엑셀을 두는 이유로 적은 <i>"결함 목록이 그대로 파일이
 * 된다"</i> 도 이 조건 없이는 성립하지 않는다.
 */
function buildSearchFields(defaultUrl: string): SearchField[] {
  return [
    {
      field: URL_FIELD,
      label: MSG.API_CATALOG_SEARCH_API_URL,
      type: 'text',
      // 넘겨받아 열린 탭이면 채워진 채로 시작한다 — screen/log/access/requirements.md.
      defaultValue: defaultUrl,
      /*
        <b>기본이 `contains` 다.</b> 로그에서 들고 오는 것은 대개 전체 URL 이라 `eq` 가 맞을
        것 같지만, screen/log/access/requirements.md 가 <i>"뒷마디로 찾고 싶으면 API_CATALOG 에서 URL 을 확정해 오는
        것이 맞는 동선"</i> 이라고 적었다 — 그 동선의 입구가 이 칸이다.
      */
      op: 'contains',
      // 값 없음·값 있음이 없다 — PK 라 NOT NULL 이고 전건이거나 0건이다.
      ops: ['eq', 'startsWith', 'contains', 'endsWith'],
    },
    {
      field: 'apiNm',
      label: MSG.API_CATALOG_SEARCH_API_NM,
      type: 'text',
      op: 'contains',
      // `@Operation.summary` 가 필수라 언제나 값이 있다 — ArchUnit 이 지킨다(screen/admin/system/api-catalog/requirements.md).
      ops: ['eq', 'startsWith', 'contains', 'endsWith'],
    },
    {
      /*
        <b>공통코드가 아니다</b>(sys/code.md · frontend/packages.md) — 값에 따라 프로세스가 갈리는 코드라
        소스가 값을 갖는다. 그래서 `grpCd` 가 아니라 `options` 다(frontend/search-form.md).
      */
      field: 'actionCd',
      label: MSG.API_CATALOG_SEARCH_ACTION,
      type: 'select',
      // 서버가 `=` 만 받는다 — 열거값이라 부등호가 뜻을 갖지 않는다.
      ops: ['eq'],
      options: actionOptions(),
    },
    {
      /*
        <b>진단의 입구다.</b> 파생 조건이며 판정은 <b>매핑 행의 존재</b>이지 값 비교가 아니다 —
        screen/code/requirements.md 의 <i>변경 여부</i> 와 같은 모양이다.

        기본값을 두지 않는다(<i>전체</i>) — <b>미매핑을 기본으로 걸면</b> 이 화면이 결함
        목록이 되고, 403 하나를 들고 온 사람이 <i>자기 URL 이 목록에 없다</i> 를 미등록으로
        잘못 읽는다.
      */
      field: 'mapped',
      label: MSG.API_CATALOG_SEARCH_MAPPED,
      type: 'select',
      ops: ['eq'],
      options: [
        { value: 'Y', text: label(MSG.API_CATALOG_MAPPED) },
        { value: 'N', text: label(MSG.API_CATALOG_UNMAPPED) },
      ],
    },
  ];
}
