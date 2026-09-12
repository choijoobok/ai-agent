/**
 * 부여 상태 — 예정 · 유효 · 만료. **화면 넷이 이 하나를 본다.**
 *
 * <p><b>기간에서만 파생한다</b>(screen/admin/system/user/requirements.md). 역할 자체의 {@code USE_YN} 은 보지 않으므로
 * <i>유효인데 아무 권한도 주지 않는</i> 행이 있을 수 있고, 그 사실은 상태가 아니라 옆의
 * 배지가 말한다. 기간이 비면 무기한이다.
 *
 * <h2>왜 여기 있나</h2>
 *
 * <p>2026-09-07 까지 <b>타입이 네 벌 · 색 맵이 세 벌</b>이었고, 공통물과 화면이 같은 상태에
 * <b>다른 색</b>을 주고 있었다({@code SCHEDULED} 가 한쪽은 주의색, 두 쪽은 무색). 6차 화면 재현
 * 회귀가 찾았다 — <b>등재만으로는 갈림을 막지 못한다</b>는 실례이며(frontend/packages.md),
 * 색을 맞추는 것으로는 <b>다시 갈리는 것</b>을 막지 못해 정본을 하나로 모았다.
 *
 * <h2>라벨은 여기 두지 않는다</h2>
 *
 * <p>화면마다 메시지 키가 다르다({@code role.grant.*} · {@code menuTree.grant.*} ·
 * {@code user.state.*} · {@code userAuth.state.*}). <b>키를 하나로 합치는 것은 문구
 * 마이그레이션</b>이라 여기서 하지 않고, 대신 {@link grantDisplay} 가 <i>각자의 라벨 맵</i>을
 * 받아 같은 방식으로 쓰게 한다 — 갈릴 수 있는 것은 <b>방식</b>이고 그것만 묶으면 된다.
 */

import type { Tone } from '@/shared/grid/types';
import { label } from '@/shared/i18n/label';

export type GrantState = 'SCHEDULED' | 'ACTIVE' | 'EXPIRED';

/** 전수 커버를 테스트가 잠근다 — quality/test-design.md §3. */
export const GRANT_STATES = ['SCHEDULED', 'ACTIVE', 'EXPIRED'] as const satisfies
  readonly GrantState[];

/**
 * 배지의 색.
 *
 * <p><b>예정은 무색이다</b>(사용자 결정 2026-09-07). 경고할 일이 아니다 — <b>아직 아무
 * 영향이 없을 뿐</b>이며 관리자가 그렇게 넣은 것이다. <b>만료를 감추지 않는 것</b>이
 * 남은 요점이고(AUTHZ-13), 흐린 색이 <i>지금은 영향이 없지만 다시 유효해질 수 있다</i> 를
 * 말한다.
 *
 * <p><b>{@code Record<string, Tone>} 인 것은 컬럼의 {@code tone} 이 색인 서명을 요구해서다.</b>
 * 그래서 타입이 <i>빠진 상태</i>를 잡아 주지 않고, 그 몫을 {@link GRANT_STATES} 를 도는
 * 선언 검사가 맡는다.
 */
export const GRANT_TONE: Record<string, Tone> = {
  SCHEDULED: 'none',
  ACTIVE: 'ok',
  EXPIRED: 'muted',
};

/**
 * 컬럼의 {@code display} 를 만든다 — <b>코드 그대로 두고 글자만</b> 바꾼다.
 *
 * <p>셀 값을 라벨로 바꾸면({@code derive}) <b>정렬·필터·엑셀이 라벨을 본다</b> —
 * {@code display} 는 표시 문자열만 고른다(frontend/declarations.md). 2026-09-07 까지
 * {@code roleHolder} 하나가 {@code derive} 쪽이었고, 그래서 <b>그 화면만 엑셀에 라벨이
 * 나갔다.</b>
 *
 * @param labels 그 화면의 상태 → 메시지 키. 화면마다 다르다(위 머리말).
 */
export function grantDisplay(
  labels: Record<GrantState, string>,
): (value: unknown) => string {
  return (value) => {
    // `unknown` 을 그대로 잇지 않는다 — 객체가 오면 `[object Object]` 가 셀에 박힌다.
    const code = typeof value === 'string' ? value : '';
    return code in labels ? label(labels[code as GrantState]) : code;
  };
}
