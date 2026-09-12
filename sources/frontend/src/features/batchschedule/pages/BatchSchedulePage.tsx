import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { auditColumns } from '@/shared/grid/auditColumns';
import { DataGrid } from '@/shared/grid/DataGrid';
import { SplitPane } from '@/shared/grid/SplitPane';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow } from '@/shared/grid/rows';
import type {
  ColumnDef,
  DeleteColumnSpec,
  GridIssue,
  SelectOption,
} from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { useShellNavigation } from '@/layouts/ShellLayout/useShellNavigation';
import { handOff, onHandoff, useHandoff } from '@/shared/routes/handoffStore';
import { hasPermission } from '@/shared/authz/permission';
import { useAuthStore } from '@/shared/stores/authStore';
import { rsltLabel, RSLT_TONE } from '@/shared/batch/batchCodes';
import { BATCH_SCHEDULE_ENDPOINTS } from '@/features/batchschedule/api/endpoints';
import { getBeanList, getTimezoneList } from '@/features/batchschedule/api/batchScheduleApi';
import type { BatchRunResponse, BatchScheduleRow } from '@/features/batchschedule/types';
import { recentHistoryColumns } from '@/shared/batch/historyColumns';
import type { BatchHistoryRow } from '@/shared/batch/historyRow';

/**
 * `BATCH_SCHEDULE` — screen/batch/schedule/requirements.md. <b>screen/menu/requirements.md 이후 처음으로 *위험한 편집* 을 다룬다.</b>
 *
 * <p>메뉴 트리는 잘못 고치면 화면이 안 보인다. 배치는 <b>잘못 고치면 조용히 안 돈다</b> —
 * 그것이 이 화면의 검증과 확인이 촘촘한 이유다.
 *
 * <h2>엑셀이 없는 첫 화면이다</h2>
 *
 * <p>sys/menu.md 의 액션 열이 `R S X` 이고 <b>②가 통째로 사라진다</b>(frontend/grid.md) —
 * `ROLE_MGMT` · `ROLE_AUTH_MGMT` 는 *액션 미정의* 였지만 여기는 <b>일부러 뺐다</b>.
 * 등록이 수십 건이고 <b>원본이 화면</b>이라(시드가 아니다) 내려받아도 결국 화면에서 고쳐야
 * 하고, `PARAM_JSON` 중괄호가 셀에 들어간 파일은 읽기도 어렵다. <b>감추는 코드가 한 줄도
 * 없다</b> — `EXPORT_YN` 이 꺼져 있어 버튼이 나오지 않는다(sys/menu.md).
 *
 * <h2>끄는 것이 켜는 것과 다르다</h2>
 *
 * <p>저장 확인이 `BATCH_DESC` 를 <b>그대로 읽어 준다</b>. sys/batch.md 이 그 컬럼을
 * *"끄면 무슨 일이 생기는가를 적는 자리"* 로 정했고, 그 문장을 <b>끄는 순간에</b> 보여주지
 * 않으면 적어 둔 의미가 없다. <b>켜는 것은 확인하지 않는다</b> — 켜는 것은 되돌릴 수 있고
 * 끄는 것은 시간이 간다.
 *
 * <h2>이력과 왕복한다</h2>
 *
 * <p>하단 pane 에서 행을 더블 클릭하면 `BATCH_HISTORY` 가 그 배치로 열리고, 반대로
 * 그 화면에서 `배치 ID` 를 더블 클릭하면 여기가 그 배치로 열린다. <b>등록이 원인이고
 * 이력이 결과</b>라 운영자가 하는 일은 거의 언제나 둘을 왕복한다.
 */

const MENU_CD = 'BATCH_SCHEDULE';
const HISTORY_CD = 'BATCH_HISTORY';

/** 등록이 수십 건이다 — <b>한 화면에 다 들어오는 것이 목적</b>이다(screen/batch/schedule/requirements.md). */
const PAGE_SIZE = 50;
const PAGE_SIZES = [50, 100, 500];

/** 하단 pane 의 건수 — screen/batch/schedule/requirements.md. 전량은 `BATCH_HISTORY` 가 답한다. */
const RECENT_SIZE = 10;

