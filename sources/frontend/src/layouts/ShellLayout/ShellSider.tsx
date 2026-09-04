import { useCallback, useMemo, useState } from 'react';
import {
  ClockCircleOutlined,
  FireOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  NodeCollapseOutlined,
  NodeExpandOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Layout, Menu, Space, Tooltip, theme, type MenuProps } from 'antd';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTabStore } from '@/shared/stores/tabStore';
import { useUiStore } from '@/shared/stores/uiStore';
import { useFavoriteStore } from '@/shared/favorite/favoriteStore';
import { menuIconOf } from '@/shared/authz/menuIcons';
import { label } from '@/shared/i18n/label';
import type { MenuIndex, MenuNode } from '@/shared/authz/menuTree';
import type { EntryTab } from '@/layouts/ShellLayout/entryTabs';
import { MSG } from '@/shared/i18n/messageKeys';

type AntMenuItem = Required<MenuProps>['items'][number];

interface Props {
  index: MenuIndex;
  onOpen: (node: MenuNode) => void;
  onOpenInNewTab: (node: MenuNode) => void;
  /** 브라우저 창을 하나 더 연다 — 앱 안의 탭이 아니다(frontend/tabs.md). */
  onOpenInBrowser: (node: MenuNode) => void;
  /** 진입 모달을 그 탭으로 연다 — frontend/tabs.md. */
  onOpenEntry: (tab: EntryTab) => void;
}

/**
 * 사이더 — frontend/tabs.md.
 *
 * <p><b>여기 있는 것은 검색과 메뉴 트리다.</b> frontend/tabs.md 는 상단에 <b>진입 스플릿 버튼</b>
 * (즐겨찾기·최근·자주)도 두라고 하는데 그것은 `SYS_USER_FAVORITE`·`SYS_USER_MENU_STAT` 이
 * 먼저다(sys/menu.md) — 자리는 frontend/tabs.md 가 이미 정해 두었으므로 그때 검색 옆에 얹으면 된다.
 *
 * <p><b>검색 칸이 없다</b>(2026-08-30 실물). 칸에 치고 Enter 를 누르면 <b>모달이 열려
 * 같은 질의를 다시 받는다</b> — 칸이 하는 일은 결국 <i>모달을 여는 것</i> 하나였고,
 * 그렇다면 돋보기 하나로 충분하다. 240px 짜리 칸이 사이더 위쪽을 통째로 쓰고 있었다.
 *
 * <p><b>활성 메뉴가 든 폴더만 열어 둔다</b>(2026-08-29). 처음에는 활성 메뉴가 바뀔 때마다
 * <b>메뉴를 통째로 새로 만들어</b> 조상을 펼쳤는데, 그러면 사람이 접어 둔 폴더까지 다시
 * 열리고 <b>접힌 사이더에서는 팝업 서브메뉴로 튀어나왔다</b>. 그렇다고 아무것도 열지 않으면
 * <b>선택 표시가 닫힌 폴더 안에 숨어</b> 지금 어디인지 보이지 않는다 — 보이지 않는 선택은
 * 선택이 아니다.
 *
 * <p>그래서 <b>열린 목록을 제어하되 빼지 않는다</b>: 사람이 연 것에 <b>활성 메뉴의 조상을
 * 더한</b> 합집합이다. 탭을 옮기면 그 조상만 열리고 나머지는 그대로 있다.
 *
 * <p><b>접혀 있을 때는 제어하지 않는다.</b> 80px 사이더에서 열린 목록을 강제하면 판이 그것을
 * <b>팝업으로</b> 낸다 — 탭을 옮겼을 뿐인데 화면 위로 메뉴가 뜬다.
 *
 * <p><b>권한 필터를 여기서 걸지 않는다.</b> 서버가 준 트리가 이미 유효 권한을 통과한 것이며
 * (backend/security.md) 화면마다 다른 규칙을 쓰면 어디선가 권한 없는 메뉴가 새어 나온다(frontend/tabs.md).
 */
