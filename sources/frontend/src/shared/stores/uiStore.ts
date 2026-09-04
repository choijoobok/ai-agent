import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** frontend/tabs.md — 모드 축. `system` 은 OS 설정을 따른다(UX-08). */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * frontend/tabs.md — 색 톤 축. <b>중립 회색의 색조</b>이지 강조색이 아니다.
 *
 * <p><b>초록이 넷째다</b>(2026-08-30 — 사용자 요청). 따뜻함·차가움이 <i>빨강 ↔ 파랑</i>
 * 한 축의 양끝이라면 초록은 그 축 밖이다 — 오래 보는 화면의 피로를 줄이려는 선택이며,
 * 강조색(Primary)이 아니라 <b>바탕과 회색의 색조</b>인 것은 나머지 셋과 같다.
 */
export type ColorTone = 'neutral' | 'warm' | 'cold' | 'green';

/**
 * frontend/tabs.md — 바탕의 <b>농도</b>(%). 톤이 색조, 모드가 명도라면 이것은 <b>눈부심</b>이다.
 *
 * <p><b>모드마다 무엇의 농도인지가 다르다</b>(2026-08-30). 라이트에서는 <b>흰색의 농도</b>
 * 이고 다크에서는 <b>검은색의 농도</b>다 — 둘 다 <i>100% 가 그 극단, 낮출수록 회색</i>
 * 이라는 한 문장으로 읽힌다. 앞서는 라이트에만 먹였고 다크에서는 슬라이더가 <b>잠긴 채</b>
 * 있었는데, 눈부심의 반대편(<i>너무 새까맣다</i>)에 답이 없었다.
 *
 * <p>축이 하나인 것이 요점이다. 모드별로 값을 따로 두면 <b>모드를 바꿀 때마다 다시
 * 맞춰야</b> 하고, 그것은 이 눈금이 <i>화면과 사람</i> 에 딸린 값이라는 사실과 어긋난다.
 *
 * <p><b>모드에 칸을 더 두지 않았다</b>(2026-08-30). <i>라이트 · 그레이 · 다크 · 시스템</i>
 * 으로 늘리면 <b>시스템 따름과 회색을 함께 고를 수 없다</b> — OS 가 라이트일 때 어떤
 * 라이트인지는 모드가 답할 수 없는 질문이라, 축을 따로 두는 쪽이 맞다.
 *
 * <p><b>둘 중 하나가 아니라 눈금이다</b>(2026-08-30 — 흰색·회색 두 칸에서 바꿨다).
 * 눈부심은 사람과 화면마다 갈리는 것이라 <i>흰색이냐 회색이냐</i> 로는 맞출 수 없다 —
 * 글자 크기와 같은 성격이고, 그래서 같은 슬라이더를 쓴다.

/**
 * 농도의 눈금 — <b>80% 아래로는 내려가지 않는다.</b>
 *
 * <p>농도는 바탕만 옮기고 글자는 그대로 두므로 내려갈수록 <b>대비가 준다</b>. 라이트는
 * 80% 면 중립이 `#cccccc` 로 이미 뚜렷한 회색이고, 그 아래는 <i>어두운 라이트</i> 라
 * 원하는 것이 그것이라면 다크가 답이다(2026-08-30 — 50 에서 올렸다).
 *
 * <p>다크도 같은 눈금을 쓴다. 80% 면 순검정이 `#333333` 근처로 떠오르며, 그 아래는
 * <i>밝은 다크</i> 라 대칭으로 같은 말이 성립한다 — 원하는 것이 그것이라면 라이트다.
 */
export const BG_DENSITY_MIN = 80;
export const BG_DENSITY_MAX = 100;

/**
 * frontend/tabs.md — <b>본문 글자의 굵기</b>. 크기와 다른 축이다.
 *
 * <p>크기를 키우면 글이 자리를 더 먹지만 굵기는 <b>자리를 그대로 두고 또렷해진다</b> —
 * 촘촘한 그리드에서 크기를 올릴 수 없을 때 남는 수단이다.
 */
