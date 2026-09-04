import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { DeleteOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Modal, Tabs, Tooltip, Typography, theme, type InputRef } from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { filterHits, searchMenus, type MenuSearchHit } from '@/shared/authz/menuSearch';
import type { MenuIndex, MenuNode } from '@/shared/authz/menuTree';
import { readRecentMenus } from '@/shared/authz/recentMenus';
import { useFavoriteStore } from '@/shared/favorite/favoriteStore';
import { useFrequentStore } from '@/shared/menustat/frequentStore';
import { thinScrollbar } from '@/shared/theme/scrollbar';
import { useModalTabHotkeys } from '@/shared/hooks/useModalTabHotkeys';
import { ENTRY_TABS, ENTRY_TAB_KEYS, type EntryTab } from '@/layouts/ShellLayout/entryTabs';

/**
 * 메뉴 진입 모달 — main-shell.md §4.3.
 *
 * <p><b>넷이 한 창이고 탭으로 갈린다</b>(2026-08-29 — 설계 변경). main-shell.md §4.3 은 <i>탭 모드</i>
 * (즐겨찾기·최근·자주)와 <i>검색 결과 모드</i>(탭 없음)를 <b>두 모드</b>로 나눴는데, 나눌
 * 이유가 없었다 — 넷 다 <b>메뉴 하나를 골라 연다</b>는 같은 일이고 목록의 출처만 다르다.
 * 나눠 두면 검색하다 <i>아까 그거 최근에 열었는데</i> 로 옮겨 가려면 창을 닫고 다른 경로로
 * 다시 들어와야 한다.
 *
 * <p><b>여는 경로가 어느 탭인지를 정한다.</b> 단축키와 사이더 검색은 검색 탭, 사이더의 세
 * 아이콘은 각자의 탭이다. 연 뒤에는 탭을 자유롭게 옮긴다.
 *
 * <p><b>키는 이 모달 안에서만 듣는다.</b> `window` 에서 들으면 자기를 연 Enter 를 자기가
 * 듣는다 — React 가 discrete 이벤트의 커밋과 passive effect 를 <b>그 이벤트의 디스패치
 * 안에서</b> 비우기 때문이다. 듣는 자리는 <b>모달 래퍼</b>이며, 본문에 포커스를 주는 것만
 * 으로는 열림 애니메이션이 끝날 때까지 키가 죽는다.
 *
 * <p><b>그와 별개로 포커스를 입력 칸에 앉히고 <i>선택까지</i> 한다.</b> 포커스만 주면 지난
 * 질의가 남아 있어 <b>지우고 다시 치게</b> 된다. 선택해 두면 그냥 치는 것이 곧 새로 치는
 * 것이다. 두지 않으면 판이 <b>닫기(X) 버튼</b>에 앉히고, 그러면 다음 Enter 한 번이 모달을
 * 닫는다. 화살표와 Enter 는 입력 칸에 포커스가 있어도 <b>래퍼까지 올라오므로</b> 그대로
 * 듣는다.
 *
 * <p><b>탭 이동 단축키는 여기서 멈춘다</b>(main-shell.md §10). `PageUp`/`PageDown` 은 원래 셸의 탭바를
 * 옮기는데, <b>탭을 가진 모달이 떠 있으면 그 모달의 것</b>이다 — 보고 있는 탭을 두고 뒤에
 * 가린 탭바가 움직이면 무엇이 바뀌었는지 알 수 없다. 탭이 없는 모달(설정 등)에서는 그대로
 * 셸까지 올라간다. 듣는 것은 <b>공용 훅</b>이며(`useModalTabHotkeys`), 알림·프로필 모달도
 * 같은 훅을 쓴다 — 이 모달에만 있던 것을 그리로 올렸다(2026-09-01 — 지시).
 */

interface Props {
  open: boolean;
  /** 열 때 활성화할 탭. */
  tab: EntryTab;
  /** 사이더 검색에서 넘어온 질의. 검색 탭의 입력 칸에 그대로 실린다. */
  query: string;
  index: MenuIndex;
  onOpen: (node: MenuNode) => void;
  onClose: () => void;
}

