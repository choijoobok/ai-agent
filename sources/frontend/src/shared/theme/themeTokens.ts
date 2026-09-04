import { theme, type ThemeConfig } from 'antd';
import {
  colorSchemeDark,
  colorSchemeLight,
  themeQuartz,
  type Theme as AgTheme,
} from 'ag-grid-community';
import {
  FONT_WEIGHT_VALUE,
  BG_DENSITY_MAX,
  type ColorTone,
  type UiState,
} from '@/shared/stores/uiStore';

/**
 * 축 셋에서 <b>토큰 세트 하나</b>를 만든다 — frontend/tabs.md.
 *
 * <pre>
 *         설정(모드 · Primary · 색 톤 · 글꼴 · 그리드 높이)
 *                            ↓
 *                     여기 — 한 곳
 *              ┌────────────┴────────────┐
 *            AntD                     AG Grid
 *        ConfigProvider              theme parts
 * </pre>
 *
 * <p><b>그리드가 자기 테마를 따로 갖지 않는다.</b> 갖게 하면 셸의 회색과 그리드의 회색이
 * 어긋나고, 사용자가 톤을 바꿨을 때 <b>화면의 절반만 따라온다.</b>
 *
 * <p><b>톤은 씨앗 하나로 양쪽에 간다</b>(2026-08-30 — 스킴 표를 버렸다). 판이 주는
 * `colorSchemeLightWarm`·`LightCold` 는 <b>바탕을 바꾸지 않는다</b> — 테두리 알파와 머리
 * 배경만 손대고 흰색은 흰색 그대로다. 화면의 대부분이 그리드이므로 결과는 <i>"톤을
 * 바꿔도 달라지는 게 없다"</i> 였다(실물). 지금은 모드별 중립 스킴만 쓰고 온도는 우리
 * 씨앗을 `backgroundColor`·`foregroundColor` 로 먹인다 — 판이 나머지(테두리·머리·보조
 * 글자)를 그 둘에서 파생하므로, <b>셸과 그리드가 같은 온도를 본다.</b>
 */

/** 모드가 고르는 판의 중립 스킴 — 온도는 여기가 아니라 씨앗이 정한다. */
const AG_COLOR_SCHEME = { light: colorSchemeLight, dark: colorSchemeDark } as const;

/** 바탕과 글자 — AntD 와 AG Grid 가 <b>같은 두 값</b>에서 각자의 계단을 만든다. */
interface Seed {
  bg: string;
  text: string;
}

/**
 * 톤이 바꾸는 것은 <b>바탕과 글자의 색조</b>, 모드가 <b>명도</b>, 라이트 바탕이 <b>눈부심</b>이다.
 *
 * <p>계단의 각 칸을 직접 정하지 않는 이유는 그것이 <b>판의 알고리즘을 우리가 다시 구현하는
 * 것</b>이기 때문이다 — 판이 바뀌면 우리 계단만 옛것으로 남는다.
 *
 * <p><b>씨앗을 다시 진하게 잡는다</b>(2026-08-30). 하루 전 실물에서 옅게 낮췄던 것은
 * <b>한 화면에 두 온도</b>가 보였기 때문인데, 원인은 씨앗의 세기가 아니라 <b>그리드가 딴
 * 표를 보고 있던 것</b>이었다. 양쪽이 같은 씨앗을 보게 된 지금 옅을 이유가 없다 — 옅으면
 * 따뜻함과 차가움이 <b>서로 구별되지 않는다</b>(실물).
 *
 * <p><b>여기 적힌 라이트 값은 농도 100% 의 색</b>이다. 그 아래는 곱셈으로 만든다(`dilute`).
 *
 * <p><b>다크의 씨앗은 라이트보다 옅다</b>(2026-08-30 실물 — 낮췄다). 판이 다크에서 면을
 * <b>증폭</b>하기 때문이다(§9.7.3) — 씨앗의 색조 차이가 컨테이너에서 세 배로 커진다.
 * 라이트와 같은 세기로 적으면 화면이 <b>갈색 판·남색 판</b>이 된다. 실측한 자리는
 * 씨앗 `2~3` → 컨테이너 `7~10` 이며, 그 앞의 값(`5`·`-7`)은 `16`·`-22` 였다.
 *
 * <p><b>`null` 은 "판 기본값을 건드리지 않는다"</b>는 뜻이다 — 중립·라이트와 중립·다크가
 * 그 자리이며, 우리 색을 한 번 더 적어 두면 판이 기본값을 바꿀 때 우리만 옛것으로 남는다.
 */
