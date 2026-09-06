import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App } from 'antd';
import { post } from '@/shared/api';
import { DataGrid } from '@/shared/grid/DataGrid';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow } from '@/shared/grid/rows';
import type {
  ColumnDef,
  GridControl,
  GridIssue,
  PageResponse,
  ReadApi,
  SaveApi,
} from '@/shared/grid/types';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { useAuthStore } from '@/shared/stores/authStore';
import { useCodeOptions } from '@/shared/code/useCodeOptions';
import { matchRows } from '@/shared/excelupload/matchRows';
import { readWorkbook, type ReadText } from '@/shared/excelupload/readWorkbook';

/**
 * 엑셀 업로드 탭 — frontend/grid-advanced.md · playbook/INDEX.md.
 *
 * <p><b>업로드가 아니라 읽기다.</b> 파일은 서버에 올라가지 않고(frontend/grid-advanced.md) 브라우저가
 * 읽어 <b>그리드에 붓는다</b> — 그래서 `SYS_FILE` 에 아무것도 남지 않고 업로드 엔드포인트도
 * 없다. 저장은 <b>업무 탭과 같은 `api.save`</b> 이며 새 경로를 만들지 않는다.
 *
 * <p><b>미리보기가 곧 행 상태다</b>(playbook/INDEX.md). 읽은 뒤 같은 조회 API 를 한 번 불러
 * 기존 행과 대조하고, 신규는 `C` · 변경은 `U` · 같은 것은 <b>상태가 없다</b> — 412행짜리
 * 파일에서 세 줄만 고쳤으면 <b>나가는 것도 세 줄</b>이어야 한다.
 *
 * <h2>조회 버튼이 없다</h2>
 *
 * <p>frontend/grid.md 이 <i>"디테일도 ①에 조회를 갖는다"</i> 로 닫았지만 <b>업로드 탭은 디테일이
 * 아니다</b>(playbook/INDEX.md): 행이 서버가 아니라 <b>파일</b>에서 오므로 조회 버튼이 부를 곳이 없고,
 * 눌리면 <b>읽어들인 412행이 통째로 날아간다</b>. 그래서 {@code read} 를 컨트롤러의
 * {@code api} 가 아니라 <b>이 컴포넌트의 인자</b>로 받는다 — 선언하면 버튼이 선다.
 *
 * <h2>거절은 통째로 한다</h2>
 *
 * <p>헤더가 다르거나 행이 상한을 넘으면 <b>읽지 않는다</b>(playbook/INDEX.md). 조용히 자르면
 * 사용자는 <i>올린 것이 다 들어간 줄</i> 알고, 열이 밀린 채 읽으면 <b>수량 자리에 단가가</b>
 * 들어간 파일이 저장까지 통과한다.
 */
export interface ExcelUploadTabHandle {
  /**
   * 읽어들인 행 중 <b>저장되지 않은 것이 있나</b> — 최상단 탭이 옮기기 전에 묻는다
   * (68 &sect;8.7).
   *
   * <p>하단 디테일 탭과 <b>규칙이 다르다</b>: 저기는 한 화면 안의 부분이 갈리는 것이라
   * 묻지 않지만, 최상단 탭은 <b>화면 전체</b>를 갈아 끼운다. 묻지 않으면 사용자는
   * <i>탭을 옮긴 것</i>으로 알고 읽어들인 412행을 남겨 둔 채 다른 일을 한다.
   *
   * <p><b>함수인 것은 <i>지금</i> 을 물어야 하기 때문이다</b>({@code ScreenTabs.dirty}
   * 와 같은 이유) — 불리언으로 올리면 매 편집마다 화면 전체가 다시 그려진다.
   */
  dirty: () => boolean;
}