export function ShellSider({
  index,
  onOpen,
  onOpenInNewTab,
  onOpenInBrowser,
  onOpenEntry,
}: Props) {
  const { token } = theme.useToken();
  const menuTree = useAuthStore((state) => state.menuTree);
  const collapsed = useUiStore((state) => state.siderCollapsed);
  const toggleSider = useUiStore((state) => state.toggleSider);
  const tabs = useTabStore((state) => state.tabs);
  const activeKey = useTabStore((state) => state.activeKey);

  const favorites = useFavoriteStore((state) => state.menuCds);
  const toggleFavorite = useFavoriteStore((state) => state.toggle);

  const actions = useMemo(
    (): ContextActions => ({
      openInNewTab: onOpenInNewTab,
      openInBrowser: onOpenInBrowser,
      isFavorite: (menuCd) => favorites.includes(menuCd),
      toggleFavorite: (menuCd) => void toggleFavorite(menuCd),
    }),
    [onOpenInNewTab, onOpenInBrowser, favorites, toggleFavorite],
  );

  const items = useMemo(() => menuTree.map((node) => toAntItem(node, actions)), [menuTree, actions]);

  const activeMenuCd = tabs.find((tab) => tab.key === activeKey)?.menuCd;

  // 사람이 연 폴더. 여기서 빼는 것은 사람뿐이다.
  const [opened, setOpened] = useState<string[]>([]);

  /** 열 수 있는 것 전부 — <b>모두 펼치기</b>가 넣는 목록이다. 리프는 열 것이 없다. */
  const branchCodes = useMemo(() => {
    const codes: string[] = [];
    const walk = (nodes: MenuNode[]) => {
      for (const node of nodes) {
        if (node.children.length > 0) {
          codes.push(node.menuCd);
          walk(node.children);
        }
      }
    };
    walk(menuTree);
    return codes;
  }, [menuTree]);
  const ancestors = useMemo(
    () =>
      activeMenuCd
        ? (index.pathByCode.get(activeMenuCd) ?? []).slice(0, -1).map((node) => node.menuCd)
        : [],
    [activeMenuCd, index],
  );
  const openKeys = useMemo(
    () => Array.from(new Set([...opened, ...ancestors])),
    [opened, ancestors],
  );

  const openByKey = useCallback(
    ({ key }: { key: string }) => {
      const node = index.byCode.get(key);
      if (node) {
        onOpen(node);
      }
    },
    [index, onOpen],
  );

  /*
    <b>상단 줄과 트리를 따로 붙든다</b> — frontend/tabs.md · 2026-08-31 실측.

    <p>탭을 옮기면 셸이 <b>세 번</b> 커밋한다({@code navigate} 로 location 이 바뀌고, 효과가
    {@code activate} 를 부르고, 그 뒤 하나 더). 사이더는 자기가 {@code tabs}·{@code activeKey} 를
    구독하므로 그 셋 <b>전부</b>에서 다시 그려졌다 — 한 번이 상단 줄 11ms + 트리 24ms 라
    전환마다 50ms 를 넘겼다.

    <p><b>그런데 첫 커밋에는 활성 메뉴가 아직 바뀌지도 않았다</b>(주소만 바뀌었고 활성 탭은
    그 다음 커밋에서 바뀐다). 상단 줄은 활성 메뉴와 아무 상관이 없고 <b>세 번 모두</b> 같은
    것을 그린다.

    <p>그래서 각자 <b>자기 입력</b>에만 반응하게 한다. 같은 엘리먼트 참조를 다시 주면 React 가
    그 subtree 를 건너뛰므로, 남는 것은 <i>활성 메뉴가 실제로 바뀐 커밋 한 번의 트리 렌더</i>
    뿐이다.

    <p><b>문구가 낡을 걱정은 없다.</b> {@code label()} 은 훅이 아니라 함수라 스스로 구독하지
    않지만, 언어 교체는 {@code window.location.reload()} 다({@code SettingsModal}) — 붙들어 둔
    엘리먼트가 옛 언어로 남는 경로가 없다. 언어를 <b>다시 그려서</b> 바꾸는 날에는 여기가
    함께 바뀌어야 한다.

    <p><b>{@code memo} 를 쓰지 않는 것은</b> 이 둘이 이 컴포넌트의 지역 상태
    ({@code opened})와 스토어 넷을 함께 읽기 때문이다 — 컴포넌트로 떼어내면 그 배선을 props
    로 옮겨야 하고, 붙드는 자리가 읽는 자리와 멀어진다.
  */
  const top = useMemo(
    () => (
  <div
          style={{
            padding: 8,
            display: 'flex',
            gap: 4,
            alignItems: 'center',
            // 접히면 80px 안에 버튼 하나다 — 왼쪽에 붙이면 아이콘이 한쪽으로 쏠린다.
            justifyContent: collapsed ? 'center' : undefined,
          }}
        >
          <Tooltip
            title={label(collapsed ? MSG.SHELL_SIDER_EXPAND : MSG.SHELL_SIDER_COLLAPSE)}
            // 접혀 있으면 위가 헤더에 가린다 — 그때만 옆으로 낸다.
            placement={collapsed ? 'right' : 'bottom'}
          >
            <Button
              type="text"
              aria-label={label(collapsed ? MSG.SHELL_SIDER_EXPAND : MSG.SHELL_SIDER_COLLAPSE)}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleSider}
            />
          </Tooltip>

          {!collapsed && (
            <>
              <EntryButtons onOpenEntry={onOpenEntry} />
              {/* 트리를 다루는 둘은 <b>오른쪽 끝</b>이다 — 왼쪽 넷은 "어디로 갈까", 이 둘은
                  "지금 트리를 어떻게 볼까" 라 성격이 다르다. */}
              <Space size={0} style={{ marginInlineStart: 'auto' }}>
                <Tooltip title={label(MSG.SHELL_TREE_EXPAND_ALL)} placement="bottom">
                  <Button
                    type="text"
                    icon={<NodeExpandOutlined />}
                    aria-label={label(MSG.SHELL_TREE_EXPAND_ALL)}
                    onClick={() => setOpened(branchCodes)}
                  />
                </Tooltip>
                <Tooltip title={label(MSG.SHELL_TREE_COLLAPSE_ALL)} placement="bottom">
                  <Button
                    type="text"
                    icon={<NodeCollapseOutlined />}
                    aria-label={label(MSG.SHELL_TREE_COLLAPSE_ALL)}
                  /*
                    비우기만 한다 — <b>활성 탭의 조상은 저절로 남는다.</b> 열린 목록은
                    `사람이 연 것 ∪ 활성 탭의 조상` 이라, 사람 쪽을 비우면 조상만 남는다.
                    여기서 조상까지 닫으면 <b>선택 표시가 닫힌 폴더 안에 숨어</b> 지금 어디인지
                    보이지 않는다 — 보이지 않는 선택은 선택이 아니다.
                  */
                    onClick={() => setOpened([])}
                  />
                </Tooltip>
              </Space>
            </>
          )}
        </div>
    ),
    [collapsed, toggleSider, onOpenEntry, branchCodes],
  );

  const tree = useMemo(
    () => (
  <Menu
          mode="inline"
          // 판의 inline 메뉴는 자기 오른쪽 테두리를 그린다 — 사이더가 이미 같은 자리에
          // 하나를 그리고 있어 **두 줄로 겹쳐 보인다**. 경계를 긋는 것은 사이더의 일이다.
          style={{ borderInlineEnd: 'none' }}
          items={items}
          selectedKeys={activeMenuCd ? [activeMenuCd] : []}
          // 접혀 있으면 제어하지 않는다 — 강제하면 판이 팝업으로 낸다.
          openKeys={collapsed ? undefined : openKeys}
          onOpenChange={setOpened}
          onClick={openByKey}
        />
    ),
    [items, activeMenuCd, collapsed, openKeys, openByKey],
  );

  return (
    <Layout.Sider
      collapsible
      collapsed={collapsed}
      // 접힘 토글은 헤더 버튼 하나다 — frontend/tabs.md. 사이더 하단의 기본 트리거를 함께 두면
      // 같은 동작의 조작점이 둘이 된다.
      trigger={null}
      width={240}
      // 색은 전역 알고리즘이 정한다 — theme="light" 를 박으면 다크 모드에서 사이더만
      // 밝게 남아 frontend/tabs.md 의 "화면의 절반만 따라온다" 가 그대로 일어난다.
      // 세로를 스스로 채운다. 붙박이일 때는 바깥 flex 가 늘려 주지만 <b>떠 있을 때는 그
      // 힘이 없어</b> 내용 높이에서 멈추고, 그 아래로 화면이 비쳐 배경이 뚫린 것처럼 보인다.
      style={{
        height: '100%',
        background: token.colorBgContainer,
        borderInlineEnd: `1px solid ${token.colorSplit}`,
      }}
    >
      {/*
        상단 줄은 <b>접혀 있을 때도 남는다</b> — 남는 것은 펼치기 버튼 하나다.

        접힘 토글이 사이더 안에 있는 것이 요점이다(frontend/tabs.md). 조작하는 것과 조작되는 것이
        붙어 있어야 하고, <b>접은 뒤에 펼치려고 찾는 곳</b>도 여기다 — 헤더에 있으면
        사이더가 사라진 자리를 보다가 눈을 위로 올려야 한다.
      */}
      {top}

      {tree}

    </Layout.Sider>
  );
}

