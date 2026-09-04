import { cloneElement, type ReactElement } from 'react';
import { StarFilled, StarOutlined } from '@ant-design/icons';
import { Dropdown, Tabs, theme, type MenuProps } from 'antd';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { label } from '@/shared/i18n/label';
import { tabTitle, useTabStore, type WorkTab } from '@/shared/stores/tabStore';
import { useFavoriteStore } from '@/shared/favorite/favoriteStore';
import { MSG } from '@/shared/i18n/messageKeys';

interface Props {
  onSelect: (key: string) => void;
  /** 닫기 계열은 미저장 확인을 거쳐야 하므로 셸이 받는다 — main-shell.md §3.1. */
  onClose: (keys: string[]) => void;
}

/**
 * 탭바 — frontend-stack.md §4 · main-shell.md §5.
 *
 * <p><b>넘칠 때 탭을 줄이지 않는다.</b> 상한이 20개라 넘치는 것이 기본 상태인데, 축소하면
 * 제목이 잘려 무슨 탭인지 알 수 없게 된다 — 너비를 유지하고 <b>스크롤</b>한다(frontend-stack.md §4.7).
 * AntD `Tabs` 가 화살표와 휠 스크롤을 이미 제공하고 활성 탭도 스스로 보이게 한다.
 *
 * <p><b>드래그 순서 변경(frontend-stack.md §4.7)은 아직 없다.</b> `@dnd-kit` 은 메뉴 트리 편집(42 §4)·
 * 즐겨찾기 순서(main-shell.md §4.5)와 <b>같은 라이브러리를 셋이 공유</b>하기로 되어 있어, 셋 중 하나만
 * 먼저 만들면 나머지 둘이 그것을 따라야 할지 다시 정해야 한다. 순서는 저장하지 않으므로
 * (frontend-stack.md §4.7) 나중에 붙여도 잃는 것이 없다.
 */