export type FontWeight = 'light' | 'normal' | 'bold';

/**
 * 이름 → 실제 굵기.
 *
 * <p><b>굵게가 500 이 아니라 600 이다</b>(2026-08-30 — 500 은 눈에 띄지 않았다). 이유는
 * 취향이 아니라 <b>CSS 의 굵기 매칭 규칙</b>이다. 요청한 굵기가 글꼴에 없으면 브라우저가
 * 가장 가까운 것을 고르는데, <b>정확히 500 일 때만 400 쪽을 먼저</b> 뒤진다.
 *
 * <pre>
 *   요청 500 → 500 없음 → <b>400 으로 내려간다</b>   (보통과 같아진다)
 *   요청 600 → 600 없음 → <b>700 으로 올라간다</b>   (진짜 굵게가 된다)
 * </pre>
 *
 * <p>이것이 드러난 자리가 <b>한글</b>이다. Windows 의 맑은 고딕은 400 과 700 둘뿐이라
 * 500 을 달라고 하면 <i>말 그대로 아무 일도 일어나지 않는다.</i> 600 이면 맑은 고딕에서
 * 700 을 집고, 굵기를 다 갖춘 글꼴(Pretendard · Noto Sans KR)에서는 <b>진짜 세미볼드</b>가
 * 된다 — 700 을 박는 것보다 낫다: 본문 전체가 700 이면 제목과 구분이 사라진다.
 *
 * <p><b>얇게(300)도 글꼴에 달렸다.</b> 맑은 고딕에는 Light 가 없어 400 으로 올라오므로
 * 보통과 같아 보인다 — 그쪽은 <b>글꼴을 바꾸면</b> 살아난다(frontend/tabs.md).
 */
export const FONT_WEIGHT_VALUE: Record<FontWeight, number> = {
  light: 300,
  normal: 400,
  bold: 600,
};

export interface UiState {
  themeMode: ThemeMode;
  /** `null` 이면 판의 기본 강조색이다 — frontend/tabs.md 의 프리셋 밖으로 나갈 수 있다. */
  primaryColor: string | null;
  colorTone: ColorTone;
  /** 흰 바탕이 눈부실 때 <b>라이트 전체를 낮춘다</b>(%) — 다크에서는 뜻이 없다. */
  bgDensity: number;
  /** AntD `compactAlgorithm`. frontend/tabs.md 의 "콤팩트 모드". */
  compact: boolean;

  /** `null` 이면 판의 기본 글꼴 — frontend/tabs.md 의 폴백이 그 자리다. */
  fontFamily: string | null;
  fontSize: number;
  fontWeight: FontWeight;

  /** 그리드 전역 표시 속성 — UX-06 의 컬럼 구성과 다른 것이다(frontend/tabs.md). */
  gridHeaderHeight: number;
  gridRowHeight: number;
  /** 기본 폰트 크기와 <b>별개</b>다 — 그리드는 글자가 촘촘해 따로 줄이는 경우가 많다. */
  gridFontSize: number;

  /**
   * 헤더를 평소에 감추고 <b>위쪽 가장자리에 마우스를 대면 내려오게</b> 한다 — frontend/tabs.md.
   *
   * <p><b>화면을 밀지 않고 그 위로 뜬다.</b> 밀면 아래 전체가 함께 움직여, 보려던 것이
   * 눈앞에서 내려가고 마우스를 떼면 다시 올라온다 — 세로가 아까워서 켠 설정이 <b>세로를
   * 쓰는 화면을 흔드는</b> 셈이 된다.
   */
  headerAutoHide: boolean;
  /** 사이더도 같은 규약이다 — 왼쪽 가장자리에서 <b>화면 위로</b> 미끄러져 나온다. */
  siderAutoHide: boolean;
  /**
   * 접힘(240px → 80px). <b>자동 숨기기와 다른 축</b>이다 — 이쪽은 자리를 차지한 채 좁아지고
   * 저쪽은 자리를 비운다. 설정 항목이 아니라 헤더 버튼이 그때그때 바꾸는 현재 상태다.
   */
  siderCollapsed: boolean;

