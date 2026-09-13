// @feat FEAT-503
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { auditColumns } from '@/shared/grid/auditColumns';
import { DataGrid } from '@/shared/grid/DataGrid';
import { DetailTabs } from '@/shared/grid/DetailTabs';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow } from '@/shared/grid/rows';
import type { ColumnDef, DeleteColumnSpec, TitleSuffixSpec } from '@/shared/grid/types';
import { SAMPLE_TABS_ENDPOINTS } from '@/modules/sample/features/mdtabs/api/endpoints';
import { duplicatedSortNo, nextSortNo, tooManyTagRows } from '@/modules/sample/tagRules';
import { buildItemColumns } from '@/modules/sample/itemColumns';
import type { SampleOrder, SampleOrderItem, SampleOrderTagRow } from '@/modules/sample/types';

/**
 * `SMPL_MD_TABS` 의 하단 — playbook/INDEX.md. **하단 디테일 탭의 유일한 실물**이다(playbook/INDEX.md).
 *
 * <p>탭 둘이 **같은 주문의 서로 다른 얼굴**이다: 품목은 ③④와 같은 표이고, 태그는 ①이
 * `list` 컬럼 하나로 나르던 것을 **행으로** 편 것이다(playbook/INDEX.md).
 *
 * <h2>탭 둘의 기본값 셋을 화면이 적지 않는다</h2>
 *
 * <p>frontend/grid.md — `gridId` 는 탭 키에서, `titleSuffix` 는 부모 컨트롤러에서, `disabled` 는
 * 선택 상태에서 온다. 판의 높이·탭 최소 폭·탭바 높이는 `DetailTabs` 가 갖는다.
 *
 * <h2>지연 로딩 — 안 연 탭은 아직 읽지도 않았다</h2>
 *
 * <p>마스터를 클릭할 때마다 둘 다 나가면 **목록을 훑는 동작 자체가 부하**가 된다
 * (playbook/INDEX.md). `USER_MGMT` 가 탭 다섯에 대해 같은 판단을 내렸고 그 근거가 여기서도 같다.
 *
 * <p>**한 번 부른 탭은 주문이 바뀔 때까지 다시 부르지 않는다** — 탭을 오가는 것은 조회가
 * 아니라 *보는 각도를 바꾸는 것*이다. 그래도 **조회 버튼은 탭마다 있다**(playbook/INDEX.md): 남이
 * 고친 것을 다시 읽는 일은 **그 탭만**의 일이며, 마스터의 조회는 목록을 통째로 바꿔
 * 디테일을 리셋하므로 같은 것이 아니다.
 *
 * <p>**저장은 서로를 잊게 하지 않는다.** `USER_MGMT` 는 한 탭의 저장이 다른 탭의 답을
 * 바꾸므로(역할을 회수하면 유효 권한이 준다) 나머지를 잊었지만, 품목과 태그는 **서로를
 * 바꾸지 않는다** — 같은 주문에 매달렸을 뿐 한쪽이 다른 쪽의 입력이 아니다. 근거 없이
 * 잊으면 사용자가 태그를 저장할 때마다 품목이 조용히 다시 조회된다.
 *
 * <h2>탭별 독립 편집 상태</h2>
 *
 * <p>`useGridController` 둘이 **이 컴포넌트에** 산다. antd 의 탭이 활성 판만 그리더라도
 * 훅은 부모에 있으므로 **품목을 고치고 태그 탭으로 가도 편집이 살아 있다**(playbook/INDEX.md) —
 * 탭 안에서 훅을 부르면 언마운트와 함께 미저장 편집이 사라진다.
 */

type TabKey = 'item' | 'tag';

export interface SampleDetailTabsHandle {
  /**
   * 마스터의 선택이 바뀌었다 — frontend/grid.md 의 상태 셋을 여기서 편다.
   *
   * @param ordId `null` 이면 **빈 상태**다(조회 전 · 아무도 안 고름 · 미저장 신규 행).
   *     신규 행이 여기 섞이는 것은 FK 때문이다 — 부모가 저장되기 전에는 자식을 만들 수 없다.
   */
  select: (ordId: string | null) => Promise<void>;
  /**
   * **탭 둘 중 하나라도** 미저장인가 — 마스터가 선택을 바꾸기 전에 묻는다.
   *
   * <p>playbook/INDEX.md 이 *"두 번 묻지 않는다"* 고 적은 것이 이 한 줄이다. 탭마다 물으면 사용자는
   * 같은 물음에 두 번 답하면서도 **무엇을 잃는지는 여전히 모른다**.
   */
  dirty: () => boolean;
}