export function BatchSchedulePage() {
  const searchForm = useRef<SearchFormHandle>(null);
  const { modal } = App.useApp();
  const permissions = useAuthStore((state) => state.permissions);
  const shell = useShellNavigation();

  /**
   * 하단의 빈 상태 — <b>셋이 갈린다</b>(frontend/grid.md · screen/batch/schedule/requirements.md).
   *
   * <p>*"배치를 선택하세요"* · *"저장 후 조회할 수 있습니다"* · *"아직 실행된 적이
   * 없습니다"* 는 같은 빈 판이지만 <b>다음에 할 일이 다르다</b>. 셋째가 특히 중요한데,
   * screen/batch/schedule/requirements.md 이 <i>"행이 없으면 꺼져 있는 것"</i> 이라고 한 그 신호이기 때문이다 —
   * *"선택하세요"* 로 뭉치면 조사하러 온 사람이 아무것도 못 읽는다.
   */
  const [recentEmpty, setRecentEmpty] = useState<string>(MSG.BATCH_SCHEDULE_RECENT_EMPTY);

  /**
   * 넘겨받은 배치 — `BATCH_HISTORY` 에서 왔다(screen/batch/schedule/requirements.md).
   *
   * <p><b>효과가 아니라 초기값이다.</b> 효과로 읽으면 *첫 렌더는 빈 칸, 두 번째 렌더에서
   * 채워짐* 이 되어 사람이 그 깜빡임을 본다 — `ApiCatalogPage` 가 같은 자리에서 같은
   * 모양을 쓴다.
   */
  const handoff = useHandoff(MENU_CD);

  const header = useSearchFormHeader();

  /**
   * `BEAN_ID` 셀렉트의 후보 — <b>서버가 준다</b>(screen/batch/schedule/requirements.md).
   *
   * <p>스프링 컨텍스트에서 `BatchJob` 구현을 모은 것이며 <b>시드가 아니다</b>. 시드로 두면
   * 배포마다 구현과 목록이 어긋날 수 있고, 어긋나면 화면이 <i>고를 수 있는데 실행되지
   * 않는</i> 빈을 보여준다.
   *
   * <p><b>비어 있는 것이 정상이다</b> — 템플릿에는 구현이 하나도 없다. 그때 셀렉트가 비고,
   * 그 비어 있음은 고장이 아니라 *아직 배치가 없다* 는 사실이다.
   *
   * <p>`staleTime` 이 무한인 것은 <b>배포가 바뀌지 않는 한 목록도 바뀌지 않기</b>
   * 때문이다 — 프론트는 서버 JAR 에 임베드되어 함께 배포된다(build-deploy.md).
   */
  const beans = useQuery({
    queryKey: ['batchSchedule', 'beans'],
    queryFn: () => getBeanList(),
    staleTime: Infinity,
  });

  const beanOptions = useMemo<SelectOption[]>(
    () => (beans.data ?? []).map((beanId) => ({ value: beanId, text: beanId })),
    [beans.data],
  );

  /**
   * 시간대 후보 — <b>tzdb 가 원본</b>이고 600개가 넘는다(screen/batch/schedule/requirements.md §4-1).
   *
   * <p>빈 목록과 같은 이유로 `staleTime` 이 무한이다. <b>맨 앞이 업무 시간대</b>이며 서버가
   * 그 순서를 정한다 — 화면이 다시 정렬하면 *무엇이 기본인가* 를 두 곳이 알아야 한다.
   */
  const timezones = useQuery({
    queryKey: ['batchSchedule', 'timezones'],
    queryFn: () => getTimezoneList(),
    staleTime: Infinity,
  });

  const timezoneOptions = useMemo<SelectOption[]>(
    () => (timezones.data ?? []).map((zone) => ({ value: zone, text: zone })),
    [timezones.data],
  );

  /** 신규 행의 기본 시간대 — 서버가 내린 목록의 <b>맨 앞</b>이 업무 시간대다. */
  const defaultTimezone = timezones.data?.[0] ?? '';

  const collectConditions = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );

  const columns = useMemo(
    () => buildColumns(beanOptions, timezoneOptions),
    [beanOptions, timezoneOptions],
  );
  const searchFields = useMemo(() => buildSearchFields(handoff ?? ''), [handoff]);

  /**
   * 저장 확인이 <b>`BATCH_DESC` 를 그대로 읽어 준다</b> — screen/batch/schedule/requirements.md.
   *
   * <p>sys/batch.md 의 셋째 항목(*"껐다 켜면 저절로 따라잡는 배치와 건너뛴 구간이 영영 비는
   * 배치는 끄는 결정의 무게가 다르다"*)이 여기서 값을 한다. 그 문장을 <b>끄는 순간에</b>
   * 보여주지 않으면 적어 둔 의미가 없다.
   *
   * <p><b>켜는 것은 확인하지 않는다.</b> 축이 다르다 — 켜는 것은 되돌릴 수 있고 끄는 것은
   * 시간이 간다. `ROLE_MGMT` 가 같은 판단을 했다(screen/admin/system/role/requirements.md).
   *
   * <p><b>설명을 메시지 키로 감싸지 않는다.</b> 데이터이지 문구가 아니며, 운영자가 적은
   * 그 문장이 그대로 읽혀야 한다.
   */
  const warnDisable = useCallback((rows: GridRow<BatchScheduleRow>[]): string[] => {
    const lines: string[] = [];

    const disabled = rows.filter(
      (row) => row.state === 'U' && row.original?.useYn === true && row.data.useYn === false,
    );
    if (disabled.length > 0) {
      lines.push(label(MSG.BATCH_SCHEDULE_WARN_DISABLE, { count: disabled.length }));
      for (const row of disabled) {
        lines.push(
          label(MSG.BATCH_SCHEDULE_WARN_DISABLE_ITEM, {
            name: row.data.batchNm,
            batchId: row.data.batchId,
          }),
        );
        lines.push(`  ${row.data.batchDesc}`);
      }
    }

    /*
      <b>시간대 변경도 확인을 받는다</b>(screen/batch/schedule/requirements.md §5-1). 크론이 그대로라 화면상
      달라진 것은 한 칸인데 <b>실제 실행 시각은 몇 시간 옮겨진다</b> — 보이는 변화의
      크기와 결과의 크기가 어긋난다.

      <b>기존 행만이다.</b> 신규 행에는 옮겨지는 실행이 없다 — *켜는 것은 확인하지
      않는다* 와 같은 규칙이다.
    */
    const moved = rows.filter(
      (row) =>
        row.state === 'U' &&
        row.original != null &&
        row.original.timezone !== row.data.timezone,
    );
    if (moved.length > 0) {
      lines.push(label(MSG.BATCH_SCHEDULE_WARN_TIMEZONE, { count: moved.length }));
      for (const row of moved) {
        lines.push(
          label(MSG.BATCH_SCHEDULE_WARN_TIMEZONE_ITEM, {
            name: row.data.batchNm,
            batchId: row.data.batchId,
            from: row.original?.timezone ?? '',
            to: row.data.timezone,
          }),
        );
      }
    }

    return lines;
  }, []);

  const recentApi = useMemo(
    () => ({ read: { url: BATCH_SCHEDULE_ENDPOINTS.getRecentHistory } }),
    [],
  );
  const recentBatchId = useRef<string | null>(null);
  const recentParams = useCallback(() => ({ batchId: recentBatchId.current }), []);

  const recent = useGridController<BatchHistoryRow>({
    menuCd: MENU_CD,
    columns: useMemo(() => recentHistoryColumns(), []),
    api: recentApi,
    searchParams: recentParams,
    pageSize: RECENT_SIZE,
    // 이력 행은 불변이다(screen/admin/system/log/access/requirements.md) — 편집을 열면 저장할 곳이 없는 셀이 생긴다.
    editable: false,
  });

  /**
   * 즉시 실행의 결과를 <b>건별로</b> 낸다 — frontend/grid.md · screen/batch/schedule/requirements.md.
   *
   * <p>서버는 값만 내려보내고(`BatchRunResponse`) <b>문구는 여기서 짓는다</b> — 완성된 문장을
   * 서버가 내려보내면 그것이 서버의 언어로 굳는다(backend/packages.md 가 오류 문구에서 감수한 대가와
   * 다른 자리다: 이쪽은 정상 응답이다).
   *
   * <p><b>노드와 시각이 요점이다.</b> *"실행 중입니다"* 만 내면 운영자는 얼마나 기다려야
   * 하는지 모른다 — backend/persistence.md 이 `NODE_ID` 를 남긴 것과 같은 이유다.
   */
  const showRunResult = useCallback(
    (result: unknown) => {
      const items = (result as BatchRunResponse | null)?.items ?? [];
      const started = items.filter((item) => item.started);
      const rejected = items.filter((item) => !item.started);

      const lines: string[] = [];
      if (started.length > 0) {
        lines.push(label(MSG.BATCH_SCHEDULE_RUN_STARTED, { count: started.length }));
      }
      for (const item of rejected) {
        lines.push(
          item.runningNodeId
            ? label(MSG.BATCH_SCHEDULE_RUN_REJECTED_NODE, {
                batchId: item.batchId,
                node: item.runningNodeId,
                time: timeText(item.runningStartedAt),
              })
            : label(MSG.BATCH_SCHEDULE_RUN_REJECTED, { batchId: item.batchId }),
        );
      }
      modal.info({
        title: label(MSG.BATCH_SCHEDULE_RUN_TITLE),
        content: (
          <div style={{ whiteSpace: 'pre-wrap' }}>{lines.join('\n')}</div>
        ),
      });
      /*
        <b>하단 pane 을 다시 읽는다</b>(screen/batch/schedule/requirements.md) — `RUNNING` 행이 바로 보인다. 마스터가
        아니라 pane 인 것이 요점이다: 진행률 모달을 두지 않기로 했으므로 진행을
        보여줄 자리가 그 행 하나다.

        <b>고른 배치가 없으면 읽지 않는다.</b> 여러 건을 골라 실행할 수 있고 pane 은
        마지막에 고른 하나만 본다 — 그때는 사용자가 보고 싶은 행을 직접 고른다.
      */
      if (recentBatchId.current) {
        void recent.read(true);
      }
    },
    [modal, recent],
  );

  /**
   * 마스터의 선언 — <b>`actions` 가 처음으로 이 화면에 온다</b>(frontend/grid.md).
   *
   * <p>`reloadAfter` 를 끈 것이 결정이다. 기본값은 <i>자기 그리드를 다시 읽는다</i> 인데,
   * 즉시 실행이 바꾸는 것은 <b>이력</b>이지 등록이 아니다 — 마스터를 다시 읽으면
   * <i>최근 결과</i> 컬럼 하나 때문에 50행을 다시 받고, 정작 봐야 할 `RUNNING` 행은
   * 하단에 있다. 그래서 `onSuccess` 에서 pane 만 읽는다.
   */
  const api = useMemo(
    () => ({
      read: { url: BATCH_SCHEDULE_ENDPOINTS.getList, emptyNotice: true },
      save: {
        url: BATCH_SCHEDULE_ENDPOINTS.save,
        validate: { grid: validateBatchIds },
        warn: warnDisable,
      },
      actions: [
        {
          key: 'runNow',
          label: MSG.BATCH_SCHEDULE_ACTION_RUN,
          url: BATCH_SCHEDULE_ENDPOINTS.runNow,
          target: 'selected' as const,
          /*
            <b>미저장 변경이 있으면 막는다</b>(screen/batch/schedule/requirements.md). 고친 크론이 반영되지 않은 채
            도는 것을 사용자가 기대하지 않는다 — 저장은 등록을 바꾸고 실행은 그 등록을
            읽는다.
          */
          validate: { grid: rejectUnsaved },
          toTargets: (rows: GridRow<BatchScheduleRow>[]) =>
            rows.map((row) => row.data.batchId),
          reloadAfter: false,
          onSuccess: showRunResult,
        },
      ],
    }),
    [showRunResult, warnDisable],
  );

  const master = useGridController<BatchScheduleRow>({
    menuCd: MENU_CD,
    columns,
    api,
    pageSize: PAGE_SIZE,
    params: collectConditions,
    addRow: {
      defaults: () => ({
        batchId: '',
        batchNm: '',
        batchDesc: '',
        beanId: '',
        cron: '',
        /*
          <b>빈 칸이 아니라 업무 시간대다</b>(screen/batch/schedule/requirements.md §4-1). 필수 칸을 비워 내면
          *대개 맞는 값* 을 매번 손으로 고르게 되고, 빠뜨리면 저장이 막힌다.
        */
        timezone: defaultTimezone,
        paramJson: null,
        // backend/persistence.md 의 기본값과 같다 — `@CustomLock` 의 `expirySeconds` 가 300 이다.
        lockExpirySec: 300,
        // 쿨다운은 <b>끈 상태로 시작한다</b>. 크론과의 관계를 모른 채 값을 넣으면 저장이 막힌다.
        lockMinIntervalSec: 0,
        // 켜 두는 것이 정상이다 — 만들자마자 꺼져 있으면 왜 안 도는지 찾게 된다.
        useYn: true,
        sortNo: 0,
        /*
          파생 셋은 <b>`null` · `false` 다</b>(screen/menu/requirements.md 주석 8 과 같은 규칙). 서버가 계산하는
          값이라 `0` 이나 임의의 시각으로 채우면 <i>계산해 보니 그렇다</i> 와 구분되지 않는다.
        */
        nextExecDtm: null,
        lastRsltCd: null,
        running: false,
        regId: null,
        regDtm: null,
        modId: null,
        modDtm: null,
      }),
    },
    toSaveRow: (row) => ({
      rowState: row.state,
      batchId: row.data.batchId,
      // 삭제는 대상만 가리킨다 — 나머지를 보내면 서버가 쓰지 않을 값을 검증하게 된다.
      ...(row.state === 'D'
        ? {}
        : {
            batchNm: row.data.batchNm,
            batchDesc: row.data.batchDesc,
            beanId: row.data.beanId,
            cron: row.data.cron,
            paramJson: row.data.paramJson,
            lockExpirySec: row.data.lockExpirySec,
            lockMinIntervalSec: row.data.lockMinIntervalSec,
            useYn: row.data.useYn,
            sortNo: row.data.sortNo,
          }),
    }),
  });

  /**
   * 배치 선택 — 하단 pane 을 그 배치로 읽는다(frontend/grid.md · screen/batch/schedule/requirements.md).
   *
   * <p><b>거부하지 않는다.</b> 하단이 읽기 전용이라 잃을 미저장 편집이 없다.
   */
  const selectBatch = useCallback(
    (row: GridRow<BatchScheduleRow> | null): void => {
      if (!row) {
        recentBatchId.current = null;
        recent.setRows([]);
        setRecentEmpty(MSG.BATCH_SCHEDULE_RECENT_EMPTY);
        return;
      }
      if (row.state === 'C') {
        /*
          <b>아직 서버에 없는 등록</b>이다. FK 가 없으므로(sys/batch.md) 조회해도 오류는 아니지만
          <b>언제나 0건</b>이고, 그 0건은 *"한 번도 안 돌았다"* 와 구분되지 않는다 —
          `ROLE_MGMT` 가 FK 때문에 막은 자리를 여기서는 <b>의미 때문에</b> 막는다.
        */
        recentBatchId.current = null;
        recent.setRows([]);
        setRecentEmpty(MSG.BATCH_SCHEDULE_RECENT_LOCKED);
        return;
      }
      recentBatchId.current = row.data.batchId;
      // 한 번도 안 돈 배치와 아직 안 고른 상태를 가른다(screen/batch/schedule/requirements.md).
      setRecentEmpty(MSG.BATCH_SCHEDULE_RECENT_NONE);
      void recent.read(true);
    },
    [recent],
  );

  /**
   * 마스터 조회는 <b>하단을 리셋한다</b> — frontend/grid.md.
   *
   * <p>조회는 목록을 통째로 바꾸므로 이전에 보던 등록이 결과에 없을 수도 있다. 하단이 남아
   * 있으면 <b>다른 배치의 실행 이력을 이 배치 것으로</b> 보게 된다.
   */
  const readMaster = useCallback(async () => {
    recentBatchId.current = null;
    recent.setRows([]);
    setRecentEmpty(MSG.BATCH_SCHEDULE_RECENT_EMPTY);
    await master.read();
  }, [master, recent]);

  /** 넘겨받은 배치가 있으면 <b>마운트하며 그 조건으로</b> 조회한다(screen/batch/schedule/requirements.md). */
  const applyHandoff = useCallback(
    (batchId: string) => {
      searchForm.current?.apply({ batchId: { value: batchId } });
      void readMaster();
    },
    [readMaster],
  );
  useEffect(() => onHandoff(MENU_CD, applyHandoff), [applyHandoff]);

  /**
   * 하단 행 더블 클릭 → `BATCH_HISTORY` 를 그 배치로 연다(UX-02 멀티탭 — screen/batch/schedule/requirements.md).
   *
   * <p>§4.7 의 <b>반대 방향</b>이며 둘이 왕복을 만든다. <b>볼 권한이 없으면 열지
   * 않는다</b>(frontend/tabs.md) — 열어 놓고 403 을 보여주는 것보다 아무 일도 일어나지 않는 편이 낫다.
   */
  const openHistory = useCallback(
    (row: BatchHistoryRow) => {
      const node = shell.index.byCode.get(HISTORY_CD);
      if (!node || !hasPermission(permissions, HISTORY_CD, 'READ')) {
        return;
      }
      handOff(HISTORY_CD, row.batchId);
      shell.openMenu(node);
    },
    [permissions, shell],
  );

  /**
   * 지울 수 있는가 — <b>게이트가 자식이 아니라 상태</b>다(screen/batch/schedule/requirements.md).
   *
   * <p>`ROLE_MGMT` 는 자식 건수를 셌고 여기는 <b>켜져 있는가</b>와 <b>도는가</b>를 본다.
   *
   * <p><b>실행 이력은 게이트가 아니다.</b> 이력에 FK 가 없으므로(sys/batch.md) 등록을 지워도
   * 행은 남으며 남아야 한다 — 게이트로 삼으면 <b>오래된 배치는 영영 못 지운다</b>.
   * 대신 그 화면에 고아가 생기고 `(삭제된 배치)` 로 그린다.
   *
   * <p><b>왜 막히는지 말하고 대안까지 말한다</b> — 사람이 실제로 하려는 일은 대개
   * <i>끄는 것</i>이다.
   */
  const deletable = useMemo<DeleteColumnSpec<BatchScheduleRow>>(
    () => ({
      // 미저장 신규 행은 언제나 지울 수 있다 — 서버에 없으므로 즉시 제거다(frontend/grid.md).
      enabled: (row) => row.state === 'C' || (!row.data.useYn && !row.data.running),
      reason: (row) =>
        row.data.useYn
          ? label(MSG.BATCH_SCHEDULE_DELETE_ENABLED)
          : label(MSG.BATCH_SCHEDULE_DELETE_RUNNING),
    }),
    [],
  );

  return (
    <FillColumn>
      <SearchForm
        handleRef={searchForm}
        fields={searchFields}
        onSubmit={() => void readMaster()}
        onReset={master.clearFilters}
        onActiveCountChange={header.onActiveCountChange}
        collapsed={header.collapsed}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        {/*
          <b>축이 상하다</b>(frontend/grid.md · screen/batch/schedule/requirements.md). 마스터 컬럼이 열이 넘어 좌우로 나누면
          가로가 모자라고, 하단이 이력이라 <b>가로로 긴 표</b>다.
        */}
        <SplitPane
          storageKey="batchSchedule"
          first={(collapsed, expand) => (
            <DataGrid<BatchScheduleRow>
              title={MSG.BATCH_SCHEDULE_GRID_TITLE}
              menuCd={MENU_CD}
              // 개인화의 키다 — 같으면 위아래 설정이 서로를 덮는다(frontend/grid.md).
              gridId="master"
              controller={master}
              pageSizes={PAGE_SIZES}
              deletable={deletable}
              onSelect={selectBatch}
              emptyText={MSG.BATCH_SCHEDULE_EMPTY}
              collapsed={collapsed}
              onExpand={expand}
            />
          )}
          second={(collapsed, expand) => (
            <DataGrid<BatchHistoryRow>
              title={MSG.BATCH_SCHEDULE_RECENT_TITLE}
              menuCd={MENU_CD}
              gridId="recent"
              controller={recent}
              emptyText={recentEmpty}
              /*
                <b>하단에 ②가 없다</b>(screen/menu/requirements.md) — 그리고 이 화면은 마스터에도 없다.
                전량을 묻는 질문에는 `BATCH_HISTORY` 가 답하며 그쪽에 `E` 가 있다.
              */
              onRowDoubleClick={(row) => openHistory(row.data)}
              collapsed={collapsed}
              onExpand={expand}
            />
          )}
        />
      </div>
    </FillColumn>
  );
}