export interface ExcelUploadTabProps<T> {
  title: string;
  menuCd: string;
  /** <b>업무 탭과 같은 배열</b>이다 — 양식이 갈릴 수 없다(playbook/INDEX.md). */
  columns: ColumnDef<T>[];
  /** 기존 행과 대조하는 키 — playbook/INDEX.md 의 {@code keyFields}. */
  keyFields: string[];
  /** 업무 탭과 <b>같은 조회 API</b>. 버튼이 되지 않으므로 {@code api} 밖에 있다(위). */
  read: ReadApi;
  /** 업무 탭과 <b>같은 저장 API</b>. */
  save: SaveApi<T>;
  /**
   * 행 하나를 요청 모양으로 바꾼다 &mdash; <b>업무 탭과 같은 함수</b>다.
   *
   * <p><b>인자로 받는 것이 결정이다.</b> 이 컴포넌트가 스스로 만들면 <i>행 봉투를 그대로
   * 보낸다</i> 같은 모양이 되는데, 그러면 서버가 <b>파생 컬럼과 감사 컬럼까지</b> 받게 되고
   * (원칙 P1) 업무 탭이 보내는 것과 갈린다 — 같은 경로에 두 가지 요청이 도착한다.
   *
   * <p><b>배열이 아니라 행 하나인 것이 규약이다</b>(standard/frontend/save-errors.md §3). 배열을 화면이
   * 만들면 서버가 준 행 순번을 배관이 믿을 수 없어 <b>서버 오류가 셀에 꽂히지 않는다</b>.
   *
   * <p><b>없으면 저장이 조용히 아무 일도 하지 않는다</b>(2026-09-02 실물). 컨트롤러의
   * {@code save} 는 만들 방법이 없으면 <b>첫 줄에서 돌아가며</b>, 사용자에게는 버튼을
   * 눌렀는데 아무 반응이 없는 것으로 보인다 — 실패 문구조차 없다. 필수로 둔다.
   */
  toSaveRow: (row: GridRow<T>) => unknown;
  /** 화면이 미저장 여부를 묻는 손잡이 — {@link ExcelUploadTabHandle}. */
  handleRef?: React.RefObject<ExcelUploadTabHandle | null>;
  height?: number;
}

