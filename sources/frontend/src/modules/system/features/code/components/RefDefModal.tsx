// @feat FEAT-504
import { useCallback, useEffect, useMemo } from 'react';
import { Modal } from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { DataGrid } from '@/shared/grid/DataGrid';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow } from '@/shared/grid/rows';
import type { ColumnDef, GridIssue, SelectOption } from '@/shared/grid/types';
import { CODE_ENDPOINTS } from '@/modules/system/features/code/api/endpoints';
import type { CodeRefDefRow } from '@/modules/system/features/code/types';

/**
 * 참조 코드 <b>정의</b> 관리 — screen/admin/system/code/requirements.md.
 *
 * <p><b>값은 컬럼이고 정의만 모달이다.</b> 이전 판은 값 목록을 모달에 담았는데 그러면
 * <b>한 코드씩만 보여</b> *"어느 코드가 아직 안 채워졌나"* 에 답할 수 없었다(sys/code.md).
 * 정의는 <b>자주 열지 않는 관리 행위</b>라 상시 자리를 줄 값이 없다.
 *
 * <p><b>저장이 모달 안에서 닫힌다</b> — 바깥 그리드의 미저장 편집과 섞이지 않는다. 닫으면
 * 하단을 재조회한다: 컬럼 집합이 바뀌었을 수 있다.
 *
 * <p><b>안은 그냥 그리드 하나다.</b> 53 의 크롬(①②③)과 색을 그대로 쓰며, 여기만의 어휘를
 * 만들지 않는다 — 만들면 같은 화면 안에 규약이 둘이 된다.
 */

interface RefDefModalProps {
  open: boolean;
  /** 어느 그룹의 정의인가 — 모달이 닫혀 있는 동안에도 유지된다. */
  grpCd: string | null;
  grpNm: string;
  menuCd: string;
  /** `CODE_REF_KEY` 화이트리스트 — 신규 행의 `REF_CD` 후보다(sys/code.md). */
  refCdOptions: SelectOption[];
  /**
   * 닫힐 때. <b>저장 여부와 무관하게 하단을 재조회한다</b> — 저장하고 닫았는지 아닌지를
   * 모달이 바깥에 알려 주는 것보다, 닫힘 하나를 신호로 두는 편이 어긋날 자리가 없다.
   */
  onClose: () => void;
}

