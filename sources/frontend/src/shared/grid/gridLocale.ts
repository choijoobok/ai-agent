import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';

/**
 * AG Grid 자체 문구도 언어를 따른다 — sys/code.md · frontend/grid.md 과 같은 방향.
 *
 * <p><b>판이 내는 문구가 화면에 그대로 나온다.</b> 로딩 오버레이와 <b>컬럼 필터 패널</b>이
 * 그것이며, 두지 않으면 한국어 화면에 <i>"Loading…"</i> 과 <i>"Contains"</i> 가 섞인다 —
 * 메시지 슬라이스에서 antd 의 {@code locale} 이 {@code koKR} 로 박혀 있던 것과 같은 자리다.
 *
 * <p><b>전부 옮기지 않는다.</b> Community 의 {@code localeText} 는 백 개가 넘고 대부분은
 * Enterprise 기능(집계·피벗·차트)의 것이라 이 저장소에서 렌더될 일이 없다. 여기 있는 것은
 * <b>실제로 화면에 나오는 것</b>뿐이며, 새 화면이 다른 문구를 띄우면 그때 더한다 —
 * 안 쓰는 키를 미리 넣으면 번역하는 사람이 <b>한 번도 보이지 않는 문구</b>를 채우게 된다.
 *
 * <p>날짜 필터는 여기 없다. frontend/grid.md 가 <b>AntD 달력으로 자체 구현</b>하기로 정했으므로
 * 판의 날짜 문구가 나올 자리가 아니다 — 그 구현은 그것을 처음 요구하는 화면이 가져온다.
 */
export function gridLocaleText(): Record<string, string> {
  return {
    loadingOoo: label(MSG.GRID_AG_LOADING),
    noRowsToShow: label(MSG.GRID_EMPTY),
    noMatchingRows: label(MSG.GRID_AG_NO_MATCHING_ROWS),

    filterOoo: label(MSG.GRID_AG_FILTER_OOO),
    applyFilter: label(MSG.GRID_AG_APPLY_FILTER),
    resetFilter: label(MSG.GRID_AG_RESET_FILTER),
    clearFilter: label(MSG.GRID_AG_CLEAR_FILTER),
    cancelFilter: label(MSG.COMMON_CANCEL),

    contains: label(MSG.SEARCH_OP_CONTAINS),
    notContains: label(MSG.GRID_AG_NOT_CONTAINS),
    equals: label(MSG.SEARCH_OP_EQ),
    notEqual: label(MSG.SEARCH_OP_NE),
    startsWith: label(MSG.SEARCH_OP_STARTS_WITH),
    endsWith: label(MSG.SEARCH_OP_ENDS_WITH),
    blank: label(MSG.SEARCH_OP_IS_NULL),
    notBlank: label(MSG.SEARCH_OP_IS_NOT_NULL),

    greaterThan: label(MSG.GRID_AG_GREATER_THAN),
    greaterThanOrEqual: label(MSG.GRID_AG_GREATER_OR_EQUAL),
    lessThan: label(MSG.GRID_AG_LESS_THAN),
    lessThanOrEqual: label(MSG.GRID_AG_LESS_OR_EQUAL),
    inRange: label(MSG.GRID_AG_IN_RANGE),
    inRangeStart: label(MSG.GRID_AG_IN_RANGE_START),
    inRangeEnd: label(MSG.GRID_AG_IN_RANGE_END),

    andCondition: label(MSG.GRID_AG_AND),
    orCondition: label(MSG.GRID_AG_OR),
  };
}
