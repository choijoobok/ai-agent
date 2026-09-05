import { useEffect, useState } from 'react';
import { Alert, Modal, Skeleton, Tabs } from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { getMyProfile } from '@/features/profile/api/profileApi';
import { useModalTabHotkeys } from '@/shared/hooks/useModalTabHotkeys';
import { PROFILE_TABS, PROFILE_TAB_KEYS, type ProfileTab } from '@/features/profile/profileTabs';
import { MyInfoTab } from '@/features/profile/tabs/MyInfoTab';
import { PasswordTab } from '@/features/profile/tabs/PasswordTab';
import { LoginHistoryTab } from '@/features/profile/tabs/LoginHistoryTab';
import { MyRolesTab } from '@/features/profile/tabs/MyRolesTab';
import type { MyProfile } from '@/features/profile/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * 프로필 모달 — USER-05 · frontend/tabs.md.
 *
 * <p><b>탭 넷이며 전부 "나에 대한 것" 이다</b> — 내 정보 · 비밀번호 변경 · 내 로그인 이력 ·
 * 내 역할. 헤더의 사용자명을 누르면 열린다(frontend/tabs.md).
 *
 * <p><b>여는 순간 읽는 것은 프로필 하나다.</b> 앞의 두 탭이 그것으로 그려지고(비밀번호 탭은
 * 정책과 만료 상태가 필요하다), 뒤의 둘은 <b>그 탭이 열릴 때</b> 각자 읽는다 — 대부분은 첫
 * 탭만 보고 닫으므로 넷을 다 읽으면 그 비용이 매번 든다.
 *
 * <p><b>버전·환경 표시는 여기 없다</b>(2026-08-29 정정). frontend/tabs.md 이 §2 에서 푸터를 없애며
 * 이리로 옮겨 두었는데, 알림 모달에 <b>시스템 정보</b>가 서면서 그쪽으로 일원화했다 —
 * 같은 것을 두 곳에서 말하면 어느 쪽이 맞는지 화면만 봐서는 알 수 없다. 프론트 번들의
 * 버전(`package.json`)은 <b>서버 빌드를 특정하지 못한다</b>는 것도 이유다.
 *
 * <p><b>닫으면 상태를 버린다</b>(`destroyOnHidden`). 비밀번호 칸에 친 값이 남아 있으면 다시
 * 열었을 때 그것이 <i>저장된 것</i>처럼 보이고, 로그인 이력은 다시 열 때 새로 읽는 편이 맞다.
 */
export function ProfileModal({ open, onClose }: Props) {
  const [active, setActive] = useState<ProfileTab>('info');
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // **렌더 중에 되돌린다.** 효과에서 부르면 렌더가 연쇄되고
  // (`react-hooks/set-state-in-effect`), 다시 열었을 때 지난 사람의 값이 한 프레임 보인다.
  const [seed, setSeed] = useState(open);
  if (seed !== open) {
    setSeed(open);
    setActive('info');
    setProfile(null);
    setError(null);
  }

  /*
    <b>`PageUp`/`PageDown` 이 이 모달의 탭을 옮긴다</b> — frontend/tabs.md · `useModalTabHotkeys`.

    <b>진입 모달만 하고 있던 일이다</b>(2026-09-01 — 지시). 이 창이 듣지 않는 동안 그 키는
    <b>뒤에 가린 셸의 탭바</b>를 옮겼다 — 비밀번호를 바꾸다 누른 한 번이 보이지도 않는 곳을
    움직였다는 뜻이다.

    <b>프로필이 오기 전에는 옮기지 않고 삼킨다</b>(`hold`). 그 구간은 뼈대만 그려져 탭이
    없는데, 삼키지 않으면 <b>모달이 뜬 직후에만</b> 셸의 탭바가 움직인다.
  */
  useModalTabHotkeys({
    open,
    keys: PROFILE_TAB_KEYS,
    active,
    onChange: setActive,
    hold: profile === null,
  });

  useEffect(() => {
    if (!open) return;
    let alive = true;
    getMyProfile().then(
      (loaded) => {
        if (alive) setProfile(loaded);
      },
      (failure: unknown) => {
        if (alive) setError(failure instanceof Error ? failure.message : String(failure));
      },
    );
    return () => {
      alive = false;
    };
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={label(MSG.PROFILE_TITLE)}
      // 저장은 탭 안에서 한다 — 탭마다 저장 대상이 다른데 모달 하나의 버튼이 그것을
      // 대신하면 지금 무엇이 저장되는지 알 수 없다. 남길 것이 없으므로 푸터를 비운다.
      footer={null}
      width={720}
      destroyOnHidden
    >
      {error && <Alert type="error" message={error} showIcon />}
      {!error && !profile && <Skeleton active paragraph={{ rows: 6 }} />}
      {profile && (
        <Tabs
          activeKey={active}
          onChange={(key) => setActive(key as ProfileTab)}
          items={PROFILE_TABS.map((tab) => ({
            key: tab.key,
            label: label(tab.titleKey),
            children: paneOf(tab.key, active, profile, setProfile),
          }))}
        />
      )}
    </Modal>
  );
}

/**
 * 뒤의 두 탭에 <b>지금 보고 있는가</b>를 넘긴다 — 그 값이 참이 될 때 각자 읽는다.
 *
 * <p>antd 는 한 번 연 탭의 내용을 그대로 두므로(`destroyInactiveTabPane` 기본 꺼짐) 이
 * 플래그가 없으면 <b>넷의 내용이 처음부터 다 마운트</b>되어 지연 로딩이 무의미해진다.
 */
function paneOf(
  tab: ProfileTab,
  active: ProfileTab,
  profile: MyProfile,
  setProfile: (profile: MyProfile) => void,
) {
  switch (tab) {
    case 'info':
      return <MyInfoTab profile={profile} onSaved={setProfile} />;
    case 'password':
      return <PasswordTab profile={profile} />;
    case 'history':
      return <LoginHistoryTab active={active === 'history'} />;
    case 'roles':
      return <MyRolesTab active={active === 'roles'} />;
  }
}