const TONE_SEED: Record<ColorTone, Record<'light' | 'dark', Seed | null>> = {
  neutral: { light: null, dark: null },
  warm: {
    light: { bg: '#fffaf1', text: '#2a231a' },
    dark: { bg: '#1a1918', text: '#eeecea' },
  },
  cold: {
    light: { bg: '#f4f9ff', text: '#171d26' },
    dark: { bg: '#161719', text: '#ebedf0' },
  },
  /*
    초록은 <b>따뜻함·차가움과 다른 축</b>이다. 그 둘은 빨강 ↔ 파랑 한 축의 양끝이라
    빨강과 파랑의 차로 재면 되지만, 초록은 <b>가운데 채널이 양쪽보다 높은</b> 것이라
    같은 자로 재면 둘 다 0 에 가깝게 나온다 — 재는 법이 다르다는 것이 곧 축이 다르다는
    뜻이다.
  */
  green: {
    light: { bg: '#f3fdf6', text: '#1a241d' },
    dark: { bg: '#171a18', text: '#eaeeec' },
  },
};

/**
 * 중립의 라이트·다크 — 표에서는 `null`(판 기본값)이라 <b>농도를 낮출 때만</b> 쓰인다.
 *
 * <p>100% 에서 이것을 넣어도 결과는 같지만 넣지 않는다 — 판 기본값을 우리가 한 번 더
 * 적어 두는 것이기 때문이다.
 *
 * <p>다크의 바탕이 <b>순검정</b>인 것은 판의 기본이 그렇기 때문이다. 톤이 있는 다크
 * 씨앗들(`#1a1918` 류)보다 어둡고, 농도를 낮추면 거기서 회색으로 떠오른다.
 */
const NEUTRAL_LIGHT: Seed = { bg: '#ffffff', text: '#1a1a1a' };
const NEUTRAL_DARK: Seed = { bg: '#000000', text: '#ffffff' };

/**
 * 농도(%)를 색에 먹인다 — <b>자기 극단에서 멀어지는 만큼</b>이다.
 *
 * <p><b>모드가 극단을 정한다.</b> 라이트는 흰색이 극단이라 검정까지의 거리를 줄이고,
 * 다크는 검은색이 극단이라 흰색까지의 거리를 줄인다. 어느 쪽이든 <b>100% 는 씨앗 그대로,
 * 낮출수록 회색</b>이며 50% 면 중립이 중간 회색 근처에 선다.
 *
 * <pre>
 * 라이트: c × level/100              #ffffff → 80% → #cccccc
 * 다크  : 255 − (255 − c) × level/100  #000000 → 80% → #333333
 * </pre>
 *
 * <p>빼기·더하기로 옮기는 길도 있고 그쪽은 톤의 <i>절대 차이</i> 를 지키지만, 눈금이
 * <b>얼마나 희다/검다</b> 를 읽는 이상 비례가 그 말과 같다.
 */
