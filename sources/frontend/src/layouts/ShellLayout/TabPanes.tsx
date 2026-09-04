import {
  Component,
  Suspense,
  createElement,
  memo,
  useMemo,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { Alert, Result, Spin } from 'antd';
import { useTabStore, type WorkTab } from '@/shared/stores/tabStore';
import { screenFor } from '@/shared/routes/screenRegistry';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { TabIdentityProvider } from '@/layouts/ShellLayout/tabContext';

/**
 * 열린 탭의 화면들 — frontend/packages.md.
 *
 * <p><b>비활성 탭을 언마운트하지 않고 숨긴다.</b> 검색 조건·스크롤·입력 중인 폼이 탭 전환
 * 후에도 남아야 하기 때문이며, 언마운트 방식은 멀티탭의 이점이 없다(frontend/tabs.md).
 *
 * <p>대신 DOM 이 계속 쌓이므로 <b>전환이 O(1) 이어야 한다</b> — `display` 토글만 하고
 * 리마운트·리페치를 하지 않는다.
 *
 * <p><b>그 O(1) 은 공짜가 아니다.</b> 토글하는 값이 화면 subtree 로 흘러 들어가면 전환
 * 한 번이 <b>들어오는 화면과 나가는 화면을 모두 다시 그린다</b> — 실측 350ms(그리드에 행이
 * 0개일 때). 그래서 이 파일은 경계를 <b>둘</b>로 나눈다: {@link TabPane} 이 보임을 갖고,
 * {@link TabBody} 가 화면을 갖는다.
 *
 * <p><b>React key 가 `tab.key` 다.</b> 같은 라우트라도 탭이 다르면 별개 인스턴스이며 상태를
 * 공유하지 않는다 — frontend/tabs.md 의 "새 탭으로 열기" 가 성립하는 근거다.
 */
export function TabPanes() {
  const tabs = useTabStore((state) => state.tabs);
  const activeKey = useTabStore((state) => state.activeKey);

  return (
    <>
      {tabs.map((tab) => (
        <TabPane key={tab.key} tab={tab} active={tab.key === activeKey} />
      ))}
    </>
  );
}

/**
 * 탭 하나의 <b>보임</b> — 전환 때 다시 그려지는 것은 여기까지다.
 *
 * <p>`display` 토글이 전환의 전부이므로 <b>바뀌는 것은 이 div 의 style 하나</b>여야 한다.
 * 아래 {@link TabBody} 는 {@code active} 를 받지 않으므로 다시 그려지지 않는다 — 그 한 줄이
 * 전환 비용을 화면 크기에서 떼어 낸다.
 *
 * <p><b>`content-visibility` 를 주지 않는다.</b> 한동안 숨은 패널에 {@code hidden} 을
 * 줬는데(frontend/packages.md) {@code display: none} 이 이미 박스를 만들지 않으므로 <b>아무 일도 하지
 * 않는 선언</b>이었다. 숨기는 쪽은 원래 공짜이고, 비용은 <b>되켤 때의 레이아웃</b>에 있다 —
 * 그쪽은 실측 20~30ms 로 문제가 아니었다(2026-08-31).
 *
 * <p>부모가 다시 그려질 때 여기서 멈추는 근거는 <b>탭 객체가 안정된 참조</b>라는 것이다.
 * {@code tabStore} 는 한 번 만든 {@link WorkTab} 을 다시 만들지 않는다(열기·닫기·순서
 * 바꾸기가 모두 배열만 새로 만든다).
 */
const TabPane = memo(function TabPane({ tab, active }: { tab: WorkTab; active: boolean }) {
  return (
    <div
      role="tabpanel"
      aria-hidden={!active}
      style={{
        // 활성 탭이 콘텐츠 영역을 채운다 — 그래야 화면의 `height: 100%` 가 성립한다.
        // 대시보드처럼 흐름대로 자라는 화면은 남는 자리를 그냥 비워 둔다.
        display: active ? 'block' : 'none',
        height: active ? '100%' : undefined,
      }}
    >
      <TabBody tab={tab} />
    </div>
  );
});

/**
 * 탭 하나의 <b>화면</b> — <b>탭이 사는 동안 한 번만 그린다</b>.
 *
 * <p>받는 것이 {@code tab} 하나이고 그것이 안정된 참조이므로, 셸이 무슨 일로 다시 그려져도
 * (탭 전환 · 사이더 접힘 · 알림 개수 · 모달 열림) 이 아래로는 내려오지 않는다. 화면이 다시
 * 그려지는 것은 <b>자기 스토어·쿼리·상태가 바뀔 때</b>뿐이다.
 *
 * <p><b>{@code active} 를 받지 않는 것이 요점이다.</b> 예전에는 그것이 컨텍스트에 실려
 * 내려갔는데 <b>읽는 곳이 없었다</b> — 활성 탭만 그리는 판단은 {@code BreadcrumbSlot} 이
 * {@code tabStore.activeKey} 로 따로 한다. 쓰이지 않는 값 하나가 전환마다 화면 둘을 다시
 * 그리게 하고 있었다(2026-08-31 실측: 클릭 → 350ms 렌더 → 그 끝에서야 `display` 가 바뀜).
 *
 * <p><b>테마·언어는 그대로 통과한다.</b> 끊는 것은 부모의 리렌더 하나이며 컨텍스트와 스토어
 * 구독은 memo 를 넘어 도달한다 — frontend/tabs.md 의 토큰 교체는 여전히 모든 탭에 닿는다.
 */
const TabBody = memo(function TabBody({ tab }: { tab: WorkTab }) {
  // 탭이 사는 동안 바뀌지 않는 값이다 — 컨텍스트 소비자(모든 탭의 `SearchForm`)가
  // 전환마다 깨어나지 않는 근거가 이 안정성이다.
  const identity = useMemo(() => ({ tabKey: tab.key, menuCd: tab.menuCd }), [tab.key, tab.menuCd]);

  return (
    // 화면이 셸의 슬롯을 채우려면 자기가 어느 탭인지 알아야 한다 — frontend/tabs.md.
    <TabIdentityProvider value={identity}>
      {/* 에러 바운더리가 탭 단위인 것이 요점이다 — frontend/tabs.md. */}
      <TabErrorBoundary tab={tab}>
        <Suspense fallback={<ScreenLoading />}>
          <TabScreen tab={tab} />
        </Suspense>
      </TabErrorBoundary>
    </TabIdentityProvider>
  );
});

/**
 * 화면 청크를 받는 동안의 자리 — <b>가운데다</b>.
 *
 * <p>맨 {@code <Spin/>} 은 인라인 요소라 <b>콘텐츠 영역의 왼쪽 위 구석</b>에 붙는다.
 * 그러면 사용자가 보는 것은 <i>"화면이 뜨는 중"</i> 이 아니라 <i>"왼쪽 위에 뭔가 생겼다"</i>
 * 다 — <b>기다리는 대상이 화면 전체</b>이므로 표시도 그 자리를 차지해야 한다.
 *
 * <p>{@code minHeight} 는 <b>바닥</b>이다. 탭 패널은 활성일 때 {@code height: 100%} 라
 * 보통 뷰포트를 채우지만, 상위 높이가 풀리는 경우에 높이 0짜리 <b>보이지 않는 표시</b>가
 * 되는 것을 막는다.
 */
function ScreenLoading() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 240,
      }}
    >
      <Spin size="large" />
    </div>
  );
}

