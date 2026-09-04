import { useCallback, type ReactNode } from 'react';
import { App } from 'antd';
import { hasPermission, type Action } from '@/shared/authz/permission';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { DetailTabs } from '@/shared/grid/DetailTabs';
import { useAuthStore } from '@/shared/stores/authStore';

/**
 * 화면 안 <b>최상단</b>의 모드 전환 — main-shell.md §12 의 미결을 닫는다(68 §9.3).
 *
 * <h2>모양은 <b>하단 디테일 탭과 같다</b>(2026-09-02 실물)</h2>
 *
 * <p>68 §11 이 <i>"세그먼트의 시각적 무게 — 그린 것과 쓰는 것이 다를 수 있다"</i> 를
 * <b>실물에서 다시 본다</b> 로 남겨 두었고, 실물이 답을 줬다: 세그먼티드 컨트롤은
 * <b>일반 버튼 두 개</b>로 읽혔다. 화면을 <b>갈아 끼우는</b> 컨트롤이 <i>누르면 뭔가
 * 실행되는 버튼</i> 과 같은 모양이면, 사용자는 그것이 <b>지금 어디에 있는지를 말하는
 * 표시</b>라는 것을 못 읽는다 — 세그먼티드에는 활성 항목을 가리키는 <b>밑줄이 없고</b>
 * 두 항목이 같은 상자 안에 들어 있어 <i>고른 것</i> 과 <i>고를 수 있는 것</i> 의 대비가
 * 약하다.
 *
 * <p>그래서 <b>{@link DetailTabs} 를 그대로 쓴다.</b> 스타일을 베껴 오지 않는 것이
 * 요점이다 — 베끼면 탭바 높이 · 탭 최소 폭 · 활성 표시가 <b>두 곳</b>이 되고, 그 둘은
 * 반드시 갈린다(그 컴포넌트가 기본값 셋을 스스로 갖는 이유와 같은 자리다).
 *
 * <h2>탭이 되어도 <b>셸 탭바와는 갈린다</b></h2>
 *
 * <p>main-shell.md §12 가 세그먼트를 권한 근거는 <i>"셸 탭바 바로 아래라 화면을 닫으려다 탭을
 * 닫는다"</i> 였다. 그 위험은 <b>닫기 {@code ×} 가 여기에 없다</b>는 것으로 막힌다 —
 * 셸 탭은 탭마다 {@code ×} 를 달고 있고(main-shell.md §4) 이쪽에는 없으므로, <b>닫을 수 있는
 * 것</b>과 <b>고르는 것</b>이 눈으로 갈린다. 나머지 둘(층이 다르다 · 하단 탭과 갈린다)은
 * <b>모양이 아니라 자리</b>가 말한다: 셸 탭바는 브레드크럼 위, 이것은 아래다.
 *
 * <p><b>규칙은 그대로다</b> — 모양만 바뀌었다. 전환할 때 미저장이면 <b>묻고</b>(화면
 * 전체가 갈린다), 안 보이는 항목을 <b>언마운트하지 않는다</b>.
 *
 * <h2>언마운트하지 않는다</h2>
 *
 * <p>68 §9.3 의 계약이다. 돌아왔을 때 <b>조회 결과가 남아 있어야</b> 하는데, 고른 것만
 * 그리면 돌아올 때마다 빈 그리드이고 사용자는 <b>조회를 다시</b> 누른다 — 업로드 탭에서는
 * 그것이 <i>읽어들인 412행</i>을 잃는 일이다.
 *
 * <p>그래서 {@code forceRender} 다. antd 의 탭은 <b>열어 본 적 없는 판을 아예 그리지
 * 않으므로</b>, 이것이 없으면 계약이 조용히 깨진다 — 첫 전환에서만 드러나고 그때는 이미
 * 읽어들인 행이 없다.
 *
 * <h2>전환할 때 미저장을 묻는다</h2>
 *
 * <p>하단 디테일 탭과 <b>규칙이 다르다</b>(68 §8.7) — 저기는 한 화면 안의 부분이 갈리는
 * 것이고 여기는 <b>화면 전체</b>다. 모양이 같아졌다고 이것까지 같아지지는 않는다:
 * 묻지 않으면 사용자는 <i>탭을 옮긴 것</i>으로 알고 편집을 남겨 둔 채 다른 일을 한다.
 *
 * <h2>권한은 항목마다 다를 수 있다</h2>
 *
 * <p>{@code S} 가 없으면 <b>업로드 항목이 아예 없다</b>(68 §9.3) — 그 탭의 액션이 저장
 * 하나뿐이라 들어가 봐야 할 일이 없고, grid-api-contract.md §3.6 이 이미 저장 버튼을 거른다. 빈 탭을
 * 남기면 <i>왜 여기서는 아무것도 안 되나</i> 를 묻게 된다.
 */
