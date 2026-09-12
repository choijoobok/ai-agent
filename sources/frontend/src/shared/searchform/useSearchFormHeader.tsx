import { useMemo, useState } from 'react';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Space, Typography } from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { useSearchFormCollapse } from '@/shared/searchform/useSearchFormCollapse';
import { useBreadcrumbSlot } from '@/layouts/ShellLayout/breadcrumbSlotStore';

/**
 * 조회조건 폼의 <b>브레드크럼 헤더</b> — frontend/tabs.md · UX-15.
 *
 * <p><b>접기 토글과 걸린 조건 수는 폼이 아니라 브레드크럼 줄에 있다</b>. 토글이 접히는
 * 대상 안에 있으면 <b>숨긴 뒤 되돌릴 수 없고</b>, 조건 수는 접힌 채로도 보여야 한다 —
 * 접기는 표시일 뿐 조건은 살아 있기 때문이다({@link useSearchFormCollapse}).
 *
 * <p><b>스물한 화면이 같은 스무 줄을 각자 갖고 있었다</b>(2026-09-02 실측). 사본이 같은
 * 동안에는 아무 문제가 없지만, 문구 하나를 고치는 일이 스물한 곳을 고치는 일이 되고
 * <b>그중 하나를 빠뜨리면 그 화면만 다르게 말한다</b>. 조회조건을 갖는 화면은 전부 이
 * 훅을 부르며, 화면에 남는 것은 <b>폼에 넘기는 두 값</b>뿐이다:
 *
 * <pre>
 * const searchForm = useRef&lt;SearchFormHandle&gt;(null);
 * const header = useSearchFormHeader();
 * …
 * &lt;SearchForm
 *   handleRef={searchForm}
 *   fields={searchFields}
 *   onSubmit={() =&gt; void grid.read()}
 *   onReset={grid.clearFilters}
 *   onActiveCountChange={header.onActiveCountChange}
 *   collapsed={header.collapsed}
 * /&gt;
 * </pre>
 *
 * <p><b>폼의 `ref` 는 화면이 갖는다.</b> 여기로 올리지 않은 이유는 조건을 <i>읽는</i> 쪽이
 * 화면이기 때문이다 — 조회 파라미터를 모으고(`collect`), 넘겨받은 값을 채워 넣는다
 * (`apply` — screen/admin/system/log/access/requirements.md 의 화면 간 이동). 훅이 들고 있으면 그 둘이 한 번 더 감싸여 돌아간다.
 *
 * <p><b>슬롯 노드를 매 렌더 새로 만들지 않는다.</b> {@code useBreadcrumbSlot} 은 내용을
 * 효과의 의존으로 받으므로(스토어에 등록한다) 새 노드는 곧 <b>매 렌더 재등록</b>이다 —
 * 셸이 1초마다 다시 그리는 자리라 그 왕복도 초당 한 번이 된다.
 */
export interface SearchFormHeader {
  /** {@code <SearchForm collapsed>} 로 넘긴다. 폼은 언마운트되지 않고 <b>감춰진다</b>. */
  collapsed: boolean;
  /** {@code <SearchForm onActiveCountChange>} 로 넘긴다 — 접힌 채로 몇 개가 걸렸는지. */
  onActiveCountChange: (count: number) => void;
}

export function useSearchFormHeader(): SearchFormHeader {
  const [activeConditions, setActiveConditions] = useState(0);

  // 토글은 접히는 대상 밖에 있어야 한다 — 폼 안에 두면 숨긴 뒤 되돌릴 수 없다(frontend/tabs.md).
  const form = useSearchFormCollapse();

  const slot = useMemo(
    () => (
      <Space size={8}>
        {/* 접힌 채로 조건이 걸려 있으면 그것을 말한다 — frontend/grid.md 가 컬럼 필터에 정한 규칙과 같다. */}
        {form.collapsed && activeConditions > 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {label(MSG.SEARCH_FORM_ACTIVE, { count: activeConditions })}
          </Typography.Text>
        )}
        {/* 아이콘이 <b>다음에 일어날 일</b>을 가리킨다 — 접혀 있으면 아래로 펼친다. */}
        <Button
          type="text"
          icon={form.collapsed ? <DownOutlined /> : <UpOutlined />}
          onClick={form.toggle}
        >
          {label(form.collapsed ? MSG.SEARCH_FORM_SHOW : MSG.SEARCH_FORM_HIDE)}
        </Button>
      </Space>
    ),
    [form.collapsed, form.toggle, activeConditions],
  );

  useBreadcrumbSlot(slot);

  return { collapsed: form.collapsed, onActiveCountChange: setActiveConditions };
}
