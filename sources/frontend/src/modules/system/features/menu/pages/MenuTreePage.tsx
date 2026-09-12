// @feat FEAT-503
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { App, Select, Space, Switch, Tag, Typography, theme } from 'antd';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { hasPermission } from '@/shared/authz/permission';
import { menuIcon, menuIconOf, MENU_ICONS } from '@/shared/authz/menuIcons';
import { useAuthStore } from '@/shared/stores/authStore';
import { SCREENS } from '@/shared/routes/screenRegistry';
import { onHandoff, useHandoff } from '@/shared/routes/handoffStore';
import { TreeGrid } from '@/shared/tree/TreeGrid';
import { buildTree, heightOf, selfAndDescendants } from '@/shared/tree/treeModel';
import type { TreeGridHandle, TreeNode } from '@/shared/tree/types';
import { SplitPane } from '@/shared/grid/SplitPane';
import { SWITCH_WIDTH } from '@/shared/grid/columnDefs';
import type { GridButtonControl } from '@/shared/grid/types';
import { deleteNode, getMenuTree, saveMenu, saveNode, saveTree } from '@/modules/system/features/menu/api/menuApi';
import { AddNodeModal } from '@/modules/system/features/menu/components/AddNodeModal';
import { MenuDetailTabs } from '@/modules/system/features/menu/components/MenuDetailTabs';
import type { MenuSiblingGroup, MenuTreeRow } from '@/modules/system/features/menu/types';

/**
 * `MENU_TREE` — screen/admin/system/menu/requirements.md. <b>통째로 즉시 저장이다.</b>
 *
 * <p>이 화면의 절반이 그 한 줄에서 나온다. 위치 변경은 <b>즉시일 수밖에 없고</b>(형제
 * 전체가 다시 쓰이며 `@CustomLock(WAIT)` 로 직렬화된다 — sys/menu.md), 한 그리드 안에서 일괄과
 * 즉시를 섞지 않으므로 <b>전부 즉시</b>가 됐다.
 *
 * <pre>
 * 즉시 저장이 지우는 것        대신
 * ────────────────────────────────────────────────
 * 행 상태 컬럼                 없다 — 미저장 상태가 존재하지 않는다
 * 저장 버튼                    없다
 * 삭제 컬럼                    ① 의 삭제 버튼 + 확인
 * addRow 의 미저장 신규 행     ① 의 추가 버튼 둘 + 모달
 * 되돌리기                     셀은 다시 고치고 스위치는 다시 누른다.
 *                              <b>드래그만 그것으로 부족해</b> 놓기 전에 묻는다
 * </pre>
 *
 * <h2>이 화면이 실제로 하는 일 — 리프를 만드는 곳이 아니다</h2>
 *
 * 프론트 라우트는 <b>정적 맵이고 배포로만 바뀐다</b>(backend/api.md) — 화면에서 리프를 새로 만들어도
 * 그 URL 에 컴포넌트가 없다. 자주 하는 일은 <b>구조 정리</b>(폴더 추가 · 순서 · 부모 바꾸기)와
 * <b>아이콘 · 사용 여부</b>이며, 리프 추가는 <b>배포 뒤에</b> 트리에 붙이는 드문 일이다.
 *
 * <p>그래서 <b>URL 은 고르는 것</b>이다 — 손으로 치게 두면 오타가 곧 404 이고, 그 값은
 * <b>저장은 되지만 열리지 않는다</b>. 목록이 이미 있는데 자유 입력을 두는 것은 근거가 없다.
 *
 * <h2>검색은 필터가 아니다 — 그리고 칸이 하나다</h2>
 *
 * 조건에 맞는 노드만 남기면 부모가 사라져 <b>트리가 아니게 된다</b>. 일치 노드를
 * 강조하고 <b>그 경로를 펼치며</b>, 첫 일치로 스크롤한다.
 *
 * <p><b>칸 셋이 하나가 됐다</b>(2026-08-31 요청). 이름·코드·URL 을 각각 받고 {@code AND} 로
 * 좁히던 것을 <b>{@code OR} 로 잇는 칸 하나</b>로 합쳤다 — 사람은 <i>손에 있는 것</i>으로
 * 찾고, 어느 칸에 넣을지를 먼저 정해야 하는 것이 곧 마찰이다.
 *
 * <p><b>자리도 브레드크럼에서 트리 ①로 내려왔다</b>. 슬롯은 셸이 그리는 구조라 값이 한 커밋
 * 늦게 도착해 <b>한글이 두 번 입력됐다</b>(screen/admin/system/user/requirements.md 에서 실물로 겪었다). 이동 버튼 둘은 뺐다 —
 * 강조가 경로를 펼치므로 나머지 일치도 같은 화면 안에 있다.
 */

const MENU_CD = 'MENU_TREE';

/** 리프 포함 5단이 상한이다 — sys/menu.md. 서버도 같은 값을 본다(sys/menu.md). */
const MAX_DEPTH = 5;

