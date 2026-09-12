import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App } from 'antd';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { DataGrid } from '@/shared/grid/DataGrid';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow } from '@/shared/grid/rows';
import type { SearchCondition } from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { useShellNavigation } from '@/layouts/ShellLayout/useShellNavigation';
import { handOff, onHandoff, useHandoff } from '@/shared/routes/handoffStore';
import { hasPermission } from '@/shared/authz/permission';
import { useAuthStore } from '@/shared/stores/authStore';
import { execTypeOptions, rsltOptions } from '@/shared/batch/batchCodes';
import { BATCH_HISTORY_ENDPOINTS } from '@/features/batchhistory/api/endpoints';
import { historyColumns } from '@/shared/batch/historyColumns';
import { BatchDetailModal } from '@/features/batchhistory/components/BatchDetailModal';
import type { BatchCancelResult } from '@/features/batchhistory/types';
import type { BatchHistoryRow } from '@/shared/batch/historyRow';

/**
 * `BATCH_HISTORY` — screen/batch/history/requirements.md. <b>조회 전용인데 개입한다.</b>
 *
 * <p>sys/menu.md 의 액션 열이 `R E X` 다 — `S` 가 없는데 `X` 가 있다. screen/menu/requirements.md 의 조회 전용
 * 모양에서 <b>`X` 하나가 더 있는</b> 형태이며, 그 하나가 <b>중단</b>이다.
 *
 * <h2>이 화면이 답하는 질문은 셋이다</h2>
 *
 * <table><caption></caption>
 * <tr><td>*"어제 안 돌았는데 왜"*</td><td><b>행이 없으면 꺼져 있는 것</b>이고 `SKIP_*` 이
 *     있으면 켜져 있는데 건너뛴 것이다. 이 구분이 이 화면의 첫 질문에 답한다</td></tr>
 * <tr><td>*"뭐가 오래 걸리나"*</td><td><b>소요 정렬</b>이다. 조회조건으로 거를 수
 * 있는 질문이 아니라 screen/admin/system/log/access/requirements.md 의 <i>정렬이 아니라 거르기</i> 규칙의 <b>반대 사례</b>다</td></tr>
 * <tr><td>*"왜 두 번 돌았나"*</td><td>`노드` 를 켜서 본다. 같으면 재시도나 수동,
 * 다르면 락 선점 실패다 — backend/persistence.md 의 표를 화면이 그대로 쓴다</td></tr>
 * </table>
 *
 * <h2>정렬이 열려 있고 총 건수를 센다 — 이력 넷 중 유일하다</h2>
 *
 * <p>screen/admin/system/log/access/requirements.md 의 규약을 <b>항목별로 따져</b> 상속하지 않기로 했다. 근거는 하나다:
 * sys/batch.md 이 `ELAPSED_MS` 를 <b>저장하기로</b> 한 이유가 <i>"오래 걸린 배치 정렬이 인덱스를
 * 못 탄다"</i> 였고, <b>정렬을 끄면 그 컬럼을 저장할 이유가 사라진다</b>.
 *
 * <h2>중단은 요청까지가 화면의 책임이다</h2>
 *
 * <p>배치는 <b>다른 노드에서 돌 수 있으므로</b> 스레드를 직접 끊을 수 없다 — 협조적
 * 중단이며 배치가 체크포인트에서 플래그를 읽고 스스로 멈춘다. 확인 문구가
 * *"중단합니다"* 가 아닌 것이 의도이며, 말하지 않으면 안 멈췄을 때 <b>화면이 거짓말한
 * 것</b>이 된다.
 */

const MENU_CD = 'BATCH_HISTORY';
const SCHEDULE_CD = 'BATCH_SCHEDULE';

/** 이력이며 64 와 같은 성격이다 — screen/batch/history/requirements.md. */
const PAGE_SIZE = 100;
const PAGE_SIZES = [100, 500, 1000];

