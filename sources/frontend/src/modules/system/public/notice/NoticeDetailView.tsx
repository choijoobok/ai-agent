// @feat FEAT-509
import { useEffect, useState } from 'react';
import { Alert, Descriptions, Skeleton, Typography } from 'antd';
import dayjs from 'dayjs';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { getNoticeOne } from '@/modules/system/public/notice/api/noticeApi';
import type { NoticeBrief, NoticeDetail } from '@/modules/system/public/notice/types';

interface Props {
  notice: NoticeBrief;
  /** 목록의 조건을 그대로 물려받는다 — 켜서 찾아 낸 지난 공지는 상세도 열려야 한다. */
  includeExpired: boolean;
}

/**
 * 공지 상세 — screen/_standalone/README.md · screen/admin/system/notice/requirements.md.
 *
 * <h2>목록이 가진 것을 먼저 그린다</h2>
 *
 * <p>제목·게시일·작성자는 `NoticeBrief` 에 이미 있으므로 **본문을 기다리지 않고** 그린다.
 * 전부를 스켈레톤으로 덮으면 이미 아는 것까지 사라져 화면이 한 번 깜빡인다.
 *
 * <h2>본문은 텍스트다 — `richText` 를 쓰지 않는다</h2>
 *
 * <p>`CONTENT_TYPE_CD` 는 지금 언제나 `TEXT` 다(screen/admin/system/notice/requirements.md). **모르는 형식이 와도 그대로
 * 텍스트로 그린다** — 해석하려 들면 그것이 곧 XSS 통로가 되고, 에디터를 붙이는 프로젝트가
 * **표시 측도 함께** 바꿔야 한다는 사실이 여기서 드러나야 한다(태그가 글자로 보인다).
 *
 * <p>`white-space: pre-wrap` 이 줄바꿈을 살린다. `textarea` 로 쓴 글이므로(screen/admin/system/notice/requirements.md)
 * 줄바꿈이 유일한 서식이며, 그것마저 잃으면 문단이 한 덩어리가 된다.
 */
export function NoticeDetailView({ notice, includeExpired }: Props) {
  const [detail, setDetail] = useState<NoticeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getNoticeOne(notice.noticeId, includeExpired).then(
      (loaded) => {
        if (alive) setDetail(loaded);
      },
      (failure: unknown) => {
        if (alive) setError(failure instanceof Error ? failure.message : String(failure));
      },
    );
    return () => {
      alive = false;
    };
  }, [notice.noticeId, includeExpired]);

  return (
    <>
      <Descriptions size="small" column={1} style={{ marginBottom: 12 }}>
        <Descriptions.Item label={label(MSG.NOTIFICATION_NOTICE_FROM)}>
          {dayjs(notice.noticeFromDtm).format('YYYY-MM-DD')}
        </Descriptions.Item>
        <Descriptions.Item label={label(MSG.NOTIFICATION_NOTICE_AUTHOR)}>
          {notice.regNm}
        </Descriptions.Item>
      </Descriptions>

      {error && <Alert type="error" showIcon message={error} />}

      {detail === null && !error ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : (
        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
          {detail?.content}
        </Typography.Paragraph>
      )}
    </>
  );
}
