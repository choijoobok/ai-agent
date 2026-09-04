import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, App, Button, Modal, Progress, Tooltip, Typography, theme } from 'antd';
import { LoadingOutlined, WarningOutlined } from '@ant-design/icons';
import { get, ApiError } from '@/shared/api';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { PROGRESS_ENDPOINTS } from '@/shared/progress/api/endpoints';
import { ProgressContextProvider } from '@/shared/progress/progressContext';
import { pollJob } from '@/shared/progress/poll';
import { splitElapsed } from '@/shared/progress/elapsed';
import type { JobProgress, OpenProgress, ProgressOptions } from '@/shared/progress/types';

/**
 * 진행률 창이 열리는 <b>단 한 자리</b> — backend/crosscutting.md · playbook/INDEX.md.
 *
 * <p><b>창을 닫아도 작업은 돈다.</b> 사용자를 붙잡아 두지 않는 것이 이 기능의 요점이며
 * (붙잡을 것이면 동기 호출로 충분했다), 그래서 <b>폴링은 창이 아니라 이 호스트가</b>
 * 들고 있다 — 창에 두면 닫는 순간 폴링이 죽어 {@code onDone} 이 오지 않고, 목록은
 * <b>갱신되지 않은 채</b> 남는다.
 *
 * <h2>닫는 것은 <b>접는 것</b>이다 (2026-09-02 — playbook/INDEX.md 을 닫으면서)</h2>
 *
 * <p>여기가 한 번 어긋나 있었다. 계약은 <i>"모달을 닫아도 약속은 계속 산다"</i> 였는데
 * ({@code types.ts}) 닫기가 폴링의 세대를 올려 <b>루프를 취소</b>했다 — 그래서 닫으면
 * {@code onDone} 이 오지 않고 <b>목록이 갱신되지 않았다</b>. 그 고장에는 오류도, 실패한
 * 작업도 없다: 사용자가 보는 것은 <i>재계산을 눌렀는데 금액이 그대로</i> 뿐이라 화면을
 * 의심할 근거가 하나도 없다. {@code ProgressHost.test.tsx} 가 그 자리를 잡고 있다.
 *
 * <p>그래서 닫기는 <b>둘로 갈린다</b> — 도는 중이면 <b>접고</b>(폴링은 그대로), 끝났으면
 * <b>버린다</b>(볼 것이 남아 있지 않다). 접힌 것은 표시로 남아 다시 열린다.
 *
 * <h2>접힌 표시는 <b>셸에 산다</b></h2>
 *
 * <p>화면(탭) 어딘가가 아니라 여기인 것은 <b>작업이 화면보다 오래 살기</b> 때문이다 —
 * 사용자는 재계산을 걸어 두고 다른 메뉴로 간다. 화면에 두면 그 순간 표시가 사라지고,
 * 그것은 이 항목이 걱정하던 <i>닫는 순간 작업이 사라진 것처럼 보인다</i> 와 같은 자리다.
 *
 * <p><b>{@code jobId} 하나만 돈다.</b> 오래 걸리는 실행을 둘 겹쳐 시작할 수 있게 두면
 * 창 하나에 무엇을 그릴지가 곧 문제가 되고, 그리드는 <b>이미 실행 중복을 막는다</b>
 * ({@code inFlight}). 그래도 겹쳐 오면 앞의 것을 <b>보는 것만</b> 그만둔다 — 그 작업은
 * 서버에서 계속 돈다.
 */
