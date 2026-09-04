import { Alert, Empty, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { getMyLoginHistory } from '@/features/profile/api/profileApi';
import { useLoad } from '@/shared/hooks/useLoad';
import type { MyLoginRecord } from '@/features/profile/types';

interface Props {
  /** 이 탭이 화면에 있는가 — 열릴 때 한 번만 읽는다(main-shell.md §8). */
  active: boolean;
}

/**
 * 내 로그인 이력 — LOG-02 · main-shell.md §8.
 *
 * <p><b>보안 기능이다.</b> 본인이 모르는 접속을 발견하는 유일한 경로이므로 관리자 화면의
 * 축소판이 아니라 <b>본인 것만</b> 보여준다.
 *
 * <p><b>실패 기록을 포함한다.</b> 누군가 내 계정으로 시도했다는 사실이 그 자체로 신호이며,
 * 성공만 보이면 이 탭이 있을 이유가 없다.
 *
 * <p><b>결과 코드를 그대로 쓰지 않는다.</b> {@code FAIL_PWD} 같은 문자열은 45 §5.1 의 것이지
 * 사용자가 읽을 말이 아니다. 세 갈래(성공 · 실패 · 종료)로 접고 원래 코드는 툴팁에 둔다 —
 * 운영 문의에서 그 값이 필요해질 수 있다.
 */
export function LoginHistoryTab({ active }: Props) {
  const { data, error, loading } = useLoad(active, getMyLoginHistory);

  if (error) {
    return <Alert type="error" message={error} showIcon />;
  }

  return (
    <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
      <Typography.Text type="secondary">{label(MSG.PROFILE_HISTORY_NOTE)}</Typography.Text>
      <Table<MyLoginRecord>
        rowKey={(row) => `${row.creDtm}/${row.loginRsltCd}`}
        loading={loading}
        dataSource={data ?? []}
        columns={columns()}
        pagination={false}
        // 30건이 한 번에 온다 — 페이징 대신 스크롤이다(LoginHistoryService.MY_HISTORY_LIMIT).
        scroll={{ y: 320 }}
        locale={{
          emptyText: <Empty description={label(MSG.PROFILE_HISTORY_EMPTY)} />,
        }}
      />
    </Space>
  );
}

function columns(): ColumnsType<MyLoginRecord> {
  return [
    {
      title: label(MSG.PROFILE_HISTORY_WHEN),
      dataIndex: 'creDtm',
      width: 170,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: label(MSG.PROFILE_HISTORY_RESULT),
      dataIndex: 'loginRsltCd',
      width: 90,
      render: (code: string) => {
        const shown = outcome(code);
        // 원래 코드는 툴팁에 — 화면의 말과 이력의 값이 둘 다 필요하다.
        return (
          <Tooltip title={code}>
            <Tag color={shown.color}>{shown.text}</Tag>
          </Tooltip>
        );
      },
    },
    { title: label(MSG.PROFILE_HISTORY_IP), dataIndex: 'clientIp', width: 130 },
    {
      title: label(MSG.PROFILE_HISTORY_AGENT),
      dataIndex: 'userAgent',
      /*
        <b>{@code showTitle} 을 끈다.</b> 판의 {@code ellipsis: true} 는 잘린 칸에
        <b>브라우저 기본 툴팁</b>({@code title} 속성)을 함께 붙인다 — 아래 툴팁과 겹쳐
        <b>같은 자리에서 두 개가 뜨고</b> 하나는 셸의 다른 툴팁과 생김새가 다르다
        (2026-08-30 실물).

        자르는 것은 판에게 맡기고 <b>말하는 것은 우리 툴팁 하나</b>다.
      */
      ellipsis: { showTitle: false },
      /*
        <b>글자가 아니라 칸을 잡는다.</b> 툴팁은 자식 요소의 상자에 붙는데, 문자열을 그대로
        주면 판이 인라인 {@code span} 으로 싸고 <b>그 상자는 잘리기 전의 폭</b>이다 —
        {@code overflow: hidden} 은 그리는 것만 자를 뿐 상자를 줄이지 않는다. 그래서 툴팁이
        <b>모달 밖 오른쪽 멀리</b> 떴다(2026-08-30 실물).

        블록으로 만들고 자르기를 여기서 하면 상자가 칸과 같아진다. {@code topLeft} 는 긴
        글의 툴팁이 <b>왼쪽 끝에서 시작</b>하게 해 읽는 자리를 고정한다.
      */
      render: (value: string | null) => (
        <Tooltip title={value} placement="topLeft">
          <span style={ELLIPSIS}>{value}</span>
        </Tooltip>
      ),
    },
  ];
}

/** 툴팁이 붙을 상자를 <b>칸과 같게</b> 만든다 — 자르기를 이 요소가 한다. */
const ELLIPSIS: React.CSSProperties = {
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/** 세션이 끝난 기록은 실패가 아니다 — 빨갛게 칠하면 매일의 로그아웃이 사고로 보인다. */
const ENDED = ['LOGOUT', 'SESSION_TIMEOUT', 'FORCED_LOGOUT', 'SESSION_EVICTED'];

function outcome(code: string): { color: string; text: string } {
  if (code === 'SUCCESS') {
    return { color: 'green', text: label(MSG.PROFILE_HISTORY_SUCCESS) };
  }
  if (ENDED.includes(code)) {
    return { color: 'default', text: label(MSG.PROFILE_HISTORY_ENDED) };
  }
  return { color: 'red', text: label(MSG.PROFILE_HISTORY_FAILURE) };
}