// ── 컬럼 (screen/batch/schedule/requirements.md) ────────────────────────────────────────────────

/**
 * frontend/grid.md 대로 <b>편집 폼이 없다</b> — 이 표가 목록이자 편집 화면이다.
 *
 * <p><b>`BATCH_DESC` 가 기본 숨김이 아닌 것</b>이 sys/batch.md 의 화면 쪽 절반이다.
 * 장애 대응 중에 소스를 열 시간은 없고, 컬럼 설정에서 꺼 둘 수는 있지만 <b>기본은 보인다</b>.
 */
function buildColumns(
  beanOptions: SelectOption[],
  timezoneOptions: SelectOption[],
): ColumnDef<BatchScheduleRow>[] {
  return [
    {
      field: 'sortNo',
      header: MSG.BATCH_SCHEDULE_COL_SORT_NO,
      type: 'number',
      width: 80,
      sortable: true,
      /*
        <b>드래그가 아니라 숫자다</b>(screen/batch/schedule/requirements.md). screen/menu/requirements.md 의 트리 드래그는 <b>계층을 바꾸는
        조작</b>이라 드래그가 유일한 수단이었지만, 여기는 평평한 목록이고 정렬이 표시
        순서일 뿐이라 드래그를 만들면 sys/menu.md 의 재작성 규약이 딸려 온다.

        <b>중복을 막지 않는다</b> — tie-breaker(`BATCH_ID`)가 순서를 결정적으로 만든다.
      */
      editable: true,
    },
    {
      field: 'batchId',
      header: MSG.BATCH_SCHEDULE_COL_BATCH_ID,
      type: 'text',
      width: 180,
      pinned: 'left',
      /*
        PK 이자 <b>락 키</b>다(backend/persistence.md). 신규 행에서만 열리고, 필수이고, 헤더에 필수 표시가
        붙는다(frontend/grid.md). 이 테이블은 <b>물리 삭제가 있으므로</b> 고치려면 지우고 다시
        만드는 길이 실제로 열려 있다 — 역할과 갈리는 점이다.
      */
      pk: true,
    },
    {
      field: 'batchNm',
      header: MSG.BATCH_SCHEDULE_COL_BATCH_NM,
      type: 'text',
      width: 180,
      sortable: true,
      required: true,
      // <b>다국어가 아니다</b> — 관리자 전용 명칭이라 컬럼 값이다(sys/batch.md).
      editable: true,
    },
    {
      field: 'batchDesc',
      header: MSG.BATCH_SCHEDULE_COL_BATCH_DESC,
      type: 'text',
      width: 280,
      fill: true,
      filter: false,
      /*
        <b>필수다</b> — sys/batch.md · screen/batch/schedule/requirements.md. 비워 둔 채 저장할 수 없고, 이 문장을 <b>끄는
        확인 창이 그대로 읽어 준다</b>.
      */
      required: true,
      editable: true,
      editor: 'largeText',
    },
    {
      field: 'beanId',
      header: MSG.BATCH_SCHEDULE_COL_BEAN_ID,
      type: 'text',
      width: 200,
      /*
        <b>고르는 것이지 타이핑이 아니다</b>(screen/batch/schedule/requirements.md) — screen/menu/requirements.md 이 메뉴 URL 을 라우트
        목록에서 고르게 한 것과 같은 판단이다. 없는 빈을 넣으면 <b>실행 시점에 터지고</b>
        그때는 크론이 깨운 새벽이다.

        <b>후보가 비어 있을 수 있다</b> — 템플릿에는 `BatchJob` 구현이 하나도 없다.
        그때 고를 수 없는 것이 정상이며, 서버도 같은 것을 다시 본다(원칙 P1).
      */
      required: true,
      editable: true,
      editor: 'select',
      options: beanOptions,
    },
    {
      field: 'cron',
      header: MSG.BATCH_SCHEDULE_COL_CRON,
      type: 'text',
      width: 150,
      /*
        <b>구문도 관계도 서버가 본다</b>(screen/batch/schedule/requirements.md). 크론 파서가 프론트 의존성에 없으며
        (stack.md), 쿨다운과의 관계는 <b>파서 없이는 판정 자체가 불가능</b>하다 —
        frontend/grid.md 가 *서버 검증이 남는 자리* 로 적은 그것이다.
      */
      required: true,
      editable: true,
    },
    {
      field: 'timezone',
      header: MSG.BATCH_SCHEDULE_COL_TIMEZONE,
      type: 'text',
      width: 200,
      /*
        <b>크론 바로 오른쪽이다</b>(screen/batch/schedule/requirements.md §4-1) — 둘이 한 뜻이라 떨어뜨리면
        *어느 시간대의 6시인가* 를 두 곳에서 읽어야 한다.

        <b>고르는 것이지 타이핑이 아니다.</b> 자유 입력을 열면 `Korea/Seoul` 처럼 있을 듯한
        오타가 들어오고, 그것을 잡는 것이 오로지 서버 검증이 된다.
      */
      required: true,
      editable: true,
      /*
        <b>`select` 이 아니라 `richSelect` 다</b> — 후보가 600개다. playbook/INDEX.md 이 스무
        개를 경계로 둔 이유가 그것이며, 검색 없는 콤보에서 600개는 <b>고르는 것이 아니라
        뒤지는 것</b>이 된다(screen/batch/schedule/requirements.md §4-1 — *검색으로 좁힌다*).
      */
      editor: 'richSelect',
      options: timezoneOptions,
    },
    {
      field: 'nextExecDtm',
      header: MSG.BATCH_SCHEDULE_COL_NEXT_EXEC,
      type: 'text',
      width: 200,
      /*
        <b>그 배치의 시간대로 표시한다</b>(screen/batch/schedule/requirements.md §4-1). 브라우저 시간대로 보이면
        `America/New_York` 로 설정한 운영자가 서울에서 `19:00` 을 보고, <b>자기가 넣은
        06:00 이 맞는지 확인할 근거가 사라진다</b> — 이 칸의 목적 전부가 그 확인이다.

        <b>시간대를 함께 적는다.</b> 그리드의 다른 일시(감사 4)는 보는 사람의 시간대라
        <b>시계가 둘</b>이며, 구별할 표식이 없으면 같은 시계로 읽힌다.

        `dateTime` 이 아니라 `text` + `derive` 인 것이 그 때문이다 — 공통 포매터는
        브라우저 시간대로 옮긴다(shared/grid/dateFormat.ts).
      */
      derive: (row) => formatInZone(row.nextExecDtm, row.timezone),
      filter: false,
      /*
        <b>파생이며 읽기 전용이다</b>(screen/batch/schedule/requirements.md). 이 칸이 <b>크론을 눈으로 확인시킨다</b> —
        `0 0 9 * * MON-FRI` 를 넣고 저장했는데 여기가 월요일이면 맞게 쓴 것이다.

        <b>비어 있는 경우가 둘이고 뜻이 다르다</b>: 꺼 둔 배치이거나(정상 — §3.6),
        크론을 서버가 읽지 못했거나(고장 — 시드·직접 UPDATE 로 들어온 값)다. 후자는
        `최근 결과` 가 함께 말해 준다.
      */
    },
    {
      field: 'paramJson',
      header: MSG.BATCH_SCHEDULE_COL_PARAM,
      type: 'text',
      width: 220,
      filter: false,
      editable: true,
      /*
        <b>`nclob` 이 아니다</b>(`VARCHAR(2000)`). 값이 손에 있으므로 screen/batch/schedule/requirements.md 의 `[보기]`
        규약이 아니라 frontend/grid.md 의 <b>`textModal`</b> 이며, 셀은 한 줄로 잘리고 툴팁에 전체다.

        <b>JSON 포맷터를 두지 않는다</b> — 모달 안에 *정렬* 버튼 같은 것을 넣으면
        그것도 규약이 된다. 값은 2000자 상한이고 대개 한 줄이다.
      */
      editor: 'largeText',
      /*
        <b>구문 검증은 프론트가 한다</b> — 크론과 반대다. `JSON.parse` 는 브라우저에
        이미 있고 <b>파서를 들여오지 않는다</b>. 서버도 저장 시 다시 본다(frontend/grid.md).

        <b>비어 있어도 된다</b> — `NULL` 허용이다(sys/batch.md). 빈 문자열은 서버가 `NULL` 로
        넣는다(Oracle 에서 둘이 같다 — backend/persistence.md).
      */
      validate: (value) => {
        /*
          <b>문자열이 아니면 검사하지 않는다.</b> `unknown` 을 그대로 이으면 객체가 왔을 때
          `[object Object]` 를 파싱하게 되고, 그것은 언제나 실패해 <b>있지도 않은 구문
          오류</b>를 낸다. 이 셀은 `largeText` 편집기라 문자열 아닌 값이 올 자리가 없지만,
          그 사실을 타입이 말해 주지 않는다.
        */
        if (typeof value !== 'string' || value.trim() === '') {
          return null;
        }
        try {
          JSON.parse(value);
          return null;
        } catch {
          return label(MSG.BATCH_SCHEDULE_PARAM_INVALID);
        }
      },
    },
    {
      field: 'lockMinIntervalSec',
      header: MSG.BATCH_SCHEDULE_COL_COOLDOWN,
      type: 'number',
      width: 110,
      /*
        <b>크론과 비교된다</b>(backend/persistence.md). 이 값이 크론 최소 간격 이상이면 저장이
        실패하고 <b>오류가 두 셀에 걸린다</b> — 어느 쪽이 틀렸는지 서버가 말할 수 없다.
        틀린 것은 값이 아니라 <b>관계</b>다.
      */
      editable: true,
    },
    {
      field: 'lockExpirySec',
      header: MSG.BATCH_SCHEDULE_COL_LOCK_EXPIRY,
      type: 'number',
      width: 110,
      /*
        <b>기본 숨김이다</b> — 안전망이라 평소에 볼 일이 없다. 다만 <b>실행 이력의 유령
        판정이 이 값을 임계값으로 쓰므로</b>(screen/batch/schedule/requirements.md) 유령이 자주 보이면 여기를 켜서 본다.
      */
      visible: false,
      editable: true,
    },
    {
      field: 'useYn',
      header: MSG.BATCH_SCHEDULE_COL_USE_YN,
      type: 'ynFlag',
      width: 80,
      sortable: true,
      /*
        <b>스위치가 즉시 저장을 뜻하지 않는다</b>(frontend/grid.md). 토글하는 순간 저장되면
        <b>확인을 낼 자리가 없고</b>, 그 확인이 `BATCH_DESC` 를 읽어 주는 것이 이 화면의
        요점이다.
      */
      editable: true,
    },
    {
      field: 'lastRsltCd',
      header: MSG.BATCH_SCHEDULE_COL_LAST_RSLT,
      type: 'text',
      width: 120,
      filter: false,
      /*
        <b>하단 pane 첫 행과 같은 값</b>이다 — 목록에서 훑고 pane 에서 확인한다.
        한쪽은 20행을 한눈에, 한쪽은 한 배치를 깊이 본다.

        <b>값은 코드이고 글자만 라벨이다</b>(frontend/grid.md) — `tone` 맵이 코드를 키로 봐야 하고,
        정렬·필터·엑셀도 코드를 본다.
      */
      renderer: 'badge',
      tone: RSLT_TONE,
      display: rsltLabel,
    },
    // 감사 4컬럼은 켤 수 있다 — 이 행은 사람이 만들고 사람이 고치므로 감사가 실제로 갈린다.
    ...auditColumns<BatchScheduleRow>(),
  ];
}