  setThemeMode: (mode: ThemeMode) => void;
  setPrimaryColor: (color: string | null) => void;
  setColorTone: (tone: ColorTone) => void;
  setBgDensity: (density: number) => void;
  setCompact: (compact: boolean) => void;
  setFontFamily: (family: string | null) => void;
  setFontSize: (size: number) => void;
  setFontWeight: (weight: FontWeight) => void;
  setGridHeaderHeight: (height: number) => void;
  setGridRowHeight: (height: number) => void;
  setGridFontSize: (size: number) => void;
  setHeaderAutoHide: (hide: boolean) => void;
  setSiderAutoHide: (hide: boolean) => void;
  setSiderCollapsed: (collapsed: boolean) => void;
  toggleSider: () => void;

  /** 그룹 하나만 기본값으로 — frontend/tabs.md. */
  resetGroup: (group: SettingsGroup) => void;
  resetAll: () => void;
}

/** frontend/tabs.md 의 그룹 넷. 초기화 단위이기도 하다. */
export type SettingsGroup = 'general' | 'theme' | 'font' | 'grid';

/** 저장 키는 하나다 — 항목마다 키를 두면 부분 복원된 상태가 생긴다. */
export const UI_STORAGE_KEY = 'backoffice.ui';

/**
 * 그룹별 기본값 — <b>초기화가 읽는 유일한 자리</b>다.
 *
 * <p>초기값과 초기화 값을 따로 두면 <i>"초기화했는데 처음과 다르다"</i> 가 생긴다.
 * 스토어의 초기 상태도 이 표를 펼친 것이다.
 */
export const UI_DEFAULTS = {
  general: { headerAutoHide: false, siderAutoHide: false, siderCollapsed: false },
  theme: {
    themeMode: 'system' as ThemeMode,
    primaryColor: null as string | null,
    colorTone: 'neutral' as ColorTone,
    bgDensity: BG_DENSITY_MAX,
    compact: false,
  },
  font: { fontFamily: null as string | null, fontSize: 14, fontWeight: 'normal' as FontWeight },
  grid: { gridHeaderHeight: 40, gridRowHeight: 36, gridFontSize: 14 },
} as const;