export function MenuEntryModal({ open, tab, query, index, onOpen, onClose }: Props) {
  const { token } = theme.useToken();
  const [active, setActive] = useState<EntryTab>(tab);
  const [text, setText] = useState(query);
  const [cursor, setCursor] = useState(0);
  const [seed, setSeed] = useState({ tab, query, open });
  // 셸이 읽어 둔 것을 본다 — 모달이 열릴 때마다 다시 부르면 별을 누른 직후 깜빡인다.
  const favorites = useFavoriteStore((state) => state.menuCds);
  const removeFavorite = useFavoriteStore((state) => state.remove);
  const frequentMenus = useFrequentStore((state) => state.menus);
  const frequentFrom = useFrequentStore((state) => state.fromYm);
  const loadFrequent = useFrequentStore((state) => state.load);
  const frequent = frequentMenus.map((row) => row.menuCd);
  const useCntOf = new Map(frequentMenus.map((row) => [row.menuCd, row.useCnt]));
  const inputRef = useRef<InputRef | null>(null);
  const cursorRow = useRef<HTMLDivElement | null>(null);

  // 여는 경로가 바뀌면 탭과 질의를 그것으로 맞춘다.
  //
  // 효과가 아니라 **렌더 중 조정**이다. 효과로 하면 지난 탭을 한 번 그리고 다시 그리며,
  // 그 사이에 Enter 가 들어오면 **지난 목록의 항목**이 열린다.
  // `open` 도 함께 본다 — 모달 안에서 친 글은 `query` 를 바꾸지 않으므로, 이것이 없으면
  // 닫았다 다시 열 때 **지난 질의가 그대로 남는다**.
  if (seed.tab !== tab || seed.query !== query || seed.open !== open) {
    setSeed({ tab, query, open });
    setActive(tab);
    setText(query);
    setCursor(0);
  }

  const hits = listOf(active, index, text, favorites, frequent);
  // 목록이 줄어들면 커서가 밖에 남는다 — 그대로 Enter 를 받으면 아무것도 열리지 않는다.
  const at = Math.min(cursor, Math.max(hits.length - 1, 0));

  /*
    고른 줄을 <b>보이는 자리로 끌어온다</b> — main-shell.md §4.3.

    목록이 스크롤될 만큼 길면 방향키로 내려가다 <b>선택 표시가 화면 밖으로 나간다</b> —
    커서는 움직이는데 눈에는 아무 일도 일어나지 않으므로, 사용자는 키가 먹지 않는다고
    읽는다(2026-08-30 실물).

    `nearest` 다. `center` 로 두면 이미 보이는 줄에서도 목록이 <b>매번 출렁인다</b> —
    마우스를 올리기만 해도 커서가 옮겨 가므로(hover) 그 출렁임이 계속된다.

    선택적 호출인 것은 jsdom 에 이 메서드가 없기 때문이다 — 테스트가 그것 때문에 죽으면
    정작 재는 것(어느 줄이 골렸는가)을 못 잰다.
  */
  useEffect(() => {
    cursorRow.current?.scrollIntoView?.({ block: 'nearest' });
  }, [at]);

  /** 포커스와 함께 <b>있던 글을 선택</b>한다 — 그냥 치면 새로 치는 것이 되게. */
  const takeInput = () => inputRef.current?.focus({ cursor: 'all' });

  /*
    자주 쓰는 메뉴는 <b>열 때 읽는다</b>(42 §8). 셸이 뜰 때 한 번 읽어 두면 방금 연
    메뉴가 순위에 없고, 셀 때마다 받아 오면 <b>메뉴를 열 때마다 왕복이 두 배</b>가
    되는데 그 목록은 이 창을 열기 전까지 아무도 보지 않는다.
  */
  useEffect(() => {
    if (open) {
      void loadFrequent();
    }
  }, [open, loadFrequent]);

  useEffect(() => {
    if (!open) {
      return;
    }
    // 한 프레임 뒤에 잡는다 — 판이 본문을 포털에 붙이는 것이 이 효과보다 늦을 수 있어,
    // 지금 잡으면 `inputRef` 가 아직 비어 **조용히 아무 일도 일어나지 않는다**.
    // 여는 경로가 바뀌어도(탭이 다시 정해져도) 되찾는다.
    const frame = requestAnimationFrame(takeInput);
    return () => cancelAnimationFrame(frame);
  }, [open, tab]);

  const changeTab = (next: EntryTab) => {
    setActive(next);
    // 탭마다 목록이 달라지므로 커서를 맨 위로. 질의는 그대로 두되 **선택해 둔다** — 같은
    // 말로 다른 목록을 훑을 수도, 새 말로 칠 수도 있어야 한다.
    setCursor(0);
    takeInput();
  };

  /*
    탭 이동은 <b>공용 훅</b>이 듣는다 — main-shell.md §10 · `useModalTabHotkeys`.

    <b>이 모달에 있던 코드를 그리로 올렸다</b>(2026-09-01 — 지시). 알림·프로필 모달도 탭을
    가지므로 같은 규칙이 필요한데, 규칙을 셋에 적어 두면 <b>고칠 때 셋을 다 고쳐야 한다</b>.
    `window` 에서 캡처로 듣는 까닭과 셸보다 먼저인 까닭은 그 파일에 적혀 있다.
  */
  useModalTabHotkeys({
    open,
    keys: ENTRY_TAB_KEYS,
    active,
    onChange: changeTab,
  });

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (hits.length === 0) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setCursor((current) => (Math.min(current, hits.length - 1) + step + hits.length) % hits.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      onOpen(hits[at].node);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={label(MSG.SHELL_ENTRY_TITLE)}
      footer={null}
      width={520}
      wrapProps={{ onKeyDown }}
      afterOpenChange={(opened) => opened && takeInput()}
    >
      <div>
        <Tabs
          activeKey={active}
          onChange={(key) => changeTab(key as EntryTab)}
          items={ENTRY_TABS.map((entry) => ({ key: entry.key, label: label(entry.title) }))}
        />

        {/* 검색 탭에서는 전체 메뉴를 찾고, 나머지 탭에서는 그 목록만 거른다
            (main-shell.md §4.2 · §4.3). 둘은 다른 일이라 안내 문구도 다르다. */}
        <Input
          ref={inputRef}
          allowClear
          value={text}
          placeholder={label(
            active === 'search' ? MSG.SHELL_SEARCH_PLACEHOLDER : MSG.SHELL_ENTRY_FILTER,
          )}
          onChange={(event) => {
            setText(event.target.value);
            setCursor(0);
          }}
        />

        <div style={{ marginTop: 8, minHeight: 220 }}>
          {hits.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={label(emptyOf(active, text))} />
          ) : (
            <>
              <Typography.Text type="secondary">
                {label(MSG.SHELL_SEARCH_COUNT, { count: hits.length })}
                {/* <b>무엇을 기준으로 자주인가</b>를 말한다 — 건수만으로는 알 수 없고,
                    창은 서버 설정이라 화면이 짐작하면 어긋난다(42 §8). */}
                {active === 'frequent' && frequentFrom !== null
                  ? ` · ${label(MSG.SHELL_ENTRY_FREQUENT_SINCE, { from: yearMonth(frequentFrom) })}`
                  : ''}
              </Typography.Text>
              <div style={{ maxHeight: 320, overflow: 'auto', marginTop: 4, ...thinScrollbar(token) }}>
                {hits.map((hit, row) => (
                  /*
                    줄 하나가 <b>두 조각</b>이다 — 여는 자리와 지우는 자리. 버튼 안에
                    버튼을 넣을 수 없어(HTML 이 막는다) 바깥은 div 이고, 강조와 커서는
                    그 div 이 갖는다.
                  */
                  <div
                    key={hit.node.menuCd}
                    ref={row === at ? cursorRow : undefined}
                    onMouseEnter={() => setCursor(row)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      paddingInlineEnd: 4,
                      borderRadius: token.borderRadius,
                      background: row === at ? token.colorPrimaryBg : 'transparent',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(hit.node)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'left',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '6px 8px',
                        borderRadius: token.borderRadius,
                        background: 'transparent',
                      }}
                    >
                      {/* 경로가 부가 정보가 아니라 필수 항목이다 — 같은 이름의 메뉴가 여러
                          경로에 있을 수 있어 경로가 없으면 결과를 구분할 수 없다(main-shell.md §4.2). */}
                      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                        {hit.path
                          .slice(0, -1)
                          .map((node) => label(node.menuNm))
                          .join(' › ')}
                      </Typography.Text>
                      <Typography.Text>{label(hit.node.menuNm)}</Typography.Text>
                    </button>

                    {/*
                      즐겨찾기 탭에만 둔다. 최근·자주는 <b>파생</b>이라 지울 것이 없고
                      (지워도 다시 쓰면 돌아온다), 검색 결과에서 지우는 것은 <i>찾던 것을
                      없애는</i> 일이라 뜻이 다르다.
                    */}
                    {/* 순위의 근거를 함께 낸다 — 순서만 보이면 <i>왜 이 순서인가</i> 를
                        알 수 없다(42 §8). */}
                    {active === 'frequent' && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {label(MSG.SHELL_ENTRY_FREQUENT_COUNT, {
                          count: useCntOf.get(hit.node.menuCd) ?? 0,
                        })}
                      </Typography.Text>
                    )}
                    {active === 'favorite' && (
                      <Tooltip title={label(MSG.FAVORITE_REMOVE)}>
                        <Button
                          type="text"
                          icon={<DeleteOutlined />}
                          aria-label={label(MSG.FAVORITE_REMOVE)}
                          onClick={() => void removeFavorite(hit.node.menuCd)}
                        />
                      </Tooltip>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * 탭이 무엇을 내놓는가.
 *
 * <p><b>셋 다 코드 목록일 뿐이다</b> — 이름과 경로는 인덱스가 붙인다. 출처만 갈린다:
 * 즐겨찾기는 <b>사용자가 선언한 것</b>(DB · 42 §7), 자주는 <b>서버가 센 것</b>(DB ·
 * 42 §8), 최근은 <b>이 기기의 것</b>(`localStorage` · main-shell.md §4.4).
 */
function listOf(
  tab: EntryTab,
  index: MenuIndex,
  text: string,
  favorites: string[],
  frequent: string[],
): MenuSearchHit[] {
  if (tab === 'search') {
    return searchMenus(index, text, label);
  }
  const codes = codesOf(tab, favorites, frequent);
  const hits = codes.flatMap((code) => {
    const node = index.byCode.get(code);
    // 인덱스에 없으면 권한을 잃었거나 사라진 메뉴다 — 조용히 뺀다(main-shell.md §4.4).
    return node ? [{ node, path: index.pathByCode.get(code) ?? [node] }] : [];
  });
  return filterHits(hits, text, label);
}

/** `202606` → `2026-06`. 달 단위라 그 이상 잘게 쓸 것이 없다. */
function yearMonth(ym: string): string {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}`;
}

/**
 * 탭 → 메뉴 코드 목록. <b>셋 다 코드 목록일 뿐</b>이고 이름·경로는 인덱스가 붙인다.
 *
 * <p>출처만 다르다 — 즐겨찾기는 <b>사용자가 선언한 것</b>(DB), 자주는 <b>서버가 센
 * 것</b>(DB), 최근은 <b>이 기기의 것</b>(`localStorage`)이다(42 §7·§8 · main-shell.md §4.4).
 */
function codesOf(tab: EntryTab, favorites: string[], frequent: string[]): string[] {
  if (tab === 'favorite') return favorites;
  if (tab === 'frequent') return frequent;
  if (tab === 'recent') return readRecentMenus();
  return [];
}

/** 비었을 때 무엇이라 말하는가 — <b>이유마다 다르다</b>. */
function emptyOf(tab: EntryTab, text: string): string {
  if (tab === 'search') {
    // 아직 묻지 않은 것과 물었는데 없는 것은 다르다.
    return text.trim() === '' ? MSG.SHELL_ENTRY_SEARCH_PROMPT : MSG.SHELL_SEARCH_EMPTY;
  }
  if (tab === 'recent') {
    return MSG.SHELL_ENTRY_EMPTY_RECENT;
  }
  if (tab === 'favorite') {
    return MSG.SHELL_ENTRY_EMPTY_FAVORITE;
  }
  return MSG.SHELL_ENTRY_EMPTY_FREQUENT;
}
