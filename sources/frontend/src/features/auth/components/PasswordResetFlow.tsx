import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Space, Steps, Typography } from 'antd';
import { ApiError } from '@/shared/api';
import {
  fetchPasswordPolicy,
  saveResetPassword,
  sendResetCode,
  verifyResetCode,
  type PasswordPolicy,
} from '@/features/auth/api/authApi';
import {
  allClientRulesSatisfied,
  evaluateRules,
  type RuleState,
} from '@/features/auth/passwordRules';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';

/** 서버가 *다시 받아라* 라고 말하는 코드 — 화면은 ①로 되돌린다(요건서 §6-5). */
const CODE_EXPIRED = 'err.reset.code-expired';

type Step = 'request' | 'verify' | 'done';

interface Props {
  /** 로그인 폼에서 이어 온 아이디. 잠김 배너에서 들어오면 방금 시도한 값이 있다. */
  initialLoginId?: string;
  /** 로그인 폼으로 — 취소든 완료든 출구는 하나다. */
  onExit: (completed: boolean) => void;
}

/**
 * 분실 비밀번호 재설정 3단계 — AUTH-07 · {@code documents/screen/_standalone/login/requirements.md} §6-3.
 *
 * <p><b>같은 라우트의 단계 전환이다</b>. 라우트를 나누면 뒤로 가기로 ②에 직접 들어올 수
 * 있고, 그 화면은 아무 상태도 없이 열린다 — 코드를 받은 적 없는 사람이 인증번호 칸을 본다.
 *
 * <p><b>인증번호는 메모리에만 둔다.</b> ③이 같은 코드를 다시 실어야 하므로 상태로 갖되
 * `sessionStorage` 에 두지 않는다 — 10분간 계정 하나를 여는 값이고, 새로고침하면 ①부터
 * 다시 하는 것이 맞다.
 *
 * <p><b>재발송 타이머를 화면이 센다.</b> 서버는 언제나 같은 응답을 주며 남은 시간을 알려주지
 * 않는다 — 알려주면 <b>존재하는 계정에만 쿨다운이 걸린다</b>는 사실이 계정 열거의
 * 단서가 된다. 그래서 정책 API 가 <i>간격</i> 만 내려주고 <i>경과</i> 는 여기서 잰다.
 */
export function PasswordResetFlow({ initialLoginId, onExit }: Props) {
  const [step, setStep] = useState<Step>('request');
  const [loginId, setLoginId] = useState(initialLoginId ?? '');
  const [resetCode, setResetCode] = useState('');
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  usePolicy(setPolicy);
  useCountdown(cooldown, setCooldown);

  const startCooldown = useCallback(() => {
    setCooldown(policy?.reset.resendCooldownSeconds ?? 0);
  }, [policy]);

  /** 실패 하나를 배너 한 곳에 낸다 — 필드마다 흩으면 어느 쪽이 틀렸는지 알려주는 꼴이 된다. */
  const fail = (caught: unknown) => {
    const apiError = caught instanceof ApiError ? caught : null;
    setError(apiError?.message ?? null);
    // 만료·시도 초과는 ①로 돌아가야 풀린다. 그 자리에 남겨 두면 사용자는 같은 코드를
    // 계속 넣어 본다.
    if (apiError?.code === CODE_EXPIRED) {
      setResetCode('');
      setStep('request');
    }
  };

  const run = async (action: () => Promise<void>) => {
    setSubmitting(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      fail(caught);
    } finally {
      setSubmitting(false);
    }
  };

  const request = (values: { loginId: string }) =>
    run(async () => {
      await sendResetCode(values.loginId);
      setLoginId(values.loginId);
      setNotice(label(MSG.RESET_SENT));
      startCooldown();
      setStep('verify');
    });

  const resend = () =>
    run(async () => {
      await sendResetCode(loginId);
      setNotice(label(MSG.RESET_SENT));
      startCooldown();
    });

  const verify = (values: { resetCode: string }) =>
    run(async () => {
      await verifyResetCode(loginId, values.resetCode);
      setResetCode(values.resetCode);
      setNotice(null);
      setStep('done');
    });

  const complete = (values: { newPwd: string }) =>
    run(async () => {
      await saveResetPassword(loginId, resetCode, values.newPwd);
      onExit(true);
    });

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ textAlign: 'center', margin: 0 }}>
        {label(MSG.RESET_TITLE)}
      </Typography.Title>

      <Steps
        size="small"
        current={['request', 'verify', 'done'].indexOf(step)}
        items={[
          { title: label(MSG.RESET_STEP_REQUEST) },
          { title: label(MSG.RESET_STEP_VERIFY) },
          { title: label(MSG.RESET_STEP_DONE) },
        ]}
      />

      {error ? <Alert type="error" showIcon title={error} /> : null}
      {/* 발송 안내는 성공을 단정하지 않는다 — 계정이 없어도 같은 문구가 나간다. */}
      {!error && notice ? <Alert type="info" showIcon title={notice} /> : null}

      {step === 'request' ? (
        <RequestStep
          loginId={loginId}
          submitting={submitting}
          onSubmit={(values) => void request(values)}
        />
      ) : null}

      {step === 'verify' ? (
        <VerifyStep
          minutes={policy?.reset.tokenValidMinutes}
          cooldown={cooldown}
          submitting={submitting}
          onSubmit={(values) => void verify(values)}
          onResend={() => void resend()}
        />
      ) : null}

      {step === 'done' ? (
        <DoneStep
          loginId={loginId}
          policy={policy}
          submitting={submitting}
          onSubmit={(values) => void complete(values)}
        />
      ) : null}

      <Button type="link" block onClick={() => onExit(false)}>
        {label(MSG.RESET_BACK_TO_LOGIN)}
      </Button>
    </Space>
  );
}