/**
 * 기기·화면의 속성 — frontend/packages.md · frontend/tabs.md.
 *
 * <p><b>세 스토어 중 여기만 `persist` 를 쓴다.</b> 테마·접힘·밀도는 <b>계정이 아니라 기기의
 * 속성</b>이므로 로그아웃해도 남아야 한다(frontend/packages.md). 반대로 `authStore`·`tabStore` 는
 * 메모리이며 F5 에 사라진다 — 그 둘이 같은 수명을 갖는 것이 재인증 모달 판정의 근거다
 * (backend/session.md).
 *
 * <p><b>언어는 여기 없다.</b> 언어만 서버가 알아야 하므로(메일·알림을 어느 언어로 보낼지)
 * 원본이 `SYS_USER.LOCALE_CD` 다 — frontend/tabs.md. 로그인 전 표시용 사본은 `i18n/lang` 이 갖는다.
 *
 * <p><b>"사이더 기본 접힘" 을 따로 두지 않는다</b>(2026-08-29). frontend/tabs.md 는 그것을 별도 항목으로
 * 적었는데, 현재 접힘 상태가 이미 `localStorage` 라 <b>지금 접힌 것이 곧 다음에 열 때의
 * 상태</b>다. 둘을 나누면 *"지금은 펼쳐져 있는데 기본은 접힘"* 인 상태가 생기고, 둘 다 같은
 * 저장소에 있어 그 차이를 설명할 근거가 없다.
 *
 * <p><b>그래서 설정에 있는 것은 접힘이 아니라 자동 숨기기다</b>(2026-08-29). 접기는 헤더
 * 왼쪽 버튼이 이미 하고 있어 설정에 같은 것을 한 번 더 두면 <b>조작점만 둘</b>이 된다.
 * 자동 숨기기는 <b>다른 축</b>이다 — 접힘은 자리를 차지한 채 좁아지고, 숨기기는 자리를
 * 비운 뒤 필요할 때 그 위로 뜬다.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      ...UI_DEFAULTS.general,
      ...UI_DEFAULTS.theme,
      ...UI_DEFAULTS.font,
      ...UI_DEFAULTS.grid,

      setThemeMode: (themeMode) => set({ themeMode }),
      setPrimaryColor: (primaryColor) => set({ primaryColor }),
      setColorTone: (colorTone) => set({ colorTone }),
      setBgDensity: (bgDensity) => set({ bgDensity }),
      setCompact: (compact) => set({ compact }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) => set({ fontSize }),
      setFontWeight: (fontWeight) => set({ fontWeight }),
      setGridHeaderHeight: (gridHeaderHeight) => set({ gridHeaderHeight }),
      setGridRowHeight: (gridRowHeight) => set({ gridRowHeight }),
      setGridFontSize: (gridFontSize) => set({ gridFontSize }),
      setHeaderAutoHide: (headerAutoHide) => set({ headerAutoHide }),
      setSiderAutoHide: (siderAutoHide) => set({ siderAutoHide }),
      setSiderCollapsed: (siderCollapsed) => set({ siderCollapsed }),
      toggleSider: () => set((state) => ({ siderCollapsed: !state.siderCollapsed })),

      resetGroup: (group) => set({ ...UI_DEFAULTS[group] }),
      resetAll: () =>
        set({
          ...UI_DEFAULTS.general,
          ...UI_DEFAULTS.theme,
          ...UI_DEFAULTS.font,
          ...UI_DEFAULTS.grid,
        }),
    }),
    {
      name: UI_STORAGE_KEY,
      /*
        `whiteLevel` 이 `bgDensity` 가 됐다 — 라이트의 흰색만 다루던 값이 다크의 검은색까지
        맡으면서 이름이 사실과 어긋났기 때문이다(2026-08-30).

        <b>옮겨 주지 않으면 조용히 기본값으로 돌아간다.</b> 저장된 것은 기기에 딸린
        취향이고 그 사람은 이름이 바뀐 것을 알 수 없다 — 어느 날 화면이 다시 하얘질 뿐이다.
      */
      version: 1,
      migrate: (persisted, version) => {
        if (version >= 1 || typeof persisted !== 'object' || persisted === null) {
          return persisted;
        }
        const { whiteLevel, ...rest } = persisted as { whiteLevel?: number };
        return typeof whiteLevel === 'number' ? { ...rest, bgDensity: whiteLevel } : persisted;
      },
      // 액션은 저장하지 않는다 — 저장된 함수는 복원되지 않고 배포마다 모양이 바뀐다.
      partialize: (state) => ({
        themeMode: state.themeMode,
        primaryColor: state.primaryColor,
        colorTone: state.colorTone,
        bgDensity: state.bgDensity,
        compact: state.compact,
        fontFamily: state.fontFamily,
        fontSize: state.fontSize,
        fontWeight: state.fontWeight,
        gridHeaderHeight: state.gridHeaderHeight,
        gridRowHeight: state.gridRowHeight,
        gridFontSize: state.gridFontSize,
        headerAutoHide: state.headerAutoHide,
        siderAutoHide: state.siderAutoHide,
        siderCollapsed: state.siderCollapsed,
      }),
    },
  ),
);