export function MenuTreePage() {
  const { modal, message } = App.useApp();
  const { token } = theme.useToken();
  const permissions = useAuthStore((state) => state.permissions);
  const canSave = hasPermission(permissions, MENU_CD, 'SAVE');

  /**
   * 넘겨받은 메뉴 — screen/admin/system/menu/requirements.md 가 요구한 도착 지점이다.
   *
   * <p>`API_CATALOG` 하단에서 더블 클릭하면 그 메뉴 코드가 건네져 온다. <b>마운트할 때 한 번
   * 읽고 지운다</b>({@code takeHandoff}) — 넘겨주기는 <b>사건</b>이지 상태가 아니라서, 남겨
   * 두면 이 화면을 다음에 열 때도 같은 곳으로 튄다.
   *
   * <p>효과가 아니라 <b>초기값</b>인 것이 요점이다. 효과로 읽으면 <i>첫 렌더는 빈 화면,
   * 두 번째 렌더에서 이동</i> 이 되어 사람이 그 깜빡임을 본다.
   */
  const handoff = useHandoff(MENU_CD);

  /**
   * 고른 메뉴 — <b>행이 아니라 코드로 든다</b>.
   *
   * <p>즉시 저장이라 셀 하나를 고칠 때마다 트리를 다시 읽는데, 행 객체를 들고 있으면
   * 그 뒤로 <b>낡은 객체</b>를 가리킨다 — 하단 탭이 방금 바꾼 값을 못 보고, 삭제 게이트가
   * 옛 건수로 판정한다. 코드로 들면 <b>매번 지금 트리에서 다시 찾는다</b>.
   */
  const [selectedCd, setSelectedCd] = useState<string | null>(handoff);
  const [addParent, setAddParent] = useState<{ menuCd: string | null; name: string | null } | null>(
    null,
  );
  const tree = useRef<TreeGridHandle>(null);

  /*
    조회조건 셋 — 거르지 않고 찾아간다.

    넘겨받았으면 <b>메뉴 코드 칸이 채워진 채로</b> 시작한다. 그 메뉴는 접힌 폴더 안에 있을
    수 있는데, 이 화면에서 <i>경로를 펼치고 스크롤하는</i> 수단이 이미 검색이다 — 같은 일을
    하는 길을 둘로 만들지 않는다.
  */
  /**
   * 검색어 <b>하나</b>가 이름·코드·URL 을 함께 본다 — 2026-08-31 요청 · screen/admin/system/menu/requirements.md.
   *
   * <p>칸이 셋이었다. 그런데 <b>사람은 손에 있는 것으로 찾는다</b> — 이름이거나 코드이거나
   * URL 이고, <i>어느 칸에 넣을지</i> 를 먼저 정해야 하는 것이 곧 마찰이다.
   *
   * <p><b>넘겨받은 코드가 여기 들어온다</b>({@code handoff}). 칸이 셋일 때는 코드 칸의
   * 초기값이었고, 하나가 된 뒤에도 <b>코드로 걸린다</b> — 셋을 함께 보므로 그대로 맞는다.
   */
  const [term, setTerm] = useState(handoff ?? '');

  /**
   * <b>이미 열려 있을 때</b>의 넘겨주기 — 위의 초기값과 <b>짝이다</b>.
   *
   * <p>frontend/tabs.md 대로 같은 메뉴를 다시 열면 새 탭이 아니라 <b>이미 있는 탭이 활성화</b>되고,
   * 비활성 탭도 마운트된 채이므로(frontend/tabs.md) 이 화면은 <b>다시 마운트되지 않는다</b> — 초기값
   * 하나로 두면 그 넘겨주기는 아무 일도 일으키지 못한다.
   *
   * <p>구독 콜백에서 값을 받는다. 효과가 하는 일은 <b>구독을 걸고 푸는 것</b>뿐이며, 상태를
   * 바꾸는 것은 렌더가 아니라 <b>사건</b>이다.
   */
  useEffect(
    () =>
      onHandoff(MENU_CD, (menuCd) => {
        setSelectedCd(menuCd);
        // 접힌 폴더 안에 있을 수 있다 — 펼치고 스크롤하는 수단이 검색이다.
        setTerm(menuCd);
      }),
    [],
  );

  /*
    <b>첫 진입에 스스로 부른다.</b> 트리가 곧 목록이라 빈 판으로 시작할 이유가 없고, 조건이
    거르지 않으므로 조회가 언제나 전건이라 <b>누르기 전과 뒤가 같다</b> — 조회 버튼을
    기다리는 다른 화면들과 갈리는 자리다.

    <b>{@code useGridController} 가 아니라 {@code useQuery} 다.</b> 저것은 조건·정렬·페이징·
    저장을 들고 있는데 여기 있는 것은 <b>하나도 없다</b>(§4.2.2 · §4.4 · §4.10) — 쓰면 절반이
    죽은 채로 붙어 있게 되고, 다음 사람이 <i>왜 여기서만 안 되나</i> 를 묻는다.
  */
  const treeQuery = useQuery({
    queryKey: ['menuTree'],
    queryFn: () => getMenuTree(),
  });
  const rows = useMemo(() => treeQuery.data?.content ?? [], [treeQuery.data]);

  const { refetch } = treeQuery;

  /**
   * ① 의 <b>조회</b> — 선택을 놓는다(frontend/grid.md).
   *
   * <p>조회는 목록을 통째로 바꾸므로 이전에 보던 행이 결과에 없을 수도 있다. 하단이 남아
   * 있으면 <b>다른 메뉴의 권한을 이 메뉴 것으로</b> 보게 된다. §4.5 의 집합 검증 실패에서
   * 복구하는 경로이기도 하다.
   */
  const read = useCallback(async () => {
    setSelectedCd(null);
    await refetch();
  }, [refetch]);

  /**
   * 저장 뒤의 다시 읽기 — <b>선택을 놓지 않는다</b>. {@link read} 와 갈리는 자리다.
   *
   * <p>즉시 저장이라 셀 하나를 고칠 때마다 트리를 다시 읽는데, 그때마다 선택이
   * 풀리면 <b>아이콘 하나 바꿨다고 읽던 하단이 사라진다</b>(2026-08-30 실물). frontend/grid.md 이
   * 선택을 놓으라고 한 것은 <i>사람이 조회를 눌렀을 때</i> 이고, 그 근거는 <b>목록이 통째로
   * 바뀌었을 수 있다</b> 는 것이다 — 자기가 방금 고친 한 행을 다시 읽는 것은 그 경우가 아니다.
   *
   * <p>선택을 <b>코드로 들기 때문에</b> 이것이 안전하다. 행 객체를 들었다면 다시 읽은 뒤의
   * 낡은 객체를 가리켰을 것이다.
   */
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const nodes = useMemo(
    () => indexOf(buildTree(rows, idOf, parentOf)),
    [rows],
  );

  /**
   * <b>지금 트리에서 다시 찾는다.</b> 트리가 도착하기 전에는 {@code null} 이고, 넘겨받은
   * 코드가 트리에 없어도(지워진 메뉴를 가리켰다) {@code null} 이다 — 둘 다 <i>고른 것이
   * 없다</i> 이며 하단이 빈 상태를 낸다(frontend/grid.md).
   */
  const selected = selectedCd === null ? null : (nodes.get(selectedCd)?.data ?? null);

  // ── 검색 (screen/admin/system/menu/requirements.md) ─────────────────────────────────────────────

  /**
   * <b>셋을 {@code OR} 로 잇는다</b> — 칸이 하나가 됐다(2026-08-31 요청).
   *
   * <p>{@code AND} 였다. 칸이 셋일 때는 그것이 <i>좁히는</i> 뜻이었지만 칸이 하나면 <b>넣은
   * 글자가 어디서든 걸려야</b> 한다 — {@code USER_AUTH_MGMT} 의 사용자 조건이 ID 와 이름을
   * 함께 보는 것과 같은 규칙이며(screen/admin/system/user/requirements.md), 그쪽도 서버에서 {@code OR} 다.
   */
  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return [];
    return rows
      .filter(
        (row) =>
          row.menuNm.toLowerCase().includes(needle)
          || row.menuCd.toLowerCase().includes(needle)
          || (row.menuUrl ?? '').toLowerCase().includes(needle),
      )
      .map((row) => row.menuCd);
  }, [rows, term]);

  const highlighted = useMemo(() => new Set(matches), [matches]);
  // 첫 일치로 스크롤한다 — 강조가 경로를 펼치므로 나머지도 같은 화면 안에 있다(screen/admin/system/menu/requirements.md).
  const focused = matches[0] ?? null;

  /**
   * 트리 ①의 검색 칸 — <b>브레드크럼이 아니라 거기다</b>(2026-08-31 · screen/admin/system/menu/requirements.md).
   *
   * <p>근거는 {@code TreeSearch} 에 있다. 슬롯에 두면 값이 <b>한 커밋 늦게</b> 도착해
   * <b>한글이 두 번 입력되고</b>, 자리도 <i>조회조건 숨기기</i> 옆이라 무엇을 검색하는지가
   * 화면에 없었다.
   */
  const treeSearch = useMemo(
    () => ({ placeholder: MSG.MENU_SEARCH_ANY, value: term, onChange: setTerm }),
    [term],
  );

  /*
    브레드크럼 슬롯이 <b>빈다</b>(2026-08-31) — 이 화면에 있던 것은 검색 칸 셋과 이동 버튼
    둘뿐이었고 그것이 전부 트리 ①로 옮겨 갔다(위 {@code treeSearch}). 조회조건 폼이 없는
    화면이라 frontend/tabs.md 의 <i>조회조건 접기</i> 도 여기 올 것이 없다.
  */

  // ── 쓰기 넷 (screen/admin/system/menu/requirements.md) ───────────────────────────────────────────

  /**
   * 셀 하나에 요청 하나 — <b>응답을 받고 값을 바꾼다</b>.
   *
   * <p>즉시 저장은 낙관적 반영이 아니다. 되돌리기 수단이 없는 화면에서 화면과 DB 가 어긋나면
   * 고칠 방법이 없으므로, 실패하면 <b>조회로 되돌린다</b> — 셀이 제자리로 간다.
   */
  const saveAttributes = useCallback(
    async (row: MenuTreeRow, patch: Partial<MenuTreeRow>) => {
      const next = { ...row, ...patch };
      await saveMenu(next.menuCd, next.menuUrl, next.iconCd, next.useYn);
      // 방금 고친 한 행을 다시 읽는 것이라 선택을 놓지 않는다 — read() 와 갈린다.
      await refresh();
    },
    [refresh],
  );

  /**
   * 사용 여부 — <b>확인이 무엇을 바꾸는지 전부 말한다</b>.
   *
   * <p>끌 때는 자손 수와 <b>접근할 수 있던 인원</b>을, 켤 때는 <b>개별로 꺼 두었던 것까지
   * 켜진다</b>는 것을 말한다. 켜는 방향에 경고가 있는 것이 §3.6 과 갈리는 자리이며, 이유는
   * <b>전파가 이전 상태를 기억하지 않기</b> 때문이다 — 기억하려면 컬럼이 하나 더 필요한데
   * backend/security.md 가 `DISP_YN` 을 기각하며 적은 <i>"컬럼 둘이 한 일을 하면 어느 것을 봐야 하는지 알
   * 수 없다"</i> 가 그대로 걸린다.
   *
   * <p><b>자손 수가 `0` 이면 그 줄을 내지 않는다</b> — 항상 보이면 읽히지 않는다.
   */
  const toggleUseYn = useCallback(
    (row: MenuTreeRow, useYn: boolean) => {
      const node = nodes.get(row.menuCd);
      const family = node ? [...selfAndDescendants(node)] : [row.menuCd];
      const descendants = family.filter((menuCd) => menuCd !== row.menuCd);
      const lines: string[] = [];

      if (descendants.length > 0) {
        lines.push(
          useYn
            ? label(MSG.MENU_USE_ON_DESCENDANTS, {
                count: descendants.length,
                off: descendants.filter((menuCd) => nodes.get(menuCd)?.data.useYn === false).length,
              })
            : label(MSG.MENU_USE_OFF_DESCENDANTS, { count: descendants.length }),
        );
      }
      if (!useYn) {
        // 리프만 인원이 있다 — 구조 노드는 권한 대상이 아니라 `0` 이다(backend/security.md).
        const people = family
          .map((menuCd) => nodes.get(menuCd)?.data.accessibleUserCount ?? 0)
          .reduce((sum, count) => sum + count, 0);
        lines.push(label(MSG.MENU_USE_OFF_USERS, { count: people }));
      }

      modal.confirm({
        title: label(useYn ? MSG.MENU_USE_ON_TITLE : MSG.MENU_USE_OFF_TITLE, { name: row.menuNm }),
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        ),
        okText: label(MSG.GRID_CONFIRM_OK),
        cancelText: label(MSG.COMMON_CANCEL),
        // 취소하면 스위치가 제자리로 돌아간다 — 조회를 부르지 않으므로 값이 그대로다.
        onOk: () => void saveAttributes(row, { useYn }),
      });
    },
    [modal, nodes, saveAttributes],
  );

  /**
   * 드롭 — <b>놓으면 묻는다</b>.
   *
   * <p>즉시 저장이라 드롭이 곧 저장이다. 셀 편집은 다시 고치면 되고 스위치는 다시 누르면
   * 되지만, <b>드래그는 원래 자리를 사람이 기억해야</b> 되돌릴 수 있다 — 형제가 스무 개인
   * 폴더에서 <i>몇 번째였는지</i> 를 기억하는 사람은 없다.
   *
   * <p><b>*지금* 과 *이동* 을 나란히 낸다.</b> 목적지만 말하면 취소한 뒤 원래 자리를 찾지
   * 못한다 — 확인 문구가 <b>되돌릴 근거</b>를 함께 준다. 기본 포커스는 <b>취소</b>다.
   */
  const onDrop = useCallback(
    (drop: { dragId: string; parentId: string | null; index: number }) => {
      const node = nodes.get(drop.dragId);
      if (!node) return;

      const groups = siblingGroups(rows, drop);
      const from = { parent: node.parentId, index: siblingIndex(rows, drop.dragId) };

      modal.confirm({
        title: label(MSG.MENU_MOVE_TITLE, { name: node.data.menuNm }),
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>
              {label(MSG.MENU_MOVE_FROM, {
                path: pathOf(nodes, from.parent),
                index: from.index + 1,
              })}
            </span>
            <span>
              {label(MSG.MENU_MOVE_TO, {
                path: pathOf(nodes, drop.parentId),
                index: drop.index + 1,
              })}
            </span>
            <Typography.Text type="secondary">{label(MSG.MENU_MOVE_WARN)}</Typography.Text>
          </div>
        ),
        okText: label(MSG.GRID_CONFIRM_OK),
        cancelText: label(MSG.COMMON_CANCEL),
        // 되돌릴 수 없는 확인의 기본은 안전한 쪽이다(frontend/grid.md 의 삭제 확인과 같다).
        autoFocusButton: 'cancel',
        onOk: async () => {
          await saveTree(groups);
          // 옮긴 노드는 그대로 있다 — 선택을 놓을 이유가 없다.
          await refresh();
        },
      });
    },
    [modal, nodes, refresh, rows],
  );

  /** 삭제 — 게이트 넷이 전부 `0` 일 때만 활성이다. 즐겨찾기는 함께 지운다. */
  const removeNode = useCallback(() => {
    if (!selected) return;
    modal.confirm({
      title: label(MSG.MENU_DELETE_CONFIRM, { name: selected.menuNm }),
      okText: label(MSG.GRID_CONFIRM_OK),
      cancelText: label(MSG.COMMON_CANCEL),
      autoFocusButton: 'cancel',
      onOk: async () => {
        await deleteNode(selected.menuCd);
        await read();
      },
    });
  }, [modal, read, selected]);

  const addNode = useCallback(
    async (menuCd: string) => {
      await saveNode(addParent?.menuCd ?? null, menuCd);
      await refresh();
      /*
        <b>추가 직후 그 행을 선택한다</b>. 맨 끝이라 화면 밖에 생길 수 있고, 만든
        사람은 곧바로 URL·아이콘을 채운다 — 모달이 받지 않는 값이다.

        검색어 칸에도 넣는다: 트리가 접혀 있으면 새 행이 보이지 않는데, 이 화면에서 경로를
        펼치고 스크롤하는 수단이 검색이다.
      */
      setSelectedCd(menuCd);
      setTerm(menuCd);
      message.success(label(MSG.GRID_SAVE_DONE));
      return true;
    },
    [addParent, message, refresh],
  );

  // ── 컬럼과 버튼 ─────────────────────────────────────────────────

  /** 라우트 목록에서 고른다 — <b>다른 메뉴가 이미 쓰는 URL 은 뺀다</b>. */
  const urlOptions = useCallback(
    (row: MenuTreeRow) => {
      const taken = new Set(
        rows.filter((other) => other.menuCd !== row.menuCd).map((other) => other.menuUrl),
      );
      return [
        // 첫 항목 — <b>URL 을 비워 폴더로 되돌리는 유일한 경로</b>다.
        { value: '', label: label(MSG.MENU_URL_NONE) },
        ...Object.keys(SCREENS)
          .filter((url) => !taken.has(url))
          .map((url) => ({ value: url, label: url })),
      ];
    },
    [rows],
  );

  const columns = useMemo(
    () => [
      {
        header: MSG.MENU_COL_MENU_CD,
        width: 170,
        /*
          <b>글자 크기를 적지 않는다.</b> 설정 창의 <i>그리드 글자 크기</i>를 트리가 행에 걸고
          셀이 물려받는다(frontend/tabs.md) — 여기서 한 번 더 적으면 설정이 이 컬럼만 비껴간다.
        */
        cell: (row: MenuTreeRow) => (
          <Typography.Text>
            {row.menuCd}
            {/*
              <b>선언에서 사라진 메뉴</b>(seed.md). 시드가 지우지 않고 표시만 하므로
              — 딸린 권한이 사람의 것이다 — 지울 대상을 트리가 말해 주는 자리가 여기다.
              지우는 길은 §4.8 의 삭제 버튼이며 게이트 넷을 먼저 통과해야 한다.
            */}
            {row.srcCd === 'ORPHAN' && (
              <Tag color="warning" style={{ marginLeft: 6 }} title={label(MSG.MENU_ORPHAN_HINT)}>
                {label(MSG.MENU_ORPHAN)}
              </Tag>
            )}
          </Typography.Text>
        ),
      },
      {
        header: MSG.MENU_COL_MENU_URL,
        width: 210,
        /*
          <b>자식이 있으면 잠긴다</b> — URL 과 자식은 배타다. 화면이 미리 막고
          저장 서비스가 다시 막는다: 화면의 방어는 UX 이지 방어가 아니다(backend/security.md).

          이제 그 잠금이 <b>색으로도 보인다</b> — 열리지 않는 칸은 읽기 전용 색조가 깔린다
          (`TreeColumn.editable` · frontend/grid.md).
        */
        editable: (_row: MenuTreeRow, node: TreeNode<MenuTreeRow>) =>
          canSave && node.children.length === 0,
        /*
          <b>평소에는 값만 보인다</b>(2026-08-31 요청). 콤보가 늘 서 있으면 판을 쓰는 옆
          그리드와 이질적이고, 무엇보다 <i>구조를 보는</i> 화면이 입력 화면처럼 읽혔다.

          <b>`미연결` 은 사후 진단이다.</b> 콤보로 고르므로 만드는 순간에는 생기지 않지만,
          배포로 라우트가 사라지거나 시드로 직접 넣으면 생긴다 — 저장을 막지는 않는다.
        */
        cell: (row: MenuTreeRow) =>
          row.menuUrl === null ? (
            // 폴더의 URL 은 <b>비어 있는 것이 아니라 없는 것</b>이다 — 파생 수 컬럼과 같은 `—`.
            <Typography.Text type="secondary">—</Typography.Text>
          ) : (
            <Space size={4}>
              <Typography.Text>{row.menuUrl}</Typography.Text>
              {hasUnlinked(row) && <Tag color="warning">{label(MSG.MENU_UNLINKED)}</Tag>}
            </Space>
          ),
        editor: (row: MenuTreeRow, _node: TreeNode<MenuTreeRow>, done: () => void) => (
          <Select
            size="small"
            /*
              <b>열리면서 드롭다운이 함께 열린다</b> — 더블 클릭 뒤에 한 번 더 눌러야 하면
              제스처가 둘이 된다(판의 콤보 편집기도 열자마자 목록을 낸다).
            */
            autoFocus
            defaultOpen
            style={{ width: '100%' }}
            value={row.menuUrl ?? ''}
            showSearch
            options={urlOptions(row)}
            // 포커스를 잃으면 <b>고르지 않은 것</b>이다 — 값은 그대로 두고 칸만 닫는다.
            onBlur={done}
            onChange={(value) => {
              done();
              void saveAttributes(row, { menuUrl: value === '' ? null : value });
            }}
          />
        ),
      },
      {
        header: MSG.MENU_COL_ICON,
        width: 150,
        editable: () => canSave,
        // 아이콘은 <b>코드와 모양을 함께</b> 보여야 한다 — 코드만으로는 무엇인지 모른다.
        cell: (row: MenuTreeRow) =>
          row.iconCd === null ? (
            <Typography.Text type="secondary">—</Typography.Text>
          ) : (
            <Space size={4}>
              <span style={{ display: 'inline-flex', color: token.colorTextSecondary }}>
                {menuIcon(row.iconCd)}
              </span>
              <Typography.Text>{row.iconCd}</Typography.Text>
            </Space>
          ),
        editor: (row: MenuTreeRow, _node: TreeNode<MenuTreeRow>, done: () => void) => (
          <Select
            size="small"
            autoFocus
            defaultOpen
            style={{ width: '100%' }}
            value={row.iconCd ?? ''}
            showSearch
            options={[
              { value: '', label: label(MSG.MENU_URL_NONE) },
              ...Object.keys(MENU_ICONS).map((code) => ({
                value: code,
                label: (
                  <Space size={4}>
                    {menuIcon(code)}
                    {code}
                  </Space>
                ) as unknown as string,
              })),
            ]}
            onBlur={done}
            onChange={(value) => {
              done();
              void saveAttributes(row, { iconCd: value === '' ? null : value });
            }}
          />
        ),
      },
      {
        header: MSG.MENU_COL_USE_YN,
        width: 90,
        /*
          <b>스위치는 셀이 곧 편집기다</b> — 판의 {@code ynFlag} 컬럼과 같다(frontend/grid.md).
          더블 클릭이 열 것이 없으므로 {@code editor} 가 없고, 그래도 <b>잠긴 칸이
          아니므로</b> 이것을 선언한다 — 안 하면 읽기 전용 색조가 깔린다.
        */
        editable: () => canSave,
        cell: (row: MenuTreeRow) => (
          <Switch
            size="small"
            // <b>그리드의 스위치 컬럼과 같은 폭</b>이다 — frontend/grid.md · `SWITCH_WIDTH`.
            style={{ minWidth: SWITCH_WIDTH }}
            checked={row.useYn}
            disabled={!canSave}
            onChange={(value) => toggleUseYn(row, value)}
          />
        ),
      },
      {
        header: MSG.MENU_COL_API_COUNT,
        width: 100,
        align: 'right' as const,
        cell: (row: MenuTreeRow) => <span>{row.apiCount}</span>,
      },
      {
        header: MSG.MENU_COL_USER_COUNT,
        width: 120,
        align: 'right' as const,
        // 리프만 값이 있다 — 구조 노드는 권한 대상이 아니라 세는 것이 정의되지 않는다.
        cell: (row: MenuTreeRow) => <span>{row.menuUrl === null ? '—' : row.accessibleUserCount}</span>,
      },
      {
        header: MSG.MENU_COL_ROLE_COUNT,
        width: 100,
        align: 'right' as const,
        cell: (row: MenuTreeRow) => <span>{row.roleCount}</span>,
      },
    ],
    [canSave, saveAttributes, toggleUseYn, token.colorTextSecondary, urlOptions],
  );

  /** 삭제를 막는 것들 — <b>어느 쪽이 막는지 말한다</b>(§4.8 · §3.5 의 규약). */
  const blockers = useMemo(() => {
    if (!selected) return null;
    const found: string[] = [];
    if ((nodes.get(selected.menuCd)?.children.length ?? 0) > 0) found.push(label(MSG.MENU_COL_MENU_NM));
    if (selected.apiCount > 0) found.push(label(MSG.MENU_COL_API_COUNT));
    if (selected.roleCount > 0) found.push(label(MSG.MENU_COL_ROLE_COUNT));
    return found.length === 0 ? null : found.join(' · ');
  }, [nodes, selected]);

  const childBlock = useMemo(() => {
    if (!selected) return MSG.MENU_ADD_CHILD_NO_SELECTION;
    if (selected.menuUrl !== null) return MSG.MENU_ADD_CHILD_LEAF;
    if ((nodes.get(selected.menuCd)?.depth ?? 1) >= MAX_DEPTH) return MSG.MENU_ADD_CHILD_DEPTH;
    return null;
  }, [nodes, selected]);

  const controls = useMemo<GridButtonControl[]>(
    () => [
      /*
        Ⓑ 의 둘은 <b>`actionCd` 를 선언하지 않는다</b> — 표시를 바꿀 뿐 데이터를 읽지도
        쓰지도 않는다. frontend/grid.md 은 선언한 것만 권한 판정을 받는다고 정했다.

        <b>토글 하나로 두지 않는다</b> — 일부만 펼친 중간 상태에서 토글이 무엇을
        가리키는지 말할 수 없다.
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
      {
        key: 'addRoot',
        slot: 'beforeRead',
        type: 'button',
        label: MSG.MENU_ADD_ROOT,
        actionCd: 'SAVE',
        menuCd: MENU_CD,
        onClick: () => setAddParent({ menuCd: null, name: null }),
      },
      {
        key: 'addChild',
        slot: 'beforeRead',
        type: 'button',
        label: MSG.MENU_ADD_CHILD,
        actionCd: 'SAVE',
        menuCd: MENU_CD,
        disabled: childBlock !== null,
        hint: childBlock ?? undefined,
        onClick: () =>
          selected && setAddParent({ menuCd: selected.menuCd, name: selected.menuNm }),
      },
      {
        key: 'delete',
        slot: 'beforeRead',
        type: 'button',
        label: MSG.MENU_DELETE,
        actionCd: 'SAVE',
        menuCd: MENU_CD,
        disabled: selected === null || blockers !== null,
        hint: blockers === null ? undefined : MSG.MENU_DELETE_BLOCKED,
        onClick: removeNode,
      },
    ],
    [blockers, childBlock, removeNode, selected],
  );

  return (
    <FillColumn>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SplitPane
          storageKey="menuTree"
          first={(collapsed, expand, axis) => (
            <TreeGrid<MenuTreeRow>
              handleRef={tree}
              title={MSG.MENU_TREE_TITLE}
              /*
                <b>접히면 제목만 남는다</b>(frontend/grid.md). 넘기지 않으면 트리는 자기가 접혔다는
                것을 몰라 머리·판·푸터를 그대로 그리고, 좁아진 pane 안에서 그것이 <b>잘린
                표</b>로 보인다(screen/admin/system/user/requirements.md 에서 실물로 겪었다).
              */
              collapsed={collapsed}
              collapsedAxis={axis}
              onExpand={expand}
              menuCd={MENU_CD}
              rows={rows}
              idOf={idOf}
              parentOf={parentOf}
              hierarchyHeader={MSG.MENU_COL_MENU_NM}
              hierarchy={(row) => (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    minWidth: 0,
                    // 꺼진 메뉴는 흐리다 — 최종 게이트에서 걸린다(backend/security.md ④).
                    opacity: row.useYn ? 1 : 0.45,
                  }}
                >
                  {/*
                    <b>사이더와 같은 아이콘</b>이다 — frontend/tabs.md · `menuIconOf`. 폴백까지
                    공유하므로, 아이콘을 <b>비워 둔 메뉴</b>가 여기서는 폴더/문서로 보이고
                    사이더에서는 다른 모양이던 일이 없어진다(그 폴백이 사이더에만 있었다).
                  */}
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
              )}
              /* 폭을 내용에서 내고 잘린 이름은 툴팁이 말한다 — screen/admin/system/menu/requirements.md. */
              hierarchyText={(row) => row.menuNm}
              search={treeSearch}
              columns={columns}
              loading={treeQuery.isFetching}
              selectedId={selected?.menuCd ?? null}
              onSelect={(row) => setSelectedCd(row?.menuCd ?? null)}
              onRead={() => void read()}
              controls={controls}
              onDrop={canSave ? onDrop : undefined}
              canHaveChildren={(row, node) => row.menuUrl === null && node.depth < MAX_DEPTH}
              verdict={(dragNode, target, zone) => verdictOf(dragNode, target, zone, nodes)}
              highlighted={highlighted}
              focusedId={focused}
              excel={{
                fileName: label(MSG.MENU_TREE_TITLE),
                build: () => excelTable(rows, nodes),
              }}
            />
          )}
          /*
            <b>접힘을 넘긴다</b>(frontend/grid.md) — 탭바가 사라지고 활성 탭의 그리드가 제목 한 줄로
            접힌다. 넘기지 않으면 탭이 있는 하단은 <b>탭바·버튼 줄·페이징이 그대로 남고
            판만 0px</b> 이 되어 <i>판이 깨진 것</i>으로 보인다.
          */
          second={(collapsed, expand) => (
            <MenuDetailTabs
              menuCd={MENU_CD}
              menu={selected}
              collapsed={collapsed}
              onExpand={expand}
            />
          )}
        />
      </div>

      {/*
        <b>열려 있을 때만 그린다.</b> 매번 새로 마운트되므로 칸이 빈 채로 열리고, 그 사실이
        모달 안의 {@code useState('')} 한 줄에 그대로 남는다 — 상태를 되돌리는 효과가 없다.
      */}
      {addParent !== null && (
        <AddNodeModal
          parentName={addParent.name}
          onSubmit={addNode}
          onCancel={() => setAddParent(null)}
        />
      )}
    </FillColumn>
  );
}

