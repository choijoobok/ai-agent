import { useEffect, type ReactNode } from 'react';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import koKR from 'antd/locale/ko_KR';
import enUS from 'antd/locale/en_US';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FONT_WEIGHT_VALUE, useUiStore } from '@/shared/stores/uiStore';
import { antdTheme } from '@/shared/theme/themeTokens';
import { useMessageStore } from '@/shared/i18n/messageStore';
import { useResolvedDark } from '@/shared/theme/useResolvedDark';
import { PopupHost } from '@/shared/popup/PopupHost';
import { FormModalHost } from '@/shared/formmodal/FormModal';
import { ProgressHost } from '@/shared/progress/ProgressHost';

// 서버 상태는 react-query, 클라이언트 상태는 zustand 로 가른다 — frontend-stack.md §8.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 백오피스는 화면을 오래 열어 두므로 창 포커스마다 다시 부르지 않는다.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  const dark = useResolvedDark();
  // 축을 하나씩 구독한다 — 스토어 전체를 구독하면 사이더 접힘 같은 무관한 변화에도
  // 토큰이 다시 만들어진다.
  const primaryColor = useUiStore((state) => state.primaryColor);
  const colorTone = useUiStore((state) => state.colorTone);
  const bgDensity = useUiStore((state) => state.bgDensity);
  const compact = useUiStore((state) => state.compact);
  const fontFamily = useUiStore((state) => state.fontFamily);
  const fontSize = useUiStore((state) => state.fontSize);
  const fontWeight = useUiStore((state) => state.fontWeight);
  const gridHeaderHeight = useUiStore((state) => state.gridHeaderHeight);
  const gridRowHeight = useUiStore((state) => state.gridRowHeight);
  const gridFontSize = useUiStore((state) => state.gridFontSize);

  // 번들이 바뀌면 트리 전체를 다시 그린다.
  //
  // `label()` 은 훅이 아니라 함수라 스스로 구독하지 않는다(모달 콜백·토스트에서도 불러야
  // 하기 때문이다). 여기서 한 번 구독해 두면 언어·버전이 바뀔 때 아래가 전부 다시 그려지고,
  // `key` 를 바꾸는 것이 아니므로 **열린 탭과 입력값은 그대로 남는다**.
  const lang = useMessageStore((state) => state.lang);
  useMessageStore((state) => state.version);

  useDocumentColorScheme(dark);
  useDocumentFontWeight(FONT_WEIGHT_VALUE[fontWeight]);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        // antd 자체 문구(페이징·날짜·빈 목록)도 같은 언어를 따라야 한다 — 여기가 ko 로
        // 박혀 있으면 영어 화면에 한국어 "데이터 없음" 이 섞인다.
        locale={lang === 'ko' ? koKR : enUS}
        // main-shell.md §9.7 — 축의 조합에서 토큰 세트 하나를 만들어 먹인다. 그 조립은 `themeTokens`
        // 한 곳이며 AG Grid 도 같은 입력에서 자기 파라미터를 받는다.
        theme={antdTheme({
          dark,
          primaryColor,
          colorTone,
          bgDensity,
          compact,
          fontFamily,
          fontSize,
          fontWeight,
          gridHeaderHeight,
          gridRowHeight,
          gridFontSize,
        })}
      >
        <AntApp>
          {/*
            참조 팝업이 열리는 단 한 자리 — grid-column-contract.md §6 · 68 §9.4.

            <b>{@code AntApp} 안이다.</b> 팝업이 띄우는 그리드가 {@code App.useApp()} 의
            모달·토스트를 쓰므로(미저장 확인 · 조회 실패) 밖에 두면 그 훅이 컨텍스트를
            못 찾아 <b>확인 없이 지나가거나</b> 화면 없이 죽는다.

            <b>{@code AppSurface} 밖에 두지 않는다</b>는 뜻이기도 하다 — 이 컴포넌트는
            자식을 그대로 감쌀 뿐이라 바탕색 층과 순서를 다툴 것이 없고, 위에 두면
            <i>배경을 칠하지 않은 곳에 모달이 뜨는</i> 경로가 열린다.
          */}
          <PopupHost>
            {/*
              실행 파라미터 모달이 열리는 단 한 자리 — grid-api-contract.md §8 · 68 §9.13.

              <b>팝업 호스트 안쪽이다.</b> 순서에 뜻이 있는 것은 아니고(둘은 서로를
              부르지 않는다) <b>둘 다 {@code AntApp} 안</b>이어야 한다는 것만이 규칙이다 —
              AntD 폼의 검증 문구와 모달이 그 컨텍스트를 쓴다.
            */}
            <FormModalHost>
              {/*
                진행률 창이 열리는 단 한 자리 — 30 §6 · 68 §9.1.

                <b>그리드 컨트롤러가 이 훅을 부른다</b>({@code useProgress}) — 화면이
                폴링 코드를 쓰지 않는 것이 그 계약이므로, 이 호스트는 <b>그리드가 서는
                모든 곳보다 위</b>에 있어야 한다.
              */}
              <ProgressHost>
                <AppSurface>{children}</AppSurface>
              </ProgressHost>
            </FormModalHost>
          </PopupHost>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

