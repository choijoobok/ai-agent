import { useCallback, useMemo, useRef, useState } from 'react';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { auditColumns } from '@/shared/grid/auditColumns';
import { DataGrid } from '@/shared/grid/DataGrid';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow } from '@/shared/grid/rows';
import type { ColumnDef, DeleteColumnSpec, Tone } from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { NOTICE_ENDPOINTS } from '@/features/notice/api/endpoints';
import type { NoticeRow, NoticeStatus } from '@/features/notice/types';

/**
 * `NOTICE_MGMT` — screen/notice/requirements.md. <b>여기서 만든 것이 전 사용자에게 뜬다.</b>
 *
 * <p>62~65 의 관리 화면은 잘못 고치면 <b>관리자가</b> 곤란하다. 이 화면에서 잘못 올린 글은
 * <b>다음 로그인부터 전원에게 팝업으로</b> 뜨며, 그것이 저장 검증이 넷인 이유다.
 *
 * <h2>축이 셋이라 컬럼이 여섯이다</h2>
 *
 * <p>게시 기간(둘) · 즉시 내림(`useYn`) · 팝업 기간(셋)이며 <b>한 컬럼으로 합칠 수
 * 없다</b>(sys/notification.md). `USE_YN` 만으로 닫으면 <i>내리는 것을 잊는 것</i>이 정상 경로가 되어
 * 점검 안내가 점검이 끝난 뒤에도 떠 있고, 반대로 기간만 두면 잘못 올린 공지를 내리는 데
 * <b>미래의 게시 계획을 손으로 지워야</b> 한다.
 *
 * <h2>엑셀이 없다 — 근거가 배치와 다르다</h2>
 *
 * <p>sys/menu.md 의 액션 열이 `R S` 이고 ②가 감춰진다(frontend/grid.md). `BATCH_SCHEDULE` 은
 * <i>원본이 화면</i> 이라 뺐지만 여기는 <b>본문이 `nclob` 이라 엑셀 셀 상한에서
 * 잘린다</b>(frontend/grid.md) — 잘린 공지 파일은 원본도 참고 자료도 아니다.
 *
 * <h2>하단 pane 이 없다</h2>
 *
 * <p>공지는 자식이 없다. 첨부가 그 자리인데 이번 범위 밖이다(screen/notice/requirements.md). 그래서 frontend/grid.md 의
 * 제약이 걸리지 않아 <b>다중 선택을 연다</b> — 여러 건을 한 번에 지우는 일이 실제로 있다
 * (`BATCH_SCHEDULE` 은 pane 이 있어 단일이었다).
 */

const MENU_CD = 'NOTICE_MGMT';

/** 행마다 `nclob` 이 달려 있다 — 목록에서 읽지 않지만 행 수를 늘릴 이유도 없다(screen/notice/requirements.md). */
const PAGE_SIZE = 20;
const PAGE_SIZES = [20, 50, 100];

/**
 * 게시 상태 배지의 색 — 값이 코드이고 글자만 라벨이다(frontend/grid.md).
 *
 * <p>`DOWN` 과 `EXPIRED` 가 같은 회색인 것이 의도다. 둘 다 <b>지금 안 보인다</b>는 사실을
 * 말하며, 갈리는 것은 <i>왜</i> 이지 <i>지금 어떤가</i> 가 아니다 — 글자가 그 차이를 낸다.
 */
const STAT_TONE: Record<NoticeStatus, Tone> = {
  SCHEDULED: 'warn',
  ACTIVE: 'ok',
  EXPIRED: 'muted',
  DOWN: 'muted',
};

const STAT_LABEL: Record<NoticeStatus, string> = {
  SCHEDULED: MSG.NOTICE_STAT_SCHEDULED,
  ACTIVE: MSG.NOTICE_STAT_ACTIVE,
  EXPIRED: MSG.NOTICE_STAT_EXPIRED,
  DOWN: MSG.NOTICE_STAT_DOWN,
};

function statLabel(value: unknown): string {
  const key = STAT_LABEL[value as NoticeStatus];
  return key ? label(key) : codeText(value);
}

/**
 * 모르는 값을 <b>글자로 옮기되 지어내지는 않는다</b> — `batchCodes.codeText` 와 같은 규칙.
 *
 * <p>`String(value)` 를 그대로 쓰지 않는 것은 객체가 왔을 때 `[object Object]` 가 셀에
 * 박히기 때문이다 — 그것은 <i>모르는 코드</i> 보다 나쁘다: 값이 있는 것처럼 보이면서
 * 아무것도 말하지 않는다. 문자열이 아니면 빈 칸이 낫다.
 */
