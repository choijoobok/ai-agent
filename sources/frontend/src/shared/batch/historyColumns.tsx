import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import type { ColumnDef } from '@/shared/grid/types';
import { execTypeLabel, rsltLabel, RSLT_TONE } from '@/shared/batch/batchCodes';
import type { BatchHistoryRow } from '@/shared/batch/historyRow';

/**
 * 실행 이력의 컬럼 — screen/admin/system/batch/schedule/requirements.md. <b>화면 둘이 나눠 쓴다.</b>
 *
 * <p>`BATCH_HISTORY` 의 마스터와 `BATCH_SCHEDULE` 의 하단 pane 이 같은 행을 그린다 —
 * screen/admin/system/batch/schedule/requirements.md 가 pane 을 <i>"§4.2 와 같은 컬럼"</i> 으로 정했기 때문이다. 두 곳에 따로 적으면
 * <b>같은 값이 화면마다 다른 색과 다른 단위</b>로 보이고, 그것이 정확히 이 슬라이스가
 * 피하려는 종류의 어긋남이다(sys/batch.md 이 판정을 코드에 둔 이유와 같은 축).
 *
 * <p><b>편집 선언이 한 줄도 없다</b>(screen/admin/system/log/access/requirements.md) — 그래서 상태 컬럼도 삭제 컬럼도 붙지
 * 않는다(frontend/grid.md). 이력 행은 불변이다.
 *
 * <p><b>`RSLT_DTL_MSG` · `ERR_MSG` 가 없다.</b> 둘 다 `nclob` 이라 목록에 싣지 않으며
 * (screen/admin/system/batch/schedule/requirements.md) 그 자리에 *상세* 파생 컬럼 하나가 온다.
 *
 * <p><b>`features/` 가 아니라 `shared/` 인 것</b>이 frontend/packages.md 이다 — 두 번째 화면이 쓰는
 * 순간 올린다. `features` 끼리 직접 import 하면 <b>폴더가 인가 경계라는 규칙</b>도
 * 함께 흐려진다(seed.md).
 */

/**
 * 마스터의 컬럼 — 배치를 가로질러 본다.
 *
 * @param openDetail `[보기]` 를 눌렀을 때. 없으면 <b>누를 수 없는 글자</b>가 아니라
 *     <b>컬럼 자체가 빠진다</b>(pane 이 그렇다)
 * @param openSchedule `배치 ID` 셀 더블 클릭 → `BATCH_SCHEDULE`(screen/admin/system/batch/schedule/requirements.md)
 */
export function historyColumns(
  openDetail: (row: BatchHistoryRow) => void,
  openSchedule: (row: BatchHistoryRow) => void,
): ColumnDef<BatchHistoryRow>[] {
  return [
    startDtm(true),
    {
      field: 'batchId',
      header: MSG.BATCH_HISTORY_COL_BATCH_ID,
      type: 'text',
      width: 160,
      sortable: true,
      /*
        <b>행이 아니라 칸이다</b>(screen/admin/system/log/access/requirements.md 와 같은 규칙). 이 화면은 <b>행 더블 클릭이 이미
        상세 모달</b>이므로 축이 다르면 자리도 달라야 한다 — 겹치면 하나가 다른 하나를 가린다.

        §3.9 의 반대 방향이며 둘이 왕복을 만든다 — <b>등록이 원인이고 이력이 결과</b>다.
      */
      onDoubleClick: openSchedule,
    },
    {
      field: 'batchNm',
      header: MSG.BATCH_HISTORY_COL_BATCH_NM,
      type: 'text',
      width: 180,
      fill: true,
      /*
        <b>없으면 `(삭제된 배치)`</b> — 고장이 아니다(screen/admin/system/batch/schedule/requirements.md). 이력에 FK 가 없으므로
        등록을 지워도 행은 남으며, <b>이름을 지어내지 않는다</b>(screen/admin/system/log/access/requirements.md 와 같은 판단).
        `BATCH_ID` 는 그대로 보이므로 <i>무엇이었는지</i> 는 남는다.
      */
      derive: (row) => row.batchNm ?? label(MSG.BATCH_HISTORY_DELETED_BATCH),
    },
    execType(),
    rslt(),
    elapsed(),
    {
      field: 'rsltMsg',
      header: MSG.BATCH_HISTORY_COL_RSLT_MSG,
      type: 'text',
      width: 260,
      filter: false,
      /*
        <b>한 줄 요약이며 셀에 싣는다</b> — `VARCHAR(1000)` 이라 실을 수 있고, 실려야
        *"어느 배치가 몇 건을 처리했나"* 를 목록에서 읽는다(sys/batch.md). 그것이 이 컬럼을
        `nclob` 으로 올리지 않은 이유 전부다.

        <b>펼쳐 읽는다</b>(frontend/grid.md) — 1000자까지 올 수 있어 셀에서 다 보이지 않는다.
        편집기가 아니라 <b>뷰어</b>인 것이 요점이다: 이력 행은 불변이라 고칠 수 있는 것처럼
        보이면 안 된다.
      */
      viewer: 'largeText',
    },
    {
      field: 'hasDetail',
      header: MSG.BATCH_HISTORY_COL_DETAIL,
      type: 'text',
      width: 80,
      filter: false,
      /*
        <b>값이 아니라 유무다</b>(screen/admin/system/batch/schedule/requirements.md · screen/admin/system/log/access/requirements.md 의 규약). 셀에 그려지는 것은 `[보기]` 이고
        값은 `true`/`false` 로 남아 <b>엑셀과 복사가 그것을 쓴다</b>(frontend/grid.md).

        <b>`false` 면 아무것도 그리지 않는다.</b> `display` 가 빈 문자열을 내면 어댑터가
        보통 텍스트로 떨어뜨리므로 <b>링크가 아예 없다</b> — 열 것이 없는데 링크를 두면
        *눌러 보고서야 빈 것을 아는 셀*이 된다(screen/admin/system/batch/schedule/requirements.md).
      */
      renderer: 'link',
      display: (value) => (value === true ? label(MSG.BATCH_HISTORY_DETAIL_LINK) : ''),
      onClick: openDetail,
    },
    endDtm(),
    nodeId(),
    cancelReq(),
    {
      field: 'histId',
      header: MSG.BATCH_HISTORY_COL_HIST_ID,
      type: 'number',
      width: 100,
      visible: false,
      // PK 이자 tie-breaker — 시각이 같은 두 행의 순서를 결정적으로 만든다(backend/persistence.md).
    },
  ];
}

