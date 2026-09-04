import { describe, expect, it } from 'vitest';
import { ASIDE_CLASS, cellText, isCopyShortcut, renderedText } from '@/shared/grid/copyCell';

const press = (key: string, mods: { ctrlKey?: boolean; metaKey?: boolean } = {}) => ({
  key,
  ctrlKey: mods.ctrlKey ?? false,
  metaKey: mods.metaKey ?? false,
});

/**
 * 셀 복사 — frontend/grid.md.
 *
 * <p><b>복사하는 것은 데이터가 아니라 보이는 글자다.</b> 값이 `Y` 인 칸을 사람은
 * <i>사용</i> 으로 보고 있고, 붙여 넣으려는 것도 그것이다.
 *
 * <p>가로채면 안 되는 자리 둘이 이 파일의 나머지다 — <b>글자를 골라 둔 사용자</b>와
 * <b>편집 중</b>. 둘 다 조용히 깨진다: 복사는 성공한 것처럼 보이고, 붙여 넣어 봐야
 * 엉뚱한 것이 나온다.
 */
describe('셀 복사', () => {
  describe('무엇을 복사하는가', () => {
    it('그려진 글자를 그대로 쓴다 — 코드 컬럼은 코드가 아니라 코드명이다', () => {
      expect(cellText('사용', 'Y')).toBe('사용');
    });

    it('앞뒤 공백은 버린다 — 셀의 여백이 값에 섞이면 붙여 넣은 곳에서 드러난다', () => {
      expect(cellText('\n  사용  \n', 'Y')).toBe('사용');
    });

    it('글자가 없으면 값을 쓴다 — 스위치 컬럼은 그리는 글자가 없다', () => {
      expect(cellText('', true)).toBe('Y');
      expect(cellText(null, false)).toBe('N');
    });

    it('빈 칸은 빈 칸이다 — 없는 값에 글자를 지어내지 않는다', () => {
      expect(cellText('', null)).toBe('');
      expect(cellText(undefined, undefined)).toBe('');
    });

    it('객체는 [object Object] 가 아니라 빈 칸이다', () => {
      expect(cellText('', { a: 1 })).toBe('');
    });
  });

  /**
   * 셀의 글자가 <b>전부 값인 것은 아니다</b> — 2026-08-30 실물에서 잡았다.
   *
   * <p>값 뒤에 배지를 덧붙이는 셀에서 통째로 읽으면 `CODE_REF_KEY시스템` 이 복사됐다 —
   * <b>붙여 넣을 수 없는 문자열</b>이다. 조용히 깨지는 종류다: 복사는 성공한 것처럼
   * 보이고 붙여 넣은 곳에서야 드러난다.
   *
   * <p>가르는 것은 <b>배지가 값인가 값의 곁인가</b> 하나이며, 그 판정은 <b>그린 쪽</b>이
   * 표시로 남긴다.
   */
  describe('곁들인 배지는 빼고 읽는다', () => {
    const cell = (html: string) => {
      const node = document.createElement('div');
      node.innerHTML = html;
      return node;
    };

    it('값 뒤의 배지는 빠진다 — 값은 따로 있다', () => {
      const node = cell(`CODE_REF_KEY<span class="${ASIDE_CLASS}">시스템</span>`);
      expect(cellText(renderedText(node), 'CODE_REF_KEY')).toBe('CODE_REF_KEY');
    });

    it('표시가 없는 배지는 복사된다 — 거기서는 배지가 곧 값이다', () => {
      // `renderer: 'badge'` 는 값 <b>대신</b> 그리므로 그것 말고 복사할 것이 없다.
      expect(cellText(renderedText(cell('<span>미사용</span>')), 'NONE')).toBe('미사용');
    });

    it('배지를 빼고 나면 빈 셀일 수도 있다 — 그때는 값으로 떨어진다', () => {
      const node = cell(`<span class="${ASIDE_CLASS}">변경됨</span>`);
      expect(cellText(renderedText(node), true)).toBe('Y');
    });

    it('화면의 DOM 을 건드리지 않는다 — 복사할 때마다 배지를 잃으면 안 된다', () => {
      const node = cell(`CODE_REF_KEY<span class="${ASIDE_CLASS}">시스템</span>`);

      renderedText(node);

      expect(node.querySelectorAll(`.${ASIDE_CLASS}`)).toHaveLength(1);
    });

    it('셀이 없으면 빈 칸이다 — 판이 아직 그리지 않았을 수 있다', () => {
      expect(renderedText(null)).toBe('');
    });
  });

  describe('언제 가로채는가', () => {
    it('Ctrl+C · Cmd+C 둘 다 받는다', () => {
      expect(isCopyShortcut(press('c', { ctrlKey: true }), '', false)).toBe(true);
      expect(isCopyShortcut(press('c', { metaKey: true }), '', false)).toBe(true);
    });

    it('수정자 없는 c 는 복사가 아니다 — 그냥 글자다', () => {
      expect(isCopyShortcut(press('c'), '', false)).toBe(false);
    });

    it('글자를 골라 둔 사용자는 가로채지 않는다 — 그가 원하는 것은 고른 그것이다', () => {
      expect(isCopyShortcut(press('c', { ctrlKey: true }), '고른 글자', false)).toBe(false);
    });

    it('편집 중에는 비켜선다 — 입력 칸 안의 복사는 브라우저의 일이다', () => {
      expect(isCopyShortcut(press('c', { ctrlKey: true }), '', true)).toBe(false);
    });
  });
});