export function ProgressHost({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<Job | null>(null);
  const { message } = App.useApp();
  /*
    <b>진행 중인 폴링의 취소 신호.</b> 다음 작업이 오면 올린다 — 훅이 아니라 ref 인 것은
    폴링 루프가 <b>렌더 밖</b>에서 이 값을 읽기 때문이다.

    <b>닫기는 이것을 건드리지 않는다</b>(위 주석). 창과 폴링은 수명이 다르다.
  */
  const generation = useRef(0);

  const open = useCallback<OpenProgress>((jobId, options) => {
    const mine = ++generation.current;
    /*
      <b>창이 뜬 시각을 여기서 잡는다</b>(backend/crosscutting.md). 경과 시간의 기준이며, 서버의
      {@code CRE_DTM} 을 쓰지 않는 이유는 {@code elapsed.ts} 가 적었다 — 시계가 어긋난
      만큼 틀리고, <b>폴링이 실패하는 동안 멈춘다</b>: 그 구간이 바로 경과 시간이 가장
      필요한 때다.
    */
    setJob({
      jobId,
      options,
      progress: null,
      error: null,
      folded: false,
      openedAt: Date.now(),
    });

    return new Promise<void>((resolve) => {
      void (async () => {
        try {
          const settled = await pollJob(
            jobId,
            {
              fetchOne: (id) => get<JobProgress>(PROGRESS_ENDPOINTS.getOne(id)),
              sleep: (ms) => new Promise((wake) => setTimeout(wake, ms)),
              // 다음 작업이 왔으면 이 루프는 <b>보는 것을 그만둔다</b>. 창을 닫은 것과 다르다.
              cancelled: () => generation.current !== mine,
              /*
                <b>세션 만료는 실패가 아니다</b>(playbook/INDEX.md). 재인증 모달이 복구하면 다음
                폴링이 그냥 나간다 — 여기서 실패로 세면 사람이 비밀번호를 치는 동안
                예산이 바닥나고, <b>멀쩡히 도는 작업을 놓친다</b>.
              */
              isUnauthenticated: (error) =>
                error instanceof ApiError && error.status === 401,
            },
            (progress) => {
              if (generation.current !== mine) return;
              setJob((current) => (current ? { ...current, progress } : current));
            },
          );

          if (generation.current !== mine) return;
          /*
            <b>창이 접혀 있어도 부른다.</b> 부르는 쪽이 기다리는 것은 <i>작업의 끝</i>이지
            <i>창이 열려 있는 동안</i>이 아니다 — 접힌 사이에 끝난 작업의 목록이 갱신되지
            않으면, 사용자는 <b>돌지 않은 작업</b>과 구별할 수 없다.
          */
          if (settled?.jobStatCd === 'DONE') options.onDone?.();
          if (settled?.jobStatCd === 'FAILED') options.onFail?.(settled.errMsg ?? '');
        } catch (error) {
          /*
            <b>못 보는 것이지 실패한 것이 아니다.</b> {@code onFail} 을 부르지 않는 것이
            결정이다 — 그 콜백은 <i>작업이 실패했다</i> 는 뜻이고, 여기서는 작업이
            <b>여전히 돌고 있을 수 있다</b>. 지어내면 사용자가 다시 실행한다.
          */
          if (generation.current !== mine) return;
          setJob((current) => (current ? { ...current, error: describe(error) } : current));
        } finally {
          if (generation.current === mine) resolve();
        }
      })();
    });
  }, []);

  /*
    <b>성공은 목록이 증거다</b> — {@code onDone} 이 재조회했다. 그래서 접힌 표시는
    사라지고, 사라졌다는 것만으로는 <i>내가 놓쳤나</i> 가 되므로 토스트가 한 번 말한다.

    <b>실패는 여기서 지우지 않는다</b>(아래 {@link ProgressChip} 이 남는다). 사유가
    <b>다른 어디에도 없기</b> 때문이며, 지우면 그 작업은 <i>하지 않은 채로 잊힌다</i>.
  */
  useEffect(() => {
    if (!job?.folded || job.progress?.jobStatCd !== 'DONE') return;
    message.success(label(MSG.PROGRESS_DONE, { title: label(job.options.title) }));
    setJob(null);
  }, [job, message]);

  const close = useCallback(() => {
    setJob((current) => {
      if (!current) return null;
      // 끝났거나 더 볼 수 없게 됐다 — 접어 두면 <i>아직 돈다</i> 로 읽히는 표시가 남는다.
      if (!alive(current)) return null;
      // 보는 것만 접는다 — 폴링도 작업도 계속 간다(playbook/INDEX.md).
      return { ...current, folded: true };
    });
  }, []);

  const reopen = useCallback(() => {
    setJob((current) => (current ? { ...current, folded: false } : current));
  }, []);

  return (
    <ProgressContextProvider value={open}>
      {children}
      {job && !job.folded && <ProgressModal job={job} onClose={close} />}
      {job?.folded && <ProgressChip job={job} onOpen={reopen} />}
    </ProgressContextProvider>
  );
}

interface Job {
  jobId: string;
  options: ProgressOptions;
  progress: JobProgress | null;
  /** <b>진행률을 못 본다</b> — 작업의 실패와 다른 것이다(위 주석). */
  error: string | null;
  /** 창을 닫았다 — <b>폴링은 살아 있다</b>. */
  folded: boolean;
  /**
   * 창을 연 시각 — 경과 시간의 기준이다.
   *
   * <p><b>접었다 다시 열어도 그대로다.</b> 접는 것은 <i>보는 것</i>을 그만두는 일이지
   * 작업이 다시 시작되는 것이 아니므로, 다시 열었을 때 {@code 0분 00초} 가 보이면
   * <b>없던 사실</b>을 말한 셈이 된다.
   */
  openedAt: number;
}

/** 아직 <b>볼 것이 남았는가</b> — 폴링이 살아 있고 작업이 끝나지 않았다. */
function alive(job: Job): boolean {
  return job.error === null && (job.progress === null || job.progress.jobStatCd === 'RUNNING');
}

/**
 * 완료율 — <b>{@code null} 이면 그런 것이 없다</b>(sys/batch.md).
 *
 * <p>전체를 모르면 나눌 수가 없다. 0 으로 치환하면 <b>0% 가 <i>아직 시작 안 함</i>으로
 * 읽히고</b>, 0 으로 나누면 화면에 {@code NaN%} 이 뜬다.
 *
 * <p><b>막대와 글자가 같은 값을 써야 한다</b> — 따로 세면 반내림이 갈려 <i>막대는 24%,
 * 글자는 25%</i> 가 되고, 그 한 자리 차이는 <b>화면이 무엇을 세는지</b>를 의심하게 만든다.
 */
function percentOf(progress: JobProgress | null): number | null {
  if (progress === null || progress.totCnt === null || progress.totCnt <= 0) return null;
  return Math.floor((progress.curCnt * 100) / progress.totCnt);
}

/**
 * 창이 뜬 지 지난 시간 — 1초마다 다시 그린다.
 *
 * <p><b>끝나면 멈춘다.</b> 그 자리에 남은 숫자가 곧 <i>이 작업에 걸린 시간</i>이며,
 * 계속 흐르게 두면 그 사실이 1초 만에 사라진다.
 *
 * <p><b>멈추는 방법이 <i>안 재는 것</i>이다.</b> 시각을 tick 콜백에서만 읽으므로
 * ({@code setInterval} 이 멈추면 값도 멈춘다) 끝난 뒤에 이 창이 어떤 이유로 다시 그려져도
 * 숫자가 흐르지 않는다 — 렌더에서 {@code Date.now()} 를 읽으면 20초 걸린 작업의 창을
 * 5분 열어 둔 것만으로 <b>5분 걸렸다</b>가 된다.
 *
 * <p><b>그 대가는 마지막 1초 미만이다.</b> 끝난 순간이 마지막 tick 과 어긋난 만큼 모자라게
 * 굳는데, 이 창의 숫자는 <i>기다릴까 접을까</i> 를 위한 것이라 초의 반올림이 걸린 결정이
 * 없다 — 대신 <b>지어낸 사실이 없는 쪽</b>을 고른다.
 */
function useElapsed(openedAt: number, running: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  return now - openedAt;
}

/**
 * 접힌 진행률 — playbook/INDEX.md.
 *
 * <p><b>이것이 없으면 닫기가 곧 잊기다.</b> 작업은 서버에서 계속 돌지만 화면에 그 사실이
 * 아무 데도 없어, 사용자가 하는 일은 <b>같은 실행을 한 번 더</b>가 된다.
 *
 * <p><b>화면을 밀지 않는다</b> — 떠 있는다({@code AutoHideEdge} 와 같은 이유다. 미는 것은
 * 그리드의 높이를 다시 계산하게 만들고, 그 흔들림은 진행률과 아무 상관이 없다).
 */
function ProgressChip({ job, onOpen }: { job: Job; onOpen: () => void }) {
  const { token } = theme.useToken();
  const failed = job.progress?.jobStatCd === 'FAILED';
  const unreachable = job.error !== null;
  const percent = percentOf(job.progress);

  return (
    <Tooltip title={label(MSG.PROGRESS_REOPEN)}>
      <Button
        onClick={onOpen}
        // 도는 중에는 <b>움직이는 것</b>이 하나 있어야 한다 — 정지한 표시는 멈춘 작업이다.
        icon={failed || unreachable ? <WarningOutlined /> : <LoadingOutlined />}
        danger={failed}
        style={{
          position: 'fixed',
          insetInlineEnd: token.marginLG,
          insetBlockEnd: token.marginLG,
          /*
            모달(1000)보다 아래다 — 접혀 있을 때만 그리므로 진행률 창과 겹칠 일은 없지만,
            <b>다른 모달</b>이 뜬 위로 이것이 올라오면 그 창의 버튼을 가린다.
          */
          zIndex: 900,
          boxShadow: token.boxShadowSecondary,
        }}
      >
        {/* 이름이 없으면 <i>무엇이 도는지</i> 를 말하지 못한다 — 실행의 이름 그대로다. */}
        {label(job.options.title)}
        {percent !== null && !failed ? ` ${percent}%` : ''}
      </Button>
    </Tooltip>
  );
}

function ProgressModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const { progress } = job;
  const failed = progress?.jobStatCd === 'FAILED';
  const done = progress?.jobStatCd === 'DONE';

  /*
    <b>전체를 모르면 불확정 막대다</b>(sys/batch.md). 0 으로 치환하면 {@code 0/0} 이라
    <i>완료</i> 로 보이고, 그 화면은 <b>아직 도는 작업을 끝난 것</b>으로 말한다.
  */
  const percent = percentOf(progress);
  const known = percent !== null;
  // 끝났으면 멈춘 숫자가 곧 <b>걸린 시간</b>이다.
  const elapsed = useElapsed(job.openedAt, !done && !failed);

  return (
    <Modal
      open
      title={label(job.options.title)}
      onCancel={onClose}
      // 닫는 것이 유일한 버튼이다 — 취소가 아니다: 도는 중이면 <b>접고</b>, 끝났으면 버린다.
      footer={null}
      closable
      destroyOnHidden
    >
      {/*
        <b>소제목 — 지금 어느 구간인가</b>(서버가 정한다). 제목은 그 실행의 이름이라
        50행을 도는 동안 한 글자도 바뀌지 않으므로, 행이 넘어가고 있다는 사실을 말하는
        것은 이 줄뿐이다.

        <b>메시지 키가 아니다</b> — 서버가 문구를 완성한다(backend/packages.md). 업무 데이터가
        섞이는 값이라(<i>주문 A-1023</i>) 화면이 조립할 수 있는 것이 아니다.
      */}
      {progress?.subTitle && (
        <Typography.Paragraph strong ellipsis={{ rows: 2 }}>
          {progress.subTitle}
        </Typography.Paragraph>
      )}
      <Progress
        percent={done ? 100 : (percent ?? 0)}
        status={failed ? 'exception' : done ? 'success' : 'active'}
        // 불확정이면 숫자를 내지 않는다 — 0% 가 <i>아직 시작 안 함</i> 으로 읽힌다.
        showInfo={known || done || failed}
      />
      {/*
        <b>건수와 완료율, 그리고 경과 시간이 한 줄이다.</b> 셋이 같은 질문에 답하기
        때문이다 — <i>기다릴까 접을까</i>. 퍼센트만으로는 그 결정을 할 수 없고(3초 지난
        24% 와 5분 지난 24% 는 정반대다), 경과 시간만으로도 할 수 없다.

        <b>경과 시간은 진행률이 없어도 있다.</b> 첫 폴링이 오기 전에도, 폴링이 실패해
        멈춰 있는 동안에도 이 숫자는 흐른다 — 그 구간에 화면이 <b>아무것도 말하지 않는
        것</b>이 가장 나쁘다.
      */}
      <Typography.Paragraph type="secondary">
        {progress && `${countText(progress, percent)} · `}
        {label(MSG.PROGRESS_ELAPSED, splitElapsed(elapsed))}
      </Typography.Paragraph>
      {/*
        <b>지금 무엇을 하는 중인가</b>(playbook/INDEX.md) — 퍼센트만 있으면 <i>멈춘 것</i>과
        <i>느린 것</i>을 구별할 수 없다.
      */}
      {progress?.stepMsg && (
        <Typography.Paragraph>{progress.stepMsg}</Typography.Paragraph>
      )}
      {failed && (
        <Alert
          type="error"
          showIcon
          message={label(MSG.PROGRESS_FAILED)}
          // 서버가 완성한 사유 그대로다 — 스택은 서버 로그가 갖는다(backend/security.md).
          description={progress?.errMsg ?? undefined}
        />
      )}
      {job.error !== null && (
        <Alert
          type="warning"
          showIcon
          // <b>작업이 실패했다고 말하지 않는다</b> — 우리가 못 보는 것이다.
          message={label(MSG.PROGRESS_UNREACHABLE)}
          description={job.error}
        />
      )}
      {!done && !failed && (
        <Typography.Paragraph type="secondary">
          {label(MSG.PROGRESS_BACKGROUND)}
        </Typography.Paragraph>
      )}
    </Modal>
  );
}

/**
 * 몇 건 중 몇 건이고 몇 퍼센트인가 — <b>전체를 모르면 문구가 갈린다</b>(sys/batch.md).
 *
 * <p>그때 {@code {cur} / {tot}} 을 쓸 수 없는데, 그렇다고 <b>줄을 없애면</b> 창에 도는
 * 막대만 남아 <i>멈춘 것</i>과 구별되지 않는다 — 건수라도 올라가는 것이 돌고 있다는
 * 유일한 증거다.
 *
 * <p><b>천 단위를 끊는다.</b> 이 자리의 숫자는 수천에서 수십만이고, {@code 128000} 은
 * 눈이 자릿수를 세어야 읽힌다.
 */
function countText(progress: JobProgress, percent: number | null): string {
  const cur = progress.curCnt.toLocaleString();
  if (percent === null || progress.totCnt === null) {
    return label(MSG.PROGRESS_COUNT_UNKNOWN, { cur });
  }
  return label(MSG.PROGRESS_COUNT, { cur, tot: progress.totCnt.toLocaleString(), percent });
}

/** 화면에 그대로 보이는 줄 — 서버가 문구를 완성한다(backend/packages.md). */
function describe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : String(error);
}
