import type { Action } from '@/shared/authz/permission';

/**
 * 경로에서 액션을 읽는다 — backend/api.md 결정 1.
 *
 * <p><b>규칙의 원본은 서버 쪽 시드 생성기다</b>(`bootstrap/build.gradle.kts` 의
 * `actionOfPath`). 여기 있는 것은 그 규칙의 <b>사본</b>이며, 사본을 두는 이유는
 * `api.actions[]` 버튼이 <b>액션 코드를 선언하지 않기</b> 때문이다(frontend/grid.md) — 버튼과
 * URL 이 한 선언에 있으므로 권한 판정에 필요한 것은 이미 다 있고, 손으로 적게 하면
 * <b>버튼을 추가하고 권한을 빠뜨리는</b> 경로가 열린다.
 *
 * <p><b>사본이 틀려도 데이터는 새지 않는다.</b> 여기서 하는 판정은 *버튼을 그릴까* 이고
 * 최종 판정은 서버의 인가 인터셉터다(backend/security.md · `permission.ts`). 틀리면 드러나는 증상은
 * <b>눌러도 403 인 버튼</b>이거나 <b>보이지 않는 버튼</b>이며, 둘 다 시드와 대조하면 곧
 * 보인다 — `API_CATALOG`(screen/menu/requirements.md)가 그 대조표다.
 *
 * <p>규칙을 바꿀 일이 생기면 <b>생성기가 원본</b>이다. 여기만 고치면 화면은 버튼을 그리는데
 * 시드에는 다른 액션이 들어가 있게 된다.
 */

const READ_PREFIXES = ['get', 'search', 'find', 'retrieve'];
const SAVE_PREFIXES = ['save', 'insert', 'update', 'delete'];

/**
 * <b>마지막 마디의 접두</b>가 정한다 — 그 밖은 전부 `EXECUTE` 다.
 *
 * <p>`@ApiActionType` 으로 접두를 이긴 API 는 여기서 알 수 없다. 그 애너테이션은 <b>규약을
 * 지킬 수 없는 경로를 위한 예외</b>이고(레거시 이관 등) 새로 쓰는 화면의 버튼이 그것을
 * 쓸 일이 없다 — 쓰게 되는 날에는 이 함수가 아니라 `controls` 가 답이다.
 */
export function actionOfUrl(url: string): Action {
  const last = url.substring(url.lastIndexOf('/') + 1);
  if (READ_PREFIXES.some((prefix) => last.startsWith(prefix))) return 'READ';
  if (SAVE_PREFIXES.some((prefix) => last.startsWith(prefix))) return 'SAVE';
  if (last.startsWith('export')) return 'EXPORT';
  return 'EXECUTE';
}