interface Props {
  menuCd: string;
  /**
   * 마스터 그리드 — **탭의 제목이 누구의 것인지 말하는 근거**다(frontend/grid.md).
   *
   * <p>{@link SampleDetailTabsHandle.select} 가 이미 주문 ID 를 받지만 그것으로는 모자란다:
   * 제목에 붙는 것은 **주문번호와 주문명**이고, 그 둘을 여기서 또 들면 **같은 사실이 두
   * 곳**이 된다 — 마스터에서 이름을 고치고 저장하기 전이면 둘이 갈린다.
   */
  master: { selected: GridRow<SampleOrder>[] };
  /** 스플리터가 하단을 접었다 — **탭바까지 감춘다**(playbook/INDEX.md · `DetailTabs`). */
  collapsed?: boolean;
  onExpand?: () => void;
  handleRef: React.RefObject<SampleDetailTabsHandle | null>;
}

export function SampleDetailTabs(props: Props) {
  const { menuCd, master, collapsed, onExpand, handleRef } = props;

  const [tab, setTab] = useState<TabKey>('item');
  /** 렌더가 보는 값 — 빈 판의 문구와 `disabled` 가 읽는다. */
  const [picked, setPicked] = useState<string | null>(null);

  /*
    조회 콜백이 읽는 값들 — 행을 고른 **바로 그 순간**에 조회가 나가야 하므로 상태 갱신을
    기다릴 수 없다. 기다리면 첫 조회가 *이전 주문*의 것을 가져온다(`UserDetailTabs` 와 같다).
  */
  const ordId = useRef<string | null>(null);
  const activeTab = useRef<TabKey>('item');
  /** 이미 부른 탭 — 주문이 바뀔 때 비운다. */
  const loaded = useRef<Set<TabKey>>(new Set());
  /** 신규 태그 행이 제안할 순서가 읽는다 — `defaults` 는 콜백이라 렌더 값을 못 본다. */
  const tagRows = useRef<GridRow<SampleOrderTagRow>[]>([]);

  /** 디테일 탭에는 조회조건 폼이 없다 — 대상이 없으면 **조회 자체를 하지 않는다**(frontend/grid.md). */
  const conditions = useCallback(() => Promise.resolve(ordId.current ? [] : null), []);
  const byOrder = useCallback(() => ({ ordId: ordId.current }), []);

  // ── 탭 1 — 품목 ────────────────────────────────────────────────

  const itemColumns = useMemo(() => buildItemColumns(), []);
  const itemApi = useMemo(
    () => ({
      read: { url: SAMPLE_TABS_ENDPOINTS.getItemList },
      save: { url: SAMPLE_TABS_ENDPOINTS.saveItems },
    }),
    [],
  );
  const items = useGridController<SampleOrderItem>({
    menuCd,
    columns: itemColumns,
    api: itemApi,
    params: conditions,
    searchParams: byOrder,
    addRow: {
      canAdd: () =>
        ordId.current !== null ? true : { ok: false, message: label(MSG.SAMPLE_ITEM_NO_MASTER) },
      defaults: () => ({
        ordId: ordId.current,
        // 주문 안의 다음 번호는 서버가 정한다 — 화면이 정하면 두 사람이 같은 번호를 만든다.
        itemSeq: null,
        ordNo: '',
        itemCd: '',
        itemNm: '',
        uomCd: 'EA',
        qty: 0,
        unitAmt: 0,
        amt: 0,
        dlvrDt: null,
        itemStatCd: 'WAIT',
        useYn: true,
        rmk: null,
        regId: null,
        regDtm: null,
        modId: null,
        modDtm: null,
      }),
    },
    toSaveRow: (row) => ({
      rowState: row.state,
      itemSeq: row.data.itemSeq,
      ...(row.state === 'D'
        ? {}
        : {
            itemCd: row.data.itemCd,
            itemNm: row.data.itemNm,
            uomCd: row.data.uomCd,
            qty: row.data.qty,
            unitAmt: row.data.unitAmt,
            dlvrDt: row.data.dlvrDt,
            itemStatCd: row.data.itemStatCd,
            useYn: row.data.useYn,
            rmk: row.data.rmk,
          }),
    }),
    saveEnvelope: (rows) => ({ ordId: ordId.current, rows }),
  });

  // ── 탭 2 — 태그 ────────────────────────────────────────────────

  const tagColumns = useMemo(() => buildTagColumns(), []);
  const tagApi = useMemo(
    () => ({
      read: { url: SAMPLE_TABS_ENDPOINTS.getTagList },
      save: {
        url: SAMPLE_TABS_ENDPOINTS.saveTags,
        /*
          3층 — 판 전체를 봐야 아는 것이다(frontend/grid.md). 서버도 같은 것을 본다.

          **둘을 이어 붙인다.** 개수와 순서는 서로 상관이 없고 한 판에서 둘 다 어긋날 수
          있으므로, 앞의 것만 내면 사용자가 고친 뒤에 나머지를 처음 듣는다 — frontend/grid.md 의
          *건수를 먼저 알려준다* 가 두 규칙에 걸쳐서도 성립해야 한다.

          **개수를 앞에 둔다.** 넘은 판에서 할 일은 행을 빼는 것이고, 뺄 행의 순서를 먼저
          고치라고 말하면 두 번 고치게 된다(서버가 같은 순서로 본다).
        */
        validate: {
          grid: (rows: GridRow<SampleOrderTagRow>[]) => [
            ...tooManyTagRows(rows),
            ...duplicatedSortNo(rows),
          ],
        },
      },
    }),
    [],
  );
  const tags = useGridController<SampleOrderTagRow>({
    menuCd,
    columns: tagColumns,
    api: tagApi,
    params: conditions,
    searchParams: byOrder,
    addRow: {
      canAdd: () =>
        ordId.current !== null ? true : { ok: false, message: label(MSG.SAMPLE_ITEM_NO_MASTER) },
      defaults: () => ({
        ordId: ordId.current,
        // ①과 갈리는 자리다 — 저기서는 배열의 색인이 곧 순번이고 여기서는 서버가 정한다.
        tagSeq: null,
        tagNm: '',
        tagTypeCd: 'GEN',
        /*
          **정렬순서는 화면이 제안한다.** 서버가 정하면 신규 행의 칸이 저장 전까지 비어
          있는데, 이 컬럼은 사용자가 고치는 값이라(그것이 `TAG_SEQ` 와 갈리는 이유다)
          빈 칸을 주면 *무엇을 적어야 하나* 를 매번 묻게 된다. 겹치면 저장이 거부한다.
        */
        sortNo: nextSortNo(tagRows.current),
        regId: null,
        regDtm: null,
        modId: null,
        modDtm: null,
      }),
    },
    toSaveRow: (row) => ({
      rowState: row.state,
      tagSeq: row.data.tagSeq,
      ...(row.state === 'D'
        ? {}
        : {
            tagNm: row.data.tagNm,
            tagTypeCd: row.data.tagTypeCd,
            sortNo: row.data.sortNo,
          }),
    }),
    saveEnvelope: (rows) => ({ ordId: ordId.current, rows }),
  });

  useEffect(() => {
    tagRows.current = tags.rows;
  }, [tags.rows]);

  // ── 탭의 상태 ──────────────────────────────────────────────────

  const controllerOf = useCallback((key: TabKey) => (key === 'item' ? items : tags), [items, tags]);

  const loadTab = useCallback(
    async (key: TabKey) => {
      if (!ordId.current || loaded.current.has(key)) return;
      loaded.current.add(key);
      await controllerOf(key).read(true);
    },
    [controllerOf],
  );

  const changeTab = useCallback(
    (key: string) => {
      const next = key as TabKey;
      activeTab.current = next;
      setTab(next);
      void loadTab(next);
    },
    [loadTab],
  );

  const select = useCallback(
    async (next: string | null) => {
      ordId.current = next;
      loaded.current.clear();
      setPicked(next);
      /*
        **둘 다 비운다.** 남겨 두면 *다른 주문의 데이터를 그 주문 것으로* 보게 되고
        (frontend/grid.md), 탭을 옮기는 순간 그 오해가 화면에 그대로 남는다 — 지연 로딩이라
        **안 연 탭은 조회로 갈아 끼워지지도 않는다**.
      */
      items.setRows([]);
      tags.setRows([]);
      await loadTab(activeTab.current);
    },
    [items, tags, loadTab],
  );

  const dirty = useCallback(() => items.dirty || tags.dirty, [items.dirty, tags.dirty]);

  /*
    **렌더 중에 ref 를 쓰지 않는다**(`react-hooks/refs`). 마스터가 이 핸들을 부르는 것은
    사람이 행을 클릭한 뒤이므로 효과가 이미 돌아 있다.
  */
  useEffect(() => {
    handleRef.current = { select, dirty };
  }, [handleRef, select, dirty]);

  // ── 그리기 ─────────────────────────────────────────────────────

  /**
   * 대상이 없으면 **탭은 살아 있고 버튼이 잠긴다**(playbook/INDEX.md).
   *
   * <p>탭을 잠그면 *"이 주문에 태그 탭이 없나"* 로 읽힌다 — 없는 것은 **고를 주문**이지
   * 탭이 아니다.
   */
  const idle = picked === null;

  const itemDeletable = useMemo<DeleteColumnSpec<SampleOrderItem>>(
    () => ({ enabled: () => true }),
    [],
  );
  const tagDeletable = useMemo<DeleteColumnSpec<SampleOrderTagRow>>(
    () => ({ enabled: () => true }),
    [],
  );

  const titleSuffix = useMemo<TitleSuffixSpec>(
    () => ({ parent: master, fields: ['ordNo', 'ordNm'] }),
    [master],
  );

  return (
    <FillColumn>
      <DetailTabs
        activeKey={tab}
        onChange={changeTab}
        collapsed={collapsed}
        items={[
          {
            key: 'item',
            label: label(MSG.SAMPLE_TAB_ITEM),
            children: (
              <DataGrid<SampleOrderItem>
                title={MSG.SAMPLE_ITEM_GRID_TITLE}
                menuCd={menuCd}
                // 개인화의 키다 — 같으면 탭 둘의 설정이 서로를 덮는다(frontend/grid.md).
                gridId="detailItem"
                controller={items}
                deletable={itemDeletable}
                titleSuffix={titleSuffix}
                emptyText={idle ? MSG.SAMPLE_ITEM_NO_MASTER : MSG.SAMPLE_ITEM_EMPTY}
                disabled={idle}
                collapsed={collapsed}
                onExpand={onExpand}
              />
            ),
          },
          {
            key: 'tag',
            label: label(MSG.SAMPLE_TAB_TAG),
            children: (
              <DataGrid<SampleOrderTagRow>
                title={MSG.SAMPLE_TAG_GRID_TITLE}
                menuCd={menuCd}
                gridId="detailTag"
                controller={tags}
                deletable={tagDeletable}
                titleSuffix={titleSuffix}
                emptyText={idle ? MSG.SAMPLE_ITEM_NO_MASTER : MSG.SAMPLE_TAG_EMPTY}
                disabled={idle}
                collapsed={collapsed}
                onExpand={onExpand}
              />
            ),
          },
        ]}
      />
    </FillColumn>
  );
}

