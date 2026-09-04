import { AppProviders } from '@/app/providers/AppProviders';
import { AppRouter } from '@/app/router/AppRouter';

/**
 * 앱 진입.
 *
 * <p>라우트는 <b>로그인 화면과 셸</b> 둘뿐이며 메뉴별 경로는 라우터에 없다 — 탭이 그것을
 * 대신한다(frontend/packages.md). 전역 프로바이더(테마·react-query·antd `App`)는 셸 밖에도 필요하므로
 * 여기서 감싼다.
 */
export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
