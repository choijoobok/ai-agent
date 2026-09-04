import { useEffect } from 'react';
import { Tabs, theme, type TabsProps } from 'antd';
import { ensureGridStyles } from '@/shared/grid/gridStyles';

/**
 * 마스터-디테일의 <b>하단 탭</b> — frontend/grid.md · screen/user/requirements.md.
 *
 * <p><b>기본값을 화면마다 적지 않는다.</b> 탭 안이 그리드인 화면이 여러 개 서면서 같은 값
 * 셋을 매번 적게 됐고(높이 · 탭 최소 폭 · 탭바 높이), 적는 자리가 화면이면 <b>새 화면이
 * 빠뜨려도 조용하다</b> — 그 화면만 탭바가 좁다.
 *
 * <h2>셋을 이 컴포넌트가 갖는다</h2>
 *
 * <ol>
 *   <li><b>본문이 남는 높이를 다 쓴다</b> — 그리드는 자기 몫을 채우는 컴포넌트인데 antd 의
 *       탭 본문 래퍼 셋이 기본 높이가 auto 라 그 사이에서 높이가 <b>끊긴다</b>(`gridStyles`)
 *   <li><b>탭 하나의 최소 폭이 100px 다</b> — 이름이 두 글자인 탭(<i>세션</i>)과 다섯 글자인
 *       탭(<i>개인 예외</i>)이 나란히 있으면 폭이 제각각이라 <b>손이 자리를 기억하지
 *       못한다</b>. 다국어에서 더 벌어진다 — 같은 탭이 언어마다 다른 폭이 된다
 *   <li><b>탭바 높이가 그리드 버튼 줄과 같다</b>({@code controlHeight + 16}) — 위아래로
 *       나란히 놓이는 두 줄이라, 높이가 갈리면 <b>탭바만 눌린 것처럼</b> 보인다
 * </ol>
 *
 * <p><b>{@code size} 를 열지 않는다.</b> 탭바 높이를 우리가 정하므로 antd 의 크기 프리셋과
 * 겹치고, 둘이 다투면 <i>화면마다 다른 높이</i> 라는 원래 문제로 돌아온다.
 */

interface DetailTabsProps extends Omit<TabsProps, 'size' | 'className'> {
  /**
   * 스플리터가 이 pane 을 <b>접었다</b> — frontend/grid.md.
   *
   * <p><b>탭바를 감춘다.</b> 본문의 그리드는 화면이 {@code collapsed} 를 함께 넘겨 제목 한
   * 줄로 접으며, 그 둘이 맞물려 <b>그리드 하나짜리 하단과 같은 모양</b>이 된다.
   *
   * <p>언마운트하지 않는다 — 접힘은 <b>표시</b>일 뿐이라 조회한 행과 미저장 편집이 살아
   * 있어야 한다(frontend/tabs.md 의 조회조건 접힘과 같은 규칙).
   */
  collapsed?: boolean;
}
export function DetailTabs(props: DetailTabsProps) {
  const { collapsed, ...rest } = props;
  const { token } = theme.useToken();
  // 스타일시트는 한 번만 들어간다 — 렌더 중이 아니라 효과에서 부른다(`DataGrid` 와 같다).
  useEffect(ensureGridStyles, []);

  return (
    <Tabs
      {...rest}
      size="small"
      /*
        <b>접히면 탭바까지 감춘다</b>(2026-08-31 실물). 그리드 하나만 있는 하단은 접히면
        <b>제목 한 줄</b>이 남는데(frontend/grid.md), 탭이 있는 하단은 <b>탭바 · 버튼 줄 · 페이징이
        그대로 남고 판만 0px</b> 이 됐다 — 접은 것이 아니라 <i>판이 깨진 것</i>으로 보였다.

        <b>탭바만 감추면 되는 것이 요점이다.</b> 남은 본문(활성 탭 하나)의 그리드가 스스로
        제목 한 줄로 접히므로({@code DataGrid collapsed}), 결과가 그리드 하나짜리 하단과
        <b>같은 모양</b>이 된다 — 접힘의 규칙이 하나여야 배울 것도 하나다.
      */
      className={collapsed ? 'bo-detail-tabs bo-detail-tabs-collapsed' : 'bo-detail-tabs'}
      style={{
        // CSS 가 읽는다 — 토큰은 여기서만 얻을 수 있고 스타일시트는 정적 문자열이다.
        ['--bo-tab-min-width' as string]: '100px',
        ['--bo-tab-bar-height' as string]: `${String(token.controlHeight + 16)}px`,
        ...props.style,
      }}
    />
  );
}
