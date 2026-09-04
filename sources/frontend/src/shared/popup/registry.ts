import type { PopupSpec } from '@/shared/popup/types';

/**
 * 참조 팝업 레지스트리 — grid-column-contract.md §8 의 미결(<i>"화면 코드에서 선언할지 공통 목록을 둘지"</i>)에
 * 답한다(68 §9.4).
 *
 * <p><b>공통 레지스트리에 등록하되 키에 네임스페이스를 둔다</b>(`sample.customer` ·
 * `sys.user`). 둘 중 하나만 고르면 각각 이렇게 깨진다 —
 *
 * <ul>
 *   <li><b>화면마다 선언하면</b> 같은 팝업이 두 화면에서 두 벌이 되고, 한쪽만 컬럼이
 *       늘어난다. 고르는 창은 <b>같은 데이터를 같은 모양으로</b> 보여야 하는 자리다
 *   <li><b>네임스페이스 없는 공통 목록이면</b> 샘플을 지울 때 그 목록에서 줄을 지워야
 *       하고, 그것은 10 §L 체크리스트에 <b>없던 항목</b>이 된다 — 빠뜨리면 없는 화면의
 *       팝업이 목록에 남는다
 * </ul>
 *
 * <p><b>등록은 모듈 로드에서 일어난다.</b> 화면이 자기가 쓰는 팝업 모듈을 임포트하므로
 * 그 화면이 열릴 때 등록되고, <b>화면 폴더를 지우면 등록도 함께 사라진다</b> — 지우는
 * 일이 폴더 하나로 끝나는 것이 68 §10.2 의 규칙이다.
 */

const registry = new Map<string, PopupSpec>();

/**
 * `네임스페이스.이름` — <b>점 하나</b>다.
 *
 * <p>점이 없으면 통째로 지우는 규칙(`sample.*`)이 성립하지 않고, 점이 둘이면 어디까지가
 * 네임스페이스인지 읽는 사람마다 갈린다.
 */
const KEY_SHAPE = /^[a-z][a-zA-Z0-9]*\.[a-zA-Z0-9]+$/;

/**
 * 팝업 여럿을 등록한다 — <b>한 파일이 자기 네임스페이스를 통째로</b> 낸다.
 *
 * <p><b>같은 키를 두 번 등록하는 것을 막지 않는다</b> — 화면 둘이 같은 팝업을 쓰면 각자
 * 임포트하고, 모듈 캐시가 있어도 테스트에서는 다시 돌 수 있다. 대신 <b>덮어쓴다</b>:
 * 마지막 선언이 이긴다는 규칙 하나면 <i>어느 화면을 먼저 열었나</i> 에 따라 팝업이 달라
 * 보이는 일이 없다.
 *
 * <p><b>키 모양은 막는다.</b> 이것은 실수가 아니라 <b>규약 위반</b>이고, 통과시키면
 * 삭제 규칙이 조용히 새어 나간다 — 지울 때가 되어서야 드러나는 종류다.
 */
export function registerPopups(entries: Record<string, PopupSpec>): void {
  for (const [key, spec] of Object.entries(entries)) {
    if (!KEY_SHAPE.test(key)) {
      // 개발자용이라 영어다 — 화면에 나가는 문구가 아니다(eslint 의 43 §3 규칙 주석).
      throw new Error(`Popup key must be namespaced as "ns.name" (68 §9.4): ${key}`);
    }
    registry.set(key, spec);
  }
}

/**
 * 키 → 선언. <b>모르는 키는 {@code undefined} 다.</b>
 *
 * <p>여는 쪽이 그것을 어떻게 다룰지는 부르는 자리의 몫이다 — 셀 편집기는 <b>열지 않고
 * 편집을 물린다</b>: 빈 모달을 띄우면 사용자는 <i>목록이 0건</i> 으로 읽고 기다린다.
 */
export function popupSpec(key: string): PopupSpec | undefined {
  return registry.get(key);
}

/** 등록된 키 전부 — 진단과 테스트용이다. */
export function popupKeys(): string[] {
  return [...registry.keys()].sort();
}
