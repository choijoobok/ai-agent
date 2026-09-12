import { useCallback, useMemo, useRef, useState } from 'react';
import { App } from 'antd';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { DataGrid } from '@/shared/grid/DataGrid';
import { useGridController } from '@/shared/grid/useGridController';
import type { ColumnDef, Tone } from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { NOTI_REQUEST_ENDPOINTS } from '@/features/notirequest/api/endpoints';
import { updateHandle } from '@/features/notirequest/api/notiRequestApi';
import { HandleModal } from '@/features/notirequest/components/HandleModal';
import type { NotiRequestRow, ReqStatus, ReqType } from '@/features/notirequest/types';

/**
 * `NOTI_REQUEST` — screen/noti-request/requirements.md. <b>62~65 를 통틀어 편집 열이 통째로 없는 첫 화면이다.</b>
 *
 * <p>frontend/grid.md 의 *"그리드가 목록이자 편집 화면"* 의 예외이며 이유가 셋이다.
 * 처리는 <b>저장이 아니라 판정</b>이고, <b>부수 효과가 있고</b>(요청자에게 알림이 나간다),
 * <b>반려는 두 값을 함께 강제</b>해야 하는데 셀 하나로는 안 된다.
 *
 * <h2>대기열이라 오름차순이다 — 로그 3종과 반대다</h2>
 *
 * <p>64 의 이력은 <i>"방금 무슨 일이 있었나"</i> 를 묻지만 여기는 <b>할 일 목록</b>이고,
 * 대기열은 오래 기다린 것이 먼저다. 최신을 위에 두면 <b>가장 오래 방치된 요청이
 * 목록 맨 아래로 밀려 영원히 안 보인다</b>. 조회조건 기본값이 `접수` 하나인 것도 같은
 * 방향이다 — 전체를 기본으로 두면 처리된 것이 대기 중인 것을 덮는다.
 *
 * <h2>섞이면 전부 막는다</h2>
 *
 * <p>선택에 이미 처리된 것이 하나라도 있으면 버튼이 비활성이다. 처리 가능한 것만
 * 골라 실행하면 <b>알림이 일부에게만 나가고</b> 사용자는 무엇이 처리됐는지 모른다 —
 * 되돌리는 길이 없으므로 부분 성공을 만들지 않는다. 서버도 같은 것을 다시 본다(원칙 P1).
 *
 * <h2>비어 있는 것이 정상인 유일한 화면이다</h2>
 *
 * <p>대기열이 비었다는 것은 <b>좋은 소식</b>이고 그렇게 읽혀야 한다.
 */

const MENU_CD = 'NOTI_REQUEST';

/** 처리 대기를 훑는 화면이다 — 넘기며 보는 것보다 한눈에 보는 것이 낫다(screen/noti-request/requirements.md). */
const PAGE_SIZE = 50;
const PAGE_SIZES = [50, 100, 500];

const STAT_TONE: Record<ReqStatus, Tone> = {
  RECEIVED: 'none',
  DONE: 'ok',
  REJECTED: 'warn',
};

const STAT_LABEL: Record<ReqStatus, string> = {
  RECEIVED: MSG.NOTI_REQUEST_STAT_RECEIVED,
  DONE: MSG.NOTI_REQUEST_STAT_DONE,
  REJECTED: MSG.NOTI_REQUEST_STAT_REJECTED,
};

const TYPE_LABEL: Record<ReqType, string> = {
  ROLE_GRANT: MSG.NOTI_REQUEST_TYPE_ROLE_GRANT,
  UNLOCK: MSG.NOTI_REQUEST_TYPE_UNLOCK,
  ETC: MSG.NOTI_REQUEST_TYPE_ETC,
};

/**
 * 유형 배지의 색 — <b>`UNLOCK` 만 다르다</b>.
 *
 * <p>잠금 해제는 <i>지금 못 들어오고 있는 사람</i>이라 기다리는 비용이 다른 둘과 다르다.
 * 권한 신청은 하루 늦어도 일이 되고, 잠긴 계정은 그동안 아무것도 못 한다.
 */
const TYPE_TONE: Record<ReqType, Tone> = {
  ROLE_GRANT: 'none',
  UNLOCK: 'warn',
  ETC: 'muted',
};

function statLabel(value: unknown): string {
  const key = STAT_LABEL[value as ReqStatus];
  return key ? label(key) : codeText(value);
}

