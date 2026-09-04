import { describe, expect, it } from 'vitest';
import { popupKeys, popupSpec, registerPopups } from '@/shared/popup/registry';
import type { PopupSpec } from '@/shared/popup/types';

const spec = (title: string): PopupSpec => ({
  title,
  columns: [{ field: 'id', header: 'h', type: 'text' }],
  read: { url: '/service/x/getList' },
});

/**
 * 팝업 레지스트리 — grid-column-contract.md §8 의 미결에 답한 형태(68 §9.4).
 *
 * <p><b>네임스페이스가 규약이지 취향이 아니다.</b> 샘플을 걷어낼 때 지우는 것은
 * <b>폴더 하나</b>여야 하는데(68 §10.2), 키에 네임스페이스가 없으면 공통 목록에서 줄을
 * 골라 지우는 일이 남는다 — 그것은 10 §L 체크리스트에 <b>없던 항목</b>이고, 빠뜨리면
 * <b>없는 화면의 팝업이 목록에 남는다</b>.
 *
 * <p>그 위반이 드러나는 시점이 <b>지울 때</b>라 늦다. 그래서 등록에서 막는다.
 */
describe('팝업 레지스트리', () => {
  it('네임스페이스 있는 키를 등록하고 되찾는다', () => {
    registerPopups({ 'sample.customer': spec('t.customer') });

    expect(popupSpec('sample.customer')?.title).toBe('t.customer');
  });

  it('모르는 키는 undefined 다 — 여는 쪽이 창을 띄우지 않는다', () => {
    expect(popupSpec('sample.nope')).toBeUndefined();
  });

  describe('키 모양을 막는다', () => {
    it('점이 없으면 거부한다 — 통째로 지우는 규칙이 성립하지 않는다', () => {
      expect(() => registerPopups({ customer: spec('t') })).toThrow();
    });

    it('점이 둘이면 거부한다 — 어디까지가 네임스페이스인지 읽는 사람마다 갈린다', () => {
      expect(() => registerPopups({ 'a.b.c': spec('t') })).toThrow();
    });

    it('네임스페이스가 비면 거부한다', () => {
      expect(() => registerPopups({ '.customer': spec('t') })).toThrow();
    });
  });

  /*
    <b>마지막 선언이 이긴다.</b> 화면 둘이 같은 팝업을 쓰면 각자 임포트하므로 다시 등록될
    수 있고, 그때 <i>먼저 등록한 쪽이 이긴다</i> 로 두면 <b>어느 화면을 먼저 열었나</b> 에
    따라 팝업이 달라 보인다 — 재현되지 않는 종류의 어긋남이다.
  */
  it('같은 키를 다시 등록하면 덮어쓴다', () => {
    registerPopups({ 'sample.dup': spec('t.first') });
    registerPopups({ 'sample.dup': spec('t.second') });

    expect(popupSpec('sample.dup')?.title).toBe('t.second');
  });

  it('여러 개를 한 번에 등록한다 — 한 파일이 자기 네임스페이스를 통째로 낸다', () => {
    registerPopups({ 'sys.user': spec('t.user'), 'sys.role': spec('t.role') });

    expect(popupKeys()).toContain('sys.user');
    expect(popupKeys()).toContain('sys.role');
  });
});