function codeText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}


export function NoticeMgmtPage() {
  const searchForm = useRef<SearchFormHandle>(null);

  const header = useSearchFormHeader();

  const collectConditions = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );

  const columns = useMemo(() => buildColumns(), []);
  const searchFields = useMemo(() => buildSearchFields(), []);

  /**
   * 삭제가 섞였을 때의 경고 — <b>건수 확인 앞에 선다</b>(frontend/grid.md · screen/admin/system/code/requirements.md).
   *
   * <p>`SaveApi.confirm` 은 불리언이라 문구를 실을 수 없다. 여기가 그 자리이며,
   * 되돌릴 수 없다는 사실과 <b>대안(끄기)</b>을 함께 말한다 — 사람이 실제로 하려는 일은
   * 대개 *잠깐 감추는 것*이고 `USE_YN` 이 이미 그것을 갖고 있다(screen/notice/requirements.md).
   */
  const warnDelete = useCallback((rows: GridRow<NoticeRow>[]): string[] => {
    const removed = rows.filter((row) => row.state === 'D');
    if (removed.length === 0) {
      return [];
    }
    const lines = [label(MSG.NOTICE_DELETE_CONFIRM, { count: removed.length })];
    for (const row of removed) {
      lines.push(`  ${row.data.title}`);
    }
    return lines;
  }, []);

  const api = useMemo(
    () => ({
      read: { url: NOTICE_ENDPOINTS.getList, emptyNotice: true },
      save: { url: NOTICE_ENDPOINTS.save, warn: warnDelete },
    }),
    [warnDelete],
  );

  const grid = useGridController<NoticeRow>({
    menuCd: MENU_CD,
    columns,
    api,
    pageSize: PAGE_SIZE,
    params: collectConditions,
    addRow: {
      defaults: () => ({
        sortNo: 0,
        // 채번이다 — 신규 행에서 `null` 이고 서버가 정한다.
        noticeId: null,
        title: '',
        content: '',
        /*
          <b>게시 시작을 비워 둔다.</b> *지금* 으로 채우면 사용자가 그 값을 보고 넘어가는데,
          이 칸은 **예약 게시가 성립하는 자리**라(sys/notification.md) 언제부터인지를 실제로 정해야 한다.
          필수이므로 저장이 막고, 그 막힘이 곧 *정하라* 는 신호다.
        */
        noticeFromDtm: '',
        noticeToDtm: null,
        /*
          파생은 서버가 계산한다 — 임의의 값으로 채우면 <i>계산해 보니 그렇다</i> 와
          구분되지 않는다(screen/batch/schedule/requirements.md 의 파생 셋과 같은 규칙). 저장 후 재조회에서 진짜 값이 온다.
        */
        noticeStat: 'SCHEDULED',
        // 게시하는 것이 정상이다 — 만들자마자 내려가 있으면 왜 안 보이는지 찾게 된다.
        useYn: true,
        // <b>팝업은 꺼진 채로 시작한다.</b> 켜는 것은 명시여야 한다 — 전 사용자에게 뜬다.
        popupYn: false,
        popupFromDtm: null,
        popupToDtm: null,
        regId: null,
        regDtm: null,
        modId: null,
        modDtm: null,
      }),
    },
    toSaveRow: (row) => ({
      rowState: row.state,
      noticeId: row.data.noticeId,
      // 삭제는 대상만 가리킨다 — 나머지를 보내면 서버가 쓰지 않을 값을 검증하게 된다.
      ...(row.state === 'D'
        ? {}
        : {
            title: row.data.title,
            content: row.data.content,
            noticeFromDtm: row.data.noticeFromDtm,
            noticeToDtm: row.data.noticeToDtm,
            popupYn: row.data.popupYn,
            popupFromDtm: row.data.popupFromDtm,
            popupToDtm: row.data.popupToDtm,
            useYn: row.data.useYn,
            sortNo: row.data.sortNo,
          }),
      /*
        <b>`noticeStat` 을 보내지 않는다</b>(screen/notice/requirements.md 의 `NoticeSaveRow`). 서버가 계산하는
        파생 값이라 보낼 경로를 두면 <b>화면이 게시 여부를 스스로 정하는</b> 셈이 된다 —
        읽기 전용은 화면에서만 읽기 전용이고 요청 본문은 조작할 수 있다(원칙 P1).
      */
    }),
  });

  /**
   * 지울 수 있는가 — <b>게이트가 없다</b>(screen/notice/requirements.md).
   *
   * <p>`BATCH_SCHEDULE` 은 <i>켜져 있는가·도는가</i> 를 봤지만(screen/batch/schedule/requirements.md) 공지는 지운다고
   * 조용히 멈추는 것이 없다. 지워진 뒤에 아무도 그것을 참조하지 않는다.
   *
   * <p>그래도 이 선언을 두는 것은 <b>첨부가 붙는 날 여기에 조항이 는다</b>는 자리
   * 표시이기 때문이다(screen/notice/requirements.md) — 그때 `SYS_FILE_REF` 를 함께 지워야 한다.
   */
  const deletable = useMemo<DeleteColumnSpec<NoticeRow>>(() => ({ enabled: () => true }), []);

  /**
   * 빈 상태가 <b>둘로 갈린다</b> — screen/notice/requirements.md · screen/admin/system/log/access/requirements.md.
   *
   * <p>`게시중` 하나로 걸렀을 때의 0건은 <b>사실을 말하는 답</b>이다: 지금 사용자에게
   * 아무 공지도 보이지 않는다는 뜻이고, 그것을 알고 싶어서 거른 것이다. 제목으로 걸러
   * 0건인 것은 진단이 아니라 검색 결과이며 일반 문구가 맞다.
   *
   * <p><b>조회할 때 정한다.</b> 폼의 현재 값을 렌더 중에 읽을 수 없고(`SearchFormHandle`
   * 은 `collect` 와 `apply` 뿐이다), 읽을 수 있더라도 <b>지금 보이는 0건은 마지막으로
   * 조회한 조건의 결과</b>다 — 조건을 고치고 조회하지 않은 상태에서 문구가 먼저 바뀌면
   * 화면이 거짓말한다.
   */
  const [emptyText, setEmptyText] = useState<string>(MSG.NOTICE_EMPTY);

  const readList = useCallback(async () => {
    const conditions = searchForm.current?.collect() ?? [];
    const stat = conditions.find((one) => one.field === 'noticeStat');
    const values = Array.isArray(stat?.value) ? (stat.value as string[]) : [];
    setEmptyText(
      values.length === 1 && values[0] === 'ACTIVE' ? MSG.NOTICE_EMPTY_ACTIVE : MSG.NOTICE_EMPTY,
    );
    await grid.read();
  }, [grid]);

  return (
    <FillColumn>
      <SearchForm
        handleRef={searchForm}
        fields={searchFields}
        onSubmit={() => void readList()}
        onReset={grid.clearFilters}
        onActiveCountChange={header.onActiveCountChange}
        collapsed={header.collapsed}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <DataGrid<NoticeRow>
          title={MSG.NOTICE_GRID_TITLE}
          menuCd={MENU_CD}
          controller={grid}
          pageSizes={PAGE_SIZES}
          deletable={deletable}
          emptyText={emptyText}
          /*
            <b>다중이다</b>(screen/notice/requirements.md). 하단 pane 이 없으므로 frontend/grid.md 의 제약이 걸리지 않고
            (`BATCH_SCHEDULE` 은 pane 이 있어 단일이었다 — screen/batch/schedule/requirements.md), 여러 건을 한 번에
            지우는 일이 실제로 있다.
          */
          selection="multiple"
        />
      </div>
    </FillColumn>
  );
}