/** 서버의 `rsltGroup` 파생 조건이 코드 묶음으로 번역한다(screen/batch/history/requirements.md). */
const GROUP_FAILED = 'FAILED';
const GROUP_SKIPPED = 'SKIPPED';

/** 소요 조건의 필드 — <b>화면은 초, 서버는 ms</b> 다(screen/admin/system/batch/schedule/requirements.md · frontend/search-form.md). */
const ELAPSED_FIELD = 'elapsedMs';

/** 그 배수 — sys/batch.md 이 `ELAPSED_MS` 를 ms 로 저장하기로 했다(벤더별 시간 차 함수를 피한다). */
const MILLIS = 1000;

export function BatchHistoryPage() {
  const searchForm = useRef<SearchFormHandle>(null);
  const { modal } = App.useApp();
  const permissions = useAuthStore((state) => state.permissions);
  const shell = useShellNavigation();

  /** 상세 모달이 열린 행 — `null` 이면 닫혀 있다(screen/batch/history/requirements.md). */
  const [detailOf, setDetailOf] = useState<number | null>(null);

  /**
   * 0건 문구가 <b>조건에 따라 셋으로 갈린다</b> — screen/batch/history/requirements.md.
   *
   * <p>*실패만* 으로 물어 0건이면 <b>답이다</b>: *"이 기간에 실패한 배치가 없습니다"*.
   * 한 문구로 뭉치면 셋 다 *"조회 결과가 없습니다"* 가 되어 <b>진단이 사라진다</b> —
   * screen/admin/system/log/access/requirements.md 이 같은 규칙을 적었다.
   */
  const [emptyText, setEmptyText] = useState<string>(MSG.BATCH_HISTORY_EMPTY);

  /** 넘겨받은 배치 — `BATCH_SCHEDULE` 의 하단 pane 에서 왔다(screen/batch/history/requirements.md). */
  const handoff = useHandoff(MENU_CD);

  const header = useSearchFormHeader();

  /**
   * 조회 직전에 <b>0건 문구를 정하고 소요를 ms 로 바꾼다</b>.
   *
   * <p>문구를 조회가 끝난 뒤가 아니라 여기서 정하는 것은, 응답이 0건인지 알았을 때는 이미
   * <i>무엇을 물었는지</i> 가 폼에만 남아 있기 때문이다 — 그 사이 사용자가 조건을 고쳐
   * 놓으면 문구가 <b>묻지 않은 것</b>을 말한다(screen/admin/system/log/access/requirements.md 과 같은 자리).
   *
   * <p><b>단위 변환은 여기 없다.</b> 소요를 초로 받아 ms 로 보내는 것은 폼의
   * `scale: 1000` 이 한다(frontend/search-form.md) — 그 절이 *"와이어는 언제나 저장 단위, 변환은 화면이
   * 한다"* 를 닫으면서 <b>선언이 폼에 있어야 한다</b>고 정했다. 화면마다 손으로 곱하면
   * 저장된 조건이 화면 단위로 남는 규칙도 화면마다 다시 지켜야 한다.
   */
  const collectConditions = useCallback(() => {
    const conditions = searchForm.current?.collect() ?? null;
    if (conditions === null) {
      // 검증 실패면 조회 자체가 일어나지 않는다 — 오류 표시는 폼의 몫이다(frontend/grid.md).
      return Promise.resolve(null);
    }
    setEmptyText(emptyTextFor(conditions));
    return Promise.resolve(conditions);
  }, []);

  const openDetail = useCallback((row: BatchHistoryRow) => setDetailOf(row.histId), []);

  /**
   * `배치 ID` 셀 더블 클릭 → <b>`BATCH_SCHEDULE` 을 그 배치로 연다</b>(UX-02 — screen/batch/history/requirements.md).
   *
   * <p>§3.9 의 <b>반대 방향</b>이며 둘이 왕복을 만든다 — *"어제 정산이 안 됐다"* →
   * 이력에서 사유를 보고 → 등록에서 크론이나 쿨다운을 고친다.
   *
   * <p><b>볼 권한이 없으면 열지 않는다</b>(frontend/tabs.md). 열어 놓고 403 을 보여주는 것보다 아무
   * 일도 일어나지 않는 편이 낫다 — 더블 클릭은 눌러야만 알 수 있는 제스처라 실패가 더
   * 혼란스럽다.
   */
  const openSchedule = useCallback(
    (row: BatchHistoryRow) => {
      const node = shell.index.byCode.get(SCHEDULE_CD);
      if (!node || !hasPermission(permissions, SCHEDULE_CD, 'READ')) {
        return;
      }
      handOff(SCHEDULE_CD, row.batchId);
      shell.openMenu(node);
    },
    [permissions, shell],
  );

  const columns = useMemo(
    () => historyColumns(openDetail, openSchedule),
    [openDetail, openSchedule],
  );
  const searchFields = useMemo(() => buildSearchFields(handoff ?? ''), [handoff]);

  /**
   * 중단 요청의 결과 — <b>요청과 이미 요청됨을 가른다</b>(screen/batch/history/requirements.md).
   *
   * <p>*"N건에 중단을 요청했습니다"* 만 내면 이미 요청돼 있던 것이 그 수에 섞여, 두 번
   * 누른 사람이 <b>두 번 다 먹었다</b> 고 믿는다 — <i>버튼은 한 번만 먹는다</i> 는 사실이
   * 응답에도 보여야 한다.
   */
  const showCancelResult = useCallback(
    (result: unknown) => {
      const done = result as BatchCancelResult | null;
      const lines: string[] = [];
      if (done?.requested) {
        lines.push(label(MSG.BATCH_HISTORY_CANCEL_DONE, { count: done.requested }));
      }
      if (done?.alreadyRequested) {
        lines.push(
          label(MSG.BATCH_HISTORY_CANCEL_ALREADY, { count: done.alreadyRequested }),
        );
      }
      modal.info({
        title: label(MSG.BATCH_HISTORY_ACTION_CANCEL),
        content: <div style={{ whiteSpace: 'pre-wrap' }}>{lines.join('\n')}</div>,
      });
    },
    [modal],
  );

  /**
   * 선언 — <b>`save` 도 `addRow` 도 없다</b>(screen/batch/history/requirements.md).
   *
   * <p>전 컬럼이 읽기 전용이므로 상태 컬럼도 삭제 컬럼도 붙지 않는다(frontend/grid.md) —
   * <b>감추는 코드가 한 줄도 없고 선언이 없어서</b> 나오지 않는다.
   *
   * <p><b>`actions` 하나가 `X` 의 실체다.</b> `eligible` 이 `RUNNING` 만 고르므로
   * 셋을 골랐는데 하나만 실행 중이면 <b>확인 문구가 *1건* 이라고 말한다</b> — 걸러진
   * 결과가 곧 확인의 건수이고 요청의 대상이다(frontend/grid.md).
   */
  const api = useMemo(
    () => ({
      read: { url: BATCH_HISTORY_ENDPOINTS.getList, emptyNotice: true },
      actions: [
        {
          key: 'cancel',
          label: MSG.BATCH_HISTORY_ACTION_CANCEL,
          url: BATCH_HISTORY_ENDPOINTS.cancel,
          target: 'selected' as const,
          /*
            <b>실행 중인 것만 대상이다</b>(screen/batch/history/requirements.md). 걸러진 결과가 비면 버튼이 비활성이고,
            그것이 *"중단 대상 미선택 → 버튼 비활성"* 의 실물이다.

            <b>이미 요청된 것을 여기서 빼지 않는다.</b> 그쪽은 <i>대상이 아니다</i> 가
            아니라 <i>이미 됐다</i> 이며, 빼면 세 건 중 둘이 이미 요청된 경우에 문구가
            *1건* 이 되어 <b>나머지 둘이 어떻게 됐는지</b> 를 말할 자리가 사라진다.
            서버가 세어서 돌려주고 결과 모달이 그것을 읽는다.
          */
          eligible: (row: GridRow<BatchHistoryRow>) => row.data.rsltCd === 'RUNNING',
          toTargets: (rows: GridRow<BatchHistoryRow>[]) => rows.map((row) => row.data.histId),
          /*
            <b>문구가 *"중단합니다"* 가 아니다</b>(screen/batch/history/requirements.md). 협조적 중단이라 <b>요청까지가
            화면의 책임</b>이고, 그것을 말하지 않으면 안 멈췄을 때 화면이 거짓말한 것이 된다.
          */
          confirm: MSG.BATCH_HISTORY_CANCEL_CONFIRM,
          /*
            <b>다시 읽는다.</b> `CANCEL_REQ_DTM` 이 서버에서만 채워지고(frontend/grid.md 과 같은 꼬리),
            그 값이 있어야 다음에 누를 때 <i>이미 요청됨</i> 이 보인다 — 안 읽으면 사용자가
            같은 행을 다시 고르고 <b>두 번 눌렀다는 사실만 서버가 안다</b>.
          */
          onSuccess: showCancelResult,
        },
      ],
    }),
    [showCancelResult],
  );

  const grid = useGridController<BatchHistoryRow>({
    menuCd: MENU_CD,
    columns,
    api,
    pageSize: PAGE_SIZE,
    params: collectConditions,
  });

  const readList = useCallback(async () => {
    await grid.read();
  }, [grid]);

  /** 넘겨받은 배치가 있으면 <b>마운트하며 그 조건으로</b> 조회한다(screen/batch/history/requirements.md). */
  const applyHandoff = useCallback(
    (batchId: string) => {
      searchForm.current?.apply({ batchId: { value: batchId } });
      void readList();
    },
    [readList],
  );
  useEffect(() => onHandoff(MENU_CD, applyHandoff), [applyHandoff]);

  return (
    <FillColumn>
      <SearchForm
        handleRef={searchForm}
        fields={searchFields}
        onSubmit={() => void readList()}
        // 조건과 컬럼 필터를 함께 지운다 — frontend/grid.md.
        onReset={grid.clearFilters}
        onActiveCountChange={header.onActiveCountChange}
        collapsed={header.collapsed}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <DataGrid<BatchHistoryRow>
          title={MSG.BATCH_HISTORY_GRID_TITLE}
          menuCd={MENU_CD}
          controller={grid}
          pageSizes={PAGE_SIZES}
          /*
            <b>다중 선택이다</b> — screen/batch/history/requirements.md 의 확인 문구가 *"실행 중인 {count}건"* 이고,
            유령이 여럿 남은 아침에 하나씩 누르게 하면 그 문구가 언제나 *1건* 이 된다.

            <b>행 클릭으로는 선택되지 않는다</b>(frontend/grid.md) — 체크박스만이 선택 수단이며,
            그래서 <b>행 더블 클릭(상세 모달)과 겹치지 않는다</b>. 스크롤하다 흘린 클릭
            하나가 고른 것을 통째로 갈아 치우지도 않는다.

            <b>`BATCH_SCHEDULE` 은 반대로 단일이다</b> — 그쪽은 하단 pane 이 선택을
            따라가야 하고, 다중으로 열면 클릭 선택이 꺼져 <b>pane 이 아무것도
            따라가지 못한다</b>. 즉시 실행의 *N건* 은 그 대가로 언제나 1건이다.
          */
          selection="multiple"
          /*
            <b>보존이 푸터에 있다</b>(screen/admin/system/batch/schedule/requirements.md · retention.md). 없는 것과 파기된 것을 사용자가
            가를 수 있어야 한다 — 1년 전 실행을 찾다 0건을 본 사람이 <i>기록이 없다</i> 로
            읽으면 그다음에 하는 일이 틀린다.
          */
          footerNote={label(MSG.BATCH_HISTORY_RETENTION)}
          emptyText={emptyText}
          /*
            <b>행 더블 클릭이 상세 모달이다</b>(screen/batch/history/requirements.md) — `[보기]` 와 제스처가 둘인 것은
            같은 문 앞의 손잡이가 둘인 것이다(screen/admin/system/log/access/requirements.md 와 같은 규칙).

            <b>`배치 ID` 는 여기로 오지 않는다</b> — 컬럼이 자기 더블 클릭을 선언했으면
            그것이 이긴다. 축이 좁은 쪽이 사람이 실제로 겨눈 것이다.

            <b>열 것이 없으면 열지 않는다.</b> `hasDetail` 이 `false` 인 행은 `[보기]` 도
            없으므로 행 제스처만 살아 있으면 <b>빈 모달</b>이 열린다.
          */
          onRowDoubleClick={(row) => {
            if (row.data.hasDetail) openDetail(row.data);
          }}
        />
      </div>

      <BatchDetailModal histId={detailOf} onClose={() => setDetailOf(null)} />
    </FillColumn>
  );
}

