/**
 * 서버가 준 메뉴 트리를 화면이 쓰는 모양으로 바꾼다 — AUTHZ-04 · frontend/tabs.md.
 *
 * <p><b>여기서 권한을 다시 거르지 않는다.</b> 트리는 이미 유효 권한을 통과한 것만 담고
 * 있으므로(backend/security.md) 프론트가 한 번 더 필터를 걸면 <b>같은 규칙이 두 곳</b>에 생긴다 — frontend/tabs.md
 * 가 트리·즐겨찾기·진입 모달이 <i>"셋 다 같은 게이트를 지난다"</i> 고 적은 이유다.
 */

/** 서버 `MenuNode` 와 1:1. `menuUrl` 이 없으면 구조 노드이며 열 수 없다. */
export interface MenuNode {
  menuCd: string;
  /** 메뉴명이 아니라 메시지 키(`menu.{MENU_CD}`)다 — sys/code.md. */
  menuNm: string;
  menuUrl: string | null;
  iconCd: string | null;
  children: MenuNode[];
}

/**
 * 코드로 마디와 조상 경로를 찾는 색인.
 *
 * <p>탭을 열 때마다 트리를 다시 순회하지 않으려는 것이며, <b>브레드크럼과 검색 결과가 같은
 * 경로 값을 쓰게</b> 하려는 것이기도 하다(frontend/tabs.md — <i>"트리 역산이 이미 만드는 조상 경로를
 * 그대로 쓴다"</i>).
 */
export interface MenuIndex {
  /** 구조 노드를 포함한 전부. */
  byCode: Map<string, MenuNode>;
  /** 자신을 포함한 루트→자신 경로. 브레드크럼이 이 배열을 그대로 그린다. */
  pathByCode: Map<string, MenuNode[]>;
  /** `menuUrl` 이 있는 마디만 — 열 수 있는 것 전부다. */
  leaves: MenuNode[];
}

export function indexMenuTree(tree: readonly MenuNode[]): MenuIndex {
  const byCode = new Map<string, MenuNode>();
  const pathByCode = new Map<string, MenuNode[]>();
  const leaves: MenuNode[] = [];

  const walk = (nodes: readonly MenuNode[], ancestors: MenuNode[]): void => {
    for (const node of nodes) {
      const path = [...ancestors, node];
      byCode.set(node.menuCd, node);
      pathByCode.set(node.menuCd, path);
      if (node.menuUrl) {
        leaves.push(node);
      }
      walk(node.children, path);
    }
  };

  walk(tree, []);
  return { byCode, pathByCode, leaves };
}

/**
 * 이 경로로 열 수 있는 메뉴. 딥링크와 새로고침이 URL 하나로 시작하기 때문에 필요하다
 * (frontend/packages.md 요구 6).
 *
 * <p><b>못 찾으면 `null` 이고 그것이 곧 "권한 없음"</b> 이다 — 트리에 없다는 것은 그 메뉴에
 * 대한 권한이 없거나 메뉴 자체가 없다는 뜻이며, 프론트는 둘을 구분하지 않는다(frontend/packages.md).
 */
export function findByUrl(index: MenuIndex, pathname: string): MenuNode | null {
  return index.leaves.find((node) => node.menuUrl === pathname) ?? null;
}

/** 브레드크럼이 그리는 값 — 자신을 포함한다. 최상위 리프면 길이 1 이다. */
export function pathOf(index: MenuIndex, menuCd: string): MenuNode[] {
  return index.pathByCode.get(menuCd) ?? [];
}