/**
 * <b>`createElement` 로 그린다.</b> `screenRegistry` 의 값은 모듈 스코프에서 한 번 만들어진
 * 안정된 참조이지만, 대문자 지역 변수를 JSX 로 쓰면 린트가 <i>"렌더 중에 만든 컴포넌트"</i> 로
 * 읽는다 — 실제로 위험한 패턴이라 규칙을 끄는 대신 오해할 수 없는 형태로 쓴다.
 */
function TabScreen({ tab }: { tab: WorkTab }) {
  const screen = screenFor(tab.pathname);
  if (!screen) {
    // 데이터가 앞서간 것이 아니라 아직 만들지 않은 화면이다 — 프론트는 서버와 원자적으로
    // 함께 배포되므로(build-deploy.md) 메뉴만 먼저 생기는 경우가 없다.
    return (
      <Alert
        type="info"
        showIcon
        title={label(MSG.SCREEN_MISSING_TITLE, { menu: label(tab.titleKey) })}
        description={label(MSG.SCREEN_MISSING_DESC, {
          menuCd: tab.menuCd,
          menuUrl: tab.pathname,
        })}
      />
    );
  }
  return createElement(screen);
}

/**
 * <b>셸 전체를 감싸지 않는다.</b> 감싸면 화면 하나가 깨질 때 열려 있던 탭 전부가 함께 죽어
 * 멀티탭의 의미가 사라진다 — 탭 하나가 깨져도 나머지는 살아 있고 그 탭만 닫으면 된다(frontend/tabs.md).
 */
class TabErrorBoundary extends Component<
  { tab: WorkTab; children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 화면이 깨진 사실은 서버 로그에 남지 않는다 — 최소한 콘솔에는 남겨야 재현할 수 있다.
    // 개발자용 로그다 — 사용자에게 보이지 않으므로 메시지 키를 쓰지 않는다.
    console.error(`tab screen threw — ${this.props.tab.menuCd}`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Result
          status="error"
          title={label(MSG.SCREEN_ERROR_TITLE)}
          subTitle={this.state.error.message}
        />
      );
    }
    return this.props.children;
  }
}