function typeLabel(value: unknown): string {
  const key = TYPE_LABEL[value as ReqType];
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


export function NotiRequestPage() {
  const searchForm = useRef<SearchFormHandle>(null);
  const { message } = App.useApp();

  /** 열려 있는 모달의 방향 — `null` 이면 닫혀 있다. */
  const [handling, setHandling] = useState<ReqStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const header = useSearchFormHeader();

  const collectConditions = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );

  const columns = useMemo(() => buildColumns(), []);
  const searchFields = useMemo(() => buildSearchFields(), []);

  const api = useMemo(
    () => ({ read: { url: NOTI_REQUEST_ENDPOINTS.getList, emptyNotice: true } }),
    [],
  );

  const grid = useGridController<NotiRequestRow>({
    menuCd: MENU_CD,
    columns,
    api,
    pageSize: PAGE_SIZE,
    params: collectConditions,
    /*
      <b>편집을 열지 않는다</b>(screen/noti-request/requirements.md). 열면 저장할 곳이 없는 셀이 생기고, 이 화면에는
      `save` API 자체가 없다 — 상태는 모달로만 바뀐다.
    */
    editable: false,
  });

  /**
   * 고른 것 중 <b>처리 가능한가</b> — screen/noti-request/requirements.md.
   *
   * <p>하나라도 `RECEIVED` 가 아니면 버튼이 비활성이다. <b>처리 가능한 것만 골라 실행하지
   * 않는다</b> — 일부만 처리하면 알림이 일부에게만 나가고 사용자는 무엇이 처리됐는지
   * 모른다.
   */
  const selected = grid.selected.map((row) => row.data);
  const blocked =
    selected.length === 0 || selected.some((row) => row.reqStatCd !== 'RECEIVED');
  const mixed = selected.length > 0 && blocked;

  const handle = useCallback(
    async (memo: string) => {
      if (!handling) return;
      setBusy(true);
      try {
        await updateHandle(
          selected.map((row) => row.reqId),
          handling,
          memo || null,
        );
        setHandling(null);
        message.success(label(MSG.GRID_ACTION_DONE, { count: selected.length }));
        /*
          <b>다시 읽는다.</b> 상태와 처리자·처리일시가 서버에서 채워지고(frontend/grid.md), 기본
          조건이 `접수` 라 처리한 행은 <b>목록에서 사라진다</b> — 그것이 대기열의 정상
          동작이며 *처리됐다* 의 가장 분명한 신호다.
        */
        await grid.read();
      } finally {
        setBusy(false);
      }
    },
    [grid, handling, message, selected],
  );

  return (
    <FillColumn>
      <SearchForm
        handleRef={searchForm}
        fields={searchFields}
        onSubmit={() => void grid.read()}
        onReset={grid.clearFilters}
        onActiveCountChange={header.onActiveCountChange}
        collapsed={header.collapsed}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <DataGrid<NotiRequestRow>
          title={MSG.NOTI_REQUEST_GRID_TITLE}
          menuCd={MENU_CD}
          controller={grid}
          pageSizes={PAGE_SIZES}
          emptyText={MSG.NOTI_REQUEST_EMPTY}
          /*
            <b>다중이다</b>(screen/noti-request/requirements.md — 확인 모달이 *요청 N건* 을 말한다). 하단 pane 이
            없으므로 frontend/grid.md 의 제약(다중이면 행 클릭 선택이 꺼진다)이 잃을 것을 만들지
            않는다 — `BATCH_HISTORY` 가 같은 이유로 다중이다(screen/batch/history/requirements.md).
          */
          selection="multiple"
          /*
            처리·반려는 `api.actions` 가 아니라 <b>임의 컨트롤</b>이다(frontend/grid.md 의 Ⓐ).
            `actions` 는 *고른 행을 서버에 넘긴다* 는 한 모양인데, 여기는 <b>모달이 값을
            하나 더 받아야</b> 하고(사유) 그 값의 필수 여부가 방향마다 다르다.
          */
          controls={[
            {
              key: 'done',
              slot: 'beforeRead',
              type: 'button',
              label: MSG.NOTI_REQUEST_ACTION_DONE,
              actionCd: 'SAVE',
              menuCd: MENU_CD,
              disabled: blocked,
              /*
                <b>왜 눌리지 않는지 말한다</b>(frontend/grid.md · screen/admin/system/code/requirements.md). 선택이 0건인 것은 눈에
                보이지만 <b>이미 처리된 것이 섞인 것</b>은 안 보인다 — 고른 행이 다섯인데
                버튼이 죽어 있으면 사용자는 권한을 의심한다.
              */
              hint: mixed ? MSG.NOTI_REQUEST_HINT_NOT_RECEIVED : undefined,
              onClick: () => setHandling('DONE'),
            },
            {
              key: 'reject',
              slot: 'beforeRead',
              type: 'button',
              label: MSG.NOTI_REQUEST_ACTION_REJECT,
              actionCd: 'SAVE',
              menuCd: MENU_CD,
              disabled: blocked,
              hint: mixed ? MSG.NOTI_REQUEST_HINT_NOT_RECEIVED : undefined,
              onClick: () => setHandling('REJECTED'),
            },
          ]}
        />
      </div>

      {/*
        <b>`key` 가 방향이다.</b> 열 때마다 새로 마운트되므로 사유 칸이 저절로 비고,
        효과 안에서 `setState` 를 부르지 않아도 된다(연쇄 렌더를 만든다).

        비우는 것이 중요한 이유는 <b>그 메모가 다른 사람에게 가기 때문</b>이다 — 앞서
        반려하며 쓴 사유가 남아 있으면 다음 처리에 딸려 간다.
      */}
      <HandleModal
        key={handling ?? 'closed'}
        to={handling}
        targets={selected}
        busy={busy}
        onCancel={() => setHandling(null)}
        onConfirm={(memo) => void handle(memo)}
      />
    </FillColumn>
  );
}

