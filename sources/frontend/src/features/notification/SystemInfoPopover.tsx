import { useState } from 'react';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Button, Descriptions, Popover, Skeleton, Typography } from 'antd';
import dayjs from 'dayjs';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { useLoad } from '@/shared/hooks/useLoad';
import { getSystemInfo } from '@/features/notification/api/notificationApi';
import type { SystemInfo } from '@/features/notification/types';

/**
 * 시스템 정보 — main-shell.md §7.3. 알림 모달 우측 하단의 버튼과 그 팝오버다.
 *
 * <p><b>답하는 물음이 하나다 — *"지금 도는 서버가 어느 빌드인가"*.</b> 운영 문의는 언제나
 * 거기서 시작하고, 사용자가 화면에서 읽어 줄 수 없으면 확인 경로가 **서버에 접속하는 것**
 * 뿐이다.
 *
 * <p><b>버튼을 눌러야 읽는다.</b> 모달을 열 때 함께 가져오지 않는 이유는 알림을 보러 온
 * 사람이 이것을 볼 일이 거의 없기 때문이다 — 문의할 때 한 번 읽는 값이다.
 *
 * <p><b>버튼이지 아이콘이 아니다.</b> 아이콘만 두면 무엇인지 알 수 없어 아무도 누르지
 * 않는다 — 하루에 여러 번 쓰는 것이 아니라 **필요할 때 찾아야 하는** 것이라 이름이 있어야 한다.
 */
export function SystemInfoPopover() {
  const [open, setOpen] = useState(false);
  const { data, error, loading } = useLoad(open, getSystemInfo);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="topRight"
      title={label(MSG.SYSTEM_INFO)}
      content={
        <div style={{ width: 280 }}>
          {loading && <Skeleton active paragraph={{ rows: 4 }} title={false} />}
          {error && <Typography.Text type="danger">{error}</Typography.Text>}
          {data && <Details info={data} />}
        </div>
      }
    >
      <Button type="text" icon={<InfoCircleOutlined />}>
        {label(MSG.SYSTEM_INFO)}
      </Button>
    </Popover>
  );
}

function Details({ info }: { info: SystemInfo }) {
  return (
    <Descriptions column={1} colon={false}>
      <Descriptions.Item label={label(MSG.SYSTEM_INFO_PROFILE)}>
        {/* 비었다는 것은 아무것도 지정하지 않고 도는 중이라는 뜻이다 — 빈 칸으로 두면
            조회가 실패한 것처럼 보인다. */}
        {info.profiles.length > 0
          ? info.profiles.join(', ')
          : label(MSG.SYSTEM_INFO_PROFILE_DEFAULT)}
      </Descriptions.Item>
      <Descriptions.Item label={label(MSG.SYSTEM_INFO_VERSION)}>
        {unknownIfNull(info.version)}
      </Descriptions.Item>
      {/* 배포를 특정하는 것은 버전이 아니라 이 값이다 — 태그를 붙이기 전까지 버전은
          계속 같다. `-dirty` 가 붙었으면 그 커밋과 같지 않은 빌드다. */}
      <Descriptions.Item label={label(MSG.SYSTEM_INFO_COMMIT)}>
        {commitOf(info)}
      </Descriptions.Item>
      <Descriptions.Item label={label(MSG.SYSTEM_INFO_BUILD_TIME)}>
        {info.buildTime ? moment(info.buildTime) : label(MSG.SYSTEM_INFO_UNKNOWN)}
      </Descriptions.Item>
      {/* 빌드 시각과 갈리면 배포 없이 재기동만 한 것이다 — 그 구분이 없으면
          "배포했는데 안 바뀌었다" 의 원인을 좁힐 수 없다. */}
      <Descriptions.Item label={label(MSG.SYSTEM_INFO_STARTED_AT)}>
        {moment(info.startedAt)}
      </Descriptions.Item>
      <Descriptions.Item label={label(MSG.SYSTEM_INFO_CACHE)}>
        {cacheOf(info) || label(MSG.SYSTEM_INFO_UNKNOWN)}
      </Descriptions.Item>
    </Descriptions>
  );
}

/** 브랜치가 있으면 함께 보인다 — 같은 해시라도 어느 갈래에서 왔는지가 문의를 좁힌다. */
function commitOf(info: SystemInfo): string {
  if (!info.commit) return label(MSG.SYSTEM_INFO_UNKNOWN);
  return info.branch ? `${info.commit} (${info.branch})` : info.commit;
}

function cacheOf(info: SystemInfo): string {
  return Object.entries(info.cacheVersions)
    .map(([name, version]) => `${name} ${version}`)
    .join(', ');
}

function unknownIfNull(value: string | null): string {
  return value ?? label(MSG.SYSTEM_INFO_UNKNOWN);
}

function moment(value: string): string {
  return dayjs(value).format('YYYY-MM-DD HH:mm');
}
