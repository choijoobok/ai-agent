// @feat FEAT-501
import { useState } from 'react';
import { Alert, Button, Form, Input, Modal, Space, Typography } from 'antd';
import { ApiError } from '@/shared/api';
import { login } from '@/modules/system/public/auth/api/authApi';
import { useAuthStore } from '@/shared/stores/authStore';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { useMessageStore } from '@/shared/i18n/messageStore';
import { useCodeStore } from '@/shared/code/codeStore';

interface Props {
  /** 401 응답이 실어 온 사유 문구. 세션 만료와 동시 접속으로 밀림이 여기서 갈린다. */
  reason?: string;
  onRecovered: () => void;
  onGiveUp: () => void;
}

/**
 * 재인증 모달 — backend/session.md ·.
 *
 * <p><b>만료는 로그아웃이 아니다.</b> 자리를 잠깐 비운 것과 업무를 끝낸 것은 다른데, 401 을
 * 로그아웃과 같게 처리하면 열려 있던 탭 20개와 <b>입력 중이던 값</b>이 사라진다.
 *
 * <p><b>비밀번호만 받는다.</b> ID 가 다르면 탭을 유지할 수 없다 — 열린 탭은 이전 사용자의
 * 유효 권한으로 열린 화면이고 새 사용자가 그 권한을 갖는다는 보장이 없다. ID 를 고정하면
 * 이 모달의 의미가 <i>"같은 사람의 세션 복구"</i> 로 좁혀지고 탭 유지가 정당해진다.
 *
 * <p><b>닫기(✕)를 두지 않는다.</b> 출구는 셋뿐이다 — 재인증 · 다른 계정으로 · (불가 시)
 * 로그아웃. 닫을 수 있으면 아무것도 동작하지 않는 셸이 남는다.
 *
 * <p><b>배경을 블러한다.</b> 만료된 화면이 그대로 보이면 자리를 비운 사이 데이터가 노출된다 —
 * 다만 <b>탭 제목은 남으므로</b> 완전한 방어가 아니며 그것은 OS 잠금의 몫이다(backend/session.md).
 */
export function ReauthModal({ reason, onRecovered, onGiveUp }: Props) {
  const user = useAuthStore((state) => state.user);
  const signIn = useAuthStore((state) => state.signIn);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm<{ password: string }>();

  const submit = async ({ password }: { password: string }) => {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await login({ loginId: user.userId, password });

      // 개발도구로 다른 ID 를 보낼 수 있다 — 막지 않되(권한 상승이 아니다) 값이 다르면
      // 전체 재로드한다. 값싸고 실수를 잡는다(backend/session.md).
      if (session.user.userId !== user.userId) {
        window.location.reload();
        return;
      }
      signIn(session);
      await useMessageStore.getState().syncWithSession(
        session.user.localeCd,
        session.cacheVersions?.message,
      );
      // 코드 캐시도 같은 자리에서 맞춘다 — 왕복이 없다(sys/code.md). 버전이 같으면 아무 일도
      // 하지 않으므로, 로그인할 때마다 코드를 다시 받지 않는다.
      useCodeStore.getState().syncWithSession(session.cacheVersions?.code);
      form.resetFields();
      onRecovered();
    } catch (caught) {
      // 재인증 불가(잠김·비활성·기간 만료·권한 공집합)도 여기로 온다. 사용자가 할 수 있는
      // 것은 로그아웃뿐이며 그 버튼은 아래에 있다.
      setError(caught instanceof ApiError ? caught.message : label(MSG.REAUTH_RETRY));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title={label(MSG.REAUTH_TITLE)}
      closable={false}
      mask={{ closable: false }}
      keyboard={false}
      footer={null}
      // 배경 블러 — 열려 있던 탭과 입력값은 이 뒤에 그대로 살아 있다.
      styles={{ mask: { backdropFilter: 'blur(6px)' } }}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        {reason ? <Alert type="warning" showIcon title={reason} /> : null}
        <Typography.Text type="secondary">{label(MSG.REAUTH_DESC)}</Typography.Text>

        {/* 폼의 onFinish 를 쓴다 — Enter 로 제출되는 것이 antd 폼의 기본 동작이며,
            onPressEnter 를 손으로 붙이면 그것만 동작하지 않는 조합이 생긴다. */}
        <Form form={form} layout="vertical" onFinish={(values) => void submit(values)}>
          <Form.Item label={label(MSG.REAUTH_LOGIN_ID)}>
            <Input value={user?.userId ?? ''} readOnly disabled />
          </Form.Item>
          <Form.Item
            name="password"
            label={label(MSG.LOGIN_PASSWORD)}
            rules={[{ required: true, message: label(MSG.LOGIN_PASSWORD_REQUIRED) }]}
            validateStatus={error ? 'error' : undefined}
            help={error}
          >
            <Input.Password autoFocus />
          </Form.Item>

          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            {/* 다른 계정으로 가려면 정식 로그아웃 정리를 거친다. */}
            <Button type="link" onClick={onGiveUp} style={{ paddingInline: 0 }}>
              {label(MSG.REAUTH_OTHER_ACCOUNT)}
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {label(MSG.REAUTH_SUBMIT)}
            </Button>
          </Space>
        </Form>
      </Space>
    </Modal>
  );
}
