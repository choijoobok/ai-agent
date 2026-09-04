import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import type { GridRow } from '@/shared/grid/rows';
import type { UserRoleRow } from '@/features/user/types';

/**
 * 디테일 탭의 <b>판정 둘</b> — 61 §3.8 탭 1 · 탭 3.
 *
 * <p>화면 파일에서 꺼낸 것은 <b>둘 다 한 번씩 틀렸기 때문</b>이다. 그리드 선언 사이에
 * 섞여 있으면 컴포넌트를 띄우지 않고는 잴 수 없고, 잴 수 없는 규칙은 <b>실물을 눌러 봐야</b>
 * 틀린 것이 드러난다.
 */

/**
 * 저장 확인 <b>앞</b>에 서는 경고 — 63 §4.4 가 연 자리.
 *
 * <p>회수는 <b>다음 로그인부터</b> 반영된다(security-design.md §4) — 지금 세션은 살아 있다. 건수만으로는
 * 그 사실이 빠지고, 빠지면 <i>회수했는데 아직 들어가진다</i> 가 결함으로 읽힌다.
 *
 * <h2>오늘이 언제인지 묻지 않는다</h2>
 *
 * <p>처음에는 <i>새 종료일이 오늘보다 이른가</i> 로 판정했고 <b>브라우저 시계를 UTC 로
 * 읽어</b> 그 경고가 뜨지 않았다(2026-08-31 실물 — KST 자정 직후라 UTC 로는 아직 어제였다).
 * 업무 날짜는 <b>서버가 정하는 것</b>이고(40 §4.3) 화면에는 그 값이 없다.
 *
 * <p>그래서 <b>시계를 아예 보지 않는다</b> — 묻는 것을 <i>기간을 줄였는가</i> 로 바꾸면
 * 답이 <b>편집 전후의 두 값</b>에만 있다. 즉시 회수든 예정된 종료든 <i>이 사람이 언젠가
 * 이 역할을 잃는다</i> 는 사실은 같고, 화면이 말해야 하는 것도 그것이다.
 */
export function warnRevoke(rows: GridRow<UserRoleRow>[]): string[] {
  const revoked = rows.filter(
    (row) =>
      (row.state === 'D' && row.data.grantState !== 'EXPIRED') ||
      (row.state === 'U' && row.original?.grantState !== 'EXPIRED' && shortened(row)),
  ).length;
  return revoked > 0 ? [label(MSG.USER_ROLE_WARN_REVOKE, { count: revoked })] : [];
}

/** 무기한이던 부여에 종료일이 생겼거나, 있던 종료일이 앞으로 당겨졌다. */
function shortened(row: GridRow<UserRoleRow>): boolean {
  const before = row.original?.validToDt ?? null;
  const after = row.data.validToDt ?? null;
  if (after === null) return false;
  return before === null || after < before;
}

/**
 * IP 또는 CIDR 인가 — <b>서버가 다시 본다</b>(grid-edit-validation.md §3.4). 여기서 보는 것은 UX 다.
 *
 * <p>IPv6 를 정규식으로 온전히 맞추지는 않는다. 화면의 일은 <i>오타를 저장 왕복 전에
 * 잡는 것</i>이고, 판정은 리터럴 파서를 가진 서버가 한다(`InetAddress.ofLiteral`).
 *
 * <p><b>빈 값은 통과다</b> — 아직 안 쓴 칸이며, 그것을 막는 것은 `pk` 의 필수 표시다
 * (grid-column-contract.md §5.1). 여기서 함께 막으면 새 행을 만들자마자 붉은 칸이 뜬다.
 */
export function isIpOrCidr(value: string): boolean {
  const text = value.trim();
  if (text === '') return true;
  const slash = text.indexOf('/');
  const address = slash < 0 ? text : text.slice(0, slash);
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  const v6 = address.includes(':') && /^[0-9A-Fa-f:.]+$/.test(address);
  if (!v6) {
    if (!v4) return false;
    if (v4.slice(1).some((part) => Number(part) > 255)) return false;
  }
  if (slash < 0) return true;
  const prefix = text.slice(slash + 1);
  if (!/^\d+$/.test(prefix)) return false;
  // 상한이 계열에서 나온다 — 상수 하나로 두면 `1.2.3.4/64` 가 통과한다.
  return Number(prefix) <= (v6 ? 128 : 32);
}