/**
 * 진입 모달로 가는 세 입구 — frontend/tabs.md.
 *
 * <p><b>설계는 스플릿 버튼 하나였다</b>(§4.3 — <i>"아이콘 셋을 나열하면 사이더 상단이
 * 지저분해진다"</i>). <b>실물로 견줘 보려고 늘어놓았다</b> — 어느 쪽이 나은지는 화면에서
 * 갈리는 판단이고, 지금 바꿔 보기 쉬운 것은 이 컴포넌트 하나뿐이다.
 *
 * <p><b>돋보기가 넷째가 아니라 첫째다</b>(2026-08-30). 검색 칸을 걷어내면서 그 자리를
 * 이어받았고, 모달의 탭 차례도 검색이 먼저다 — 누른 아이콘과 열린 탭의 순서가 같아야
 * 무엇을 눌렀는지 헷갈리지 않는다.
 *
 * <p>아이콘만으로는 무엇인지 알 수 없어 <b>툴팁이 이름을 말한다</b>. 툴팁의 글은 모달의
 * 탭 이름과 <b>같은 키</b>다 — 다른 문구를 쓰면 누른 것과 열린 탭이 달라 보인다.
 */
function EntryButtons({ onOpenEntry }: { onOpenEntry: (tab: EntryTab) => void }) {
  const buttons: { tab: EntryTab; title: string; icon: React.ReactNode }[] = [
    { tab: 'search', title: MSG.SHELL_ENTRY_TAB_SEARCH, icon: <SearchOutlined /> },
    { tab: 'favorite', title: MSG.SHELL_ENTRY_TAB_FAVORITE, icon: <StarOutlined /> },
    { tab: 'recent', title: MSG.SHELL_ENTRY_TAB_RECENT, icon: <ClockCircleOutlined /> },
    { tab: 'frequent', title: MSG.SHELL_ENTRY_TAB_FREQUENT, icon: <FireOutlined /> },
  ];

  return (
    <Space size={0}>
      {buttons.map((entry) => (
        <Tooltip key={entry.tab} title={label(entry.title)}>
          <Button
            type="text"
            icon={entry.icon}
            aria-label={label(entry.title)}
            onClick={() => onOpenEntry(entry.tab)}
          />
        </Tooltip>
      ))}
    </Space>
  );
}

