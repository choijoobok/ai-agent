import { Breadcrumb, theme } from 'antd';
import { label } from '@/shared/i18n/label';
import { useTabStore } from '@/shared/stores/tabStore';
import { pathOf, type MenuIndex } from '@/shared/authz/menuTree';
import { BreadcrumbSlot } from '@/layouts/ShellLayout/BreadcrumbSlot';

/**
 * 브레드크럼 — frontend/tabs.md.
 *
 * <p><b>조상 항목은 클릭 대상이 아니다.</b> 구조 노드는 열 수 없고, 여는 경로를 여기 하나 더
 * 만들면 탭이 늘어나는 길이 늘어난다 — 여기서는 <b>현재 위치를 알려주는 표시</b>다.
 *
 * <p><b>경로를 새로 계산하지 않는다.</b> 트리 역산이 이미 만든 조상 경로를 그대로 쓴다
 * (frontend/tabs.md) — 검색 결과 항목도 같은 값을 쓰게 되어 두 곳의 표기가 갈리지 않는다.
 *
 * <p><b>줄의 오른쪽은 화면이 채우는 슬롯이다</b>(frontend/tabs.md). 셸은 자리만 내주며 무엇이
 * 들어가는지 모른다 — 활성 탭의 화면이 등록하고(`useBreadcrumbSlot`) 여기가 읽어 간다.
 *
 * <p>지금 들어오는 것은 <b>조회조건 접기</b>(UX-15) 하나다. <b>저장된 조회조건</b>(UX-07)은
 * `SYS_USER_SEARCH_COND` DDL 이 먼저이며(sys/user-role.md) 그 테이블이 아직 없다 — 자리는 같다.
 */
export function ShellBreadcrumb({ index }: { index: MenuIndex }) {
  const { token } = theme.useToken();
  const tabs = useTabStore((state) => state.tabs);
  const activeKey = useTabStore((state) => state.activeKey);

  const activeMenuCd = tabs.find((tab) => tab.key === activeKey)?.menuCd;
  const trail = activeMenuCd ? pathOf(index, activeMenuCd) : [];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        // 답답해 보였다 — 글자가 위아래 선에 거의 닿아 있었다(2026-08-30 실물).
        minHeight: 44,
        paddingBlock: 4,
        paddingInline: 16,
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorSplit}`,
      }}
    >
      {/* 대시보드는 조상이 없으므로 비운다 — 한 칸짜리 경로는 정보가 없다(frontend/tabs.md). */}
      <Breadcrumb
        items={trail.length > 1 ? trail.map((node) => ({ title: label(node.menuNm) })) : []}
      />
      {/* frontend/tabs.md 의 화면 슬롯. 화면이 조회조건을 갖지 않으면 이 자리는 빈다. */}
      <BreadcrumbSlot />
    </div>
  );
}
