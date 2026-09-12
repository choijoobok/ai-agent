import { Button, Descriptions, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import type { MyNotiRow } from '@/features/notification/types';

interface Props {
  row: MyNotiRow;
  canOpenMenu: (menuCd: string) => boolean;
  onOpenMenu: (menuCd: string, linkParam: string | null) => void;
}

/**
 * 내 알림 상세 — frontend/tabs.md · `NI-09` · `NI-10` · `NI-11`.
 *
 * <h2>더 읽지 않는다</h2>
 *
 * <p>목록이 이미 전부를 갖고 있다 — `CONTENT` 가 `VARCHAR(2000)` 이라 목록에 실려 오기
 * 때문이다(sys/notification.md: *"길지 않다. 상세는 링크로 보낸다"*). 공지 상세가 한 번 더 묻는 것과
 * **갈리는 자리**이며, 그쪽은 본문이 `nclob` 이다.
 *
 * <h2>이동 버튼이 권한을 확인한다 — `NI-11`</h2>
 *
 * <p>`LINK_MENU_CD` 는 URL 이 아니라 **메뉴 코드**다(sys/notification.md). 권한이 없어진 메뉴로 가는
 * 알림은 **버튼이 비활성**이다 — 눌러서 403 을 보는 것보다 낫고, **알림이 권한을 주지
 * 않는다**는 사실이 화면에서 그렇게 보여야 한다.
 *
 * <p>판정은 **내 메뉴 트리에 그 코드가 있는가** 하나다. 트리는 유효 권한으로 이미 걸러져
 * 오므로(frontend/tabs.md) 여기서 권한을 다시 묻지 않는다.
 *
 * <p>`linkMenuCd` 가 `null` 이면 **이동 자체가 없다** — 요청 처리 알림이 그렇다(screen/admin/system/notice/requirements.md):
 * 결과를 보러 갈 자리가 이 모달의 탭이고 **탭에는 `MENU_CD` 가 없다.**
 *
 * <h2>`LINK_PARAM` 은 넘겨주기로 간다</h2>
 *
 * <p>`handoffStore` 다 — screen/menu/requirements.md · screen/admin/system/log/access/requirements.md · screen/admin/system/batch/schedule/requirements.md 의 *화면 → 화면* 건네주기와 **같은
 * 채널**이며, 알림이 그 셋째 입구가 된다. URL 파라미터가 아닌 이유도 같다: 경로 하나가
 * 탭 여러 개에 대응하므로 주소에 값을 실으면 **탭 전환마다 되살아난다.**
 *
 * <p><b>채널이 화면당 값 하나다.</b> 그래서 알림은 **그 화면의 받는 쪽이 기대하는 종류**를
 * 실어야 한다 — 배치 실패 알림이 실행 번호가 아니라 배치 ID 를 싣는 이유가 그것이다
 * (`BatchFailNotifier`). 채널이 *무엇을* 넘기는지 말할 수 없는 것이 지금의 한계다.
 */
export function MyNotiDetailView({ row, canOpenMenu, onOpenMenu }: Props) {
  const menuCd = row.linkMenuCd;
  const allowed = menuCd !== null && canOpenMenu(menuCd);

  return (
    <>
      <Descriptions size="small" column={1} style={{ marginBottom: 12 }}>
        <Descriptions.Item label={label(MSG.NOTIFICATION_MINE_RECEIVED_AT)}>
          {dayjs(row.creDtm).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        <Descriptions.Item label={label(MSG.NOTIFICATION_MINE_CONTENT)}>
          <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{row.content}</Typography.Text>
        </Descriptions.Item>
      </Descriptions>

      {menuCd !== null && (
        <Tooltip title={allowed ? undefined : label(MSG.NOTIFICATION_MINE_GOTO_DENIED)}>
          {/*
            **비활성 버튼은 툴팁을 삼킨다** — 마우스 이벤트가 죽어 있어서다. 감싸는
            `<span>` 이 그 이벤트를 받는다: 왜 못 누르는지 말하지 못하면 비활성은
            고장으로 읽힌다.
          */}
          <span>
            <Button
              disabled={!allowed}
              onClick={() => onOpenMenu(menuCd, row.linkParam)}
            >
              {label(MSG.NOTIFICATION_MINE_GOTO)}
            </Button>
          </span>
        </Tooltip>
      )}
    </>
  );
}