function dilute(hex: string, density: number, dark: boolean): string {
  const channel = (at: number) => {
    const value = parseInt(hex.slice(at, at + 2), 16);
    const moved = dark ? 255 - ((255 - value) * density) / 100 : (value * density) / 100;
    return Math.round(moved).toString(16).padStart(2, '0');
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

export interface ThemeInputs
  extends Pick<
    UiState,
    | 'primaryColor'
    | 'colorTone'
    | 'bgDensity'
    | 'compact'
    | 'fontFamily'
    | 'fontSize'
    | 'fontWeight'
    | 'gridHeaderHeight'
    | 'gridRowHeight'
    | 'gridFontSize'
  > {
  dark: boolean;
}

/**
 * 지금 축 셋이 가리키는 씨앗 — <b>AntD 와 AG Grid 가 함께 읽는 하나</b>다.
 *
 * <p>내보내는 이유는 <b>화면 없이 잴 수 있어야</b> 하기 때문이다. 온도가 실제로 다른지는
 * 눈으로만 확인해 왔고, 그래서 <i>"바꿔도 달라지지 않는"</i> 상태가 하루를 갔다.
 */
export function themeSeed(inputs: ThemeInputs): Seed | null {
  const seed = TONE_SEED[inputs.colorTone][inputs.dark ? 'dark' : 'light'];
  // 100% 는 씨앗 그대로다 — 판 기본값(`null`)을 우리 색으로 덮지 않는다.
  if (inputs.bgDensity >= BG_DENSITY_MAX) return seed;

  /*
    농도는 <b>모드마다 다른 것의 농도</b>다(2026-08-30) — 라이트에서는 흰색, 다크에서는
    검은색. 앞서는 라이트에만 먹였는데, 그러면 눈부심의 반대편(<i>너무 새까맣다</i>)에
    답이 없고 다크에서는 슬라이더가 잠긴 채 남는다.
  */
  const base = seed ?? (inputs.dark ? NEUTRAL_DARK : NEUTRAL_LIGHT);
  // 글자는 옮기지 않는다 — 바탕이 다가오는 만큼 대비는 이미 줄고 있다.
  return { bg: dilute(base.bg, inputs.bgDensity, inputs.dark), text: base.text };
}

export function antdTheme(inputs: ThemeInputs): ThemeConfig {
  const seed = themeSeed(inputs);

  return {
    algorithm: [
      inputs.dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      ...(inputs.compact ? [theme.compactAlgorithm] : []),
    ],
    token: {
      fontSize: inputs.fontSize,
      // 값이 없으면 키를 아예 넣지 않는다 — `undefined` 를 넣어도 되지만, 없는 것과
      // "비워 달라" 를 판이 같게 다룬다는 보장이 없다.
      ...(inputs.primaryColor ? { colorPrimary: inputs.primaryColor } : {}),
      ...(inputs.fontFamily ? { fontFamily: fontStack(inputs.fontFamily) } : {}),
      ...(seed ? { colorBgBase: seed.bg, colorTextBase: seed.text } : {}),
      /*
        <b>라이트에서는 면 색을 직접 박는다.</b> 판은 바탕 씨앗에서 컨테이너를 파생하면서
        <b>색조를 씻어낸다</b> — 따뜻함 `#fffaf1` 이 `#f8f8f8`(완전 중립)이 됐다(2026-08-30
        실측). 그러면 헤더·사이더·탭바·조회조건이 전부 회색이고 <b>톤이 보이는 곳은
        그리드뿐</b>이 된다.

        다크는 반대로 <b>증폭한다</b>(`#1c1917` → `#362c26`). 그쪽은 판이 옳다 — 다크의
        컨테이너는 바탕보다 <i>떠 있어야</i> 하고, 여기서 씨앗을 박으면 탭바와 본문이
        같은 색이 되어 셸의 층이 사라진다.
      */
      ...(seed && !inputs.dark ? { colorBgContainer: seed.bg, colorBgElevated: seed.bg } : {}),
    },
  };
}

/**
 * 셸이 <b>실제로 칠한 면</b>. 씨앗이 아니라 이것을 그리드에 준다.
 *
 * <p>씨앗은 계단의 <b>맨 아래 칸</b>이라 다크에서 그리드만 새까맣게 남는다 — 판은 다크의
 * 컨테이너를 씨앗보다 <i>위로</i> 올리므로(`#1c1917` → `#362c26`), 씨앗을 그대로 준
 * 그리드가 <b>조회조건 폼 바로 아래에서 혼자 다른 면</b>이 됐다(2026-08-30 실물).
 */
export interface ShellSurface {
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  fontFamily: string;
}

export function agGridTheme(inputs: ThemeInputs, shell: ShellSurface): AgTheme {
  return themeQuartz.withPart(AG_COLOR_SCHEME[inputs.dark ? 'dark' : 'light']).withParams({
    // 그리드는 <b>조회조건 폼과 같은 면</b>이다 — 판이 테두리·머리 배경·보조 글자를
    // 이 둘에서 파생하므로, 두 값만 맞추면 나머지가 따라온다.
    backgroundColor: shell.backgroundColor,
    foregroundColor: shell.foregroundColor,
    accentColor: shell.accentColor,
    fontFamily: inputs.fontFamily ? fontStack(inputs.fontFamily) : shell.fontFamily,
    fontSize: inputs.gridFontSize,
    // 판은 자기 글자 굵기를 따로 갖는다 — 먹이지 않으면 셸만 굵어진다(frontend/tabs.md).
    fontWeight: FONT_WEIGHT_VALUE[inputs.fontWeight],
    headerHeight: inputs.gridHeaderHeight,
    rowHeight: inputs.gridRowHeight,
    /*
      고정 구역의 세로 줄을 없앤다 — 판은 <b>고정 ↔ 스크롤 경계</b>에 선을 하나 긋는다.
      행 번호가 늘 고정이라(frontend/grid.md) 그 선이 <b>모든 그리드의 두 번째 칸 뒤</b>에 서게 됐고,
      다른 컬럼 사이에는 선이 없으므로 <i>"저 컬럼만 뭔가 다르다"</i> 로 읽혔다
      (2026-08-30 실물).

      대가가 있다 — 사용자가 틀고정한 컬럼(frontend/grid.md)에 <b>고정됐다는 표시가 없어진다.</b>
      스크롤해 보면 드러나므로 그쪽을 택했다.
    */
    pinnedColumnBorder: false,
  });
}

/**
 * <b>폴백이 필수다</b> — frontend/tabs.md.
 *
 * <p>고른 글꼴이 그 기기에 없거나 이름이 미묘하게 다르면(로컬라이즈된 폰트 이름) 브라우저가
 * 자기 기본 세리프로 떨어진다. 백오피스에서 그것은 <b>화면 전체가 낯설어지는 것</b>이다.
 */
function fontStack(family: string): string {
  return `"${family}", system-ui, -apple-system, "Segoe UI", "Malgun Gothic", sans-serif;`
    .replace(';', '');
}

/**
 * frontend/tabs.md 의 웹 세이프 목록 — <b>API 를 못 읽을 때의 경로</b>다.
 *
 * <p>목록을 못 읽는 것이 기능 실패가 되면 안 된다. 글꼴 선택은 편의이지 필수가 아니다.
 */
export const WEB_SAFE_FONTS = [
  'Malgun Gothic',
  'Noto Sans KR',
  'Pretendard',
  'Segoe UI',
  'Arial',
  'Helvetica',
  'Verdana',
  'Tahoma',
  'Georgia',
  'Consolas',
];
