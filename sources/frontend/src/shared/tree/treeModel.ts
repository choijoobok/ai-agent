import type { DropZone, TreeNode } from '@/shared/tree/types';

/**
 * 평면 목록 → 트리 — 62 §4.2.1.
 *
 * <p>서버가 <b>전위 순회 순서</b>로 내려주므로(62 §4.9) 이 함수는 순서를 만들지 않고
 * **깊이와 부모-자식 관계만** 붙인다. 다시 정렬하면 트리가 아니게 된다.
 *
 * <p><b>고아를 버리지 않는다.</b> 부모를 못 찾은 노드는 최상위로 올려 붙인다 — 이 화면은
 * *고치러 오는 화면*이고(62 §4.1), 화면에서 사라지면 고칠 수단이 없어진다. 서버도 같은
 * 이유로 그것들을 목록 끝에 붙여 보낸다.
 */
export function buildTree<T>(
  rows: T[],
  idOf: (row: T) => string,
  parentOf: (row: T) => string | null,
): TreeNode<T>[] {
  const nodes = new Map<string, TreeNode<T>>();
  for (const row of rows) {
    nodes.set(idOf(row), { id: idOf(row), parentId: parentOf(row), data: row, depth: 0, children: [] });
  }
  const roots: TreeNode<T>[] = [];
  for (const row of rows) {
    const node = nodes.get(idOf(row))!;
    const parent = node.parentId === null ? undefined : nodes.get(node.parentId);
    if (parent) {
      parent.children.push(node);
    } else {
      // 부모가 없거나 못 찾았다 — 뒤엣것이 고아이며 감추지 않는다.
      roots.push(node);
    }
  }
  const stamp = (list: TreeNode<T>[], depth: number) => {
    for (const node of list) {
      node.depth = depth;
      stamp(node.children, depth + 1);
    }
  };
  stamp(roots, 1);
  return roots;
}

/**
 * 지금 <b>보이는</b> 행들 — 접힌 폴더의 자손은 빠진다.
 *
 * <p>62 §4.5.2 의 <i>"가로선은 화면에 보이는 두 행 사이를 뜻한다"</i> 가 이 목록 위에서
 * 성립한다 — 드롭 판정이 보는 것과 사람이 보는 것이 같아야 한다.
 */
export function visibleRows<T>(roots: TreeNode<T>[], collapsed: ReadonlySet<string>): TreeNode<T>[] {
  const out: TreeNode<T>[] = [];
  const walk = (list: TreeNode<T>[]) => {
    for (const node of list) {
      out.push(node);
      if (!collapsed.has(node.id)) {
        walk(node.children);
      }
    }
  };
  walk(roots);
  return out;
}

/** {@code 자신} ∪ 자손 — 드롭 금지 집합이다(42 §4 의 네 층 중 첫째). */
export function selfAndDescendants<T>(node: TreeNode<T>): Set<string> {
  const ids = new Set<string>();
  const walk = (current: TreeNode<T>) => {
    ids.add(current.id);
    current.children.forEach(walk);
  };
  walk(node);
  return ids;
}

/** 이 노드를 뿌리로 한 서브트리의 높이 — 자기만 있으면 `1` 이다. */
export function heightOf<T>(node: TreeNode<T>): number {
  return node.children.length === 0
    ? 1
    : 1 + Math.max(...node.children.map(heightOf));
}

/**
 * 마우스가 행의 어디에 있는가 — <b>행 하나를 세로로 셋으로 나눈다</b>(62 §4.5.2).
 *
 * <p><b>좌우는 읽지 않는다.</b> 선의 들여쓰기를 손으로 맞추게 하면 한 픽셀 차이로 부모가
 * 바뀌고, 그 실수는 <b>놓기 전에 보이지 않는다</b> — 깊이를 고르는 수단은 접기 하나다.
 */
export function zoneAt(offsetY: number, height: number): DropZone {
  if (offsetY < height * 0.25) return 'before';
  if (offsetY > height * 0.75) return 'after';
  return 'inside';
}
