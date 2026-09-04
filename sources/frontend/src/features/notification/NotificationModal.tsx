import { useState } from 'react';
import { Button, Modal, Space, Tabs, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { SystemInfoPopover } from '@/features/notification/SystemInfoPopover';
import { useModalTabHotkeys } from '@/shared/hooks/useModalTabHotkeys';
import {
  NOTIFICATION_TABS,
  NOTIFICATION_TAB_KEYS,
  type NotificationTab,
} from '@/features/notification/notificationTabs';
import { NoticeTab } from '@/features/notification/tabs/NoticeTab';
import { MyNotiTab } from '@/features/notification/tabs/MyNotiTab';
import { MyRequestTab } from '@/features/notification/tabs/MyRequestTab';
import { NoticeDetailView } from '@/features/notification/views/NoticeDetailView';
import { MyNotiDetailView } from '@/features/notification/views/MyNotiDetailView';
import type { MyNotiRow, NoticeBrief } from '@/features/notification/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 헤더 벨의 배지를 맞춘다 — frontend/tabs.md. 내 알림 탭이 유일한 출처다. */
  onUnread: (count: number) => void;
  /** 알림이 가리키는 메뉴를 열 수 있는가 — **내 메뉴 트리에 있는가**다(`NI-11`). */
  canOpenMenu: (menuCd: string) => boolean;
  /**
   * 메뉴로 간다 — 모달은 닫힌다. 알림은 읽고 닫는 것이지 작업 공간이 아니다.
   *
   * <p>`linkParam` 이 있으면 **그 값으로 조회된 채** 열린다(`handoffStore`). 셸이 그
   * 넘겨주기를 걸고 여는 것은, 받는 화면이 **아직 마운트되지 않았거나 이미 열려 있는**
   * 두 경우를 그 저장소가 이미 다루기 때문이다.
   */
  onOpenMenu: (menuCd: string, linkParam: string | null) => void;
}

/**
 * 열려 있는 것 — 목록이거나 상세 하나다.
 *
 * <p>**같은 모달 안에서 바뀐다**(`NI-09`). 새 탭도 새 모달도 열지 않으므로 상태가 하나면
 * 충분하다 — 상세가 열려 있는 동안 탭은 그려지지 않는다.
 */
type View =
  | { kind: 'list' }
  | { kind: 'notice'; notice: NoticeBrief }
  | { kind: 'noti'; row: MyNotiRow };

/**
 * 알림 모달 — frontend/tabs.md · screen/_standalone/README.md.
 *
 * <p>**게시판 형태의 탭 모달**이다. 목록에서 항목을 고르면 같은 모달 안에서 상세로
 * 바뀐다 — 새 탭을 열지 않는다. 알림은 읽고 닫는 것이지 작업 공간이 아니다.
 *
 * <h2>탭 셋의 순서가 방향이다</h2>
 *
 * <p>공지사항(관리자→전체) · 내 알림(시스템→나) · 내 요청(나→관리자). 셋이 한 모달에
 * 있는 것은 **읽는 사람이 하나**이기 때문이며, 그 사람에게 오는 것과 그 사람이 보내는
 * 것을 나누면 *"내 요청이 어떻게 됐나"* 를 두 곳에서 봐야 한다.
 *
 * <h2>권한을 걸 자리가 없다 — `NI-01` · `NI-13`</h2>
 *
 * <p>메뉴 밖 화면이라 `MENU_CD` 가 없고(screen/_standalone/README.md), 권한은 `(MENU_CD, ACTION_CD)` 쌍이다.
 * 그래서 이 모달은 **내 것만** 보고 **관리 조작을 하나도 갖지 않는다** — 공지 작성은
 * `NOTICE_MGMT`, 요청 처리는 `NOTI_REQUEST` 메뉴의 일이다.
 *
 * <h2>우측 하단에 시스템 정보가 있다</h2>
 *
 * <p>§7.3. 여기가 *"시스템이 나에게 말하는 자리"* 이기 때문이며, 프로필 모달 하단에 있던
 * 버전 표시는 그쪽에서 뺐다 — 같은 것을 두 곳에서 말하면 어느 쪽이 맞는지 화면만 봐서는
 * 알 수 없다.
 *
 * <h2>버튼 크기를 지정하지 않는다 — 2026-09-01 요청</h2>
 *
 * <p>이 모달의 버튼 여섯이 {@code size="small"} 이었다(모두 읽음 · 새 요청 · 취소 · 요청 ·
 * 화면 열기 · 제목의 되돌아가기). <b>프로필 모달은 판의 기본 크기</b>를 쓰므로, 셸의 같은
 * 자리에서 여는 모달 둘의 버튼이 <b>다른 크기</b>였다 — 목록이 촘촘한 것과 <b>누르는 것이
 * 작은 것</b>은 다른 축이다.
 *
 * <p><b>그래서 크기를 적지 않는다.</b> 판의 기본은 밀도 설정(frontend/tabs.md 의 {@code compact})을
 * 따라가므로, 여기서 한 번 더 적으면 <b>설정이 이 모달만 비껴간다</b> — 그리드의 글자 크기를
 * 셀이 물려받게 두는 것과 같은 규약이다.
 *
 * <p>목록과 설명 표({@code List} · {@code Descriptions})의 {@code size="small"} 은 <b>남는다</b>.
 * 그것은 <i>한 판에 몇 줄이 보이나</i> 이고, 스크롤 안에 열 줄 남짓을 넣는 것이 이 모달이
 * 하는 일이다 — <b>읽는 밀도와 누르는 크기를 한 값으로 묶지 않는다</b>.
 */
