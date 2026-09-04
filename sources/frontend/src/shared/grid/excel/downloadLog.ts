import { post } from '@/shared/api';
import { EXCEL_LOG_ENDPOINTS } from '@/shared/grid/excel/api/endpoints';

/** frontend/grid.md 의 드롭다운 항목 둘. 트리는 페이지가 없어 언제나 `ALL` 이다(screen/menu/requirements.md). */
export type ExcelScope = 'PAGE' | 'ALL';

/**
 * 내렸다는 사실을 서버에 알린다 — frontend/grid-advanced.md.
 *
 * <p>sys/notification.md 는 *"다운로드는 API 요청이므로 `SYS_LO_ACCESS` 가 이미 기록한다"* 로
 * 전용 테이블을 두지 않았는데, **프론트 생성에서는 그 전제가 깨진다** — 호출이 없으므로
 * 서버가 아는 것이 아무것도 없다. 이 한 줄이 그 구멍이다.
 *
 * <p>**부수 효과다.** 응답을 기다리지 않고, 실패해도 다운로드는 이미 끝났다 — sys/menu.md 의
 * 메뉴 선택 카운트와 같은 성격이며 sys/menu.md 이 그렇게 적어 두었다.
 *
 * <h2>실패를 삼키는 것이 여기서는 맞다</h2>
 *
 * <p>화면에는 알릴 것이 없다. 파일은 이미 사용자의 디스크에 있고, *"이력을 남기지
 * 못했습니다"* 는 **사용자가 할 수 있는 일이 없는 문구**다. 서버 쪽 실패는 그쪽 로그에
 * 남으며, 클라이언트가 잘못 보낸 경우는 **사용 이력에 4xx 로** 남는다.
 *
 * <p>`menuCd` 를 보내지 않는다 — `X-Menu-Code` 헤더가 이미 나르고 그것이 곧
 * `SYS_LO_ACCESS.MENU_CD` 다(backend/packages.md). 자세한 이유는 `ExcelLogRequest` 가 갖는다.
 *
 * @param scope 어느 항목을 눌렀는가
 * @param rowCount 파일에 들어간 행 수
 * @param columnKeys 내려간 컬럼의 **식별자** — 화면에 보이는 이름이 아니다
 */
export function recordDownload(
  scope: ExcelScope,
  rowCount: number,
  columnKeys: string[],
): void {
  void post(EXCEL_LOG_ENDPOINTS.saveLog, { scope, rowCount, columnKeys }).catch(() => {
    /* 삼킨다 — 위 */
  });
}