// ── 검증 (frontend/grid.md) ────────────────────────────────────────────────

/**
 * 같은 그리드 안의 <b>배치 ID 중복</b> — 화면이 판정할 수 있는 것이다(frontend/grid.md).
 *
 * <p>서버도 같은 것을 다시 본다. 다른 사람이 방금 만든 것은 화면이 알 수 없기 때문이며
 * (frontend/grid.md), <b>이쪽이 막는 것은 저장 시점의 실패를 편집 시점에 알리는 일</b>이다.
 */
function validateBatchIds(rows: GridRow<BatchScheduleRow>[]): GridIssue[] {
  const seen = new Map<string, string>();
  const issues: GridIssue[] = [];
  for (const row of rows) {
    const batchId = row.data.batchId;
    if (!batchId) continue;
    const first = seen.get(batchId);
    if (first === undefined) {
      seen.set(batchId, row.id);
      continue;
    }
    issues.push({
      rowId: row.id,
      field: 'batchId',
      message: label(MSG.BATCH_SCHEDULE_DUPLICATE),
    });
  }
  return issues;
}

/**
 * 실행 <b>앞</b>에 선다 — 미저장 변경이 있으면 막는다(screen/batch/schedule/requirements.md).
 *
 * <p>고친 크론이 반영되지 않은 채 도는 것을 사용자가 기대하지 않는다. <b>저장은 등록을
 * 바꾸고 실행은 그 등록을 읽는다</b> — 순서가 뒤바뀌면 방금 고친 값이 아니라 <i>고치기
 * 전 값</i>으로 도는데, 화면은 고친 값을 보여주고 있다.
 *
 * <p><b>행 하나에 붙인다.</b> 그리드 단위 실패라 `field` 가 없고, 그러면 문구가 상단에
 * 뜬다(frontend/grid.md).
 */