// ── 트리 유틸 ────────────────────────────────────────────────────

const idOf = (row: MenuTreeRow) => row.menuCd;
const parentOf = (row: MenuTreeRow) => row.upMenuCd;

/** 라우트 맵에 없는 URL — <b>프론트만 아는 사실</b>이라 서버가 판정할 수 없다. */
function hasUnlinked(row: MenuTreeRow): boolean {
  return row.menuUrl !== null && !(row.menuUrl in SCREENS);
}

function indexOf(roots: TreeNode<MenuTreeRow>[]): Map<string, TreeNode<MenuTreeRow>> {
  const map = new Map<string, TreeNode<MenuTreeRow>>();
  const walk = (list: TreeNode<MenuTreeRow>[]) =>
    list.forEach((node) => {
      map.set(node.id, node);
      walk(node.children);
    });
  walk(roots);
  return map;
}

/** 확인 문구의 <i>지금</i> 과 <i>이동</i> 이 가리키는 경로 — 최상위는 이름이 없다. */
function pathOf(nodes: Map<string, TreeNode<MenuTreeRow>>, parentId: string | null): string {
  if (parentId === null) return label(MSG.MENU_ADD_TITLE_ROOT);
  const names: string[] = [];
  let cursor: string | null = parentId;
  const seen = new Set<string>();
  while (cursor && seen.add(cursor)) {
    const node = nodes.get(cursor);
    if (!node) break;
    names.unshift(node.data.menuNm);
    cursor = node.parentId;
  }
  return names.join(' › ');
}