export function RefDefModal(props: RefDefModalProps) {
  const { grpCd, menuCd, refCdOptions } = props;

  const columns = useMemo(() => buildColumns(refCdOptions), [refCdOptions]);

  const api = useMemo(
    () => ({
      read: { url: CODE_ENDPOINTS.getRefDefList },
      save: {
        url: CODE_ENDPOINTS.saveRefDef,
        validate: { grid: validateRefCds },
        // 값이 함께 사라진다는 것을 건수보다 **먼저** 말한다(frontend/grid.md · screen/admin/system/code/requirements.md).
        warn: deleteWarnings,
      },
    }),
    [],
  );

  // 부모 키는 조건이 아니라 `params` 다 — 화면의 구조이지 사용자가 좁힌 것이 아니다(backend/api.md).
  const searchParams = useCallback(() => ({ grpCd }), [grpCd]);

  const grid = useGridController<CodeRefDefRow>({
    menuCd,
    columns,
    api,
    searchParams,
    // 조회조건 폼이 없다 — 정의는 한 그룹의 것이고 그 수가 손에 꼽는다.
    toSaveRow: (row) => ({
      rowState: row.state,
      refCd: row.data.refCd,
      refNm: row.data.refNm,
      refDesc: row.data.refDesc,
    }),
    saveEnvelope: (rows) => ({ grpCd, rows }),
    addRow: {
      // 새 정의는 컬럼 하나를 더한다 — 이름이 비면 헤더가 빈 컬럼이 생긴다(sys/code.md).
      defaults: () => ({ refCd: '', refNm: '', refDesc: null, valueCount: 0 }),
    },
  });

  /*
    열릴 때 한 번 조회한다. 그리드가 스스로 조회하지 않는 것은 규약이고(frontend/grid.md — 조회는
    사용자의 행위다), 모달은 **여는 것 자체가 그 행위**다 — 열자마자 빈 판을 보여 주고
    조회를 한 번 더 누르게 하면 누구도 그 이유를 설명할 수 없다.
  */
  useEffect(() => {
    if (props.open && grpCd) {
      void grid.read();
    }
    // 여는 순간에만 돈다 — `grid` 를 의존에 넣으면 편집할 때마다 다시 조회한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, grpCd]);

  return (
    <Modal
      open={props.open}
      title={label(MSG.CODE_REF_DEF_TITLE, { grpNm: props.grpNm })}
      onCancel={props.onClose}
      footer={null}
      width={840}
      destroyOnHidden
    >
      <div style={{ height: 420 }}>
        <DataGrid
          title={MSG.CODE_REF_DEF_GRID}
          menuCd={menuCd}
          gridId="refDef"
          controller={grid}
          // 정의는 물리 삭제다 — 값 → 정의 순서라 게이트가 아니라 확인이다(screen/admin/system/code/requirements.md).
          deletable
          // 컬럼 넷이 전부 필요하다 — 끄거나 옮길 것이 없으면 설정 창도 뜻이 없다(frontend/grid.md).
          settings={false}
        />
      </div>
    </Modal>
  );
}

// ── 컬럼 ──────────────────────────────────────────────────────────

function buildColumns(refCdOptions: SelectOption[]): ColumnDef<CodeRefDefRow>[] {
  return [
    {
      field: 'refCd',
      header: MSG.CODE_COL_REF_CD,
      type: 'code',
      width: 180,
      // 그룹과 복합 PK 다 — 신규 행에서만 열린다(frontend/grid.md).
      pk: true,
      // **화이트리스트에서 고른다** — 소스가 이 값을 문자열로 참조하므로 정의 테이블이
      // 그 통제를 대신하지 않는다(sys/code.md).
      editor: 'select',
      options: refCdOptions,
    },
    {
      field: 'refNm',
      header: MSG.CODE_COL_REF_NM,
      type: 'text',
      width: 200,
      // **필수다.** 이 값이 하단 그리드의 컬럼 헤더가 되므로 비면 그리드를 못 읽는다.
      // 전역 코드명으로 폴백하지 않는다 — 명칭의 원천이 둘이 된다(sys/code.md).
      required: true,
      editable: true,
    },
    {
      field: 'refDesc',
      header: MSG.CODE_COL_REF_DESC,
      type: 'text',
      width: 200,
      fill: true,
      editable: true,
      editor: 'largeText',
    },
    {
      field: 'valueCount',
      header: MSG.CODE_COL_REF_COUNT,
      type: 'number',
      width: 120,
      // 파생이라 정렬 대상이 아니다(frontend/grid.md) — 서버 화이트리스트에도 없다.
      filter: false,
    },
  ];
}

// ── 검증 · 경고 ───────────────────────────────────────────────────

/** 같은 `REF_CD` 를 두 번 정의할 수 없다 — 같은 그리드 안의 중복은 화면이 판정한다. */
function validateRefCds(rows: GridRow<CodeRefDefRow>[]): GridIssue[] {
  const issues: GridIssue[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const refCd = row.data.refCd?.trim() ?? '';
    if (refCd === '') continue;
    if (seen.has(refCd)) {
      issues.push({ rowId: row.id, field: 'refCd', message: label(MSG.CODE_DUPLICATE) });
    }
    seen.add(refCd);
  }
  return issues;
}

/**
 * 정의를 지우면 <b>그 정의로 입력된 값이 함께 사라진다</b>(screen/admin/system/code/requirements.md).
 *
 * <p>게이트가 아니라 확인인 이유는 <b>DB 가 거부하지 않기</b> 때문이다 — 값 → 정의 순서로
 * 지우면 FK 가 막을 것이 없다. 막을 것이 없으면 <b>묻는다</b>.
 */
function deleteWarnings(rows: GridRow<CodeRefDefRow>[]): string[] {
  return rows
    .filter((row) => row.state === 'D' && row.data.valueCount > 0)
    .map((row) =>
      label(MSG.CODE_REF_DEF_DELETE_WARN, {
        refNm: row.data.refNm,
        count: row.data.valueCount,
      }),
    );
}
