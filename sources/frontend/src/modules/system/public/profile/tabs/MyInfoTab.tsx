// @feat FEAT-501
import { useState } from 'react';
import { App, Button, Descriptions, Form, Input, Space } from 'antd';
import dayjs from 'dayjs';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { codeLabel, LANG_CD } from '@/shared/i18n/codeLabel';
import { useAuthStore } from '@/shared/stores/authStore';
import { saveMyProfile } from '@/modules/system/public/profile/api/profileApi';
import type { MyProfile } from '@/modules/system/public/profile/types';

interface Props {
  profile: MyProfile;
  onSaved: (profile: MyProfile) => void;
}

/**
 * 내 정보 — USER-05 · frontend/tabs.md.
 *
 * <p><b>조회와 수정을 탭으로 나누지 않는다</b>(frontend/tabs.md). 읽기 전용 화면을 본 뒤 "수정" 으로
 * 옮겨 같은 항목을 다시 그리는 것은 화면 하나를 두 번 만드는 일이다.
 *
 * <p><b>편집 가능한 것은 둘뿐이다</b> — 이름과 메일. 나머지는 <b>관리자의 축</b>이거나
 * (사용 기간 · sys/user-role.md) <b>다른 화면의 것</b>(언어 · frontend/tabs.md)이라 읽기로만 둔다. 여기서
 * 고칠 수 있게 하면 자기 계정으로 자기 권한을 넓히는 경로가 열린다.
 *
 * <p><b>저장하면 헤더의 이름도 바뀐다.</b> 서버가 세션 주체를 갈아 끼우고, 여기서는
 * `authStore` 를 함께 고친다 — 그러지 않으면 새로고침 전까지 헤더만 옛 이름이다.
 */
export function MyInfoTab({ profile, onSaved }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ userNm: string; email: string }>();
  const [saving, setSaving] = useState(false);
  const renameUser = useAuthStore((state) => state.renameUser);

  const submit = async (values: { userNm: string; email: string }) => {
    setSaving(true);
    try {
      const saved = await saveMyProfile(values.userNm, values.email || null);
      // 서버가 다듬은 값(공백 제거 · 빈 메일의 null)으로 폼을 되맞춘다.
      form.setFieldsValue({ userNm: saved.userNm, email: saved.email ?? '' });
      renameUser(saved.userNm);
      onSaved(saved);
      message.success(label(MSG.PROFILE_SAVED));
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ userNm: profile.userNm, email: profile.email ?? '' }}
        onFinish={(values) => void submit(values)}
      >
        <Form.Item
          name="userNm"
          label={label(MSG.PROFILE_USER_NM)}
          rules={[{ required: true, message: label(MSG.PROFILE_USER_NM_REQUIRED) }]}
        >
          <Input maxLength={100} />
        </Form.Item>
        {/* 비우는 것은 정상 입력이다 — 없는 사람이 있고 지우는 것도 뜻이 있다. */}
        <Form.Item
          name="email"
          label={label(MSG.PROFILE_EMAIL)}
          rules={[{ type: 'email', message: label(MSG.PROFILE_EMAIL_INVALID) }]}
        >
          <Input maxLength={255} allowClear />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>
          {label(MSG.PROFILE_SAVE)}
        </Button>
      </Form>

      {/* 읽기 전용 — 여기 있는 것은 전부 관리자나 다른 화면이 정한다. */}
      <Descriptions column={1} bordered>
        <Descriptions.Item label={label(MSG.PROFILE_USER_ID)}>{profile.userId}</Descriptions.Item>
        <Descriptions.Item label={label(MSG.PROFILE_LOCALE)}>
          {codeLabel(LANG_CD, profile.localeCd)}
        </Descriptions.Item>
        <Descriptions.Item label={label(MSG.PROFILE_VALID_PERIOD)}>
          {period(profile.validFromDt, profile.validToDt)}
        </Descriptions.Item>
        <Descriptions.Item label={label(MSG.PROFILE_LAST_LOGIN)}>
          {instant(profile.lastLoginDtm)}
        </Descriptions.Item>
      </Descriptions>
    </Space>
  );
}

/**
 * 양끝이 다 비면 제한이 없다는 뜻이다 — 빈 칸으로 두면 조회가 실패한 것처럼 보인다.
 *
 * <p>업무 날짜(`_DT`)는 시간대가 없으므로 `dayjs` 를 태우지 않고 그대로 쓴다 —
 * 현지 시각으로 해석하면 하루가 어긋난다(sys/INDEX.md).
 */
function period(from: string | null, to: string | null): string {
  if (!from && !to) return label(MSG.PROFILE_NONE);
  return `${from ?? ''} ~ ${to ?? ''}`;
}

function instant(value: string | null): string {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : label(MSG.PROFILE_NONE);
}
