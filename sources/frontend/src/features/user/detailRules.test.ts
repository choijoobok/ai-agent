import { describe, expect, it } from 'vitest';
import type { GridRow, RowState } from '@/shared/grid/rows';
import { isIpOrCidr, warnRevoke } from '@/features/user/detailRules';
import type { UserRoleRow } from '@/features/user/types';

/**
 * 디테일 탭의 판정 둘 — 61 §3.8.
 *
 * <p><b>둘 다 한 번씩 틀렸던 자리다.</b> 회수 경고는 브라우저 시계를 UTC 로 읽어 KST 자정
 * 직후에 뜨지 않았고(40 §4.3), 형식 검사는 IPv4 의 접두 상한을 계열에서 얻지 않으면
 * `1.2.3.4/64` 를 통과시킨다.
 *
 * <p>그래서 재는 것이 <i>맞는 값을 통과시키는가</i> 가 아니라 <b>그때 틀렸던 것을 지금은
 * 잡는가</b> 다.
 */

const TODAY_ISH = '2026-08-31';
const LATER = '2026-12-31';

function row(
  state: RowState,
  before: Partial<UserRoleRow> | null,
  after: Partial<UserRoleRow>,
): GridRow<UserRoleRow> {
  const base: UserRoleRow = {
    roleId: 'DEVELOPER',
    roleNm: '개발자',
    roleDesc: null,
    roleUseYn: true,
    validFromDt: null,
    validToDt: null,
    grantState: 'ACTIVE',
    regId: null,
    regDtm: null,
    modId: null,
    modDtm: null,
  };
  return {
    id: 'r1',
    state,
    data: { ...base, ...after },
    original: before === null ? null : { ...base, ...before },
  };
}

describe('회수 경고 — 시계를 보지 않는다', () => {
  it('무기한 부여에 종료일이 생기면 경고한다 — 그 날짜가 미래여도 언젠가 잃는다', () => {
    const rows = [row('U', { validToDt: null }, { validToDt: LATER })];

    expect(warnRevoke(rows)).toHaveLength(1);
  });

  it('있던 종료일을 앞으로 당기면 경고한다 — 즉시 회수가 그 특수한 경우다', () => {
    const rows = [row('U', { validToDt: LATER }, { validToDt: TODAY_ISH })];

    expect(warnRevoke(rows)).toHaveLength(1);
  });

  /*
    이것이 <b>UTC 로 읽어 놓친 경우</b>다. 종료일을 어제로 두는 즉시 회수인데, `toISOString()`
    이 KST 자정 직후에 아직 어제를 내주어 *오늘보다 이른가* 가 거짓이 됐다.
  */
  it('종료일을 어제로 두는 즉시 회수도 경고한다 — 자정 직후에도 같다', () => {
    const rows = [row('U', { validToDt: null }, { validToDt: '2026-08-30' })];

    expect(warnRevoke(rows)).toHaveLength(1);
  });

  it('기간을 늘리면 경고하지 않는다 — 잃는 것이 없다', () => {
    const rows = [row('U', { validToDt: TODAY_ISH }, { validToDt: LATER })];

    expect(warnRevoke(rows)).toHaveLength(0);
  });

  it('종료일을 지우면 경고하지 않는다 — 무기한으로 되돌리는 것이다', () => {
    const rows = [row('U', { validToDt: TODAY_ISH }, { validToDt: null })];

    expect(warnRevoke(rows)).toHaveLength(0);
  });

  it('시작일만 고치면 경고하지 않는다 — 종료가 그대로다', () => {
    const rows = [
      row('U', { validFromDt: '2026-08-01', validToDt: LATER }, { validFromDt: '2026-09-01', validToDt: LATER }),
    ];

    expect(warnRevoke(rows)).toHaveLength(0);
  });

  it('만료된 부여를 지우는 것은 정리이지 회수가 아니다', () => {
    const rows = [row('D', { grantState: 'EXPIRED' }, { grantState: 'EXPIRED' })];

    expect(warnRevoke(rows)).toHaveLength(0);
  });

  it('유효한 부여를 지우면 경고한다', () => {
    const rows = [row('D', { grantState: 'ACTIVE' }, { grantState: 'ACTIVE' })];

    expect(warnRevoke(rows)).toHaveLength(1);
  });

  it('신규 행은 경고 대상이 아니다 — 주는 저장이지 잃는 저장이 아니다', () => {
    const rows = [row('C', null, { validToDt: TODAY_ISH })];

    expect(warnRevoke(rows)).toHaveLength(0);
  });

  /*
    <b>줄은 하나이고 건수는 그 안에 있다</b>(`{count}`). 여기서 건수를 글자로 재지 않는 것은
    테스트에 메시지 캐시가 없어 {@code label} 이 키를 그대로 돌려주기 때문이다 — 그것을
    재려면 캐시를 채워야 하고, 그러면 이 테스트가 <b>문구의 테스트</b>가 된다.
  */
  it('회수와 연장이 섞이면 회수만 세어 한 줄을 낸다', () => {
    const rows = [
      row('U', { validToDt: null }, { validToDt: TODAY_ISH }),
      row('D', { grantState: 'ACTIVE' }, { grantState: 'ACTIVE' }),
      row('U', { validToDt: TODAY_ISH }, { validToDt: LATER }),
    ];

    expect(warnRevoke(rows)).toHaveLength(1);
  });
});

describe('IP · CIDR 형식 — 접두 상한이 계열에서 나온다', () => {
  it('IPv4 · IPv6 · CIDR 을 받는다', () => {
    expect(isIpOrCidr('192.168.0.10')).toBe(true);
    expect(isIpOrCidr('10.0.0.0/8')).toBe(true);
    expect(isIpOrCidr('10.0.0.0/0')).toBe(true);
    expect(isIpOrCidr('2001:db8::1')).toBe(true);
    expect(isIpOrCidr('2001:db8::/32')).toBe(true);
    expect(isIpOrCidr('::1/128')).toBe(true);
  });

  it('IPv4 에 /64 는 거부한다 — 상한을 상수 하나로 두면 통과한다', () => {
    expect(isIpOrCidr('1.2.3.4/64')).toBe(false);
    expect(isIpOrCidr('1.2.3.4/32')).toBe(true);
    expect(isIpOrCidr('2001:db8::/129')).toBe(false);
  });

  it('잘린 주소와 범위 밖 값을 거부한다 — 서버가 옛 표기로 읽어 다른 주소가 된다', () => {
    expect(isIpOrCidr('192.168.0')).toBe(false);
    expect(isIpOrCidr('999.1.1.1')).toBe(false);
  });

  it('호스트명을 거부한다 — 받으면 이름 해석이 도는 순간 그것이 저장된다', () => {
    expect(isIpOrCidr('office.example.com')).toBe(false);
    expect(isIpOrCidr('localhost')).toBe(false);
  });

  it('빈 칸은 통과한다 — 아직 안 쓴 칸이고 그것은 필수 표시가 막는다(grid-column-contract.md §5.1)', () => {
    expect(isIpOrCidr('')).toBe(true);
    expect(isIpOrCidr('   ')).toBe(true);
  });

  it('접두가 비었거나 숫자가 아니면 거부한다', () => {
    expect(isIpOrCidr('10.0.0.0/')).toBe(false);
    expect(isIpOrCidr('10.0.0.0/+8')).toBe(false);
    expect(isIpOrCidr('10.0.0.0/-1')).toBe(false);
  });
});