export function NotificationModal({ open, onClose, onUnread, canOpenMenu, onOpenMenu }: Props) {
  const [active, setActive] = useState<NotificationTab>('notice');
  const [view, setView] = useState<View>({ kind: 'list' });

  /*
    **지난 공지 포함이 모달의 상태다.** 탭이 가지면 상세에 다녀올 때마다 꺼진다 — 켜서
    찾아 낸 공지를 열었다가 돌아왔는데 목록에서 사라지는 것이 그 증상이다.
  */
  const [includeExpired, setIncludeExpired] = useState(false);

  // **렌더 중에 되돌린다** — `ProfileModal` 과 같은 방식이다. 효과에서 부르면 렌더가
  // 연쇄되고(`react-hooks/set-state-in-effect`), 다시 열었을 때 지난 상세가 한 프레임 보인다.
  const [seed, setSeed] = useState(open);
  if (seed !== open) {
    setSeed(open);
    setView({ kind: 'list' });
  }

  const detail = view.kind !== 'list';

  /*
    <b>`PageUp`/`PageDown` 이 이 모달의 탭을 옮긴다</b> — frontend/tabs.md · `useModalTabHotkeys`.

    <b>진입 모달만 하고 있던 일이다</b>(2026-09-01 — 지시). frontend/tabs.md 은 <i>"탭을 가진 모달이
    떠 있으면 그 모달의 탭"</i> 이라 적었는데 이 창은 듣지 않았다 — 그래서 알림을 읽는 동안
    누른 `PageDown` 이 <b>뒤에 가린 셸의 탭바</b>를 옮겼고, 모달을 닫으면 다른 화면이 열려
    있었다. 무엇이 바뀌었는지 알 수 없는 이동이 바로 그 조항이 막으려던 것이다.

    <b>상세를 보는 동안은 옮기지 않고 삼킨다</b>(`hold`). 그때는 탭이 그려지지 않으므로
    (`NI-09`) 옮길 것이 없는데, 삼키지 않으면 그 구간에만 셸의 탭바가 다시 움직인다.
  */
  useModalTabHotkeys({
    open,
    keys: NOTIFICATION_TAB_KEYS,
    active,
    onChange: setActive,
    hold: detail,
  });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        detail ? (
          <Space size={6}>
            {/*
              **되돌아가는 길이 제목에 있다.** 모달 하나가 두 화면을 갖는 구조라(`NI-09`)
              브라우저 뒤로가기가 여기 닿지 않는다 — frontend/packages.md 가 감수한 제약과 같은 자리다.
            */}
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => setView({ kind: 'list' })}
            >
              {label(MSG.SHELL_NOTIFICATION)}
            </Button>
            <Typography.Text type="secondary">
              / {view.kind === 'notice' ? view.notice.title : view.row.title}
            </Typography.Text>
          </Space>
        ) : (
          label(MSG.SHELL_NOTIFICATION)
        )
      }
      // 판이 푸터를 오른쪽으로 붙인다 — 시스템 정보 버튼의 자리가 그대로 우측 하단이다.
      footer={<SystemInfoPopover />}
      width={640}
      destroyOnHidden
    >
      {view.kind === 'notice' && (
        <NoticeDetailView notice={view.notice} includeExpired={includeExpired} />
      )}

      {view.kind === 'noti' && (
        <MyNotiDetailView
          row={view.row}
          canOpenMenu={canOpenMenu}
          onOpenMenu={(menuCd, linkParam) => {
            onClose();
            onOpenMenu(menuCd, linkParam);
          }}
        />
      )}

      {view.kind === 'list' && (
        <Tabs
          activeKey={active}
          onChange={(key) => setActive(key as NotificationTab)}
          items={NOTIFICATION_TABS.map((tab) => ({
            key: tab.key,
            label: label(tab.label),
            children:
              tab.key === 'notice' ? (
                <NoticeTab
                  includeExpired={includeExpired}
                  onIncludeExpiredChange={setIncludeExpired}
                  onOpen={(notice) => setView({ kind: 'notice', notice })}
                />
              ) : tab.key === 'mine' ? (
                <MyNotiTab
                  onUnread={onUnread}
                  onOpen={(row) => setView({ kind: 'noti', row })}
                />
              ) : (
                <MyRequestTab />
              ),
          }))}
        />
      )}
    </Modal>
  );
}
