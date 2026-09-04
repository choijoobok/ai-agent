import { describe, expect, it } from 'vitest';
import { BG_DENSITY_MAX, BG_DENSITY_MIN } from '@/shared/stores/uiStore';
import { antdTheme, themeSeed, type ThemeInputs } from '@/shared/theme/themeTokens';

const BASE: ThemeInputs = {
  dark: false,
  primaryColor: null,
  colorTone: 'neutral',
  bgDensity: BG_DENSITY_MAX,
  compact: false,
  fontFamily: null,
  fontSize: 14,
  fontWeight: 'normal',
  gridHeaderHeight: 40,
  gridRowHeight: 36,
  gridFontSize: 14,
};

const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16);

/** `#rrggbb` → 빨강과 파랑의 차 — 양수면 따뜻함, 음수면 차가움이다. */
function warmth(hex: string): number {
  return channel(hex, 1) - channel(hex, 5);
}

/** 가운데 채널이 양쪽보다 얼마나 높은가 — 초록은 <b>다른 자로 잰다</b>. */
function greenness(hex: string): number {
  return channel(hex, 3) - Math.max(channel(hex, 1), channel(hex, 5));
}

/**
 * 테마 씨앗 — frontend/tabs.md.
 *
 * <p><b>온도는 눈으로만 확인해 왔다.</b> 그래서 <i>"톤을 바꿔도 달라지는 게 없다"</i> 가
 * 하루를 갔다(2026-08-30 실물) — 씨앗은 옅었고 그리드는 아예 딴 표를 보고 있었다.
 * 여기서 재는 것은 색의 취향이 아니라 <b>서로 구별되는가</b>이다.
 */