export function ShellTabBar({ onSelect, onClose }: Props) {
  const { token } = theme.useToken();
  const tabs = useTabStore((state) => state.tabs);
  const activeKey = useTabStore((state) => state.activeKey);
  const dirtyKeys = useTabStore((state) => state.dirtyKeys);
  const move = useTabStore((state) => state.move);
  const favorites = useFavoriteStore((state) => state.menuCds);
  const toggleFavorite = useFavoriteStore((state) => state.toggle);

  // 누르자마자 끌기로 보지 않는다 — 그러면 탭을 **고르는 클릭**이 드래그로 먹힌다.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      move(String(active.id), String(over.id));
    }
  };

  return (
    // 헤더 아래 선에 탭이 붙지 않게 한 칸 띄운다. 값이 아니라 토큰이어야 콤팩트 모드에서
    // 함께 줄어든다(main-shell.md §9.3) — 밀도를 바꿨는데 이 틈만 그대로면 그것이 더 눈에 띈다.
    <div
      style={{
        background: token.colorBgContainer,
        paddingInline: token.paddingXS,
        paddingBlockStart: token.paddingXS,
      }}
    >
      <Tabs
        // 드래그로 순서를 바꾼다 — frontend-stack.md §4.7. 판의 탭바를 그대로 쓰고 마디만 감싼다.
        renderTabBar={(barProps, DefaultTabBar) => (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <SortableContext
              items={tabs.map((tab) => tab.key)}
              strategy={horizontalListSortingStrategy}
            >
              <DefaultTabBar {...barProps}>
                {(node) => (
                  <DraggableTab
                    key={node.key}
                    id={node.key as string}
                    // 고정 탭은 집히지 않는다 — 대시보드는 언제나 맨 왼쪽이다.
                    fixed={!tabs.find((tab) => tab.key === node.key)?.closable}
                  >
                    {node}
                  </DraggableTab>
                )}
              </DefaultTabBar>
            </SortableContext>
          </DndContext>
        )}
        type="editable-card"
        hideAdd
        // 판은 탭 아래에 16px 을 둔다 — 탭 아래에 **내용**이 오는 배치를 전제한 값이다.
        // 여기서는 브레드크럼 띠가 바로 붙고 그 띠가 자기 여백을 이미 갖고 있어, 두 값이
        // 더해지면 브레드크럼 글자의 위(23px)가 아래(8px)보다 세 배 가까이 넓어진다.
        tabBarStyle={{ marginBottom: 0 }}
        activeKey={activeKey}
        onChange={onSelect}
        onEdit={(targetKey, action) => {
          if (action === 'remove' && typeof targetKey === 'string') {
            onClose([targetKey]);
          }
        }}
        items={tabs.map((tab) => ({
          key: tab.key,
          closable: tab.closable,
          label: (
            <Dropdown
              trigger={['contextMenu']}
              menu={{
                items: contextItemsFor(tab),
                onClick: ({ key, domEvent }) => {
                  domEvent.stopPropagation();
                  if (key === 'favorite') {
                    void toggleFavorite(tab.menuCd);
                    return;
                  }
                  onClose(keysFor(key, tab));
                },
              }}
            >
              <span>
                {tabTitle(tab, label)}
                {dirtyKeys.includes(tab.key) ? ' •' : ''}
              </span>
            </Dropdown>
          ),
        }))}
      />
    </div>
  );

  /**
   * frontend-stack.md §4.5 — 대시보드에서는 "탭 닫기" 가 뜨지 않는다. 고정 탭이기 때문이며, 나머지 둘은
   * 그대로 동작한다.
   *
   * <p><b>즐겨찾기는 트리 우클릭 메뉴와 대칭이다</b>(main-shell.md §4.7) — 같은 일을 어느 한쪽에서만
   * 할 수 있으면 사용자는 <i>"어디서 되더라"</i> 를 외워야 한다. 한 줄이 켜짐·꺼짐 둘을
   * 겸하는 것도 같다.
   */
  function contextItemsFor(tab: WorkTab) {
    const favorite = favorites.includes(tab.menuCd);
    const items: MenuProps['items'] = [
      { key: 'others', label: label(MSG.TAB_CLOSE_OTHERS) },
      { key: 'all', label: label(MSG.TAB_CLOSE_ALL) },
      { type: 'divider' },
      {
        key: 'favorite',
        label: label(favorite ? MSG.FAVORITE_REMOVE : MSG.FAVORITE_ADD),
        icon: favorite ? <StarFilled /> : <StarOutlined />,
      },
    ];
    return tab.closable ? [{ key: 'self', label: label(MSG.TAB_CLOSE) }, ...items] : items;
  }

  function keysFor(action: string, tab: WorkTab): string[] {
    if (action === 'self') return [tab.key];
    // "다른 탭 닫기" 는 현재 탭과 대시보드를 남긴다. 고정 탭은 스토어가 지켜 준다.
    if (action === 'others') {
      return tabs.filter((candidate) => candidate.key !== tab.key).map((candidate) => candidate.key);
    }
    return tabs.map((candidate) => candidate.key);
  }
}

/**
 * 탭 하나를 끌 수 있게 감싼다 — frontend-stack.md §4.7.
 *
 * <p><b>판의 탭 마디를 그대로 쓴다.</b> 새로 그리면 닫기 버튼·활성 표시·넘침 스크롤을 전부
 * 다시 만들어야 하고, 그것들은 판이 이미 잘 하고 있다. 여기서 더하는 것은 <b>끌 수 있다는
 * 사실</b> 하나다.
 */
function DraggableTab({
  id,
  fixed,
  children,
}: {
  id: string;
  fixed: boolean;
  children: ReactElement;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: fixed,
  });

  return cloneElement(children, {
    ref: setNodeRef,
    style: {
      ...(children.props as { style?: React.CSSProperties }).style,
      transform: CSS.Translate.toString(transform),
      transition,
      // 끄는 동안 위로 올린다 — 아래 탭에 가려지면 무엇을 끌고 있는지 보이지 않는다.
      zIndex: isDragging ? 1 : undefined,
      cursor: fixed ? undefined : 'grab',
    },
    ...attributes,
    ...listeners,
  } as Partial<unknown>);
}
