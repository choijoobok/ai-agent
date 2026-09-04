import type { ReactNode, Ref } from 'react';
import type { PlainColumn } from '@/shared/grid/excel/workbook';
import type { SplitAxis } from '@/shared/grid/SplitPane';
import type { GridButtonControl } from '@/shared/grid/types';

/**
 * 트리 그리드의 어휘 — screen/menu/requirements.md.
 *
 * <p><b>`<DataGrid>` 의 어휘를 물려받지 않는다.</b> AG Grid 의 Tree Data 는 Enterprise 이며
 * 어휘 밖이라(frontend/grid.md) 판 자체가 다르고, 여기 없는 것이 많다 — 페이징도 컬럼 필터도 그리드
 * 설정도 상태 컬럼도 삭제 컬럼도 없다(screen/menu/requirements.md). 같은 이름을 쓰면서 절반이 동작하지 않으면
 * <b>화면 개발자는 자기가 오타를 냈는지 미구현인지 알 수 없다</b>.
 *
 * <p>대신 <b>공유하는 것은 공유한다</b> — {@link GridButtonControl}(Ⓑ 의 버튼 둘)은 frontend/grid.md 의
 * 선언 그대로이고, 크롬과 색도 53 의 것을 받는다. 갈리는 것은 <b>판</b> 하나다.
 */

/** 조립된 노드 하나. `depth` 는 최상위가 `1` 이다(sys/menu.md 의 단수와 같다). */
export interface TreeNode<T> {
  id: string;
  parentId: string | null;
  data: T;
  depth: number;
  children: TreeNode<T>[];
}

/**
 * 행을 셋으로 나눈 그 셋 — screen/menu/requirements.md.
 *
 * <p>`inside` 만 <b>테두리</b>이고 나머지 둘은 <b>가로선</b>이다. 모양을 다르게 두는 것이
 * 결정이며(색은 정보가 아니다 — frontend/grid.md), 선은 *사이에 끼운다* 를 테두리는 *안에 넣는다* 를
 * 뜻한다.
 */
export type DropZone = 'before' | 'inside' | 'after';

/** 드롭이 성립하는가와, 성립하든 아니든 <b>문장으로 무엇을 말할 것인가</b>(screen/menu/requirements.md). */
export interface DropVerdict {
  ok: boolean;
  /** 완성된 문구다 — 화면이 `label()` 로 만들어 넣는다. */
  text: string;
}

/**
 * 놓인 결과 — <b>구역이 아니라 자리로 옮겨 놓은 것</b>이다.
 *
 * <p>{@link TreeDrop.zone} 만 넘기면 화면이 <i>펼쳐져 있었나</i> 를 다시 물어야 한다.
 * screen/menu/requirements.md 의 <b>아래 1/4 는 화면에 보이는 두 행 사이</b>라는 규칙이 접힘 상태에 달려
 * 있는데, 그것을 아는 것은 컴포넌트다 — 화면이 접힘을 들고 있는 구조로 만들면 <b>사람이
 * 보는 것과 판정하는 것이 갈릴</b> 수 있다.
 *
 * <p>그래서 컴포넌트가 {@link TreeDrop.parentId}·{@link TreeDrop.index} 까지 정해 준다.
 * 화면이 하는 일은 그것을 <b>형제 목록</b>으로 바꾸는 것뿐이다(sys/menu.md).
 */
export interface TreeDrop {
  dragId: string;
  targetId: string;
  zone: DropZone;
  /** 옮겨 갈 부모. `null` 이면 최상위다. */
  parentId: string | null;
  /** 그 형제 안에서의 자리 — <b>배열 인덱스가 곧 `SORT_NO`</b> 다. */
  index: number;
}