/**
 * 구조 노드는 `children` 을 갖고 리프는 갖지 않는다 — 서버가 이미 배타로 만들어 준다.
 *
 * <p><b>우클릭 메뉴는 리프에만 붙인다</b>(frontend/tabs.md). 구조 노드는 열 수도 즐겨찾기에 넣을
 * 수도 없으므로 비활성 항목만 뜨는 메뉴를 보여줄 이유가 없다.
 *
 * <p><b>즐겨찾기는 한 줄이 켜짐·꺼짐 둘을 겸한다.</b> <i>추가</i> 와 <i>제거</i> 를 나란히
 * 두면 언제나 하나는 뜻이 없는 항목이고, 사용자는 <b>지금 상태를 메뉴에서 읽을 수
 * 없다</b> — 지금은 글자와 별 아이콘이 함께 그것을 말한다.
 */
function toAntItem(node: MenuNode, actions: ContextActions): AntMenuItem {
  const title = label(node.menuNm);
  if (node.children.length > 0) {
    return {
      key: node.menuCd,
      icon: iconOf(node),
      label: title,
      children: node.children.map((child) => toAntItem(child, actions)),
    };
  }
  const favorite = actions.isFavorite(node.menuCd);
  return {
    key: node.menuCd,
    icon: iconOf(node),
    label: (
      <Dropdown
        trigger={['contextMenu']}
        menu={{
          items: [
            { key: 'new-tab', label: label(MSG.TAB_OPEN_NEW_INSTANCE) },
            { key: 'new-window', label: label(MSG.TAB_OPEN_NEW_WINDOW) },
            { type: 'divider' },
            {
              key: 'favorite',
              label: label(favorite ? MSG.FAVORITE_REMOVE : MSG.FAVORITE_ADD),
              icon: favorite ? <StarFilled /> : <StarOutlined />,
            },
          ],
          onClick: ({ key, domEvent }) => {
            // 막지 않으면 이 클릭이 트리 항목까지 올라가 탭이 하나 더 열린다.
            domEvent.stopPropagation();
            if (key === 'new-tab') {
              actions.openInNewTab(node);
            } else if (key === 'new-window') {
              actions.openInBrowser(node);
            } else if (key === 'favorite') {
              actions.toggleFavorite(node.menuCd);
            }
          },
        }}
      >
        <span>{title}</span>
      </Dropdown>
    ),
  };
}

