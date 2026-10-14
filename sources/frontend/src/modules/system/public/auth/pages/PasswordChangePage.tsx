// @feat FEAT-501
import { useEffect, useState } from 'react';
import { Alert, Button, Space, Spin, Typography } from 'antd';
import { fetchPasswordPolicy, logout, type PasswordPolicy } from '@/modules/system/public/auth/api/authApi';
import { PasswordChangeForm } from '@/modules/system/shared/components/PasswordChangeForm';
import { useAuthStore } from '@/shared/stores/authStore';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';

/** 초기화·만료로 제한된 세션의 유일한 업무 진입 경로다. */
export function PasswordChangePage() {
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const signOut = useAuthStore((state) => state.signOut);

  useEffect(() => {
    let cancelled = false;
    fetchPasswordPolicy()
      .then((value) => { if (!cancelled) setPolicy(value); })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => { cancelled = true; };
  }, [attempt]);

  const leave = async () => {
    setLeaving(true);
    try {
      await logout();
      signOut();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLeaving(false);
    }
  };

  const logoutAction = <Button loading={leaving} onClick={() => void leave()}>{label(MSG.SHELL_LOGOUT)}</Button>;

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3}>{label(MSG.SESSION_PASSWORD_CHANGE_TITLE)}</Typography.Title>
      <Alert type="warning" showIcon title={label(MSG.SESSION_PASSWORD_CHANGE_DESC)} />
      {error && <Alert type="error" showIcon title={error} />}
      {policy ? <PasswordChangeForm rules={policy.rules} secondaryAction={logoutAction} /> : error ? (
        <Button onClick={() => { setError(null); setAttempt((value) => value + 1); }}>
          {label(MSG.REAUTH_RETRY)}
        </Button>
      ) : <Spin />}
      {!policy && logoutAction}
    </Space>
  );
}
