import type { SearchOp } from '@/shared/searchform/types';

/**
 * 저장된 조회조건의 <b>직렬화 형태</b> — frontend/search-form.md.
 *
 * <p><b>와이어가 아니라 폼 값이다.</b> 봉투(`conditions`·`params`)는 파생물이고
 * `to`·`paramKey`·`scale` 은 **선언에 있으므로** 함께 저장하면 미러링이다 — 선언을 고쳤을
 * 때 **저장된 쪽이 낡은 형태를 되살린다**. 폼 값만 담으면 사라진 필드는 **그 키만 버리면**
 * 된다.
 *
 * <p><b>기본값과 같은 칸은 들어오지 않는다</b>. 그래서 *최근 7일* 로 저장한 조건이
 * 열 때마다 최근 7일이며, 절대값으로 굳지 않는다 — 그것이 저장된 조건의 가장 흔한
 * 배신이다. 저장 크기가 주는 것은 덤이다.
 *
 * <p><b>`op` 만 예외로 함께 저장한다</b>. 다른 셋은 선언이 정하지만 `op` 는
 * **사용자가 고른다** — 선언에 없으므로 저장하지 않으면 복원되지 않는다.
 */
export interface SavedCondValue {
  /** 기본 연산자를 그대로 쓰면 없다. */
  op?: SearchOp;
  /** 기본값을 그대로 쓰면 없다 — `op` 만 바꾼 칸이 그렇다. */
  value?: string | string[];
  /**
   * 팝업 칸의 <b>표시값</b> — playbook/INDEX.md.
   *
   * <p><b>위 머리말의 <i>미러링</i> 경고에 걸리지 않는다.</b> 그것은 <i>선언에 있는 것을
   * 또 저장하지 말라</i> 는 규칙인데, 이 글자는 선언에 없다 — <b>고른 행에서 나온 것</b>
   * 이라 다시 만들려면 그 팝업을 <b>다시 조회해야</b> 한다.
   *
   * <p>저장하지 않으면 다시 열었을 때 <b>빈 칸</b>이다: 조건은 걸려 있는데 무엇으로
   * 걸렀는지 사용자가 알 수 없고, 그 상태로 조회하면 <i>왜 이것만 나오나</i> 가 된다.
   * frontend/search-form.md 이 <b>와이어가 아니라 폼 값</b>을 저장하는 이유가 정확히 이 자리다.
   */
  text?: string;
}

export type SavedCondValues = Record<string, SavedCondValue>;

/** 서버가 주는 항목 하나 — frontend/search-form.md 의 속성 넷 중 셋. `condJson` 은 위 맵의 문자열이다. */
export interface SavedCond {
  condNm: string;
  condJson: string;
  dflt: boolean;
  sortNo: number;
}

/**
 * <b>깨진 JSON 은 없는 것으로 친다.</b> 실패가 조용한 쪽인 이유는 §5.3 그대로다 —
 * 개인 편의 기능이며, 배포마다 *"저장한 조건이 무효입니다"* 를 띄우면 **고칠 수 없는
 * 경고**가 반복된다.
 */
export function parseCondJson(condJson: string): SavedCondValues {
  try {
    const parsed: unknown = JSON.parse(condJson);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as SavedCondValues;
  } catch {
    return {};
  }
}