export interface TreeColumn<T> {
  /** 메시지 키. */
  header: string;
  width: number;
  /**
   * 셀 하나를 그린다 — <b>렌더 함수를 받는다</b>.
   *
   * <p>`<DataGrid>` 가 frontend/grid.md 을 근거로 JSX 를 거절하는 것과 갈리는 자리다. 저기서 막는
   * 것은 <i>그리드의 잠금 상태를 모르는 버튼</i>이고, 여기 셀이 아는 잠금은 <b>화면이
   * 넘겨준 것</b>뿐이다 — 컴포넌트가 저장 모델을 갖지 않으므로(frontend/grid.md) 잠금도 갖지 않는다.
   *
   * <p><b>노드를 함께 받는다</b>(2026-08-30 — screen/menu/requirements.md). 폴더의 파생 3-state 는 <i>그 아래를
   * 얼마나 줬는가</i> 이므로 <b>자손을 봐야</b> 그린다. 행 데이터만으로는 답할 수 없고,
   * 화면이 트리를 따로 조립해 들고 있으면 <b>사람이 보는 것과 세는 것이 갈릴</b> 수 있다 —
   * {@link TreeDrop} 이 구역 대신 자리를 넘기는 것과 같은 이유다.
   */
  cell: (row: T, node: TreeNode<T>) => ReactNode;
  /**
   * 이 셀이 <b>열리는가</b> — frontend/grid.md 의 `editable` 과 같은 축이다(2026-08-31 요청).
   *
   * <p><b>기본은 닫힘</b>이다 — `ColumnDef.editable` 과 같은 방향이며(frontend/grid.md · `deny by
   * default`) 빠뜨렸을 때 <b>덜 위험한 쪽</b>으로 떨어진다.
   *
   * <p><b>색이 여기서 나온다.</b> 이 프로젝트의 그리드는 <i>열리는 칸을 표시하지 않고
   * 잠긴 칸을 칠한다</i>(`.bo-cell-readonly` · frontend/grid.md) — 트리도 같은 규칙을 쓰므로,
   * 선언하지 않은 컬럼은 <b>읽기 전용 색조</b>가 깔린다. 스위치처럼 <b>셀 안의 컨트롤이
   * 곧 편집기</b>인 컬럼도 이것을 선언해야 한다: 그 칸은 잠긴 것이 아니다.
   *
   * <p>{@link TreeColumn.editor} 와 <b>다른 축</b>이다. 이것은 <i>고칠 수 있나</i> 이고
   * 저것은 <i>무엇으로 고치나</i> 다 — 스위치 컬럼은 앞엣것만 갖는다.
   */
  editable?: boolean | ((row: T, node: TreeNode<T>) => boolean);
  /**
   * <b>더블 클릭하면 열리는 편집기</b> — 판의 셀 편집과 같은 제스처다(frontend/grid.md).
   *
   * <p><b>콤보가 셀에 늘 서 있었다</b>(2026-08-31 요청). 그러면 판을 쓰는 옆 그리드와
   * <b>이질적으로 보이고</b>, 무엇보다 <i>읽는 화면</i>이 <i>입력 화면</i>처럼 읽힌다 —
   * 이 트리에서 자주 하는 일은 구조를 <b>보는</b> 것이다.
   *
   * <p>{@code done} 을 부르면 편집이 닫힌다. <b>부르는 것은 화면이다</b> — 언제 끝난
   * 것인지는 컨트롤마다 다르고(고르면 끝 · 포커스를 잃으면 끝), 컴포넌트가 정하면
   * <b>드롭다운이 열리는 순간 닫히는</b> 조합이 생긴다. {@code Escape} 는 컴포넌트가
   * 받는다 — 어느 편집기에서나 같은 뜻이라 화면이 적을 이유가 없다.
   *
   * <p>선언하지 않으면 <b>더블 클릭이 아무 일도 하지 않는다</b>.
   */
  editor?: (row: T, node: TreeNode<T>, done: () => void) => ReactNode;
  /** 오른쪽 정렬 — 파생 수 컬럼 셋이 그렇다. */
  align?: 'left' | 'right';
}

/**
 * 화면이 트리에게 <b>시키는</b> 것 — 접힘은 컴포넌트의 상태이지 화면의 상태가 아니다.
 *
 * <p>Ⓑ 의 <i>모두 접기 · 모두 펼치기</i> 는 화면이 {@link TreeGridProps.controls} 로
 * 선언하는데(screen/menu/requirements.md · frontend/grid.md) 그 버튼이 눌러야 하는 것은 여기 안에 있다. 접힘을 화면의
 * 상태로 끌어올리면 <b>드래그 중 자동 펼침</b>(§4.5.1)까지 화면이 들고 있어야 하고, 그것은
 * 컴포넌트의 일이다.
 *
 * <p>{@code SearchFormHandle} 과 같은 모양이다 — 명령은 ref 로, 값은 props 로.
 */
export interface TreeGridHandle {
  collapseAll: () => void;
  expandAll: () => void;
}

