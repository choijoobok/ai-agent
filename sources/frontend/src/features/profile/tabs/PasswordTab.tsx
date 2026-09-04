import { useState } from 'react';
import { App, Alert, Button, Form, Input, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { useAuthStore } from '@/shared/stores/authStore';
import { changePassword } from '@/features/profile/api/profileApi';
import type { MyProfile } from '@/features/profile/types';

interface Props {
  profile: MyProfile;
}

/**
 * 비밀번호 변경 — AUTH-05 · AUTH-06 · frontend/tabs.md.
 *
 * <p><b>규칙을 먼저 보여준다.</b> 서버의 실패 문구는 코드로만 조회되고 인자 치환이 없어
 * (`ErrorMessages`) *"몇 자 이상"* 을 나를 수 없다 — 규칙 값을 아는 곳은 서버가 함께 내려준
 * `passwordRule` 이고, 그것을 <b>거절당하기 전에</b> 읽게 한다. 세 번 거절당한 사람은
 * 관리자에게 전화한다.
 *
 * <p><b>확인 재입력은 서버로 보내지 않는다</b> — 두 값이 같은지는 화면이 판정한다. 서버는
 * 새 비밀번호 하나만 필요하고, 보내면 왕복 한 번이 그 확인에 쓰인다.
 *
 * <p><b>성공하면 제한 세션을 푼다.</b> 임시 비밀번호나 만료로 들어온 사람이 여기서 바꾸고도
 * 계속 막히면 <i>같은 화면에 갇힌다</i>(체인 #5 는 차단이 아니라 유도다 — backend/security.md).
 */
export function PasswordTab({ profile }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ currentPwd: string; newPwd: string; confirmPwd: string }>();
  const [saving, setSaving] = useState(false);
  const clearPasswordChange = useAuthStore((state) => state.clearPasswordChange);

  const submit = async (values: { currentPwd: string; newPwd: string }) => {
    setSaving(true);
    try {
      await changePassword(values.currentPwd, values.newPwd);
      form.resetFields();
      clearPasswordChange();
      message.success(label(MSG.PROFILE_PWD_DONE));
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const rule = profile.passwordRule;
  const status = statusOf(profile);
  const required = { required: true, message: label(MSG.PROFILE_PWD_REQUIRED) };

  return (
    <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
      {status && <Alert type={status.type} message={status.text} showIcon />}

      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => void submit(values)}
        // 브라우저의 비밀번호 관리자가 계정 칸을 찾지 못해 엉뚱한 곳을 채우는 것을 막는다.
        autoComplete="off"
      >
        <Form.Item name="currentPwd" label={label(MSG.PROFILE_PWD_CURRENT)} rules={[required]}>
          <Input.Password maxLength={100} autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="newPwd"
          label={label(MSG.PROFILE_PWD_NEW)}
          rules={[required]}
          extra={
            <Space direction="vertical" size={0}>
              <Typography.Text type="secondary">
                {label(MSG.PROFILE_PWD_RULE, {
                  minLength: rule.minLength,
                  kinds: rule.requireCharsetKinds,
                })}
              </Typography.Text>
              {/* 0 이면 재사용을 막지 않는다 — 없는 규칙을 안내하지 않는다. */}
              {rule.reuseBlockCount > 0 && (
                <Typography.Text type="secondary">
                  {label(MSG.PROFILE_PWD_RULE_REUSE, { count: rule.reuseBlockCount })}
                </Typography.Text>
              )}
            </Space>
          }
        >
          <Input.Password maxLength={100} autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmPwd"
          label={label(MSG.PROFILE_PWD_CONFIRM)}
          dependencies={['newPwd']}
          rules={[
            required,
            // 서버까지 보내지 않고 여기서 잡는다 — 서버는 이 값을 받지도 않는다.
            ({ getFieldValue }) => ({
              validator: (_, value: string) =>
                !value || getFieldValue('newPwd') === value
                  ? Promise.resolve()
                  : Promise.reject(new Error(label(MSG.PROFILE_PWD_CONFIRM_MISMATCH))),
            }),
          ]}
        >
          <Input.Password maxLength={100} autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>
          {label(MSG.PROFILE_PWD_SUBMIT)}
        </Button>
      </Form>
    </Space>
  );
}

/**
 * 지금 무엇이 문제인가 — 셋 중 하나이며 <b>급한 것부터</b> 본다.
 *
 * <p>임시 비밀번호가 먼저다: 만료 계산과 무관한 <b>독립 조건</b>이며(backend/security.md 체인 #5),
 * 그 상태에서는 남은 날짜를 말해 봐야 뜻이 없다.
 */
function statusOf(profile: MyProfile): { type: 'warning' | 'error' | 'info'; text: string } | null {
  if (profile.pwdInitYn) {
    return { type: 'warning', text: label(MSG.PROFILE_PWD_TEMPORARY) };
  }
  if (profile.pwdExpiresInDays !== null && profile.pwdExpiresInDays < 0) {
    return { type: 'error', text: label(MSG.PROFILE_PWD_EXPIRED) };
  }
  if (profile.pwdExpiresInDays !== null) {
    return {
      type: 'info',
      text: label(MSG.PROFILE_PWD_EXPIRES_IN, { days: profile.pwdExpiresInDays }),
    };
  }
  if (profile.pwdChgDtm) {
    return {
      type: 'info',
      text: label(MSG.PROFILE_PWD_CHANGED_AT, {
        when: dayjs(profile.pwdChgDtm).format('YYYY-MM-DD'),
      }),
    };
  }
  return null;
}
