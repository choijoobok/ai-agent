import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Button, Modal } from 'antd';
import { DataGrid } from '@/shared/grid/DataGrid';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow } from '@/shared/grid/rows';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { PopupContextProvider } from '@/shared/popup/popupContext';
import { popupSpec } from '@/shared/popup/registry';
import type { OpenPopup, PopupOutcome, PopupRow, PopupSpec } from '@/shared/popup/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';

/**
 * 참조 팝업이 열리는 <b>단 한 자리</b> — frontend/grid.md · playbook/INDEX.md.
 *
 * <p>앱 루트에 하나만 선다. 여는 쪽마다 모달을 들고 있으면 <b>팝업 위에 팝업</b>이 뜨는
 * 경로가 열리는데, 셀 편집기에서 연 팝업 안에서 또 팝업을 열 일이 없다 — 그 창은 <i>고르는
 * 것</i>으로 끝나는 창이다.
 *
 * <p><b>한 번에 하나만 연다.</b> 열려 있는데 또 부르면 앞의 약속을 <b>취소로 닫는다</b>:
 * 매달아 두면 앞의 편집기가 영영 기다리고, 그 셀은 편집 상태로 굳는다.
 */
export function PopupHost({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<PopupRequest | null>(null);
  /*
    <b>약속을 상태에 담지 않는다.</b> 담으면 렌더마다 새 객체가 되어 {@code resolve} 가
    갈리고, 닫을 때 <i>어느 쪽 약속인지</i> 를 알 수 없다.
  */
  const pending = useRef<((outcome: PopupOutcome) => void) | null>(null);

  const settle = useCallback((outcome: PopupOutcome) => {
    const resolve = pending.current;
    pending.current = null;
    setRequest(null);
    if (resolve) resolve(outcome);
  }, []);

  const open = useCallback<OpenPopup>(
    (key, options) => {
      const spec = popupSpec(key);
      if (!spec) {
        /*
          <b>모르는 키에는 창을 띄우지 않는다.</b> 빈 모달을 띄우면 사용자는 <i>0건</i> 으로
          읽고 기다리며, 진짜 원인(등록되지 않은 팝업)은 화면 어디에도 없다. 취소로
          돌려주므로 부르는 쪽에서는 <b>편집이 조용히 물린다</b> — 값은 그대로다.
        */
        // 개발자용이라 영어다 — 화면에 나가는 문구가 아니다(eslint 의 sys/code.md 규칙 주석).
        console.error(`Popup not registered: ${key} (playbook/INDEX.md)`);
        return Promise.resolve({ kind: 'cancelled' });
      }
      // 앞의 것을 닫는다 — 매달아 두면 그 셀이 편집 상태로 굳는다.
      const previous = pending.current;
      pending.current = null;
      if (previous) previous({ kind: 'cancelled' });

      return new Promise<PopupOutcome>((resolve) => {
        pending.current = resolve;
        setRequest({
          key,
          spec,
          param: options?.param,
          menuCd: options?.menuCd ?? '',
          clearable: options?.clearable === true,
        });
      });
    },
    [],
  );

  return (
    <PopupContextProvider value={open}>
      {children}
      {request && (
        /*
          <b>{@code key} 로 새로 만든다.</b> 같은 호스트가 팝업 둘을 번갈아 열므로, 남겨
          두면 앞 팝업의 조회 결과와 검색 폼 상태가 <b>다음 팝업에 그대로</b> 남는다 —
          컬럼이 다르면 값이 빈 칸으로만 보여 <i>0건</i> 과 구별되지 않는다.
        */
        <PopupModal key={request.key} request={request} onSettle={settle} />
      )}
    </PopupContextProvider>
  );
}

interface PopupRequest {
  key: string;
  spec: PopupSpec;
  param: unknown;
  menuCd: string;
  clearable: boolean;
}

/**
 * 팝업 하나 — <b>조회조건 + 목록</b>이며 frontend/grid.md 의 크롬을 그대로 쓴다(frontend/grid.md).
 *
 * <p><b>더블클릭이 곧 선택이다.</b> 고르러 온 창이라 <i>한 번 눌러 고르고 버튼을 누르는</i>
 * 두 걸음이 매번 낭비이고, 그래도 버튼을 함께 두는 것은 <b>더블클릭을 모르는 사용자</b>가
 * 있기 때문이다 — screen/code/requirements.md 의 <i>제스처는 지름길이지 유일한 길이 아니다</i> 와 같다.
 */
function PopupModal(props: {
  request: PopupRequest;
  onSettle: (outcome: PopupOutcome) => void;
}) {
  const { spec, param, menuCd, clearable } = props.request;
  const searchForm = useRef<SearchFormHandle>(null);
  const [selected, setSelected] = useState<PopupRow | null>(null);

  const collect = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );
  const envelope = useCallback(() => param, [param]);

  const controller = useGridController<PopupRow>({
    menuCd,
    columns: spec.columns,
    api: { read: spec.read },
    params: spec.searchFields ? collect : undefined,
    searchParams: envelope,
    // 고르는 창이다 — 저장이 없으므로 셀도 열리지 않는다.
    editable: false,
  });

  return (
    <Modal
      open
      title={label(spec.title)}
      width={spec.width ?? 900}
      /*
        <b>판이 자기 안으로 세는 팝업이다.</b> 이 창은 셀 편집기가 열고, 판은 편집 중에
        포커스가 그리드를 떠나면 편집을 끝낸다({@code stopEditingWhenCellsLoseFocus}) —
        창을 클릭하는 순간 편집기가 언마운트되고, 그 뒤로는 <b>판이 셀을 다시 그리는
        동안</b> 사용자가 고르고 있는 모양이 된다. 날짜 편집기의 달력과 같은 자리다
        (2026-09-02 — {@code ListModalCellEditor} 를 세우면서 같은 규칙임을 확인했다).
      */
      rootClassName="ag-custom-component-popup"
      onCancel={() => props.onSettle({ kind: 'cancelled' })}
      onOk={() => selected && props.onSettle({ kind: 'picked', row: selected })}
      okText={label(MSG.POPUP_PICK)}
      cancelText={label(MSG.COMMON_CANCEL)}
      // 고른 것이 없으면 확인할 것도 없다 — screen/code/requirements.md 의 <i>막는 것 자체가 신호</i> 다.
      okButtonProps={{ disabled: selected === null }}
      /*
        <b>지우기는 명시해야 일어난다.</b> 창을 그냥 닫는 것(Esc · 취소)은 아무 일도
        아니며, 그 둘을 묶으면 마음을 바꾼 사람이 <b>원래 값을 잃는다</b>({@code PopupOutcome}).
        지금 값이 있는 칸에서만 낸다 — 빈 칸의 지우기는 아무 일도 하지 않는 버튼이다.
      */
      footer={(originNode) => (
        <>
          {clearable && (
            <Button danger onClick={() => props.onSettle({ kind: 'cleared' })}>
              {label(MSG.POPUP_CLEAR)}
            </Button>
          )}
          {originNode}
        </>
      )}
      destroyOnHidden
    >
      {spec.searchFields && (
        <SearchForm
          handleRef={searchForm}
          fields={spec.searchFields}
          onSubmit={() => void controller.read()}
          onReset={controller.clearFilters}
          /*
            <b>저장된 조건을 쓰지 않는다.</b> 팝업은 자기 메뉴가 없어 부른 화면의 메뉴로
            저장되고, 그러면 화면의 조건과 <b>한 목록에 섞인다</b>(frontend/search-form.md).
          */
          savedConditions={false}
        />
      )}
      <DataGrid<PopupRow>
        title={spec.title}
        menuCd={menuCd}
        controller={controller}
        selection="single"
        onSelect={(row: GridRow<PopupRow> | null) => setSelected(row ? row.data : null)}
        onRowDoubleClick={(row: GridRow<PopupRow>) =>
          props.onSettle({ kind: 'picked', row: row.data })}
        /*
          <b>개인화를 읽지 않는다</b>(frontend/grid.md). 설정은 (사용자, 메뉴, 그리드) 로 매이는데
          팝업의 메뉴는 <b>부른 화면의 것</b>이라, 같은 팝업이 화면마다 다른 설정을 갖고
          화면의 그리드와 {@code gridId} 가 부딪힌다.
        */
        settings={false}
        height={360}
      />
    </Modal>
  );
}