/**
 * ①의 왼쪽에 서는 <b>트리 검색</b> — screen/menu/requirements.md.
 *
 * <p><b>브레드크럼이 아니라 여기다</b>(2026-08-31 실물). frontend/tabs.md 의 슬롯에 두었더니 두 가지가
 * 어긋났다.
 *
 * <table>
 *   <tr><td>자리</td><td>줄 오른쪽 끝의 <i>조회조건 숨기기</i> 옆이라, <b>무엇을 검색하는지</b>
 *       가 화면 어디에도 없었다 — 트리가 둘인 화면에서는 어느 트리인지도 말하지 못한다</td></tr>
 *   <tr><td>입력</td><td><b>한 글자가 두 번 들어갔다.</b> 슬롯은 노드를 스토어에 등록해 셸이
 *       그리는 구조라(포털이 아니다) 값이 <b>한 커밋 늦게</b> 도착하고, 그 사이 판이 DOM 을
 *       props 값으로 되돌린다 — 한글은 매 타로 조합 중이라 그 되돌림이 조합을 깨고 글자가
 *       중복됐다</td></tr>
 * </table>
 *
 * <p>①에 두면 상태와 칸이 <b>같은 렌더</b>에 있어 되돌림이 없다. 폭도 조회조건 값 칸과 같게
 * 두는데(frontend/search-form.md), <i>검색</i> 이라는 같은 일을 하는 칸이 화면 안에서 두 크기이면 그것이
 * 학습 비용이다.
 *
 * <h2>칸 하나다 — 건수도 이동 버튼도 없다</h2>
 *
 * <p>브레드크럼에 있을 때는 <i>3/12</i> 와 화살표 둘이 함께 붙어 있었다(2026-08-31 요청으로
 * 뺐다). <b>거르지 않고 강조하는</b> 방식이라(screen/menu/requirements.md) 이동 수단이 필요하다고 봤는데,
 * ①로 내려온 뒤에는 그 전제가 달라졌다.
 *
 * <table>
 *   <tr><td>강조가 <b>경로를 펼친다</b></td><td>일치한 노드의 조상이 전부 펼쳐지므로
 *       <b>스크롤 한 번에 전부 보인다</b> — 24행짜리 트리에서 <i>다음</i> 을 눌러 옮겨 다닐
 *       거리가 아니다</td></tr>
 *   <tr><td>①은 <b>버튼 줄</b>이다</td><td>조회 · 접기 · 펼치기와 나란히 서므로, 화살표 둘이
 *       더 붙으면 <b>무엇이 그리드의 동작이고 무엇이 검색의 동작인지</b> 가 섞인다</td></tr>
 * </table>
 *
 * <p><b>첫 일치로는 스크롤한다</b> — {@link TreeGridProps.focusedId} 가 그 자리이며, 화면이
 * 그것을 정한다. 이동 수단이 없다고 <i>찾았는데 화면 밖</i> 이 되지는 않는다.
 */
