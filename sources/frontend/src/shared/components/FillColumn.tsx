import type { ReactNode } from 'react';

/**
 * 부모를 <b>세로로 꽉 채우는 판</b> — 화면의 뿌리와 탭 본문이 같은 모양을 갖는다.
 *
 * <p><b>네 속성이 함께여야 뜻이 성립한다.</b> `height: 100%` 로 부모를 채우고,
 * `flex` 열로 쌓고, `minHeight: 0` 으로 <b>자식이 넘칠 때 부모가 늘어나지 않게</b> 한다 —
 * 마지막 하나가 빠지면 그리드가 자기 스크롤을 갖지 못하고 화면 전체가 늘어난다. 스물일곱
 * 자리가 이 넷을 각자 적고 있었다(2026-09-02 실측).
 *
 * <h2>문서의 `<PageContainer>` 가 이것이다</h2>
 *
 * <p>frontend/packages.md 은 *제목 + 액션버튼 + 콘텐츠* 를 갖는 `<PageContainer>` 를 적어 두었지만, 그 둘은
 * <b>셸이 갖게 됐다</b> — 제목은 브레드크럼이고(frontend/tabs.md) 액션 버튼은 그리드 헤더가 선언으로
 * 렌더한다(frontend/grid.md). 남은 것이 <b>채우는 열</b> 하나이므로 이름도 그것이다.
 */
export function FillColumn({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {children}
    </div>
  );
}