describe('테마 씨앗', () => {
  it('라이트에서 따뜻함과 차가움이 서로 반대편에 있다 — 구별되지 않으면 축이 없는 것과 같다', () => {
    const warm = themeSeed({ ...BASE, colorTone: 'warm' });
    const cold = themeSeed({ ...BASE, colorTone: 'cold' });

    expect(warmth(warm?.bg ?? '')).toBeGreaterThan(0);
    expect(warmth(cold?.bg ?? '')).toBeLessThan(0);
    // 눈에 보이는 거리여야 한다 — 한두 칸 차이는 나란히 두고도 같아 보인다.
    expect(warmth(warm?.bg ?? '') - warmth(cold?.bg ?? '')).toBeGreaterThanOrEqual(20);
  });

  it('글자도 같은 편이다 — 글자 씨앗의 색조가 모든 회색(테두리·보조 글자)에 번진다', () => {
    expect(warmth(themeSeed({ ...BASE, colorTone: 'warm' })?.text ?? '')).toBeGreaterThan(0);
    expect(warmth(themeSeed({ ...BASE, colorTone: 'cold' })?.text ?? '')).toBeLessThan(0);
  });

  describe('바탕 농도', () => {
    it('100% 는 씨앗 그대로다 — 중립은 판 기본값을 건드리지 않는다', () => {
      expect(themeSeed(BASE)).toBeNull();
      expect(themeSeed({ ...BASE, colorTone: 'warm' })?.bg).toBe('#fffaf1');
    });

    it('곱셈이다 — 50% 면 정확히 중간 회색이고, 눈금이 "얼마나 흰가" 를 그대로 읽는다', () => {
      // 하한(80)은 대비를 지키려고 둔 것이라 눈금의 뜻과 별개다 — 뜻은 절반에서 재는 것이 분명하다.
      expect(themeSeed({ ...BASE, bgDensity: 50 })?.bg).toBe('#808080');
      expect(themeSeed({ ...BASE, bgDensity: BG_DENSITY_MIN })?.bg).toBe('#cccccc');
    });

    it('낮춰도 온도는 남는다 — 눈부심을 줄인 대가로 톤을 잃으면 축이 서로를 먹는다', () => {
      expect(warmth(themeSeed({ ...BASE, colorTone: 'warm', bgDensity: 80 })?.bg ?? '')).toBeGreaterThan(0);
      expect(warmth(themeSeed({ ...BASE, colorTone: 'cold', bgDensity: 80 })?.bg ?? '')).toBeLessThan(0);
    });

    it('글자는 낮추지 않는다 — 바탕이 내려오는 만큼 대비는 이미 줄고 있다', () => {
      expect(themeSeed({ ...BASE, colorTone: 'warm', bgDensity: 60 })?.text).toBe(
        themeSeed({ ...BASE, colorTone: 'warm' })?.text,
      );
    });

    /*
      <b>다크에서는 검은색의 농도다</b>(2026-08-30 — 앞서는 라이트에만 있었다).
      한 문장으로 읽힌다: <i>100% 가 그 극단, 낮출수록 회색</i>.
    */
    it('다크는 반대편에서 같은 말을 한다 — 낮출수록 검정에서 회색으로 떠오른다', () => {
      expect(themeSeed({ ...BASE, dark: true, bgDensity: 50 })?.bg).toBe('#808080');
      expect(themeSeed({ ...BASE, dark: true, bgDensity: BG_DENSITY_MIN })?.bg).toBe('#333333');
    });

    it('다크도 100% 는 씨앗 그대로다 — 중립은 판 기본값을 건드리지 않는다', () => {
      expect(themeSeed({ ...BASE, dark: true })).toBeNull();
      expect(themeSeed({ ...BASE, dark: true, colorTone: 'warm' })?.bg).toBe('#1a1918');
    });

    it('낮추는 방향이 모드마다 반대다 — 둘 다 자기 극단에서 멀어진다', () => {
      const light = themeSeed({ ...BASE, bgDensity: 80 })?.bg ?? '';
      const dark = themeSeed({ ...BASE, dark: true, bgDensity: 80 })?.bg ?? '';

      // 라이트는 흰색보다 어두워지고, 다크는 검정보다 밝아진다.
      expect(channel(light, 1)).toBeLessThan(255);
      expect(channel(dark, 1)).toBeGreaterThan(0);
    });

    it('다크에서도 온도는 남는다 — 톤을 잃으면 축이 서로를 먹는다', () => {
      const warm = themeSeed({ ...BASE, dark: true, colorTone: 'warm', bgDensity: 80 })?.bg ?? '';
      const cold = themeSeed({ ...BASE, dark: true, colorTone: 'cold', bgDensity: 80 })?.bg ?? '';

      expect(warmth(warm)).toBeGreaterThan(0);
      expect(warmth(cold)).toBeLessThan(0);
    });
  });

  it('초록은 다른 축이다 — 따뜻함·차가움의 자로 재면 0 에 가깝고, 자기 자로 재면 서 있다', () => {
    const green = themeSeed({ ...BASE, colorTone: 'green' })?.bg ?? '';

    expect(greenness(green)).toBeGreaterThanOrEqual(5);
    // 빨강·파랑 축에서는 어느 쪽도 아니다 — 그것이 따뜻함·차가움과 겹치지 않는 이유다.
    expect(Math.abs(warmth(green))).toBeLessThan(8);
  });

  it('다크의 씨앗은 라이트보다 옅다 — 판이 다크에서 색조를 세 배로 키운다(§9.7.3)', () => {
    for (const tone of ['warm', 'cold'] as const) {
      const light = warmth(themeSeed({ ...BASE, colorTone: tone })?.bg ?? '');
      const dark = warmth(themeSeed({ ...BASE, dark: true, colorTone: tone })?.bg ?? '');

      // 방향은 같고 세기만 작다 — 부호가 뒤집히면 다크에서 따뜻함이 차가워진다.
      expect(Math.sign(dark)).toBe(Math.sign(light));
      expect(Math.abs(dark)).toBeLessThan(Math.abs(light));
    }
  });

  it('AntD 토큰이 씨앗을 그대로 받는다 — 셸과 그리드가 읽는 값이 하나여야 한다', () => {
    const inputs: ThemeInputs = { ...BASE, colorTone: 'cold', bgDensity: 85 };
    const seed = themeSeed(inputs);

    expect(antdTheme(inputs).token?.colorBgBase).toBe(seed?.bg);
    expect(antdTheme(inputs).token?.colorTextBase).toBe(seed?.text);
  });

  describe('면 색', () => {
    it('라이트에서는 면을 직접 박는다 — 판이 파생하면서 색조를 씻어낸다(#fffaf1 → #f8f8f8)', () => {
      const token = antdTheme({ ...BASE, colorTone: 'warm' }).token;

      expect(token?.colorBgContainer).toBe('#fffaf1');
      expect(token?.colorBgElevated).toBe('#fffaf1');
    });

    it('다크에서는 박지 않는다 — 컨테이너가 바탕보다 떠 있어야 셸의 층이 남는다', () => {
      const token = antdTheme({ ...BASE, dark: true, colorTone: 'warm' }).token;

      expect(token?.colorBgContainer).toBeUndefined();
      expect(token?.colorBgElevated).toBeUndefined();
    });
  });

  it('씨앗이 없으면 키를 아예 넣지 않는다 — 없는 것과 "비워 달라" 가 같다는 보장이 없다', () => {
    expect('colorBgBase' in (antdTheme(BASE).token ?? {})).toBe(false);
  });
});
