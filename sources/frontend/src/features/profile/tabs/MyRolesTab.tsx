import { Alert, Divider, Empty, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { getMyRoles } from '@/features/profile/api/profileApi';
import { useLoad } from '@/shared/hooks/useLoad';
import type { MyMenuGrant, MyRoleGrant } from '@/features/profile/types';

interface Props {
  active: boolean;
}

/**
 * 표 하나의 최대 높이 — <b>한 탭에 표가 둘</b>이라 로그인 이력(320)보다 낮다.
 *
 * <p>없으면 행이 느는 만큼 <b>모달이 세로로 자란다.</b> 판은 넘친 모달을 바깥에서
 * 스크롤시키므로 제목과 탭이 위로 밀려 올라가고, 표가 둘이라 <b>아래 표는 더 멀어진다</b> —
 * 개인 예외가 많은 사람일수록 그것을 보기 어려워지는데 그 사람이야말로 볼 이유가 있다
 * (2026-08-30).
 *
 * <p><b>짧은 목록은 짧게 남는다</b> — 판의 {@code scroll.y} 는 고정 높이가 아니라
 * 최대 높이다.
 */
const TABLE_MAX_HEIGHT = 240;

/**
 * 내 역할 — AUTHZ-04 · main-shell.md §8. <b>읽기 전용이다.</b>
 *
 * <p><b>있으면 권한 문의가 줄어든다.</b> *"왜 이 메뉴가 안 보이나"* 를 스스로 확인할 곳이
 * 없으면 그 물음은 전부 관리자에게 간다. 그래서 <b>만료된 부여도 보여준다</b> — 감추면
 * *"어제까지 되던 것이 왜 안 되나"* 에 답할 것이 없어지고, 그 답이 이 탭의 존재 이유다.
 *
 * <p><b>역할과 개인 예외를 한 표로 합치지 않는다</b>(42 §6). 출처가 다르고 고치는 사람이
 * 다르며, 합치면 *"이건 누구한테 말해야 하나"* 가 사라진다.
 *
 * <p><b>기준일을 밝힌다.</b> 유효 판정은 업무 시간대의 오늘로 하며 브라우저의 오늘이
 * 아니다(40 §4.3) — 자정 전후에 <i>왜 만료로 보이는지</i> 를 설명할 수 있어야 한다.
 */
export function MyRolesTab({ active }: Props) {
  const { data, error, loading } = useLoad(active, getMyRoles);

  if (error) {
    return <Alert type="error" message={error} showIcon />;
  }

  return (
    <Space direction="vertical" size="small" style={{ display: 'flex' }}>
      <Typography.Text type="secondary">{label(MSG.PROFILE_GRANTS_NOTE)}</Typography.Text>

      <Divider titlePlacement="left" style={{ margin: '4px 0' }}>
        {label(MSG.PROFILE_ROLES_TITLE)}
      </Divider>
      <Table<MyRoleGrant>
        rowKey="roleId"
        loading={loading}
        dataSource={data?.roles ?? []}
        columns={roleColumns(data?.businessToday)}
        pagination={false}
        scroll={{ y: TABLE_MAX_HEIGHT }}
        locale={{ emptyText: <Empty description={label(MSG.PROFILE_ROLES_EMPTY)} /> }}
      />

      <Divider titlePlacement="left" style={{ margin: '4px 0' }}>
        {label(MSG.PROFILE_GRANTS_TITLE)}
      </Divider>
      <Table<MyMenuGrant>
        rowKey={(row) => `${row.menuCd}/${row.actionCd}`}
        loading={loading}
        dataSource={data?.grants ?? []}
        columns={grantColumns(data?.businessToday)}
        pagination={false}
        scroll={{ y: TABLE_MAX_HEIGHT }}
        locale={{ emptyText: <Empty description={label(MSG.PROFILE_GRANTS_EMPTY)} /> }}
      />

      {data && (
        <Typography.Text type="secondary">
          {label(MSG.PROFILE_BASIS_DATE, { date: data.businessToday })}
        </Typography.Text>
      )}
    </Space>
  );
}

function roleColumns(businessToday: string | undefined): ColumnsType<MyRoleGrant> {
  return [
    {
      title: label(MSG.PROFILE_ROLE_NM),
      dataIndex: 'roleNm',
      // 설명은 있으면 아래 줄로 — 역할 이름만으로는 무엇인지 모르는 경우가 많다.
      render: (roleNm: string, row) => (
        <Space direction="vertical" size={0}>
          <span>{roleNm}</span>
          {row.roleDesc && <Typography.Text type="secondary">{row.roleDesc}</Typography.Text>}
        </Space>
      ),
    },
    {
      title: label(MSG.PROFILE_ROLE_PERIOD),
      key: 'period',
      width: 200,
      render: (_, row) => period(row.validFromDt, row.validToDt),
    },
    {
      title: label(MSG.PROFILE_ROLE_STATE),
      key: 'state',
      width: 110,
      render: (_, row) => stateTag(row, businessToday),
    },
  ];
}

function grantColumns(businessToday: string | undefined): ColumnsType<MyMenuGrant> {
  return [
    // 이름이 아니라 메시지 키다(`menu.{MENU_CD}`) — 43 §3.
    { title: label(MSG.PROFILE_GRANT_MENU), dataIndex: 'menuNm', render: (key: string) => label(key) },
    {
      title: label(MSG.PROFILE_GRANT_ACTION),
      dataIndex: 'actionCd',
      width: 90,
      render: (action: MyMenuGrant['actionCd']) => label(ACTION_LABEL[action]),
    },
    {
      title: label(MSG.PROFILE_ROLE_PERIOD),
      key: 'period',
      width: 200,
      render: (_, row) => period(row.validFromDt, row.validToDt),
    },
    // 사유는 부여할 때 필수다(42 §6) — 받은 사람이 볼 수 없으면 그 마찰이 기록으로만 남는다.
    {
      title: label(MSG.PROFILE_GRANT_REASON),
      dataIndex: 'grantRsn',
      // 브라우저 기본 툴팁(`title`)을 쓰지 않는다 — 셸의 다른 툴팁과 모양이 다르다.
      ellipsis: { showTitle: false },
      // 툴팁이 붙을 상자를 칸과 같게 만든다 — 문자열을 그대로 주면 잘리기 전의 폭에 붙어
      // 모달 밖으로 밀려난다(LoginHistoryTab 의 같은 자리).
      render: (value: string | null) => (
        <Tooltip title={value} placement="topLeft">
          <span
            style={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {value}
          </span>
        </Tooltip>
      ),
    },
    {
      title: label(MSG.PROFILE_ROLE_STATE),
      key: 'state',
      width: 110,
      render: (_, row) =>
        row.effective ? (
          <Tag color="green">{label(MSG.PROFILE_ROLE_EFFECTIVE)}</Tag>
        ) : (
          <Tag>{label(pendingOrExpired(row.validFromDt, businessToday))}</Tag>
        ),
    },
  ];
}

const ACTION_LABEL: Record<MyMenuGrant['actionCd'], string> = {
  READ: MSG.AUTHZ_ACTION_READ,
  SAVE: MSG.AUTHZ_ACTION_SAVE,
  EXPORT: MSG.AUTHZ_ACTION_EXPORT,
  EXECUTE: MSG.AUTHZ_ACTION_EXECUTE,
};

/**
 * <b>왜 유효하지 않은지</b>까지 말한다 — 기다리면 되는 것과 관리자에게 갈 것이 다르다.
 *
 * <p><b>역할이 꺼진 것이 먼저다.</b> 그 경우 기간이 남아 있어도 권한은 없으며, "기간 남음"
 * 만 보여주면 <i>되는데 안 된다</i> 가 된다.
 */
function stateTag(row: MyRoleGrant, businessToday: string | undefined) {
  if (row.effective) {
    return <Tag color="green">{label(MSG.PROFILE_ROLE_EFFECTIVE)}</Tag>;
  }
  if (!row.roleUseYn) {
    return <Tag color="red">{label(MSG.PROFILE_ROLE_DISABLED)}</Tag>;
  }
  return <Tag>{label(pendingOrExpired(row.validFromDt, businessToday))}</Tag>;
}

/**
 * 아직 시작 전인가, 지났는가 — 인사 발령을 미리 넣어 두는 것이 정상 운영이라(42 §3.1)
 * 둘을 갈라야 한다. <b>기다리면 되는 것</b>과 <b>관리자에게 갈 것</b>이다.
 *
 * <p>`YYYY-MM-DD` 는 사전순이 곧 날짜순이라 문자열 비교로 충분하다 — `dayjs` 를 태우면
 * 현지 시각으로 해석되어 하루가 어긋난다(40 §4.3).
 */
function pendingOrExpired(validFromDt: string | null, businessToday: string | undefined): string {
  if (validFromDt && businessToday && validFromDt > businessToday) {
    return MSG.PROFILE_ROLE_PENDING;
  }
  return MSG.PROFILE_ROLE_EXPIRED;
}

/** 양끝이 다 비면 무기한이다 — `9999-12-31` 을 채우지 않기로 한 결정의 표시다(42 §3.1). */
function period(from: string | null, to: string | null): string {
  if (!from && !to) return label(MSG.PROFILE_NONE);
  return `${from ?? ''} ~ ${to ?? ''}`;
}