// ── 컬럼 (screen/notice/requirements.md) ────────────────────────────────────────────────

/**
 * <b>본문이 목록에 보인다.</b> 64 가 이력에서 전문을 감춘 것과 갈리는데 근거가 양이었기
 * 때문이다 — 이력은 수천만 행이고 공지는 수백 건이다(screen/notice/requirements.md).
 *
 * <p>편집기가 <b>`largeText` 다</b>. screen/notice/requirements.md 은 `textModal` 로 적었지만 그 편집기는 아직
 * 없고(`shared/grid/types.ts` — *"`listModal` · `textModal` · `richText` 는 아직 없다"*),
 * `BATCH_SCHEDULE` 의 `PARAM_JSON` 도 같은 자리에서 `largeText` 를 쓴다. 두 문서가 모두
 * `textModal` 이라 적었으므로 <b>구현이 오면 두 화면이 함께 바뀐다</b>.
 */
function buildColumns(): ColumnDef<NoticeRow>[] {
  return [
    {
      field: 'sortNo',
      header: MSG.NOTICE_COL_SORT_NO,
      type: 'number',
      width: 80,
      sortable: true,
      /*
        <b>상단 고정용이고 드래그가 아니라 숫자다</b>(screen/notice/requirements.md · screen/batch/schedule/requirements.md 과 같은 판단).
        중복을 막지 않으며 결정성은 tie-breaker(`NOTICE_ID`)가 준다 — 그 결정성이
        <b>화면에 직접 보인다</b>: 팝업이 이 정렬의 첫 건을 집는다(screen/notice/requirements.md C안).
      */
      editable: true,
    },
    {
      field: 'noticeId',
      header: MSG.NOTICE_COL_NOTICE_ID,
      type: 'number',
      width: 90,
      // 채번이라 고칠 수 없고, 문의 대조용이라 평소에 볼 일이 없다.
      visible: false,
    },
    {
      field: 'title',
      header: MSG.NOTICE_COL_TITLE,
      type: 'text',
      width: 260,
      sortable: false,
      required: true,
      editable: true,
    },
    {
      field: 'content',
      header: MSG.NOTICE_COL_CONTENT,
      type: 'text',
      width: 320,
      fill: true,
      /*
        <b>정렬을 끈다 — 벤더가 막는다</b>(frontend/grid.md). Oracle 은 `CLOB` 을 `ORDER BY` 에
        쓸 수 없어 4벤더 무수정 기동이 깨진다(22). 필터도 끈다: 값이 길어 `set` 필터가
        되지 않고, 부분 일치는 조회조건이 아니라 결과 내 필터라 오해를 부른다.
      */
      sortable: false,
      filter: false,
      required: true,
      editable: true,
      editor: 'largeText',
    },
    {
      field: 'noticeFromDtm',
      header: MSG.NOTICE_COL_FROM_DTM,
      type: 'dateTime',
      width: 160,
      sortable: true,
      /*
        <b>필수다</b>(sys/notification.md). 비울 수 있게 두면 *지금부터* 와 *정하지 않음* 이 같은 값이
        되어 자동 노출을 판정할 수 없다 — 필수이므로 <b>예약 게시가 성립한다</b>.
      */
      required: true,
      editable: true,
    },
    {
      field: 'noticeToDtm',
      header: MSG.NOTICE_COL_TO_DTM,
      type: 'dateTime',
      width: 160,
      /*
        <b>비우면 무기한이다</b>(sys/notification.md). 필수로 두고 먼 미래를 넣게 하면 그 값이 곧
        매직 넘버가 되고, 벤더마다 `TIMESTAMP` 상한이 달라 이식성이 걸린다(22).
      */
      editable: true,
    },
    {
      field: 'noticeStat',
      header: MSG.NOTICE_COL_STAT,
      type: 'text',
      width: 100,
      filter: false,
      /*
        <b>파생이며 읽기 전용이다</b>(screen/notice/requirements.md). 이 칸이 <b>기간을 눈으로 확인시킨다</b> —
        게시 시작을 미래로 넣고 저장했는데 여기가 `예정` 이면 맞게 쓴 것이다.

        <b>값은 코드이고 글자만 라벨이다</b>(frontend/grid.md) — `tone` 맵이 코드를 키로 봐야 하고
        정렬·필터도 코드를 본다. screen/batch/schedule/requirements.md 이 배지에서 겪은 그 자리다.
      */
      renderer: 'badge',
      tone: STAT_TONE,
      display: statLabel,
    },
    {
      field: 'useYn',
      header: MSG.NOTICE_COL_USE_YN,
      type: 'ynFlag',
      width: 80,
      sortable: false,
      /*
        <b>스위치가 즉시 저장을 뜻하지 않는다</b>(frontend/grid.md). 그리고 이 값은 기간을 이긴다 —
        끄면 게시 기간 안이어도 목록에서 사라진다(screen/notice/requirements.md).
      */
      editable: true,
    },
    {
      field: 'popupYn',
      header: MSG.NOTICE_COL_POPUP_YN,
      type: 'ynFlag',
      width: 80,
      /*
        켜면 아래 둘이 필수가 되고, <b>팝업 기간이 게시 기간을 벗어나면 저장이
        거부한다</b>(screen/notice/requirements.md) — 없으면 *목록에 없는 공지가 팝업으로 뜬다*.
      */
      editable: true,
    },
    {
      field: 'popupFromDtm',
      header: MSG.NOTICE_COL_POPUP_FROM,
      type: 'dateTime',
      width: 160,
      /*
        <b>기본 숨김이다</b> — 팝업을 쓰는 공지가 소수라 평소에 볼 일이 없다. 켜는 순간
        필수가 되므로 그때 컬럼 설정에서 켠다.
      */
      visible: false,
      editable: true,
    },
    {
      field: 'popupToDtm',
      header: MSG.NOTICE_COL_POPUP_TO,
      type: 'dateTime',
      width: 160,
      visible: false,
      editable: true,
    },
    // 감사 4컬럼은 켤 수 있다 — 이 행은 사람이 만들고 사람이 고치므로 감사가 실제로 갈린다.
    ...auditColumns<NoticeRow>(),
  ];
}