// ── 컬럼 (screen/noti-request/requirements.md) ────────────────────────────────────────────────

/**
 * <b>편집 열이 하나도 없다.</b> `editable` 이 붙은 컬럼이 없는 것이 이 표의 요점이며,
 * 62~65 를 통틀어 처음이다(screen/noti-request/requirements.md).
 *
 * <p>요청 내용과 처리 메모는 <b>읽기 모드로 열린다</b> — `VARCHAR(2000)` 이라 셀 한 줄에
 * 안 들어가고, frontend/grid.md 가 <i>"`editable: false` 가 못 본다를 뜻하지 않는다"</i> 고 한
 * 그 자리다. `nclob` 이 아닌 컬럼에 그 규약이 적용되는 첫 사례이기도 하다.
 */
function buildColumns(): ColumnDef<NotiRequestRow>[] {
  return [
    {
      field: 'creDtm',
      header: MSG.NOTI_REQUEST_COL_CRE_DTM,
      type: 'dateTime',
      width: 160,
      /*
        <b>기본이 오름차순이다</b>(screen/noti-request/requirements.md) — 서버가 그렇게 정렬해 준다. 정렬을 여는
        것은 *가장 최근 요청* 을 보고 싶은 경우가 실제로 있어서다(방금 낸 것을 확인).
      */
      sortable: true,
    },
    {
      field: 'userNm',
      header: MSG.NOTI_REQUEST_COL_USER,
      type: 'text',
      width: 140,
      /*
        <b>미사용 계정이면 이름 옆에 표시가 붙는다</b>(screen/noti-request/requirements.md). *지금 로그인할 수 없는
        사람* 임을 알리되 <b>처리는 막지 않는다</b> — 요청은 계정이 살아 있을 때 낸 것이다.

        <b>`(삭제된 사용자)` 는 없다</b>. `SYS_USER` 는 물리 삭제를 하지 않으므로
        (USER-02 · sys/user-role.md) screen/admin/system/batch/schedule/requirements.md 의 `(삭제된 배치)` 같은 고아가 생기지 않는다.
      */
      derive: (row) => (row.userUseYn ? row.userNm : `${row.userNm} (${label(MSG.NOTI_REQUEST_USER_DISABLED)})`),
    },
    {
      field: 'reqTypeCd',
      header: MSG.NOTI_REQUEST_COL_TYPE,
      type: 'text',
      width: 110,
      /*
        <b>값은 코드이고 글자만 라벨이다</b>(frontend/grid.md). 공통코드가 아니라 소스의 값이며
        (sys/notification.md) 관리자가 늘리면 처리 코드가 없는 값이 생긴다.
      */
      renderer: 'badge',
      tone: TYPE_TONE,
      display: typeLabel,
    },
    {
      field: 'reqContent',
      header: MSG.NOTI_REQUEST_COL_CONTENT,
      type: 'text',
      width: 320,
      fill: true,
      filter: false,
      /*
        <b>읽기 전용이어도 열린다</b>(frontend/grid.md). 긴 텍스트는 열어야만 보이므로 읽기 전용
        컬럼도 뷰어를 연다 — frontend/grid.md 의 *"읽기 전용 셀입니다"* 가 <b>여기서는 나오지
        않는다</b>: 거부할 것이 아니라 보여줄 것이기 때문이다.
      */
      viewer: 'largeText',
    },
    {
      field: 'reqStatCd',
      header: MSG.NOTI_REQUEST_COL_STAT,
      type: 'text',
      width: 90,
      renderer: 'badge',
      tone: STAT_TONE,
      display: statLabel,
    },
    {
      field: 'handlerNm',
      header: MSG.NOTI_REQUEST_COL_HANDLER,
      type: 'text',
      width: 120,
      // 미처리면 빈 칸이다 — 그것이 *아직 아무도 안 봤다* 의 표시다.
      filter: false,
    },
    {
      field: 'handleDtm',
      header: MSG.NOTI_REQUEST_COL_HANDLE_DTM,
      type: 'dateTime',
      width: 160,
      filter: false,
    },
    {
      field: 'handleMemo',
      header: MSG.NOTI_REQUEST_COL_MEMO,
      type: 'text',
      width: 240,
      filter: false,
      // 요청 내용과 같은 이유로 열린다 — 반려 사유가 여기 있고 그것이 요청자에게 간 문장이다.
      viewer: 'largeText',
    },
    {
      field: 'reqId',
      header: MSG.NOTI_REQUEST_COL_REQ_ID,
      type: 'number',
      width: 90,
      // 문의 대조용이라 평소에 볼 일이 없다.
      visible: false,
    },
    {
      field: 'userId',
      header: MSG.GRID_COL_REG_ID,
      type: 'text',
      width: 120,
      // 이름으로 찾는 것이 보통이고 ID 가 필요한 것은 계정을 조사할 때다.
      visible: false,
    },
  ];
}

