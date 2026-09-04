import { DataGrid } from '@/shared/grid/DataGrid';
import type { GridController } from '@/shared/grid/useGridController';
import type { TitleSuffixSpec } from '@/shared/grid/types';
import type { RoleHolderRow } from '@/shared/authz/roleHolder';

/**
 * 하단 pane — <b>두 화면이 같은 그리드다</b>(62 §2.5 · §3.4).
 *
 * <p>제목과 빈 상태 문구만 화면이 준다. 나머지(컬럼 · 조회 · 읽기 전용)는 전부 같으며,
 * 그것이 62 §3.4 가 <i>"셋째가 둘째와 같은 그리드"</i> 라고 적은 바다 — 나누면 <b>같은
 * 조회를 두 번</b> 하고 두 화면이 <b>항상 같은 내용</b>을 다르게 그린다.
 *
 * <p><b>파일이 컴포넌트 하나뿐인 것이 의도다.</b> 어휘와 훅은 {@code roleHolder.ts} 에 있다 —
 * 한 파일이 컴포넌트와 그 밖의 것을 함께 내보내면 Fast Refresh 가 동작하지 않는다.
 */
interface Props {
  /** 메시지 키 — `ROLE_MGMT` 는 *보유 사용자*, `ROLE_AUTH_MGMT` 는 *영향 인원* 이다. */
  title: string;
  menuCd: string;
  controller: GridController<RoleHolderRow>;
  /** grid-standard.md §6.1 의 빈 상태 — <b>다음에 할 일이 다르면 문구도 다르다</b>. */
  emptyText: string;
  /** 제목 뒤 — <b>누구의 것인가</b>(grid-standard.md §6.1). 마스터가 있는 화면에서만 준다. */
  titleSuffix?: TitleSuffixSpec;
  /** ①②③을 통째로 잠근다 — <b>마스터에서 고른 행이 없다</b>(grid-standard.md §6.1 의 빈 상태). */
  disabled?: boolean;
  collapsed?: boolean;
  onExpand?: () => void;
}

export function RoleHolderGrid(props: Props) {
  return (
    <DataGrid<RoleHolderRow>
      title={props.title}
      menuCd={props.menuCd}
      // 개인화의 키다 — 같으면 위아래 설정이 서로를 덮는다(grid-standard.md §5).
      gridId="holder"
      controller={props.controller}
      emptyText={props.emptyText}
      titleSuffix={props.titleSuffix}
      disabled={props.disabled}
      collapsed={props.collapsed}
      onExpand={props.onExpand}
    />
  );
}