/**
 * 우클릭 메뉴가 할 수 있는 일 — <b>한 덩어리로 넘긴다</b>.
 *
 * <p>트리는 재귀라 인자가 하나 늘 때마다 모든 층을 지난다. 넷을 따로 받으면 서명이
 * 길어지고 <b>순서를 바꿔 넣어도 타입이 같아</b> 조용히 어긋난다.
 */
interface ContextActions {
  openInNewTab: (node: MenuNode) => void;
  openInBrowser: (node: MenuNode) => void;
  isFavorite: (menuCd: string) => boolean;
  toggleFavorite: (menuCd: string) => void;
}

/**
 * 접힌 사이더에서 <b>아이콘이 없으면 잘린 글자만 남는다</b> — frontend/tabs.md 은 접힘 상태를
 * <i>"아이콘 + 툴팁으로 이름"</i> 으로 정했다. 실제로 접어 보니 `menu.LOGIN_LOG` 가
 * <code>m</code> 으로 잘려 무엇인지 알 수 없었다.
 *
 * <p><b>`SYS_MENU.ICON_CD` 가 먼저다</b>(2026-08-30 — 시드가 채워졌다). DB 에는 판의
 * 컴포넌트 이름이 아니라 <i>뜻의 코드</i>(`dashboard`)가 들어 있고 그것을 무엇으로 그릴지는
 * {@code menuIcons} 가 정한다 — 이름을 저장하면 판을 바꾸는 날 <b>데이터가 낡는다</b>.
 *
 * <p><b>아래는 폴백으로 남는다.</b> 코드가 없거나 매핑에 없는 값이면 여기로 떨어진다 —
 * 아이콘 하나 때문에 사이더가 비면 안 된다.
 *
 * <p><b>폴백은 {@code menuIcons} 가 갖는다</b>(2026-08-31). 권한 트리가 같은 아이콘을 그리기
 * 시작했고, 폴백이 여기 남아 있으면 <b>같은 메뉴가 두 화면에서 다른 아이콘</b>이 될 수 있다 —
 * 시드가 코드를 비워 둔 메뉴가 정확히 그 경우다.
 */
function iconOf(node: MenuNode) {
  return menuIconOf(node.iconCd, node.children.length > 0);
}
