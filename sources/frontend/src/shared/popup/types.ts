import type { ColumnDef, ReadApi } from '@/shared/grid/types';
import type { SearchField } from '@/shared/searchform/types';

/**
 * 참조 팝업 — frontend/grid.md · playbook/INDEX.md.
 *
 * <p><b>고르는 창은 그 자체가 그리드다</b>(frontend/grid.md) — 조회조건과 목록을 갖고 frontend/grid.md 의
 * 크롬을 쓴다. 그래서 팝업을 <i>컴포넌트</i>로 등록하지 않고 <b>선언으로</b> 등록한다:
 * 컴포넌트로 두면 팝업마다 조회 버튼의 자리와 페이징의 모양이 갈리고, <b>같은 앱에서
 * 목록을 고르는 방법이 팝업 수만큼</b> 생긴다.
 *
 * <p><b>선택은 언제나 한 행이다</b>(frontend/grid.md) — 셀 하나에 값 하나이므로, 여러 행을 고르는
 * 것은 셀 편집이 아니라 <b>행 추가</b>이며 다른 기능이다.
 */

/**
 * 팝업이 돌려주는 행 — <b>타입이 없다</b>.
 *
 * <p>레지스트리가 키 하나로 여럿을 담으므로 여기서 타입을 붙들 수가 없다(제네릭을 맵에
 * 통과시키면 등록하는 쪽이 전부 {@code any} 가 된다). <b>타입이 필요한 자리는 여기가
 * 아니라 {@code apply} 다</b> — 고른 행을 <b>어느 컬럼에 어떻게 담을지</b> 아는 것은
 * 팝업이 아니라 그것을 쓰는 컬럼이고, 그쪽은 자기 행 타입을 안다(frontend/grid.md).
 */
export type PopupRow = Record<string, unknown>;

export interface PopupSpec {
  /** 모달 제목 — 메시지 키(sys/code.md). */
  title: string;
  /**
   * 목록 컬럼 — <b>그리드 어휘 그대로다</b>(frontend/grid.md).
   *
   * <p>읽기 전용 목록이므로 {@code editable} 을 적지 않는다. 고르는 창에서 값을 고치면
   * 그 편집은 <b>아무 데도 저장되지 않는다</b> — 저장 버튼이 없는 그리드다.
   */
  columns: ColumnDef<PopupRow>[];
  /** 목록 조회 — frontend/grid.md 의 {@code read} 하나다. */
  read: ReadApi;
  /**
   * 조회조건 — 없으면 조건 없이 전량을 연다.
   *
   * <p><b>없어도 되는 팝업이 있다.</b> 후보가 스무 개인 코드 목록이 그것이며, 거기에
   * 검색 폼을 붙이면 <i>고르러 왔는데 먼저 찾아야</i> 한다.
   */
  searchFields?: SearchField[];
  /** 모달 폭(px). 컬럼이 많은 팝업만 적는다. */
  width?: number;
}

/**
 * 팝업이 닫힌 <b>세 가지 방법</b>.
 *
 * <p><b>취소와 지우기를 가르는 것이 이 타입의 존재 이유다.</b> 하나로 묶어 {@code null}
 * 을 돌려주면 frontend/grid.md 의 <i>{@code picked === null} 은 지우는 것이다</i> 와 만나 <b>Esc 가
 * 셀을 비운다</b> — 고르러 열었다가 마음을 바꾼 사람이 <b>원래 값을 잃는다</b>. 그 사고는
 * 저장하기 전까지는 화면에 아무 경고도 남기지 않는다.
 *
 * <p>그래서 지우기는 <b>버튼으로 명시</b>하고, 창을 그냥 닫는 것은 <b>아무 일도 없음</b>이다.
 */
export type PopupOutcome =
  | { kind: 'picked'; row: PopupRow }
  /** 값을 비운다 — {@code apply(row, null)} 이 딸려 온 칸까지 함께 지운다(frontend/grid.md). */
  | { kind: 'cleared' }
  /** 창을 닫았을 뿐이다 — 셀은 그대로다. */
  | { kind: 'cancelled' };

/**
 * 팝업을 여는 함수 — {@code usePopup()} 이 준다.
 *
 * <p><b>약속을 돌려준다.</b> 셀 편집기와 검색 폼이 <i>고른 뒤에</i> 할 일을 각자 갖고
 * 있으므로, 콜백을 등록하는 모양이면 그 둘이 서로의 상태를 알아야 한다 — 고른 값이
 * <b>부른 자리로 돌아오는 것</b>이 이 컨트롤의 전부다.
 *
 * <p><b>거절하지 않는다.</b> 고르지 않고 닫는 것은 정상 흐름이고, 예외로 만들면 부르는
 * 쪽이 전부 {@code try/catch} 를 두른다.
 */
export type OpenPopup = (
  key: string,
  options?: {
    /** 팝업의 조회 봉투에 실린다 — <b>현재 행에서</b> 만든 조건이다(frontend/grid.md 의 `param`). */
    param?: unknown;
    /**
     * 인가가 매이는 메뉴 — <b>부르는 화면의 것</b>이다.
     *
     * <p>팝업의 조회 엔드포인트는 그 화면의 폴더에 있고(backend/api.md) 시드가 그 화면의 메뉴에
     * 매핑한다. 팝업이 자기 메뉴를 갖는 것처럼 굴면 <b>어느 메뉴로도 인가되지 않는</b>
     * 요청이 되어 403 이 난다.
     */
    menuCd?: string;
    /**
     * <b>지우기 버튼을 낸다</b> — 지금 값이 있는 칸에서만이다.
     *
     * <p>빈 칸에 지우기를 두면 <i>아무 일도 하지 않는 버튼</i>이 되고, 사용자는 그것이
     * 무엇을 지우는 것인지 물어야 한다.
     */
    clearable?: boolean;
  },
) => Promise<PopupOutcome>;