/** 그 형제 안에서 몇 번째인가 — 확인 문구가 <b>되돌릴 근거</b>로 쓴다. */
function siblingIndex(rows: MenuTreeRow[], menuCd: string): number {
  const row = rows.find((candidate) => candidate.menuCd === menuCd);
  if (!row) return 0;
  return rows.filter((candidate) => candidate.upMenuCd === row.upMenuCd).indexOf(row);
}

/**
 * 드롭 → <b>형제 목록</b>(sys/menu.md).
 *
 * <p>부모가 바뀌면 <b>둘</b>이다 — 뺀 쪽과 넣은 쪽. 한 요청에 담으므로 배열 하나에 넣는다.
 * <b>뺀 쪽을 빼먹지 않는 것</b>이 중요하다: 중간에서 하나가 빠진 형제는 `1,2,4` 가 되고,
 * sys/menu.md 가 전체 재작성으로 얻으려던 <i>언제나 정규화 상태</i> 가 깨진다.
 */
function siblingGroups(
  rows: MenuTreeRow[],
  drop: { dragId: string; parentId: string | null; index: number },
): MenuSiblingGroup[] {
  const drag = rows.find((row) => row.menuCd === drop.dragId);
  if (!drag) return [];

  const childrenOf = (parentId: string | null) =>
    rows.filter((row) => row.upMenuCd === parentId).map((row) => row.menuCd);

  const source = drag.upMenuCd;
  const destination = childrenOf(drop.parentId).filter((menuCd) => menuCd !== drop.dragId);
  destination.splice(Math.min(drop.index, destination.length), 0, drop.dragId);

  if (source === drop.parentId) {
    return [{ upMenuCd: drop.parentId, menuCds: destination }];
  }
  return [
    { upMenuCd: source, menuCds: childrenOf(source).filter((menuCd) => menuCd !== drop.dragId) },
    { upMenuCd: drop.parentId, menuCds: destination },
  ];
}