/**
 * <b>브라우저에게도 지금이 어느 모드인지 말한다</b> — `color-scheme`.
 *
 * <p>antd 는 자기가 그리는 것만 칠한다. <b>브라우저가 직접 그리는 것</b>(자동완성으로
 * 채워진 입력 칸 · 스크롤바 · 날짜 선택기 · `select` 팝업)은 문서가 `color-scheme` 을
 * 말하지 않으면 <b>언제나 라이트로</b> 그려진다 — 다크 화면에 <b>흰 입력 칸</b>이 남는
 * 것이 그 대표적인 모습이다(2026-08-30 로그인 화면).
 *
 * <p><b>`html` 에 건다.</b> 이 속성은 그 요소와 후손이 그리는 네이티브 UI 에 적용되므로
 * 앱 안쪽 div 에 걸면 <b>문서 캔버스와 스크롤바</b>가 빠진다.
 *
 * <p>CSS 파일을 만들지 않는 것은 frontend-stack.md §2 그대로다 — 속성 하나라 인라인으로 족하다.
 */
function useDocumentColorScheme(dark: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = dark ? 'dark' : 'light';
    return () => {
      root.style.removeProperty('color-scheme');
    };
  }, [dark]);
}

/**
 * <b>기본 글자 굵기</b> — main-shell.md §9.3.
 *
 * <p>토큰이 아니라 `body` 에 건다. antd 에는 <i>본문 굵기</i> 토큰이 없고
 * ({@code fontWeightStrong} 은 <b>강조</b>의 굵기다) 글자 굵기는 상속되므로, 여기 한 번
 * 걸면 컴포넌트가 스스로 굵기를 정한 자리만 빼고 전부 따라온다.
 */
function useDocumentFontWeight(weight: number) {
  useEffect(() => {
    document.body.style.fontWeight = String(weight);
    return () => {
      document.body.style.removeProperty('font-weight');
    };
  }, [weight]);
}

/**
 * 앱의 바탕을 antd 토큰으로 칠한다.
 *
 * <p><b>없으면 브라우저의 캔버스가 그대로 비친다.</b> antd 6 은 CSS-in-JS 라 전역 리셋을
 * 넣지 않고, 이 프로젝트에는 CSS 파일이 없다. 그래서 OS/브라우저가 다크 모드면 배경만
 * 검고 antd 의 기본(라이트) 글자색이 그 위에 얹혀 <b>로그인 화면의 라벨이 보이지 않는다</b> —
 * 실제로 그렇게 렌더된 것을 보고 넣었다.
 */
function AppSurface({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: token.colorBgLayout,
        color: token.colorText,
      }}
    >
      <ShellTextStyle />
      <AutofillStyle />
      {children}
    </div>
  );
}