// ── 조회조건 (screen/noti-request/requirements.md) ────────────────────────────────────────────

/**
 * 넷이며 <b>상태의 기본값이 `접수` 하나</b>다.
 *
 * <p>처리함은 <b>할 일 목록</b>이다. 전체를 기본으로 두면 <b>처리된 것이 대기 중인 것을
 * 덮는다</b> — `NOTICE_MGMT` 의 게시 상태 기본값과 방향이 같고 <b>더 좁다</b>.
 *
 * <p>기간은 필수가 아니다(screen/noti-request/requirements.md) — screen/admin/system/log/access/requirements.md 의 근거가 대용량인데 요청은 수천 건이다.
 *
 * <p><b>처리 메모 조건이 없다</b> — `VARCHAR(2000)` 이라 실을 수는 있지만 <b>관리자가
 * 그때 쓴 문장</b>이라 형식이 없다. 조건으로 열면 `LIKE` 가 되고, 그 물음에 답하는 것은
 * 상태다(`BatchHistorySpec` 이 `RSLT_MSG` 를 뺀 것과 같은 근거).
 */
function buildSearchFields(): SearchField[] {
  return [
    {
      field: 'creDtm',
      label: MSG.NOTI_REQUEST_SEARCH_PERIOD,
      type: 'dateRange',
      required: false,
      /*
        <b>기본값이 비어 있다</b>(screen/noti-request/requirements.md). 대기열에서 기간을 기본으로 걸면 <b>가장 오래
        방치된 요청이 기본 조회에서 사라진다</b> — 그것이 이 화면이 정확히 보여줘야 하는
        행이다. 좁히기는 `상태` 가 한다(기본 `접수`).
      */
      defaultValue: '',
    },
    {
      field: 'reqStatCd',
      label: MSG.NOTI_REQUEST_SEARCH_STAT,
      type: 'select',
      op: 'in',
      ops: ['in'],
      // <b>대기열의 기본값</b>이다 — screen/noti-request/requirements.md.
      defaultValue: ['RECEIVED'],
      options: [
        { value: 'RECEIVED', text: label(MSG.NOTI_REQUEST_STAT_RECEIVED) },
        { value: 'DONE', text: label(MSG.NOTI_REQUEST_STAT_DONE) },
        { value: 'REJECTED', text: label(MSG.NOTI_REQUEST_STAT_REJECTED) },
      ],
    },
    {
      field: 'reqTypeCd',
      label: MSG.NOTI_REQUEST_SEARCH_TYPE,
      type: 'select',
      op: 'in',
      ops: ['in'],
      options: [
        { value: 'ROLE_GRANT', text: label(MSG.NOTI_REQUEST_TYPE_ROLE_GRANT) },
        { value: 'UNLOCK', text: label(MSG.NOTI_REQUEST_TYPE_UNLOCK) },
        { value: 'ETC', text: label(MSG.NOTI_REQUEST_TYPE_ETC) },
      ],
    },
    {
      /*
        <b>이름으로 찾는다</b> — `USER_ID` 로 찾는 사람은 계정을 조사할 때뿐이고, 그
        화면은 `USER_MGMT` 다.
      */
      field: 'userNm',
      label: MSG.NOTI_REQUEST_SEARCH_USER,
      type: 'text',
      op: 'contains',
      ops: ['eq', 'startsWith', 'contains'],
    },
  ];
}