export interface ScreenTabItem {
  key: string;
  /** 메시지 키. */
  label: string;
  /**
   * 이 항목에 들어가려면 필요한 액션 — 없으면 <b>누구나</b> 본다.
   *
   * <p>메뉴가 아니라 <b>항목</b>에 매인다. 메뉴 권한은 화면 전체의 것이고 여기는 그
   * 안에서 갈리는 자리다.
   */
  actionCd?: Action;
  content: ReactNode;
}

export function ScreenTabs(props: {
  menuCd: string;
  items: ScreenTabItem[];
  value: string;
  onChange: (key: string) => void;
  /**
   * 지금 항목에 <b>미저장 변경이 있나</b> — 있으면 묻는다.
   *
   * <p>함수인 것은 <i>지금</i> 을 물어야 하기 때문이다. 불리언으로 받으면 부모가 매
   * 편집마다 다시 그려야 하고, 그러면 <b>양쪽 항목이 통째로 다시 그려진다</b>.
   */
  dirty?: (key: string) => boolean;
}) {
  const { modal } = App.useApp();
  const permissions = useAuthStore((state) => state.permissions);
  const { items, value, onChange, dirty, menuCd } = props;

  const allowed = items.filter(
    (item) => item.actionCd === undefined || hasPermission(permissions, menuCd, item.actionCd),
  );

  const move = useCallback(
    (next: string) => {
      if (next === value) return;
      if (!dirty?.(value)) {
        onChange(next);
        return;
      }
      modal.confirm({
        title: label(MSG.TAB_DIRTY_TITLE),
        content: label(MSG.SCREEN_TABS_DIRTY_CONTENT),
        okText: label(MSG.GRID_CONFIRM_OK),
        cancelText: label(MSG.COMMON_CANCEL),
        onOk: () => onChange(next),
      });
    },
    [dirty, modal, onChange, value],
  );

  /*
    <b>고른 항목이 걸러졌으면 남은 첫 항목으로 떨어진다.</b> 저장된 상태로 돌아오거나
    권한이 바뀌면 실제로 일어나며, 아무것도 안 그리면 <b>빈 화면</b>이 된다.
  */
  const active = allowed.some((item) => item.key === value) ? value : allowed[0]?.key;

  /*
    <b>고를 것이 하나뿐이면 탭바를 내지 않는다.</b> 권한이 걸러 낸 결과일 수 있고
    (`S` 없는 사용자), 그때 항목 하나짜리 탭바는 <b>누를 수 없는 탭 하나</b>다 —
    조회조건 컨트롤이 후보 하나면 셀렉터를 내지 않는 것과 같은 규칙이다(search-form-contract.md §3.4).

    <b>탭 자체를 세우지 않는다</b>(탭바만 감추는 것이 아니다). 감추기만 하면 남는 것은
    <i>비어 있는 탭 크롬</i> 이고, 그 안의 여백이 화면 본문을 위에서 눌러 <b>그리드가
    이유 없이 내려앉는다</b>.
  */
  if (allowed.length <= 1) {
    const only = allowed[0];
    return only ? (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {only.content}
      </div>
    ) : null;
  }

  return (
    /*
      <b>하단 디테일 탭과 같은 컴포넌트다</b> — 모양이 <i>같아야 한다</i> 가 계약이므로
      (2026-09-02) 스타일을 베끼지 않고 그것을 부른다. 베끼면 탭바 높이 · 탭 최소 폭 ·
      활성 표시가 두 곳이 되고, 그 둘은 반드시 갈린다.
    */
    <DetailTabs
      activeKey={active}
      onChange={move}
      items={allowed.map((item) => ({
        key: item.key,
        label: label(item.label),
        children: item.content,
        // 열어 본 적 없는 판도 그린다 — 위의 <b>언마운트하지 않는다</b> 가 여기 걸려 있다.
        forceRender: true,
      }))}
    />
  );
}