/**
 * 놓을 수 있는가 · 무엇이라 말할 것인가 — screen/admin/system/menu/requirements.md 의 문장 넷이 여기서 만들어진다.
 *
 * <p><b>놓을 수 없는 자리에서도 이유를 낸다.</b> 왜 안 놓이는지 모르면 사용자는 버그로 읽는다.
 */
function verdictOf(
  drag: TreeNode<MenuTreeRow>,
  target: TreeNode<MenuTreeRow>,
  zone: 'before' | 'inside' | 'after',
  nodes: Map<string, TreeNode<MenuTreeRow>>,
) {
  if (zone === 'inside') {
    if (target.data.menuUrl !== null) {
      return { ok: false, text: label(MSG.MENU_DROP_LEAF, { name: target.data.menuNm }) };
    }
    // 서브트리를 통째로 끌면 <b>그 서브트리의 높이까지 더해</b> 판정한다.
    if (target.depth + heightOf(drag) > MAX_DEPTH) {
      return { ok: false, text: label(MSG.MENU_DROP_DEPTH, { max: MAX_DEPTH }) };
    }
    return { ok: true, text: label(MSG.MENU_DROP_INSIDE, { name: target.data.menuNm }) };
  }

  const parentDepth = target.parentId ? (nodes.get(target.parentId)?.depth ?? 0) : 0;
  if (parentDepth + heightOf(drag) > MAX_DEPTH) {
    return { ok: false, text: label(MSG.MENU_DROP_DEPTH, { max: MAX_DEPTH }) };
  }
  return {
    ok: true,
    text: label(zone === 'before' ? MSG.MENU_DROP_BEFORE : MSG.MENU_DROP_AFTER, {
      name: target.data.menuNm,
    }),
  };
}

