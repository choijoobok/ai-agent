import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import type { Tone } from '@/shared/grid/types';

/**
 * 배치의 코드 셋 — screen/admin/system/batch/schedule/requirements.md. <b>공통코드가 아니다.</b>
 *
 * <p>그 절이 근거를 넷 들었다: 값을 아는 것은 <b>배치 러너의 분기</b>이고, 관리자가 늘릴
 * 일이 없으며, 늘리려면 소스를 고쳐야 하고, 공통코드로 두면 `SYS_YN='Y'` 로 잠가야 하는데
 * <b>잠가 두면 관리자에게 남는 것이 없다</b>(sys/code.md). 그래서 값은 여기, 라벨은 메시지다.
 *
 * <p><b>화면 둘이 함께 쓴다.</b> `BATCH_SCHEDULE` 의 *최근 결과* 와 `BATCH_HISTORY` 의
 * *결과* 가 같은 값을 그리므로(screen/admin/system/batch/schedule/requirements.md — <i>"하단 pane 첫 행과 같은 값"</i>) 여기 한 벌만
 * 둔다. 화면마다 맵을 두면 <b>색이 갈리고</b>, 갈린 색은 같은 사실을 다르게 읽힌다.
 *
 * <p><b>`features/` 가 아니라 `shared/` 인 것이 그 때문이다.</b> seed.md 의 *폴더가 인가
 * 경계* 는 <b>엔드포인트</b>의 규칙이며(그것이 `SYS_MENU_API` 시드의 입력이다), 여기에는
 * URL 이 없다.
 */

/** 서버 `BatchResultCode` 와 1:1 — sys/batch.md. */
export type BatchResultCode =
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAIL'
  | 'SKIP_LOCK'
  | 'SKIP_COOLDOWN'
  | 'CANCELED'
  | 'LOST';

/** 서버 `BatchExecType` 과 1:1 — sys/batch.md. */
export type BatchExecType = 'SCHEDULE' | 'MANUAL';

const RSLT_LABEL: Record<BatchResultCode, string> = {
  RUNNING: MSG.BATCH_RSLT_RUNNING,
  SUCCESS: MSG.BATCH_RSLT_SUCCESS,
  FAIL: MSG.BATCH_RSLT_FAIL,
  SKIP_LOCK: MSG.BATCH_RSLT_SKIP_LOCK,
  SKIP_COOLDOWN: MSG.BATCH_RSLT_SKIP_COOLDOWN,
  CANCELED: MSG.BATCH_RSLT_CANCELED,
  LOST: MSG.BATCH_RSLT_LOST,
};

const EXEC_LABEL: Record<BatchExecType, string> = {
  SCHEDULE: MSG.BATCH_EXEC_SCHEDULE,
  MANUAL: MSG.BATCH_EXEC_MANUAL,
};

/**
 * 결과의 색 — screen/admin/system/batch/schedule/requirements.md. <b>값이 일곱이고 색이 넷이다.</b>
 *
 * <p>그래서 `SYS_CODE` 에 색을 넣을 자리가 애초에 없고, frontend/grid.md 의 `tone` 맵이 그 자리다.
 *
 * <h2>`SKIP_LOCK` 이 `muted` 인 것이 결정이다</h2>
 *
 * <p>노드 3대면 <b>매 주기 2건</b>이 쌓인다. 그것을 빨강으로 두면 목록의 3분의 2가 경고가
 * 되고 <b>진짜 문제가 묻힌다</b> — screen/admin/system/log/access/requirements.md 의 *"정상이 압도적인 목록에서는 칠하지
 * 않는다"* 와 같은 판단이다.
 *
 * <p>반대로 <b>`SKIP_COOLDOWN` 은 `warn`</b> 이다. backend/persistence.md 이 막으려던 바로 그 사고이며
 * <b>나면 안 된다</b> — 둘이 한 코드였을 때 화면이 색을 줄 수 없었던 것이 코드를 가른
 * 이유 전부다.
 *
 * <p><b>`RUNNING` 은 칠하지 않는다</b>(`none`). 진행 중은 사건이 아니라 상태다.
 *
 * <h2>`LOST` 는 `err` 다 — `FAIL` 과 <b>같은 색, 다른 글자</b></h2>
 *
 * <p>운영자가 해야 할 일이 같다: <b>봐야 한다.</b> 그래서 색을 가르지 않는다. 가르는 것은
 * 글자이며, 그 차이가 <i>다음에 무엇을 볼 것인가</i> 를 정한다 — `FAIL` 은 스택을 열고
 * `LOST` 는 <b>그 노드에 무슨 일이 있었는지</b> 를 본다.
 *
 * <p>한때 이 자리를 <b>유령 배지</b>가 맡았다. `RUNNING` 인데 `START_DTM + LOCK_EXPIRY_SEC`
 * 을 넘긴 행에 붙였는데, 그 임계값은 <b>오래 도는 정상 배치를 죽었다고 부른다</b>(기본값이
 * 300초다). 서버가 락 하트비트로 정확한 증거를 갖게 되면서 판정이 그쪽으로 옮겨 갔고,
 * 화면은 <b>결과 코드 하나만</b> 읽는다 — 판정 주체가 둘이 아니게 됐다.
 */
export const RSLT_TONE: Record<BatchResultCode, Tone> = {
  RUNNING: 'none',
  SUCCESS: 'ok',
  FAIL: 'err',
  SKIP_LOCK: 'muted',
  SKIP_COOLDOWN: 'warn',
  CANCELED: 'muted',
  LOST: 'err',
};

/**
 * 결과 코드 → 번역된 라벨.
 *
 * <p><b>모르는 값은 값 그대로 낸다.</b> 서버가 코드를 늘렸는데 화면이 아직 모르는 배포가
 * 그것이며, 그때 빈 칸을 그리면 <i>결과가 없는 실행</i> 으로 보인다 — 코드 문자열이라도
 * 보이면 <b>무엇이 새로 생겼는지</b> 를 읽을 수 있다.
 */
export function rsltLabel(value: unknown): string {
  const key = RSLT_LABEL[value as BatchResultCode];
  return key ? label(key) : codeText(value);
}

/** 실행 구분 → 번역된 라벨. 모르는 값 규칙은 {@link rsltLabel} 과 같다. */
export function execTypeLabel(value: unknown): string {
  const key = EXEC_LABEL[value as BatchExecType];
  return key ? label(key) : codeText(value);
}

/**
 * 모르는 값을 <b>글자로 옮기되 지어내지는 않는다</b>.
 *
 * <p>`String(value)` 를 그대로 쓰지 않는 것은 객체가 왔을 때 `[object Object]` 가 셀에
 * 박히기 때문이다 — 그것은 <i>모르는 코드</i> 보다 나쁘다: 값이 있는 것처럼 보이면서
 * 아무것도 말하지 않는다. 문자열이 아니면 빈 칸이 낫다.
 */
function codeText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** 조회조건의 후보 일곱 — 순서가 sys/batch.md 의 전이 순서다(시작 → 끝 → 건너뜀 → 유실). */
export function rsltOptions() {
  return (Object.keys(RSLT_LABEL) as BatchResultCode[]).map((code) => ({
    value: code,
    text: label(RSLT_LABEL[code]),
  }));
}

/** 조회조건의 후보 둘. */
export function execTypeOptions() {
  return (Object.keys(EXEC_LABEL) as BatchExecType[]).map((code) => ({
    value: code,
    text: label(EXEC_LABEL[code]),
  }));
}