// ── 조회조건 (screen/batch/history/requirements.md) ────────────────────────────────────────────

/**
 * 일곱이며 <b>기간이 필수가 아니다</b>(screen/batch/history/requirements.md).
 *
 * <p>screen/admin/system/log/access/requirements.md 의 *기간 필수 + 상한* 을 상속하지 않는다 — 그 근거가 <i>90일에 수천만 행</i>
 * 이었고 여기는 등록 수십 건 × 하루 수십 회다. <b>기본값은 두되 비울 수 있다</b>: 비우면
 * 전량이고 1년치가 수십만 행이라 느려지지만 <b>막지는 않는다</b>.
 *
 * <p><b>`결과` 와 `결과 묶음` 이 둘 다 있다.</b> 겹치는 것 같지만 묻는 것이 다르다 —
 * 앞은 *이 코드들만* 이고 뒤는 *실패만* 이다. 코드 여섯을 하나씩 고르는 것보다 후자가
 * 훨씬 잦고, 특히 <b>실패가 `FAIL` 하나가 아니라는 것</b>이 묶음이 필요한 진짜
 * 이유다 — `CANCELED` 도 끝까지 못 간 실행이라 함께 봐야 하는데 매번 둘을 고르게 하면
 * <b>한쪽을 빠뜨린다</b>.
 *
 * <p><b>`소요 시간 이상` 이 정렬과 짝이다</b>. *"10분 넘게 걸린 것"* 으로 좁힌 뒤
 * 소요 정렬로 훑는 것이 이 화면의 성능 진단 동선이다.
 */
