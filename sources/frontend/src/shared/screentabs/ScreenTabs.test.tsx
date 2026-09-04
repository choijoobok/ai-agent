import { App } from 'antd';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenTabs } from '@/shared/screentabs/ScreenTabs';
import { useAuthStore } from '@/shared/stores/authStore';

/**
 * 화면 안 최상단 탭 — main-shell.md §12 · 68 §9.3.
 *
 * <p>여기서 세는 것은 <b>지우면 사고가 되는 것 둘</b>이다.
 *
 * <ul>
 *   <li><b>언마운트하지 않는다</b> — 돌아왔을 때 조회 결과가 남아 있어야 한다. 고른 것만
 *       그리면 업로드 탭으로 갔다 온 사용자가 <b>읽어들인 412행을 잃는다</b>
 *   <li><b>권한이 항목을 거른다</b> — `S` 가 없으면 업로드 항목이 아예 없다. 빈 탭을
 *       남기면 <i>왜 여기서는 아무것도 안 되나</i> 를 묻게 된다
 * </ul>
 *
 * <p><b>모양이 탭이 됐다</b>(2026-09-02 실물 — 세그먼티드가 일반 버튼으로 읽혔다). 검사는
 * 모양이 아니라 <b>위 둘</b>을 세므로 바뀐 것은 <i>무엇을 눌러 확인하는가</i> 뿐이다 —
 * 라디오가 아니라 {@code role="tab"} 이고, 감춰진 판은 {@code aria-hidden} 이 말한다.
 */
describe('화면 안 최상단 탭', () => {
  const items = [
    { key: 'business', label: 'seg.business', content: <div>업무 데이터 내용</div> },
    { key: 'upload', label: 'seg.upload', actionCd: 'SAVE' as const, content: <div>업로드 내용</div> },
  ];

  const draw = (value: string, onChange = () => undefined, dirty?: (key: string) => boolean) =>
    render(
      <App>
        <ScreenTabs
          menuCd="SMPL_EXCEL"
          items={items}
          value={value}
          onChange={onChange}
          dirty={dirty}
        />
      </App>,
    );

  beforeEach(() => {
    useAuthStore.setState({ permissions: ['SMPL_EXCEL:READ', 'SMPL_EXCEL:SAVE'] });
  });

  /*
    <b>감출 뿐 언마운트하지 않는다.</b> 그 안의 컴포넌트가 상태를 그대로 들고 있어야
    돌아왔을 때 조회 결과가 남는다 — 이 검사는 <i>고르지 않은 쪽도 트리에 있는가</i> 를
    묻는다.

    <b>탭이 되면서 이것이 기본값이 아니게 됐다.</b> antd 의 탭은 열어 본 적 없는 판을
    아예 그리지 않으므로 `forceRender` 가 곧 이 계약이다 — 지우면 이 검사만 붉어진다.
  */
  it('고르지 않은 항목도 트리에 남는다 — 돌아왔을 때 결과가 있어야 한다', () => {
    draw('business');

    expect(screen.getByText('업무 데이터 내용')).toBeTruthy();
    expect(screen.getByText('업로드 내용')).toBeTruthy();
  });

  it('고른 것만 보인다 — 남아 있다는 것이 보인다는 뜻은 아니다', () => {
    draw('business');

    const hidden = screen.getByText('업로드 내용').closest('[role="tabpanel"]');
    expect(hidden?.getAttribute('aria-hidden')).toBe('true');
  });

  describe('권한이 항목을 거른다 — 68 §9.3', () => {
    it('`S` 가 없으면 업로드 항목이 아예 없다', () => {
      useAuthStore.setState({ permissions: ['SMPL_EXCEL:READ'] });

      draw('business');

      expect(screen.queryByText('업로드 내용')).toBeNull();
    });

    /*
      <b>고를 것이 하나뿐이면 컨트롤이 없다.</b> 누를 수 없는 탭 하나를 남기는 것은
      조회조건이 후보 하나짜리 셀렉터를 내지 않는 것과 같은 자리다(search-form-contract.md §3.4).
    */
    it('남은 항목이 하나면 탭바를 그리지 않는다', () => {
      useAuthStore.setState({ permissions: ['SMPL_EXCEL:READ'] });

      draw('business');

      expect(screen.queryByRole('tablist')).toBeNull();
    });

    /*
      권한이 지운 항목이 <b>지금 고른 것</b>일 수 있다(설정이 바뀌었거나 저장된 상태로
      돌아온 경우). 그때 아무것도 안 그리면 <b>빈 화면</b>이 되므로 남은 첫 항목으로
      떨어진다.
    */
    it('고른 항목이 걸러졌으면 남은 첫 항목을 보인다 — 빈 화면이 되지 않는다', () => {
      useAuthStore.setState({ permissions: ['SMPL_EXCEL:READ'] });

      draw('upload');

      expect(screen.getByText('업무 데이터 내용')).toBeTruthy();
    });
  });

  /*
    <b>미저장이면 묻는다</b>(68 §9.3) — 화면 전체가 갈리므로 하단 디테일 탭과 규칙이
    다르다. 모양이 하단 탭과 같아졌다고 이 규칙까지 같아지지는 않는다.

    묻는 동안 전환이 일어나면 안 된다: 사용자가 <i>취소</i> 를 고를 수 있어야 한다.
  */
  it('미저장이면 곧바로 옮기지 않는다 — 확인이 먼저다', () => {
    const onChange = vi.fn();

    draw('business', onChange, () => true);
    screen.getByRole('tab', { name: 'seg.upload' }).click();

    expect(onChange).not.toHaveBeenCalled();
  });
});