// ── 조회조건 (screen/notice/requirements.md) ────────────────────────────────────────────

/**
 * 넷이며 <b>기간이 필수가 아니다</b>.
 *
 * <p>screen/admin/system/log/access/requirements.md 의 <i>기간 필수 + 상한</i> 을 상속하지 않는다(screen/notice/requirements.md) — 근거가 대용량인데
 * 공지는 수백 건이다. screen/batch/schedule/requirements.md 이 배치 등록에 내린 것과 같은 판단이다.
 *
 * <p><b>`게시 상태` 의 기본값이 `내림` 을 뺀 셋이다.</b> 내려 둔 공지는 *안 보이는 것이
 * 정상* 이라 목록의 기본에서도 빠진다 — <b>감추는 것이 아니라 기본값</b>이고 비우면 전부
 * 나온다. `BATCH_SCHEDULE` 이 `사용 여부` 를 *전체* 로 둔 것과 갈리는데, 저쪽은 꺼 둔
 * 배치를 감추면 <b>같은 것을 또 만드는</b> 사고가 났기 때문이다. 공지는 중복이 사고가
 * 아니다(PK 가 채번이다).
 *
 * <p><b>본문 조건이 없다</b> — `nclob` 이라 조건으로도 정렬로도 쓸 수 없고(backend/api.md),
 * `LIKE` 는 <b>인덱스를 못 타면서 되는 것처럼 보인다</b>.
 */