/**
 * 하단 pane 의 컬럼 — screen/admin/system/batch/schedule/requirements.md 가 적은 여섯이다(시작 · 종료 · 소요 · 결과 · 실행 구분 · 노드).
 *
 * <p><b>배치 ID 와 배치명이 없다</b> — pane 은 <b>한 배치</b>만 본다. 있으면 전 행이 같은
 * 값이고, 같은 값이 스무 번 반복되는 칸은 가로만 먹는다.
 *
 * <p><b>`[보기]` 도 없다.</b> pane 에 상세 모달을 두면 <b>같은 모달이 두 화면에</b> 생기고,
 * 그때 이 pane 은 *훑는 자리* 가 아니라 작은 이력 화면이 된다 — 전량을 묻는 질문에는
 * `BATCH_HISTORY` 가 답하며 그리로 가는 길이 <b>행 더블 클릭</b>이다.
 */
export function recentHistoryColumns(): ColumnDef<BatchHistoryRow>[] {
  return [startDtm(false), endDtm(true), elapsed(), rslt(), execType(), nodeId(true)];
}

// ── 둘이 나눠 쓰는 칸 ─────────────────────────────────────────────

function startDtm(sortable: boolean): ColumnDef<BatchHistoryRow> {
  return {
    field: 'startDtm',
    header: MSG.BATCH_HISTORY_COL_START,
    type: 'dateTime',
    width: 160,
    // <b>기본 정렬</b>(내림)이다. pane 은 정렬을 열지 않는다 — 10건이라 열 이유가 없다.
    sortable,
  };
}

function endDtm(visible = false): ColumnDef<BatchHistoryRow> {
  return {
    field: 'endDtm',
    header: MSG.BATCH_HISTORY_COL_END,
    type: 'dateTime',
    width: 160,
    /*
      <b>`null` 이면 진행 중</b>이다(screen/admin/system/batch/schedule/requirements.md). 마스터에서는 기본 숨김이고 pane 에서는 보인다 —
      pane 은 <b>한 배치를 깊이</b> 보는 자리라 시작과 종료가 함께 읽혀야 한다.
    */
    visible,
  };
}