export function ExcelUploadTab<T>(props: ExcelUploadTabProps<T>) {
  const { modal, message } = App.useApp();
  /*
    <b>상한을 인자로 받지 않는다.</b> playbook/INDEX.md 의 초안은 그렇게 두었지만, 화면마다 값을
    넘기면 <b>같은 사실의 원천이 화면 수만큼</b> 생긴다 — 설정을 바꿔도 어떤 화면은 옛
    값으로 남는다.

    <b>내려받기와는 다른 키다</b>(2026-09-02 실측 — `ui.excel.max-upload-rows`). 한동안
    같은 값을 썼고 근거는 *양식이 곧 내려받은 파일* 이었는데, 두 값이 재는 것이 달랐다:
    내려받기는 브라우저가 만드는 파일의 크기이고 올리기는 파싱 + **서버의 한 트랜잭션**
    이다. 파싱은 5만 행이 1.5초로 싸지만 저장은 2만 행이 12.5초다 — 같은 값으로 두면
    사용자를 30초 기다리게 하거나 멀쩡한 내려받기를 깎아야 한다(`UiExcelProps`).

    갈린 값이 만드는 *내려받은 것을 그대로 올렸는데 거절* 은 **행 수를 세어 말해** 갚는다
    (`readWorkbook` 의 `tooManyRows` — 상한과 파일의 행 수를 둘 다 보인다).
  */
  const maxRows = useAuthStore((state) => state.excelMaxUploadRows);
  const [pending, setPending] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  /*
    <b>후보를 파일 읽기 전에 채운다</b>(2026-09-02 실물 — ⑥이 첫 소비자가 되면서 드러났다).

    {@code DataGrid} 는 판에 닿기 전에 이것을 하지만(sys/code.md), 파일을 읽는 것은 <b>판이
    아니라 이 컴포넌트</b>다 — 선언을 그대로 {@code readWorkbook} 에 넘기면
    {@code parseCell} 이 후보를 못 보고 <b>코드명을 값으로 착각</b>한다.

    <b>증상이 조용했다.</b> 못 읽었다고 하지 않고 원문 글자를 그대로 값으로 삼으므로
    (그 갈래는 <i>후보가 아직 안 온 컬럼</i> 을 위한 것이다) 오류 셀도 뜨지 않고, 대신
    <b>손대지 않은 행이 전부 변경</b>으로 잡힌다 — {@code 대기} 와 {@code WAIT} 는 다른
    글자다. 그러면 412행짜리 파일이 <b>412행을 전부</b> 저장하러 나가고, 서버가 받는 값은
    코드가 아니라 <b>사람이 읽는 이름</b>이다.

    <b>내려받은 파일이 그 모양이다.</b> 엑셀은 셀에 보이는 대로 쓰므로(frontend/grid.md 의 <i>전체
    다운로드가 곧 양식</i>) 코드 칸에는 이름이 들어 있고, 그것을 그대로 올리는 것이
    사용자의 정상 동선이다 — playbook/INDEX.md 이 <i>"코드는 값과 이름을 둘 다 받는다"</i> 로
    적어 둔 그 자리이며, 후보가 없으면 그 규약이 <b>이름 쪽에서만 조용히</b> 깨진다.
  */
  const codeOptions = useCodeOptions(
    props.columns.map((column) => column.grpCd).filter((grpCd) => grpCd !== undefined),
  );
  const columns = useMemo(
    () =>
      // 선언이 적은 후보가 이긴다 — 소스가 값을 갖는 코드가 그쪽이다(`DataGrid` 와 같다).
      props.columns.map((column) =>
        column.grpCd && !column.options
          ? { ...column, options: codeOptions[column.grpCd] ?? [] }
          : column),
    [props.columns, codeOptions],
  );

  const controller = useGridController<T>({
    menuCd: props.menuCd,
    columns,
    // 조회가 없다 — 위 클래스 주석. 저장은 업무 탭과 같은 것이다.
    api: { save: props.save },
    toSaveRow: props.toSaveRow,
    editable: true,
  });

  /*
    <b>렌더 중에 ref 를 쓰지 않는다</b>(`react-hooks/refs`). 최상단 탭이 이 손잡이를 부르는
    것은 사람이 컨트롤을 누른 뒤이므로 효과가 이미 돌아 있다.
  */
  const { handleRef } = props;
  const dirty = controller.dirty;
  useEffect(() => {
    if (handleRef) handleRef.current = { dirty: () => dirty };
  }, [handleRef, dirty]);

  const text = useMemo<ReadText>(
    () => ({
      headerMismatch: (expected, actual) =>
        label(MSG.EXCEL_UPLOAD_HEADER_MISMATCH, { expected, actual }),
      tooManyRows: (max, count) => label(MSG.EXCEL_UPLOAD_TOO_MANY, { max, count }),
      notNumber: (value) => label(MSG.EXCEL_UPLOAD_NOT_NUMBER, { value }),
      notInteger: (value) => label(MSG.EXCEL_UPLOAD_NOT_INTEGER, { value }),
      notYn: (value) => label(MSG.EXCEL_UPLOAD_NOT_YN, { value }),
      unknownCode: (value) => label(MSG.EXCEL_UPLOAD_UNKNOWN_CODE, { value }),
      ambiguousCode: (value) => label(MSG.EXCEL_UPLOAD_AMBIGUOUS_CODE, { value }),
    }),
    [],
  );

  const load = useCallback(
    async (file: File) => {
      setPending(true);
      try {
        const outcome = await readWorkbook(await file.arrayBuffer(), columns, maxRows, text);
        if (!outcome.ok) {
          // 통째로 거절이다 — 그리드는 손대지 않는다(playbook/INDEX.md).
          modal.error({ content: outcome.detail, okText: label(MSG.GRID_CONFIRM_OK) });
          return;
        }

        /*
          <b>읽은 직후 한 번 조회한다</b>(frontend/grid-advanced.md). 사용자가 누를 일이 아니며, 이것이
          없으면 모든 행이 신규가 되어 <b>이미 있는 행을 다시 만들려는</b> 저장이 나간다.
        */
        const existing = await fetchExisting<T>(props.read, maxRows);
        const matched = matchRows(outcome.rows, existing, props.keyFields);

        controller.setRows(matched.rows);
        controller.setIssues([
          ...outcome.issues,
          ...matched.duplicated.map((rowId): GridIssue => ({
            rowId,
            // 어느 칸이라 말할 수 없다 — 키 <b>조합</b>이 겹친 것이다(frontend/grid.md 의 3층).
            message: label(MSG.EXCEL_UPLOAD_DUPLICATED),
          })),
        ]);
        message.success(label(MSG.EXCEL_UPLOAD_LOADED, { count: matched.rows.length }));
      } catch (error) {
        modal.error({
          content: error instanceof Error ? error.message : String(error),
          okText: label(MSG.GRID_CONFIRM_OK),
        });
      } finally {
        setPending(false);
      }
    },
    [columns, controller, maxRows, message, modal, props.keyFields, props.read, text],
  );

  const controls: GridControl[] = [
    {
      key: 'pickFile',
      slot: 'beforeRead',
      type: 'button',
      label: MSG.EXCEL_UPLOAD_PICK,
      disabled: pending,
      onClick: () => picker.current?.click(),
    },
  ];

  return (
    <>
      {/*
        <b>숨긴 입력이 파일 선택의 유일한 길이다.</b> AntD 의 업로드 컴포넌트를 쓰지 않는
        것은 그것이 <i>서버로 보내는</i> 것을 전제한 컨트롤이라(요청 URL · 진행률 · 목록)
        여기서는 그 대부분을 꺼야 하고, 끈 것을 다시 읽는 사람이 <b>어디로 올라가는지</b>
        를 코드에서 확인해야 하기 때문이다 — 올라가지 않는다는 것이 frontend/grid-advanced.md 의 핵심이다.
      */}
      <input
        ref={picker}
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // 같은 파일을 다시 고를 수 있어야 한다 — 값을 비우지 않으면 change 가 안 난다.
          event.target.value = '';
          if (file) void load(file);
        }}
      />
      <DataGrid<T>
        title={props.title}
        menuCd={props.menuCd}
        controller={controller}
        controls={controls}
        /*
          <b>개인화를 열지 않는다.</b> 이 판의 컬럼은 사용자의 표가 아니라 <b>양식</b>이며
          (frontend/grid.md), 감추거나 옮겨도 파일이 달라지지 않으므로 <i>여기서만 다르게 보이는
          판</i>이 될 뿐이다. 업무 탭과 나란히 놓고 대조하는 화면에서 그 어긋남은
          <b>양식이 바뀐 것처럼</b> 읽힌다.
        */
        settings={false}
        height={props.height}
      />
    </>
  );
}