// ── 단계 ──────────────────────────────────────────────────────────────

function RequestStep({
  loginId,
  submitting,
  onSubmit,
}: {
  loginId: string;
  submitting: boolean;
  onSubmit: (values: { loginId: string }) => void;
}) {
  return (
    <>
      <Typography.Text type="secondary">{label(MSG.RESET_REQUEST_DESC)}</Typography.Text>
      <Form layout="vertical" initialValues={{ loginId }} onFinish={onSubmit} requiredMark={false}>
        <Form.Item
          name="loginId"
          label={label(MSG.LOGIN_ID)}
          rules={[{ required: true, message: label(MSG.LOGIN_ID_REQUIRED) }]}
        >
          <Input autoComplete="username" autoFocus size="large" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
          {label(MSG.RESET_SEND)}
        </Button>
      </Form>
    </>
  );
}

function VerifyStep({
  minutes,
  cooldown,
  submitting,
  onSubmit,
  onResend,
}: {
  minutes?: number;
  cooldown: number;
  submitting: boolean;
  onSubmit: (values: { resetCode: string }) => void;
  onResend: () => void;
}) {
  return (
    <>
      <Typography.Text type="secondary">
        {/* 정책을 못 받았으면 시간을 말하지 않는다 — 숫자를 화면이 지어내지 않는다. */}
        {minutes === undefined ? null : label(MSG.RESET_VERIFY_DESC, { minutes })}
      </Typography.Text>
      <Form layout="vertical" onFinish={onSubmit} requiredMark={false}>
        <Form.Item
          name="resetCode"
          label={label(MSG.RESET_CODE)}
          rules={[{ required: true, message: label(MSG.RESET_CODE_REQUIRED) }]}
        >
          <Input autoComplete="one-time-code" inputMode="numeric" autoFocus size="large" />
        </Form.Item>
        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
            {label(MSG.RESET_VERIFY)}
          </Button>
          <Button block disabled={cooldown > 0 || submitting} onClick={onResend}>
            {cooldown > 0
              ? label(MSG.RESET_RESEND_IN, { seconds: cooldown })
              : label(MSG.RESET_RESEND)}
          </Button>
        </Space>
      </Form>
    </>
  );
}