function rejectUnsaved(rows: GridRow<BatchScheduleRow>[]): GridIssue[] {
  // <b>무변경은 `null` 이다</b>(`RowState`) — `'R'` 같은 값이 없다.
  const dirty = rows.find((row) => row.state !== null);
  return dirty
    ? [{ rowId: dirty.id, message: label(MSG.BATCH_SCHEDULE_RUN_UNSAVED) }]
    : [];
}

// ── 조회조건 (screen/batch/schedule/requirements.md) ────────────────────────────────────────────

/**
 * 넷이며 <b>대개 비운 채로 조회한다</b>.
 *
 * <p>등록이 수십 건이고 페이지 사이즈가 50 이라(screen/batch/schedule/requirements.md) 한 화면에 다 들어온다 — 거르는
 * 것보다 <b>눈으로 훑는 것</b>이 빠른 규모이며, 여기 열어 둔 넷은 등록이 수백 건이 됐을
 * 때를 위한 것이다(screen/batch/schedule/requirements.md 의 실측 미결).
 *
 * <p><b>`배치 ID` 가 넘겨받기의 착지점이다</b>(screen/batch/schedule/requirements.md). 실행 이력에서 `배치 ID` 를 더블
 * 클릭하면 이 탭이 그 값으로 열리며, <b>초기화는 빈 칸이 아니라 그 값으로</b> 돌아간다 —
 * 이 탭은 그것을 보러 열렸다(frontend/search-form.md).
 *
 * <p><b>`사용 여부` 의 기본값이 없다(*전체*).</b> 꺼 둔 배치를 감추면 <b>같은 것을 또
 * 만드는</b> 사고가 나고, 그때 `BATCH_ID` 가 PK 라 저장이 실패한다 — 운영자는
 * *"왜 저장이 안 되나"* 만 본다(screen/menu/requirements.md 과 같은 판단).
 *
 * <p><b>`PARAM_JSON` 조건이 없다</b> — sys/batch.md 가 감수한 대가 셋 중 첫째다. 벤더 중립으로는
 * `LIKE` 뿐이고, 그것은 <b>인덱스를 못 타면서 되는 것처럼 보이는</b> 조건이다.
 */
