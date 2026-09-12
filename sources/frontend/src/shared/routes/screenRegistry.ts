import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * `MENU_URL` → 화면 컴포넌트 — frontend/packages.md.
 *
 * <p><b>정적 맵인 것이 결정이다.</b> 서버가 준 문자열로 동적 `import` 경로를 만들면 번들
 * 분석이 불가능하고 보안상도 좋지 않다. <b>키가 곧 `MENU_URL`</b> 이라 라우트와 맵 키가 같은
 * 값이며 어긋날 수가 없다 — 별도의 "컴포넌트 키" 컬럼을 두지 않은 이유이기도 하다.
 *
 * <p><b>프론트는 서버 JAR 에 임베드되어 원자적으로 함께 배포된다</b>(build-deploy.md). 그래서
 * <i>"프론트 배포 없이 메뉴 추가"</i> 라는 이점이 성립하지 않고, 여기 없는 `MENU_URL` 은
 * 데이터가 앞서간 것이 아니라 <b>아직 만들지 않은 화면</b>이다.
 */
export const SCREENS: Record<string, LazyExoticComponent<ComponentType>> = {
  '/dashboard': lazy(async () => ({
    default: (await import('@/features/dashboard/pages/DashboardPage')).DashboardPage,
  })),
  '/message': lazy(async () => ({
    default: (await import('@/features/message/pages/MessageMgmtPage')).MessageMgmtPage,
  })),
  '/config': lazy(async () => ({
    default: (await import('@/features/config/pages/ConfigMgmtPage')).ConfigMgmtPage,
  })),
  '/code': lazy(async () => ({
    default: (await import('@/features/code/pages/CodeMgmtPage')).CodeMgmtPage,
  })),
  '/admin/system/api-catalog': lazy(async () => ({
    default: (await import('@/modules/system/features/apicatalog/pages/ApiCatalogPage')).ApiCatalogPage,
  })),
  '/admin/system/menu': lazy(async () => ({
    default: (await import('@/modules/system/features/menu/pages/MenuTreePage')).MenuTreePage,
  })),
  '/admin/system/role': lazy(async () => ({
    default: (await import('@/modules/system/features/role/pages/RoleMgmtPage')).RoleMgmtPage,
  })),
  '/admin/system/role-auth': lazy(async () => ({
    default: (await import('@/modules/system/features/roleauth/pages/RoleAuthMgmtPage')).RoleAuthMgmtPage,
  })),
  '/log/access': lazy(async () => ({
    default: (await import('@/features/accesslog/pages/AccessLogPage')).AccessLogPage,
  })),
  '/log/login': lazy(async () => ({
    default: (await import('@/features/loginlog/pages/LoginLogPage')).LoginLogPage,
  })),
  '/log/error': lazy(async () => ({
    default: (await import('@/features/errorlog/pages/ErrorLogPage')).ErrorLogPage,
  })),
  '/admin/system/user': lazy(async () => ({
    default: (await import('@/modules/system/features/user/pages/UserMgmtPage')).UserMgmtPage,
  })),
  '/admin/system/user-auth': lazy(async () => ({
    default: (await import('@/modules/system/features/userauth/pages/UserAuthMgmtPage')).UserAuthMgmtPage,
  })),
  /*
    배치 둘 — 65. **폴더가 갈려 있는 것이 인가 경계다**(seed.md): 한 폴더에 두면 두 화면의
    엔드포인트가 서로에게 매핑되어 조회 전용 화면의 권한이 등록 저장을 연다.
    `generateApiSeed` 가 이 두 줄을 따라와 각 폴더의 `api/endpoints.ts` 를 읽는다(backend/api.md).
  */
  /*
    공지 둘 — 66. **폴더가 갈려 있는 것이 인가 경계다**(seed.md): 한 폴더에 두면 두 화면의
    엔드포인트가 서로에게 매핑되어 **공지 권한이 요청 처리를 연다**. 요청 처리는 남의
    요청을 판정하는 일이라 그 사고의 대가가 크다.
    `generateApiSeed` 가 이 두 줄을 따라와 각 폴더의 `api/endpoints.ts` 를 읽는다(backend/api.md).
  */
  '/notice': lazy(async () => ({
    default: (await import('@/features/notice/pages/NoticeMgmtPage')).NoticeMgmtPage,
  })),
  '/noti-request': lazy(async () => ({
    default: (await import('@/features/notirequest/pages/NotiRequestPage')).NotiRequestPage,
  })),
  '/batch/schedule': lazy(async () => ({
    default: (await import('@/features/batchschedule/pages/BatchSchedulePage'))
      .BatchSchedulePage,
  })),
  '/batch/history': lazy(async () => ({
    default: (await import('@/features/batchhistory/pages/BatchHistoryPage')).BatchHistoryPage,
  })),
  /*
    샘플 — 68. **참조 구현이지 업무 화면이 아니다.** 걷어낼 때 지우는 줄이 여기 있고
    (playbook/INDEX.md) `generateApiSeed` 가 이 줄을 따라와 `@/features/sample/mdvertical/api/endpoints.ts` 를
    읽으므로, 지우면 006·007 시드에서 샘플 API 가 저절로 사라진다.
  */
  '/sample/single-offset': lazy(async () => ({
    default: (await import('@/features/sample/singleoffset/pages/SampleSingleOffsetPage'))
      .SampleSingleOffsetPage,
  })),
  '/sample/single-cursor': lazy(async () => ({
    default: (await import('@/features/sample/singlecursor/pages/SampleSingleCursorPage'))
      .SampleSingleCursorPage,
  })),
  '/sample/md-horizontal': lazy(async () => ({
    default: (await import('@/features/sample/mdhorizontal/pages/SampleMdHorizontalPage'))
      .SampleMdHorizontalPage,
  })),
  '/sample/md-vertical': lazy(async () => ({
    default: (await import('@/features/sample/mdvertical/pages/SampleMdVerticalPage')).SampleMdVerticalPage,
  })),
  '/sample/md-tabs': lazy(async () => ({
    default: (await import('@/features/sample/mdtabs/pages/SampleMdTabsPage')).SampleMdTabsPage,
  })),
  '/sample/excel': lazy(async () => ({
    default: (await import('@/features/sample/excel/pages/SampleExcelPage')).SampleExcelPage,
  })),
};

export function screenFor(pathname: string): LazyExoticComponent<ComponentType> | null {
  return SCREENS[pathname] ?? null;
}