/**
 * 대조할 기존 행 — <b>업무 탭과 같은 조회 API</b>다(frontend/grid-advanced.md).
 *
 * <p><b>조건 없이 전량을 훑는다.</b> 파일에 어떤 키가 올지 모르므로 좁힐 근거가 없고,
 * 상한은 <b>파일 쪽과 같은 값</b>이다 — 그보다 많은 기존 행이 있으면 대조가 반쪽이 되어
 * <b>이미 있는 행이 신규로</b> 잡힌다.
 */
async function fetchExisting<T>(read: ReadApi, maxRows: number): Promise<T[]> {
  const collected: T[] = [];
  let cursor: string | null = null;

  for (let pageNo = 0; ; pageNo += 1) {
    const response: PageResponse<T> = await post<PageResponse<T>>(read.url, {
      conditions: [],
      sorts: [],
      page: { page: pageNo, size: PAGE_SIZE, cursor: cursor ?? undefined },
    });
    collected.push(...response.content);
    if (collected.length >= maxRows) break;
    if (response.mode === 'all' || !response.hasNext || response.content.length === 0) break;
    cursor = response.nextCursor ?? null;
  }
  return collected;
}

/** 서버가 받는 한 장의 상한이다({@code PageSpec.MAX_SIZE}) — 전량 조회와 같은 값. */
const PAGE_SIZE = 1000;