function buildSearchFields(batchId: string): SearchField[] {
  return [
    {
      field: 'batchId',
      label: MSG.BATCH_SCHEDULE_COL_BATCH_ID,
      type: 'text',
      op: 'eq',
      ops: ['eq'],
      // 넘겨받아 열린 탭의 기본값은 그 배치다 — 초기화가 빈 칸으로 가지 않는다(frontend/search-form.md).
      defaultValue: batchId,
    },
    {
      field: 'batchNm',
      label: MSG.BATCH_SCHEDULE_SEARCH_NM,
      type: 'text',
      op: 'contains',
      ops: ['eq', 'startsWith', 'contains', 'endsWith'],
    },
    {
      /*
        <b>같은 빈을 여러 번 등록한다</b>(sys/batch.md 의 창고 10개) — 그래서 이 조건의 답은
        언제나 목록이며, *"이 배치 서비스를 쓰는 등록이 몇 개인가"* 를 묻는 자리다.
      */
      field: 'beanId',
      label: MSG.BATCH_SCHEDULE_SEARCH_BEAN,
      type: 'text',
      op: 'eq',
      ops: ['eq', 'contains'],
    },
    {
      /*
        <b>`select` 이지 `ynFlag` 가 아니다</b>(frontend/search-form.md — 폼의 타입은 셋뿐이다). 스위치로
        두면 <i>끄기 = N</i> 이 되어 <b>*전체* 를 표현할 자리가 없다</b>.
      */
      field: 'useYn',
      label: MSG.BATCH_SCHEDULE_SEARCH_USE_YN,
      type: 'select',
      ops: ['eq'],
      options: [
        { value: 'Y', text: label(MSG.BATCH_SCHEDULE_USE_ON) },
        { value: 'N', text: label(MSG.BATCH_SCHEDULE_USE_OFF) },
      ],
    },
  ];
}