/**
 * 태그 탭의 컬럼 넷 — playbook/INDEX.md 의 셋에 **`TAG_SEQ` 를 더한다**.
 *
 * <p>§7.2 가 `TAG_NM`·`TAG_TYPE_CD`·`SORT_NO` 셋을 적었지만 순번을 함께 그린다. 그 둘이
 * **여기서 처음 갈리기** 때문이다(playbook/INDEX.md): ①은 배열을 통째로 보내 서버가 `index + 1` 을
 * 둘에 함께 넣지만, 행 편집은 **순번을 유지한 채 순서만** 바꿀 수 있다. 하나만 그리면 그
 * 갈림이 데이터에만 있고 화면에는 없어, 다음 사람이 *왜 컬럼이 둘인가* 를 테이블에서
 * 유추해야 한다.
 */
function buildTagColumns(): ColumnDef<SampleOrderTagRow>[] {
  return [
    {
      field: 'tagSeq',
      header: MSG.SAMPLE_COL_TAG_SEQ,
      type: 'number',
      width: 90,
      pinned: 'left',
      // 복합 PK 의 절반이다 — 서버가 정하고 고칠 수 없다(고치면 다른 행이다).
    },
    {
      field: 'tagNm',
      header: MSG.SAMPLE_COL_TAG_NM,
      type: 'text',
      width: 200,
      required: true,
      editable: true,
    },
    {
      field: 'tagTypeCd',
      header: MSG.SAMPLE_COL_TAG_TYPE,
      type: 'code',
      width: 130,
      // 항목이 스칼라가 아닌 쪽의 실물이다(frontend/grid.md) — ①의 `listModal` 이 같은 값을 편집한다.
      grpCd: 'SMPL_TAG_TYPE',
      renderer: 'badge',
      tone: { GEN: 'none', PROMO: 'ok', RISK: 'warn' },
      editable: true,
      editor: 'select',
    },
    {
      field: 'sortNo',
      header: MSG.SAMPLE_COL_SORT_NO,
      type: 'number',
      width: 110,
      required: true,
      editable: true,
      editor: 'number',
      fill: true,
    },
    ...auditColumns<SampleOrderTagRow>(),
  ];
}