function buildSearchFields(batchId: string): SearchField[] {
  return [
    {
      field: 'startDtm',
      label: MSG.BATCH_HISTORY_SEARCH_START,
      type: 'dateRange',
      /*
        <b>`required` 가 없다</b> — 64 의 이력 셋과 갈리는 자리다(screen/batch/history/requirements.md). 기본값만 두며
        그 값은 시스템 값(7일)을 그대로 쓴다. 상한도 덮지 않는다: 행이 가볍고
        (`nclob` 둘을 싣지 않는다) 무엇보다 <b>비우는 것이 허용된 화면</b>이라 상한이
        마지막 방어가 아니다.
      */
    },
    {
      /*
        <b>넘겨받기의 착지점이다</b>(§3.9 → 여기). 하단 pane 에서 행을 더블 클릭하면 이
        탭이 그 배치로 열리며, <b>초기화는 빈 칸이 아니라 그 값으로</b> 돌아간다 —
        이 탭은 그것을 보러 열렸다(frontend/search-form.md).

        <b>`richSelect` 가 아니라 `text` 다.</b> screen/batch/history/requirements.md 이 셀렉트로 적었지만 후보의
        출처가 `SYS_SCHEDULE_BATCH` 이고, <b>지워진 배치의 이력은 그 목록에 없다</b> —
        고아를 찾으려는 사람이 고를 수 없게 된다(§3.8 이 고아를 남기기로 한 결정과
        어긋난다). 목록에서 셀을 복사해 넣는 동선이 남는다.
      */
      field: 'batchId',
      label: MSG.BATCH_HISTORY_SEARCH_BATCH,
      type: 'text',
      op: 'eq',
      ops: ['eq', 'startsWith', 'contains'],
      defaultValue: batchId,
    },
    {
      field: 'rsltGroup',
      label: MSG.BATCH_HISTORY_SEARCH_GROUP,
      type: 'select',
      ops: ['eq'],
      /*
        <b>기본이 *전체* 다.</b> *실패만* 이 가장 쓸모 있는 조합이지만 기본으로 두면
        <i>어제 안 돌았는데 왜</i> 를 조사하러 온 사람이 <b>빈 화면을 먼저 본다</b> —
        그 질문의 답은 `SKIP_*` 이거나 <b>행이 없는 것</b>이다.
      */
      options: [
        { value: GROUP_FAILED, text: label(MSG.BATCH_HISTORY_GROUP_FAILED) },
        { value: GROUP_SKIPPED, text: label(MSG.BATCH_HISTORY_GROUP_SKIPPED) },
      ],
    },
    {
      field: 'rsltCd',
      label: MSG.BATCH_HISTORY_SEARCH_RSLT,
      type: 'select',
      op: 'in',
      ops: ['in'],
      options: rsltOptions(),
    },
    {
      field: 'execTypeCd',
      label: MSG.BATCH_HISTORY_SEARCH_EXEC_TYPE,
      type: 'select',
      ops: ['eq'],
      options: execTypeOptions(),
    },
    {
      /*
        <b>진단의 한 단계다</b> — 컬럼은 기본 숨김이지만 조건에는 있다. 중복이
        의심될 때 특정 노드만 보는 것이 그 표를 읽는 방법이다.
      */
      field: 'nodeId',
      label: MSG.BATCH_HISTORY_SEARCH_NODE,
      type: 'text',
      op: 'eq',
      ops: ['eq', 'startsWith'],
    },
    {
      /*
        <b>입력은 초, 전송은 ms</b> — `toMillis` 가 바꾼다. `gte` 하나만 여는 것은
        *"10분 넘게 걸린 것"* 이 이 조건의 전부이기 때문이다: 상한을 묻는 사람은 없다.
      */
      field: ELAPSED_FIELD,
      label: MSG.BATCH_HISTORY_SEARCH_ELAPSED,
      type: 'text',
      op: 'gte',
      ops: ['gte'],
      // <b>입력은 초, 전송은 ms</b> — frontend/search-form.md 의 첫 사례다.
      scale: MILLIS,
    },
  ];
}

/**
 * 0건이 <b>답인 경우를 가른다</b> — screen/batch/history/requirements.md.
 *
 * <p>*실패만* 으로 물어 0건이면 *"이 기간에 실패한 배치가 없습니다"* 이고, 그것은
 * 빈 결과가 아니라 <b>진단</b>이다. screen/admin/system/log/access/requirements.md 이 같은 규칙을 적었다.
 */
function emptyTextFor(conditions: SearchCondition[]): string {
  const group = conditions.find((condition) => condition.field === 'rsltGroup')?.value;
  if (group === GROUP_FAILED) return MSG.BATCH_HISTORY_EMPTY_FAILED;
  if (group === GROUP_SKIPPED) return MSG.BATCH_HISTORY_EMPTY_SKIPPED;
  return MSG.BATCH_HISTORY_EMPTY;
}
