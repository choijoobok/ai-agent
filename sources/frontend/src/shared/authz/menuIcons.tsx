import {
  ApartmentOutlined,
  ApiOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FieldTimeOutlined,
  FileOutlined,
  FileSearchOutlined,
  FolderOutlined,
  HistoryOutlined,
  IdcardOutlined,
  InboxOutlined,
  LoginOutlined,
  MenuOutlined,
  NotificationOutlined,
  ScheduleOutlined,
  SafetyCertificateOutlined,
  SoundOutlined,
  TagsOutlined,
  TeamOutlined,
  ToolOutlined,
  TranslationOutlined,
  UserOutlined,
  UserSwitchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

/**
 * `SYS_MENU.ICON_CD` → 아이콘 — frontend/tabs.md.
 *
 * <p><b>DB 에 판의 컴포넌트 이름을 넣지 않는다.</b> `DashboardOutlined` 를 그대로 저장하면
 * 판을 바꾸는 날 <b>데이터가 낡는다</b> — 시드에 든 것은 <i>뜻의 코드</i>(`dashboard`)이고
 * 그것을 무엇으로 그릴지는 여기가 정한다.
 *
 * <p><b>없는 코드는 없는 것이다.</b> 매핑에 없으면 부르는 쪽이 폴백(구조 노드는 폴더,
 * 리프는 문서)으로 떨어진다 — 아이콘 하나 때문에 사이더가 비면 안 된다.
 */
export const MENU_ICONS: Record<string, ReactNode> = {
  dashboard: <DashboardOutlined />,
  system: <AppstoreOutlined />,

  'user-group': <TeamOutlined />,
  user: <UserOutlined />,
  'user-auth': <UserSwitchOutlined />,

  menu: <MenuOutlined />,
  tree: <ApartmentOutlined />,
  role: <IdcardOutlined />,
  'role-auth': <SafetyCertificateOutlined />,
  api: <ApiOutlined />,

  master: <DatabaseOutlined />,
  code: <TagsOutlined />,
  message: <TranslationOutlined />,
  config: <ToolOutlined />,

  log: <HistoryOutlined />,
  'access-log': <FileSearchOutlined />,
  'login-log': <LoginOutlined />,
  'error-log': <WarningOutlined />,

  batch: <ClockCircleOutlined />,
  schedule: <ScheduleOutlined />,
  'run-history': <FieldTimeOutlined />,

  notice: <NotificationOutlined />,
  'notice-board': <SoundOutlined />,
  inbox: <InboxOutlined />,
};

/** 코드 → 아이콘. 모르는 코드면 `undefined` 이고 폴백은 부르는 쪽의 일이다. */
export function menuIcon(iconCd: string | null): ReactNode | undefined {
  return iconCd === null ? undefined : MENU_ICONS[iconCd];
}

/**
 * 코드 → 아이콘, <b>폴백까지</b> — 메뉴를 계층으로 그리는 곳이 함께 쓴다(frontend/tabs.md).
 *
 * <p><b>폴백을 부르는 쪽마다 적지 않는다</b>(2026-08-31). 사이더가 이 한 줄을 갖고 있었고
 * 권한 트리가 아이콘을 그리기 시작하면서 같은 줄이 둘이 될 자리였는데, 둘이 되면 <b>같은
 * 메뉴가 화면마다 다른 아이콘</b>으로 보인다 — 시드가 코드를 비워 둔 메뉴에서 한쪽은
 * 폴더이고 한쪽은 문서인 일이 생긴다.
 *
 * <p>구조 노드와 리프를 가르는 것은 <b>둘의 성격이 다르기</b> 때문이다 — 하나는 경로이고
 * 하나는 화면이다(backend/security.md 의 배타 규칙). <b>자식이 있는가로 묻지 않는다</b>: 자식이 아직 없는
 * 구조 노드가 있고(screen/menu/requirements.md 의 신규 폴더), 그것을 문서로 그리면 <i>열 수 있는 것</i> 처럼
 * 보인다 — 부르는 쪽이 <b>무엇으로 아는지</b>를 넘긴다.
 */
export function menuIconOf(iconCd: string | null, folder: boolean): ReactNode {
  // 시드가 정한 것이 먼저다 — 없거나 모르는 코드면 폴백이다(frontend/tabs.md).
  return menuIcon(iconCd) ?? (folder ? <FolderOutlined /> : <FileOutlined />);
}