/**
 * <b>활성 항목도 본문 굵기를 따른다</b> — main-shell.md §9.3.1.
 *
 * <p>사이더의 <b>선택된 메뉴</b>와 탭바의 <b>활성 탭</b>만 굵기 설정을 따라오지 않았다
 * (2026-08-30 실물). 굵기는 {@code body} 에 걸어 상속시키는데, 그 둘은 상속을 끊는
 * 무언가가 위에 있다 — antd 의 Menu·Tabs 스타일에는 {@code font-weight} 규칙이 없어
 * (강조 굵기를 쓰는 컴포넌트 목록에도 둘 다 없다) <b>어느 규칙이 끊는지는 특정하지
 * 못했다.</b>
 *
 * <p>그래서 <b>범인을 찾는 대신 결과를 못 박는다</b>: 두 자리에 {@code inherit} 를 준다.
 * 무엇이 끊고 있었든 다시 본문을 따라오며, 끊는 것이 없었다면 이 규칙은 아무 일도 하지
 * 않는다 — 어느 쪽이든 <b>설정이 화면과 어긋나는 상태</b>가 남지 않는다.
 *
 * <p><b>선택자를 판의 클래스로 쓴다.</b> 판을 바꾸면 함께 사라져야 하는 규칙이라
 * 어댑터 밖에 두지 않는 편이 좋지만, 그럴 자리(셸의 CSS)가 이 프로젝트에 없다 —
 * frontend-stack.md §2 가 CSS 파일을 두지 않기로 했고 여기가 그 예외의 유일한 자리다.
 */
function ShellTextStyle() {
  return (
    <style>{`
      .ant-menu-item-selected,
      .ant-menu-item-selected .ant-menu-title-content,
      .ant-menu-submenu-selected > .ant-menu-submenu-title,
      .ant-tabs-tab-active .ant-tabs-tab-btn {
        font-weight: inherit;
      }
    `}</style>
  );
}

/**
 * <b>크롬이 채운 칸을 우리 색으로 덮는다</b> — main-shell.md §9.3.2.
 *
 * <p>브라우저는 자동완성으로 채운 입력 칸을 <b>자기 색으로</b> 칠하고, 그 규칙은
 * {@code background-color: … !important} 라 우리 배경으로는 이길 수 없다. 다크 화면에
 * <b>흰 칸 둘</b>(아이디·비밀번호)이 남는 것이 그 모습이며, <b>비밀번호 변경 화면은
 * 멀쩡한 것</b>이 증거다 — 그쪽은 저장된 자격 증명과 맞지 않아 채워지지 않는다.
 *
 * <p><b>{@code color-scheme} 만으로는 부족했다</b>(2026-08-30 — 먼저 그것부터 걸었다).
 * 크롬 버전에 따라 다크 자동완성 색을 쓰기도 하지만 우리 톤과는 여전히 다른 색이다.
 *
 * <p>이기는 방법은 <b>덮어 그리는 것</b> 하나다. 안쪽 그림자를 칸 전체 크기로 깔면
 * 배경 위에 우리 색이 얹히고, 글자는 {@code -webkit-text-fill-color} 로 바꾼다 —
 * {@code color} 는 브라우저 쪽이 {@code !important} 라 듣지 않는다.
 *
 * <p><b>여기만 CSS 규칙을 쓴다.</b> frontend-stack.md §2 가 CSS 파일을 두지 않기로 했고 이것은 그 예외가
 * 아니다 — 의사 클래스({@code :-webkit-autofill})는 인라인 스타일로 쓸 수 없고, 값이
 * <b>테마 토큰</b>이라 정적 파일에 둘 수도 없다. 그래서 <b>토큰에서 만들어 낸다.</b>
 */
function AutofillStyle() {
  const { token } = theme.useToken();

  // 포커스 링을 잃지 않는다 — 덮는 그림자만 두면 antd 의 링이 지워진다.
  const fill = `inset 0 0 0 1000px ${token.colorBgContainer}`;
  const css = `
    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:active {
      box-shadow: ${fill} !important;
      -webkit-text-fill-color: ${token.colorText} !important;
      caret-color: ${token.colorText};
    }
    input:-webkit-autofill:focus {
      box-shadow: ${fill}, 0 0 0 2px ${token.controlOutline} !important;
    }
  `;

  return <style>{css}</style>;
}
