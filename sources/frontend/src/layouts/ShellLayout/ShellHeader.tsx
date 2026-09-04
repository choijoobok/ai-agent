import {
  BellOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Badge, Button, Layout, Space, Tooltip, theme } from 'antd';
import { useAuthStore } from '@/shared/stores/authStore';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';

interface Props {
  onLogoClick: () => void;
  onLogout: () => void;
  onSettings: () => void;
  onProfile: () => void;
  onNotification: () => void;
  /**
   * 미읽음 배지 — **내 알림의 미읽음뿐**이다(main-shell.md §7.1).
   *
   * <p>공지는 팝업으로 이미 도달했고 요청은 내가 보낸 것이라 *"읽지 않음"* 이 성립하지
   * 않는다. **배지 하나가 세는 대상이 하나면** *"배지가 3인데 어디에 3이 있나"* 가
   * 생기지 않는다.
   */
  unreadCount: number;
}

/**
 * 헤더 — main-shell.md §3.
 *
 * <p><b>우측이 넷으로 찼다</b>(2026-08-29) — <b>알림 · 사용자 · 설정 · 로그아웃</b>. main-shell.md §3 이
 * 정한 상한이며 다섯째가 필요해지면 설정 또는 프로필 모달 안으로 들어간다.
 *
 * <p><b>넷 다 아이콘과 이름을 함께 갖는다.</b> 아이콘만 두면 무엇인지 배워야 하고, 이름만
 * 두면 넷이 글자 줄로 보여 서로 구분되지 않는다. 예외는 <b>사용자</b> 하나인데, 거기 붙는
 * 글자가 <i>기능의 이름</i>이 아니라 <b>사람의 이름</b>이라서다 — 아이콘이 그 자리를
 * <i>프로필</i> 로 읽히게 한다.
 *
 * <p><b>사용자명이 곧 프로필 버튼이다</b>(main-shell.md §8). 이름이 이미 <i>누구로 로그인했는가</i> 를
 * 말하고 있으므로 그 옆에 <b>프로필</b> 이라고 또 적지 않는다.
 *
 * <p><b>설정이 로그아웃 바로 왼쪽이다</b>(2026-08-29). 앞서는 사용자명 왼쪽이었는데, 그러면
 * 사람에 관한 것(사용자)과 세션에 관한 것(로그아웃) 사이에 <b>기기 설정</b>이 끼어 든다.
 * 지금 순서는 <i>받는 것 → 나 → 내 환경 → 끝내기</i> 이며 오른쪽으로 갈수록 되돌리기 어렵다.
 *
 * <p><b>빌려 두었던 테마 토글을 뺐다</b>(2026-08-29). main-shell.md §3 은 <i>"언어·테마 아이콘을 두지
 * 않는다 — 둘 다 설정 모달로 들어간다"</i> 로 정했고, 그 모달이 생겼으므로 약속대로 돌려준다.
 *
 * <p><b>사이더 접힘 토글이 여기 없다</b>(2026-08-30). 사이더를 접는 버튼은 <b>사이더에</b>
 * 있다(main-shell.md §4.1) — 조작하는 것과 조작되는 것이 붙어 있어야 하고, 접힌 뒤에 펼치는 버튼을
 * 찾는 곳도 그 자리다. 헤더 왼쪽은 이제 <b>로고 하나</b>다.
 *
 * <p><b>로그아웃은 독립 버튼이다</b>(main-shell.md §3.2) — 프로필 드롭다운 안에 넣으면 하루에 여러 번
 * 쓰는 종료 동작이 매번 두 클릭이 된다.
 */
export function ShellHeader({
  onLogoClick,
  onLogout,
  onSettings,
  onProfile,
  onNotification,
  unreadCount,
}: Props) {
  const { token } = theme.useToken();
  const user = useAuthStore((state) => state.user);

  return (
    <Layout.Header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingInline: 16,
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorSplit}`,
      }}
    >
      {/*
        로고 클릭은 <b>앱을 다시 띄운다</b> — main-shell.md §3.1. 탭만 닫으면 브라우저에 쌓인 것은
        그대로 남는다.
      */}
      <Button type="text" onClick={onLogoClick} style={{ fontWeight: 600 }}>
        AI Agent
      </Button>

      {/* 왼쪽에서 오른쪽으로 되돌리기 어려워진다 — 마지막이 로그아웃이다. */}
      <Space size={4}>
        {/*
          <b>숫자가 아이콘에 붙는다.</b> 버튼 옆에 따로 두면 *알림* 이라는 글자와 숫자가
          나란히 놓여 <i>알림이 3개 있다</i> 가 아니라 <i>알림 3</i> 로 읽힌다.

          <b>0 이면 사라진다</b>(AntD 기본) — 그것이 맞다: 셀 것이 없는데 동그라미가
          남아 있으면 <i>읽었는데도 뭔가 있다</i> 로 읽힌다.
        */}
        <Badge count={unreadCount} size="small" offset={[-4, 2]}>
          <Button type="text" icon={<BellOutlined />} onClick={onNotification}>
            {label(MSG.SHELL_NOTIFICATION)}
          </Button>
        </Badge>
        {/* 여기 붙는 글자는 기능의 이름이 아니라 사람의 이름이다 — 아이콘이 이 자리를
            프로필로 읽히게 한다. 그래서 이름 옆에 "프로필" 을 또 적지 않는다. */}
        <Tooltip title={label(MSG.PROFILE_TITLE)}>
          <Button type="text" icon={<UserOutlined />} onClick={onProfile}>
            {user?.userNm}
          </Button>
        </Tooltip>
        <Button type="text" icon={<SettingOutlined />} onClick={onSettings}>
          {label(MSG.SETTINGS_TITLE)}
        </Button>
        <Button type="text" icon={<LogoutOutlined />} onClick={onLogout}>
          {label(MSG.SHELL_LOGOUT)}
        </Button>
      </Space>
    </Layout.Header>
  );
}