function buildSearchFields(): SearchField[] {
  return [
    {
      field: 'title',
      label: MSG.NOTICE_SEARCH_TITLE,
      type: 'text',
      op: 'contains',
      ops: ['eq', 'startsWith', 'contains', 'endsWith'],
    },
    {
      field: 'noticeFromDtm',
      label: MSG.NOTICE_SEARCH_PERIOD,
      type: 'dateRange',
      // 비우고 조회할 수 있다 — 공지는 수백 건이다(screen/notice/requirements.md).
      required: false,
      /*
        <b>기본값이 비어 있다</b>(screen/notice/requirements.md). `dateRange` 는 적지 않으면 시스템 기본 기간
        (`ui.search.range-days.default-days` — 7일)으로 채워지는데, 그러면 <b>지난달에 올린
        공지가 기본 조회에서 사라진다</b>. 공지는 이력이 아니라 <i>지금 게시 중인 것</i>을
        묻는 화면이고, 그 좁히기는 `게시 상태` 가 한다.

        빈 문자열이 *비워 둔다* 의 뜻이다(screen/admin/system/user/requirements.md 이 만든 규약) — 적지 않는 것과 다르다.
      */
      defaultValue: '',
    },
    {
      /*
        <b>파생 조건이다</b>(screen/notice/requirements.md) — `USE_YN` 과 기간 둘의 조합이며 컬럼이 아니다.
        `72` 가 세는 파생 조건의 <b>다섯째 사례</b>이고, 앞의 넷과 달리 <b>`in` 을
        받는다</b>: 화면 기본값이 *세 개 선택* 이기 때문이다.
      */
      field: 'noticeStat',
      label: MSG.NOTICE_SEARCH_STAT,
      type: 'select',
      op: 'in',
      ops: ['in'],
      defaultValue: ['SCHEDULED', 'ACTIVE', 'EXPIRED'],
      options: [
        { value: 'SCHEDULED', text: label(MSG.NOTICE_STAT_SCHEDULED) },
        { value: 'ACTIVE', text: label(MSG.NOTICE_STAT_ACTIVE) },
        { value: 'EXPIRED', text: label(MSG.NOTICE_STAT_EXPIRED) },
        { value: 'DOWN', text: label(MSG.NOTICE_STAT_DOWN) },
      ],
    },
    {
      /*
        <b>`select` 이지 `ynFlag` 가 아니다</b>(frontend/search-form.md). 스위치로 두면 *끄기 = N* 이 되어
        <b>*전체* 를 표현할 자리가 없다</b>.
      */
      field: 'popupYn',
      label: MSG.NOTICE_SEARCH_POPUP,
      type: 'select',
      ops: ['eq'],
      options: [
        { value: 'Y', text: label(MSG.NOTICE_POPUP_ON) },
        { value: 'N', text: label(MSG.NOTICE_POPUP_OFF) },
      ],
    },
  ];
}
