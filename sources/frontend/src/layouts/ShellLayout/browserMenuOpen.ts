// @feat FEAT-510

/**
 * 메뉴의 브라우저 새 탭/창 열기와 사용 통계를 같은 결과에 묶는다.
 *
 * <p>브라우저가 탭으로 열지 창으로 열지는 사용자 설정에 맡긴다. 다만 팝업 차단이면
 * {@code window.open}이 null을 돌려주므로, 열리지 않은 메뉴를 사용 횟수에 넣지 않는다.
 */
export function openMenuInBrowser(
  node: { menuCd: string; menuUrl: string | null },
  countMenu: (menuCd: string) => void,
): void {
  if (node.menuUrl && window.open(node.menuUrl, '_blank', 'noopener')) {
    countMenu(node.menuCd);
  }
}