function elapsed(): ColumnDef<BatchHistoryRow> {
  return {
    field: 'elapsedMs',
    header: MSG.BATCH_HISTORY_COL_ELAPSED,
    type: 'number',
    width: 120,
    /*
      <b>이 화면에서 정렬을 연 이유 전부</b>다(screen/admin/system/batch/schedule/requirements.md). sys/batch.md 이 `ELAPSED_MS` 를
      *저장하기로* 한 근거가 <i>"오래 걸린 배치 정렬이 인덱스를 못 탄다"</i> 였고,
      정렬을 끄면 그 컬럼을 저장할 이유가 사라진다.
    */
    sortable: true,
    filter: false,
    /*
      <b>값은 ms 원본이고 표시만 바뀐다</b>(frontend/grid.md · screen/admin/system/batch/schedule/requirements.md). frontend/grid.md 의 *렌더러가 충분한가*
      에 <b>첫 사례</b>를 낸 자리이며, 어휘를 여섯에서 일곱으로 늘렸다.
    */
    renderer: 'duration',
  };
}

function rslt(): ColumnDef<BatchHistoryRow> {
  return {
    field: 'rsltCd',
    header: MSG.BATCH_HISTORY_COL_RSLT,
    type: 'text',
    width: 150,
    /*
      <b>값은 코드이고 글자만 라벨이다.</b> `tone` 맵이 코드를 키로 보고, 정렬·필터·엑셀도
      코드를 본다 — 라벨을 값으로 만들면 색이 하나도 안 칠해진다(frontend/grid.md).
    */
    renderer: 'badge',
    tone: RSLT_TONE,
    display: rsltLabel,
    /*
      <b>유령 배지가 여기 있었다</b>(screen/admin/system/batch/schedule/requirements.md). `RUNNING` 인데 `START_DTM +
      LOCK_EXPIRY_SEC` 을 넘긴 행에 붙였는데, 그 임계값이 <b>오래 도는 정상 배치를
      죽었다고 부른다</b> — 기본값이 300초라 5분을 넘기는 배치는 전부 유령이 됐다.

      서버가 락 하트비트를 갖게 되면서 정확한 증거가 생겼다: <b>그 노드의 살아 있는 락이
      있는가</b>. 그래서 판정이 서버로 갔고 결과가 `LOST` 코드로 남는다 — 화면은 코드
      하나만 읽으면 되고, <b>판정 주체가 둘이 아니게 됐다</b>.
    */
  };
}

function execType(): ColumnDef<BatchHistoryRow> {
  return {
    field: 'execTypeCd',
    header: MSG.BATCH_HISTORY_COL_EXEC_TYPE,
    type: 'text',
    width: 100,
    /*
      <b>중복 진단의 첫 단계</b>다(screen/admin/system/batch/schedule/requirements.md). 같은 배치가 두 번 돌았는데 노드가 같으면
      *재시도 또는 수동* 이고, 그 둘을 가르는 유일한 값이 이 칸이다.

      <b>배지가 아니다.</b> 값이 둘뿐이고 어느 쪽도 사건이 아니라 <b>둘 다 정상</b>이므로
      칠할 것이 없다 — screen/admin/system/log/access/requirements.md 의 *정상이 압도적인 목록에서는 칠하지 않는다* 와 같은 축이다.
    */
    display: execTypeLabel,
    derive: (row) => execTypeLabel(row.execTypeCd),
  };
}

function nodeId(visible = false): ColumnDef<BatchHistoryRow> {
  return {
    field: 'nodeId',
    header: MSG.BATCH_HISTORY_COL_NODE,
    type: 'text',
    width: 160,
    /*
      <b>기본 숨김이다</b>(screen/admin/system/batch/schedule/requirements.md) — 평소에는 볼 일이 없고 <b>중복이 의심될 때 켠다</b>.
      screen/menu/requirements.md 이 *최종 시드 반영* 을 `visible: false` 로 둔 것과 같은 판단이다.

      pane 에서는 보인다. 거기서는 행이 열 건이라 가로가 남고, <b>한 배치가 어느 노드에서
      돌고 있는지</b> 가 그 pane 의 관심사다(screen/admin/system/batch/schedule/requirements.md 가 컬럼에 노드를 적어 두었다).
    */
    visible,
  };
}

function cancelReq(): ColumnDef<BatchHistoryRow> {
  return {
    field: 'cancelReqDtm',
    header: MSG.BATCH_HISTORY_COL_CANCEL_REQ,
    type: 'dateTime',
    width: 160,
    /*
      <b>결과가 아니라 요청이다</b>(sys/batch.md). 값이 있는데 `RSLT_CD` 가 아직 `RUNNING` 이면
      <b>중단 중</b>이며, 한 컬럼으로는 표현할 수 없는 그 상태다.

      <b>기본 숨김</b>인 것은 대개 비어 있기 때문이다 — 중단은 드문 조작이다. 다만 중단
      버튼을 누른 사람에게는 <b>그 순간 가장 중요한 칸</b>이라, 눌러 본 사람이 켜서 본다.
    */
    visible: false,
  };
}
