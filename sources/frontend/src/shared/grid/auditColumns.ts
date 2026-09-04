import type { ColumnDef } from '@/shared/grid/types';
import { MSG } from '@/shared/i18n/messageKeys';

/**
 * 감사 넷 — 등록자 · 등록일시 · 수정자 · 수정일시.
 *
 * <p><b>모든 업무 테이블이 갖는 컬럼이라 화면마다 다시 적을 값이 아니다</b>
 * (`BaseAuditEntity` — backend/packages.md). 열두 화면이 각자 적고 있었고 그 사이에 <b>다섯 가지로
 * 벌어졌다</b>(2026-09-02 실측): 폭이 있는 것과 없는 것, `sortable` 이 붙은 것과 안 붙은 것,
 * `visible: false` 대신 `hidden` 인 것. 같은 넷이 화면마다 다르게 보일 이유가 없다.
 *
 * <p><b>기본은 숨김이되 켤 수 있다</b>(`visible: false` — frontend/grid.md). 켜서 보면 안 되는 값이
 * 아니라 <b>늘 볼 값이 아닐 뿐</b>이므로 `hidden` 이 아니다 — `hidden` 은 설정 창 목록에도
 * 나오지 않는 컬럼의 것이다.
 *
 * <p><b>이 함수가 컬럼을 켜지는 않는다.</b> 화면이 감사 넷을 <i>보여줄</i> 자리는 컬럼
 * 배열의 맨 뒤이며(열두 화면이 모두 그렇다) 순서는 부르는 쪽이 정한다:
 *
 * <pre>
 * return [ ...업무컬럼, ...auditColumns&lt;CodeRow&gt;({ sortable: true }) ];
 * </pre>
 */
export interface AuditColumnOptions {
  /**
   * 일시 두 칸의 정렬 허용 — frontend/grid.md.
   *
   * <p><b>서버 화이트리스트에 `.sortable()` 이 있어야 실제로 열린다</b>. 선언만 하고 서버가
   * 열지 않으면 눌러도 아무 일이 없으므로 <b>스펙을 확인한 화면만</b> 켠다.
   */
  sortable?: boolean;
  /**
   * 설정 창에서도 켤 수 없게 한다 — frontend/grid.md.
   *
   * <p>기본값인 `visible: false` 와 갈리는 자리다. 감사 넷을 <b>사람이 볼 일이 없는 화면</b>
   * (메시지 관리가 그렇다 — 행이 시드이고 등록자가 언제나 같다)에서만 쓴다.
   */
  hidden?: boolean;
}

/** 부르는 쪽의 행 타입을 그대로 받는다 — `field` 는 네 이름으로 고정이다. */
export function auditColumns<T>(options: AuditColumnOptions = {}): ColumnDef<T>[] {
  const { sortable, hidden } = options;
  const visibility = hidden ? { hidden: true } : { visible: false };

  return [
    { field: 'regId', header: MSG.GRID_COL_REG_ID, type: 'text', width: 120, ...visibility },
    {
      field: 'regDtm',
      header: MSG.GRID_COL_REG_DTM,
      type: 'dateTime',
      width: 160,
      ...visibility,
      ...(sortable ? { sortable: true } : {}),
    },
    { field: 'modId', header: MSG.GRID_COL_MOD_ID, type: 'text', width: 120, ...visibility },
    {
      field: 'modDtm',
      header: MSG.GRID_COL_MOD_DTM,
      type: 'dateTime',
      width: 160,
      ...visibility,
      ...(sortable ? { sortable: true } : {}),
    },
  ];
}