/** 시각을 <b>시:분</b> 으로 — screen/batch/schedule/requirements.md 의 문구가 그 단위다(*"09:14 시작"*). */
function timeText(value: string | null): string {
  if (!value) return '';
  const at = new Date(value);
  return Number.isNaN(at.getTime())
    ? ''
    : `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

/**
 * 그 배치의 시간대로 읽은 <b>다음 실행</b> — screen/batch/schedule/requirements.md §4-1.
 *
 * <p>공통 포매터(`shared/grid/dateFormat.ts`)는 <b>브라우저 시간대</b>로 옮긴다 — 감사
 * 4컬럼처럼 *보는 사람의 시각* 이 맞는 칸에서는 그것이 옳다. 이 칸은 반대로 <b>설정한
 * 시간대의 시각</b>을 물으므로 여기서 따로 만든다.
 *
 * <p><b>아직 `shared/` 로 올리지 않는다</b> — 첫 사용이다(frontend/packages.md 는 두 번째
 * 사용에 올린다). 두 번째 화면이 같은 것을 물으면 그때 올리고 원본을 지운다.
 *
 * <p>`Intl.DateTimeFormat` 을 쓰는 것은 <b>의존성이 늘지 않기</b> 때문이다 — `dayjs` 의
 * 시간대 플러그인은 이 저장소에 없다.
 */
function formatInZone(value: string | null, zone: string): string {
  if (!value || !zone) {
    return '';
  }
  try {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(value));
    // `sv-SE` 가 `YYYY-MM-DD HH:mm` 을 낸다 — 자리 맞춤을 손으로 하지 않는다.
    return `${parts} (${zone})`;
  } catch {
    /*
      시간대가 깨져 있으면 <b>비운다</b> — 서버도 같은 규칙이다(BatchScheduleQueryService).
      깨진 값에 그럴듯한 시각을 그리면 그것이 고장을 감춘다.
    */
    return '';
  }
}