/**
 * 엑셀 — <b>계층을 경로 컬럼으로 편다</b>.
 *
 * <p>엑셀의 들여쓰기는 <b>필터·정렬 한 번에 무너진다</b>. 행 순서는 화면 그대로 전위 순회이며
 * 다시 정렬하면 트리가 아니게 된다.
 */
function excelTable(rows: MenuTreeRow[], nodes: Map<string, TreeNode<MenuTreeRow>>) {
  return {
    /*
      <b>키가 함께 간다</b> — 다운로드 이력이 컬럼 식별자를 남긴다(playbook/excel-download.md). `path` 만
      행에 없는 파생이며(계층을 편 것) 나머지 일곱은 {@link MenuTreeRow} 의 필드명 그대로다.
    */
    columns: [
      { key: 'path', header: label(MSG.MENU_EXCEL_PATH) },
      { key: 'menuCd', header: label(MSG.MENU_COL_MENU_CD) },
      { key: 'menuUrl', header: label(MSG.MENU_COL_MENU_URL) },
      { key: 'iconCd', header: label(MSG.MENU_COL_ICON) },
      { key: 'useYn', header: label(MSG.MENU_COL_USE_YN) },
      { key: 'apiCount', header: label(MSG.MENU_COL_API_COUNT) },
      { key: 'accessibleUserCount', header: label(MSG.MENU_COL_USER_COUNT) },
      { key: 'roleCount', header: label(MSG.MENU_COL_ROLE_COUNT) },
    ],
    rows: rows.map((row) => [
      `${pathOf(nodes, row.upMenuCd)}${row.upMenuCd === null ? '' : ' › '}${row.menuNm}`,
      row.menuCd,
      row.menuUrl,
      row.iconCd,
      row.useYn ? 'Y' : 'N',
      row.apiCount,
      row.menuUrl === null ? null : row.accessibleUserCount,
      row.roleCount,
    ]),
  };
}