function DoneStep({
  loginId,
  policy,
  submitting,
  onSubmit,
}: {
  loginId: string;
  policy: PasswordPolicy | null;
  submitting: boolean;
  onSubmit: (values: { newPwd: string }) => void;
}) {
  const [newPwd, setNewPwd] = useState('');
  const states: RuleState[] = evaluateRules(policy?.rules ?? [], newPwd, { loginId });

  return (
    <>
      <Typography.Text type="secondary">{label(MSG.RESET_DONE_DESC)}</Typography.Text>
      <Form layout="vertical" onFinish={onSubmit} requiredMark={false}>
        <Form.Item
          name="newPwd"
          label={label(MSG.RESET_NEW_PWD)}
          rules={[{ required: true, message: label(MSG.RESET_NEW_PWD_REQUIRED) }]}
        >
          <Input.Password
            autoComplete="new-password"
            autoFocus
            size="large"
            onChange={(event) => setNewPwd(event.target.value)}
          />
        </Form.Item>

        <RuleChecklist states={states} />

        <Form.Item
          name="newPwdConfirm"
          label={label(MSG.RESET_NEW_PWD_CONFIRM)}
          dependencies={['newPwd']}
          rules={[
            { required: true, message: label(MSG.RESET_NEW_PWD_REQUIRED) },
            /* 두 값이 같은지는 **화면이 판정한다** — 서버까지 보내면 왕복 한 번이 그 확인에
               쓰이고, 서버는 어차피 새 비밀번호 하나만 필요하다. */
            ({ getFieldValue }) => ({
              validator: (_rule, value: string) =>
                !value || getFieldValue('newPwd') === value
                  ? Promise.resolve()
                  : Promise.reject(new Error(label(MSG.RESET_NEW_PWD_MISMATCH))),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" size="large" />
        </Form.Item>

        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          loading={submitting}
          /* 서버 전용 규칙(NO_REUSE)은 막지 않는다 — 판정할 수 없는 것으로 버튼을 잠그면
             통과할 수 있는 값도 제출되지 않는다. */
          disabled={!allClientRulesSatisfied(states)}
        >
          {label(MSG.RESET_SUBMIT)}
        </Button>
      </Form>
    </>
  );
}

/**
 * 규칙 체크리스트 — <b>문구를 화면이 만들지 않는다</b>. 서버가 완성해 내려준 것을 그대로 쓴다.
 *
 * <p>판정할 수 없는 규칙({@code clientCheckable: false})도 <b>보여준다</b>. 지키라고 말하지
 * 않고 제출 뒤에 거절하면 사용자는 무엇을 고쳐야 하는지 모른다.
 */
function RuleChecklist({ states }: { states: RuleState[] }) {
  if (states.length === 0) return null;
  return (
    <ul style={{ margin: '0 0 16px', paddingInlineStart: 20 }}>
      {states.map(({ rule, satisfied }) => (
        <li key={rule.id}>
          <Typography.Text type={satisfied === false ? 'secondary' : undefined}>
            {rule.message}
          </Typography.Text>
        </li>
      ))}
    </ul>
  );
}

// ── 훅 ────────────────────────────────────────────────────────────────

/**
 * 정책은 <b>한 번</b>만 받는다 — 단계를 오갈 때마다 다시 받을 이유가 없다.
 *
 * <p>실패해도 배너를 띄우지 않는다. 못 받으면 체크리스트가 비고 안내가 시간을 말하지 않을
 * 뿐, <b>재설정 자체는 진행된다</b> — 판정의 원본은 어차피 서버다.
 */
function usePolicy(setPolicy: (policy: PasswordPolicy) => void) {
  useEffect(() => {
    let cancelled = false;
    fetchPasswordPolicy()
      .then((policy) => {
        if (!cancelled) setPolicy(policy);
      })
      .catch(() => {
        /* 규칙 목록 없이도 제출은 된다 — 서버가 판정한다. */
      });
    return () => {
      cancelled = true;
    };
  }, [setPolicy]);
}

/**
 * 1초에 한 번 줄인다. 0 이면 타이머를 걸지 않는다 — 아무 일도 안 하는 인터벌을 남기지 않는다.
 *
 * <p>`setInterval` 이 아니라 <b>매초 새 `setTimeout`</b> 이다. 인터벌로 두면 콜백이 붙든
 * 값을 계속 보게 되어 `ref` 로 최신 값을 날라야 하는데, 그 한 줄이 <b>재발송 버튼이 영원히
 * 잠기는</b> 종류의 버그가 사는 자리다.
 */
function useCountdown(value: number, setValue: (next: number) => void) {
  useEffect(() => {
    if (value <= 0) return undefined;
    const timer = window.setTimeout(() => setValue(value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [value, setValue]);
}