export interface TreeSearch {
  /** 메시지 키 — 무엇으로 찾는지가 칸에 적혀 있어야 한다. */
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export interface TreeGridProps<T> {
  handleRef?: Ref<TreeGridHandle>;
  /** 화면 제목이 아니라 <b>그리드 제목</b>이다 — frontend/grid.md. 메시지 키. */
  title: string;
  /**
   * 제목 뒤에 붙는 <b>지금 보고 있는 대상</b> — frontend/grid.md 의 {@code titleSuffix} 와 같은 자리다.
   *
   * <p><b>완성된 글자를 받는다</b> — {@code DataGrid} 는 부모 컨트롤러와 필드 목록을 받지만
   * (`TitleSuffixSpec`) 트리에는 <b>부모 그리드가 없다</b>. 트리가 누구의 것인지는 화면만
   * 알며(고른 사용자 · 고른 역할), 그것을 컨트롤러로 표현할 자리가 없다.
   *
   * <p>비어 있으면 <b>아무것도 붙지 않는다</b> — <i>(없음)</i> 같은 자리표를 만들지 않는다.
   */
  titleSuffix?: string;
  menuCd: string;
  rows: T[];
  idOf: (row: T) => string;
  parentOf: (row: T) => string | null;
  /** 계층 컬럼의 헤더 — 메시지 키. <b>맨 왼쪽 고정</b>이라 순서도 고정도 대상이 아니다(screen/menu/requirements.md). */
  hierarchyHeader: string;
  /** 계층 컬럼에 그릴 것 — 아이콘과 이름이다. */
  hierarchy: (row: T, node: TreeNode<T>) => ReactNode;
  /**
   * 그 행의 <b>글자만</b> — 재는 데 쓰고 툴팁으로 낸다(2026-08-31 · screen/menu/requirements.md).
   *
   * <p>{@link #hierarchy} 가 JSX 라 <b>컴포넌트는 글자를 모른다</b>. 그런데 계층 컬럼의 폭은
   * <i>선언</i> 할 수 없는 값이다 — 들여쓰기가 폭을 먹으므로 숫자를 하나 박으면 얕은 트리에서는
   * 남고 깊은 트리에서는 잘린다. 한때 {@code flex: 1} 로 <b>남는 폭을 다 먹였는데</b>, 그러면
   * 액션 컬럼 넷을 그린 뒤의 여백이 전부 이 컬럼으로 가서 <i>메뉴 이름 뒤에 손바닥만 한
   * 빈칸</i>이 생겼다(2026-08-31 실물).
   *
   * <p>선언하면 <b>내용에서 폭을 내고 잘린 이름은 툴팁이 말한다</b>. 선언하지 않으면 옛
   * 모양({@code flex: 1})이 그대로다 — <b>컴포넌트를 쓰는 화면 셋을 한꺼번에 바꾸지 않기</b>
   * 위한 것이며, 그 셋은 폭이 문제가 된 적이 없다.
   */
  hierarchyText?: (row: T) => string;
  columns: TreeColumn<T>[];
  loading?: boolean;
  emptyText?: string;
  /**
   * 고른 행 — <b>선택이 없는 화면에서는 둘 다 생략한다</b>(2026-08-30 — screen/menu/requirements.md).
   *
   * <p>{@code MENU_TREE} 는 고른 메뉴가 하단 탭을 정하지만, 권한 트리에서 행 하나는
   * <b>그 자체로 편집 대상</b>이고 아래를 정하지 않는다(하단은 역할의 것이다) — 선택
   * 하이라이트만 남으면 <i>고르면 무언가 일어날 것</i> 이라는 기대를 만든다.
   */
  selectedId?: string | null;
  onSelect?: (row: T | null) => void;
  onRead: () => void;
  /**
   * 일괄 저장 — <b>선언하면 ① 에 저장 버튼이 선다</b>(2026-08-30 — screen/menu/requirements.md).
   *
   * <p>screen/menu/requirements.md 의 메뉴 트리는 <b>통째로 즉시 저장</b>이라 저장 버튼이 없고, screen/menu/requirements.md 의 권한
   * 트리는 <b>일괄</b>이라 있다 — <b>같은 컴포넌트인데 저장 모델이 반대</b>이며 그것이
   * screen/menu/requirements.md 이 적어 둔 사실이다. 컴포넌트가 저장 모델을 갖지 않고 <b>화면이 선언한다</b>
   * (frontend/grid.md).
   *
   * <p>{@code SAVE} 권한이 없으면 버튼이 <b>아예 없다</b>(frontend/tabs.md) — 셀의 스위치를 잠그는 것은
   * 화면의 일이며, 버튼만 감추면 <i>체크는 되는데 저장할 수 없는 상태</i>가 된다(screen/menu/requirements.md).
   */
  save?: {
    /** 미저장 변경이 있는가 — 없으면 버튼이 비활성이다. */
    dirty: boolean;
    onSave: () => void | Promise<void>;
  };
  /** ①의 왼쪽 — <b>트리 검색</b>이다(screen/menu/requirements.md). 없으면 그 자리는 빈다. */
  search?: TreeSearch;
  /**
   * ①을 <b>통째로 잠근다</b> — frontend/grid.md 의 <i>빈 상태</i>({@code <DataGrid disabled>} 와 같다).
   *
   * <p>마스터-디테일에서 <b>디테일은 마스터의 선택에 종속된다</b>. 고른 행이 없으면 조회할
   * 대상도, 접을 트리도, 검색할 이름도 없다 — 그때 버튼이 눌린다는 것은 <b>아무 일도
   * 일어나지 않는 클릭</b>이며, 사용자는 그것을 고장으로 읽는다(2026-08-31 실물: 이 트리의
   * 조회 버튼이 그랬다 — 눌러도 조용했다).
   *
   * <p>{@code loading} 과 <b>같은 자리에 걸리지만 다른 축</b>이다. 저것은 <i>지금은 잠깐</i>
   * 이고 이것은 <i>대상이 없다</i> 이며, 그래서 저쪽에는 사유를 붙이지 않고(곧 풀린다)
   * 이쪽은 <b>빈 판의 문구</b>가 사유를 말한다(<i>사용자를 선택하세요</i>).
   */
  disabled?: boolean;
  /**
   * 접히면 <b>제목 줄만</b> 남는다 — frontend/grid.md. {@code <DataGrid collapsed>} 와 같은 규약이다.
   *
   * <p><b>없어서 트리가 잘린 채로 남았다</b>(2026-08-31 실물). 스플리터를 오른쪽 끝으로
   * 밀면 pane 은 좁아지는데 트리는 자기가 접혔다는 것을 몰라 <b>머리·판·푸터를 그대로
   * 그렸고</b>, 좁은 띠 안에서 그것이 잘린 모습으로 보였다 — 접힌 것이 <i>고장난 것</i>
   * 처럼 읽히는 자리다.
   */
  collapsed?: boolean;
  /**
   * 어느 축으로 접혔는가 — {@code SplitPane} 의 콜백이 넘겨준다.
   *
   * <p>좌우로 접히면 남는 것이 <b>세로 띠</b>라 제목이 세로로 선다({@code <DataGrid
   * collapsedAxis>} 와 같은 값·같은 이유).
   */
  collapsedAxis?: SplitAxis;
  /** 제목 줄 클릭으로 되돌린다 — 접힌 pane 에서 <b>유일하게 누를 수 있는 것</b>이다. */
  onExpand?: () => void;
  /**
   * Ⓑ — frontend/grid.md. 모두 접기·펼치기가 여기 온다(screen/menu/requirements.md).
   *
   * <p><b>`button` 만 받는다</b> — 트리의 ①에 셀렉트가 필요해진 화면이 아직 없다.
   * 그리드 쪽은 유효 권한 탭이 그것을 요구해 갈렸다(screen/user/requirements.md · `GridSelectControl`).
   */
  controls?: GridButtonControl[];
  /**
   * 놓였다 — <b>서버로 나가기 전</b>이다(screen/menu/requirements.md).
   *
   * <p>확인 모달은 화면이 띄운다. {@code false} 를 돌려주면 트리가 <b>놓기 전 상태로</b>
   * 돌아간다 — 되돌릴 수 없는 작업이라 <i>확인이 판정이 아니라 마지막 되물음</i>이다.
   */
  onDrop?: (drop: TreeDrop) => void | Promise<void>;
  /**
   * 이 노드가 자식을 가질 수 있는가 — <b>가운데 구역이 사는 조건</b>이다(screen/menu/requirements.md).
   *
   * <p>죽는 경우가 둘이다: <b>URL 이 있는 리프</b>(§4.3)와 <b>깊이 5단에 닿은 노드</b>
   * (sys/menu.md). 위·아래 1/4 는 살아 있다.
   */
  canHaveChildren?: (row: T, node: TreeNode<T>) => boolean;
  /** 드롭이 성립하는가 · 무엇이라 말할 것인가 — 화면이 문장을 만든다(screen/menu/requirements.md). */
  verdict?: (drag: TreeNode<T>, target: TreeNode<T>, zone: DropZone) => DropVerdict;
  /**
   * 강조할 노드들 — <b>거르지 않는다</b>(screen/menu/requirements.md).
   *
   * <p>조건에 맞는 노드만 남기면 부모가 사라져 트리가 아니게 된다. 대신 일치 노드를
   * 강조하고 <b>그 경로를 펼친다</b> — 강조만 하고 펼치지 않으면 <i>접힌 채로 "찾았다"</i>
   * 가 된다.
   */
  highlighted?: ReadonlySet<string>;
  /** `이전 · 다음` 이 가리키는 노드 — 스크롤해 보여 준다. */
  focusedId?: string | null;
  /**
   * 엑셀이 내리는 표 — <b>화면 그대로 전위 순회</b>다(screen/menu/requirements.md).
   *
   * <p>다시 정렬하면 트리가 아니게 되므로 컴포넌트가 만들지 않고 <b>화면이 준다</b> —
   * 계층을 펴는 방법(경로 컬럼)도 화면만 안다. 엑셀의 들여쓰기는 필터·정렬 한 번에
   * 무너지므로 <b>경로 컬럼을 맨 앞에</b> 넣는다.
   */
  excel?: {
    fileName: string;
    /**
     * 표를 통째로 만든다 — 트리는 계층을 경로 컬럼으로 펴므로 `ColumnDef` 로 표현할 자리가
     * 없다(screen/menu/requirements.md).
     *
     * **`headers: string[]` 였다**(2026-08-30). 다운로드 이력이 컬럼 **식별자**를 요구하는데
     * (frontend/grid-advanced.md 의 `columnKeys`) 번역된 이름만으로는 같은 컬럼이 언어마다 다른 값으로 남아
     * *무엇을 내려받았나* 를 셀 수 없다.
     */
    build: () => { columns: PlainColumn[]; rows: (string | number | null)[][] };
  };
}
