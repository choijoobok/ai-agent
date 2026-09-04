import { Card, Col, Row, Typography } from 'antd';
import { useAuthStore } from '@/shared/stores/authStore';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';

/**
 * 대시보드 — frontend/tabs.md.
 *
 * <p><b>위젯 슬롯만 둔다.</b> 무엇을 놓을지는 frontend/tabs.md 의 미결이고, 업무 데이터 위젯을 두면
 * <b>위젯 단위 권한</b>이 따라온다 — 그것은 위젯을 정할 때 함께 정한다. 차트 라이브러리도
 * 미포함이다(frontend/packages.md).
 *
 * <p><b>고정 탭이라 항상 살아 있다.</b> 그래서 여기에 폴링이나 무거운 그리드를 두면 그 비용을
 * 모든 사용자가 로그인 내내 낸다 — 위젯을 채울 때 그것부터 생각해야 한다(frontend/packages.md).
 */
export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const menus = useAuthStore((state) => state.menus);
  const permissions = useAuthStore((state) => state.permissions);

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          {label(MSG.DASHBOARD_GREETING, { name: user?.userNm ?? '' })}
        </Typography.Title>
      </Col>

      {/* 위젯이 들어올 자리. 지금은 무엇이 손에 있는지만 보여준다. */}
      <Col xs={24} md={12}>
        <Card size="small" title={label(MSG.DASHBOARD_MENU_COUNT)}>
          <Typography.Text>
            {label(MSG.DASHBOARD_MENU_COUNT_VALUE, { count: menus.length })}
          </Typography.Text>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card size="small" title={label(MSG.DASHBOARD_PERMISSION_COUNT)}>
          <Typography.Text>
            {label(MSG.DASHBOARD_PERMISSION_COUNT_VALUE, { count: permissions.length })}
          </Typography.Text>
        </Card>
      </Col>
    </Row>
  );
}
