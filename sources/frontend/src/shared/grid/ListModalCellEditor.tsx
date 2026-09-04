import { useCallback, useRef, useState } from 'react';
import { Button, Empty, List, Modal, Tooltip } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { CustomCellEditorProps } from 'ag-grid-react';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { usePopup } from '@/shared/popup/popupContext';

/**
 * 배열 컬럼의 편집기 — `listModal`(frontend/grid.md · playbook/INDEX.md).
 *
 * <p><b>셀 하나가 값 여럿을 담는다.</b> 바코드를 여러 번 스캔한 묶음 · 시리얼 · 태그가
 * 그것이며, 저장 형태는 자식 테이블이지만(playbook/INDEX.md) <b>화면이 다루는 것은 배열</b>이다
 * (frontend/grid.md — <i>배열은 전송 형태이지 저장 형태가 아니다</i>).
 *
 * <h2>항목을 <b>고른다</b> — 팝업 레지스트리를 쓴다</h2>
 *
 * <p>playbook/INDEX.md 이 <i>"레지스트리 — §9.4 와 같은 자리"</i> 로 적은 그대로다. 여기서 타이핑을
 * 받으면 목록에 없는 태그가 만들어지고, 그것은 `popupRef` 가 없애려던 불일치와 같은
 * 종류다(frontend/grid.md) — 자식 테이블에 <b>어느 코드에도 걸리지 않는 행</b>이 남는다.
 *
 * <p><b>frontend/grid.md 의 <i>모달 자체를 레지스트리에서 고른다</i> 와 갈린다</b>(2026-09-02 —
 * 구현). 거기서는 바코드 스캔 창과 검사 항목 창이 <i>생긴 것이 전혀 다르다</i> 는 것이
 * 근거였는데, <b>다른 것은 고르는 창</b>이고 <i>고른 것을 쌓고 순서를 바꾸는</i> 부분은
 * 어느 배열에서나 같다. 그래서 <b>바깥 껍데기는 여기 하나</b>이고 레지스트리가 정하는
 * 것은 <b>항목을 고르는 팝업</b>이다 — 껍데기까지 화면이 만들면 playbook/INDEX.md 이 요구한
 * *순서 변경* 이 창마다 다른 모양으로 다시 만들어진다.
 *
 * <h2>순서가 값의 일부다</h2>
 *
 * <p>저장이 자식 테이블이라 <b>{@code SORT_NO} 가 컬럼</b>이다(playbook/INDEX.md) — 직렬화
 * 문자열이면 공짜로 얻는 것이 여기서는 <b>사람이 정하는 값</b>이며, 그래서 위·아래가
 * 버튼으로 있다. 드래그를 두지 않은 것은 <b>행이 몇 개 안 되는 창</b>이고 드래그는
 * 좁은 모달에서 실수하기 쉽기 때문이다.
 *
 * <h2>형식·개수·유일성을 여기서 재지 않는다</h2>
 *
 * <p>frontend/grid.md 이 못 박았다 — 전부 <b>검증</b>이며 frontend/grid.md 에 이미 자리가 있다. 여기서 재면
 * <i>"창고가 A 면 최대 50개"</i> 같은 조합이 올 때마다 이 컴포넌트에 키가 늘어나고,
 * {@code validate} 는 <b>배열 전체와 행을 함께</b> 받으므로 그런 조합이 처음부터 표현된다.
 */
export interface ListModalCellEditorParams {
  /** 항목을 고르는 팝업 — 레지스트리 키다(playbook/INDEX.md). */
  popupKey: string;
  /** 인가가 매이는 메뉴 — <b>부르는 화면의 것</b>이다(backend/api.md). */
  menuCd: string;
  /** 항목 하나 → 표시 문자열. 없으면 값 그대로다(frontend/grid.md). */
  display?: (item: unknown) => string;
  /** 창의 제목 — 컬럼 헤더다. */
  title: string;
  /** 편집이 닫힌 칸이면 <b>읽기 전용</b>으로 연다 — 아래 주석. */
  readOnly?: boolean;
}

export function ListModalCellEditor(props: CustomCellEditorProps<unknown, unknown>) {
  const params = props as CustomCellEditorProps<unknown, unknown> &
    Partial<ListModalCellEditorParams>;
  const open = usePopup();
  const [items, setItems] = useState<unknown[]>(() =>
    Array.isArray(props.value) ? [...(props.value as unknown[])] : [],
  );
  // 창이 닫히는 길이 둘이라(확인 · 취소) 두 번 끝나지 않게 막는다.
  const done = useRef(false);

  const close = useCallback(
    (next: unknown[] | null) => {
      if (done.current) return;
      done.current = true;
      // 취소는 <b>아무 일도 없음</b>이다 — 값을 건드리지 않으면 판이 원래 배열을 남긴다.
      if (next) props.onValueChange(next);
      props.stopEditing();
    },
    [props],
  );

  const add = useCallback(async () => {
    const key = params.popupKey;
    if (key === undefined) return;
    const outcome = await open(key, { menuCd: params.menuCd ?? '' });
    /*
      <b>{@code clearable} 을 켜지 않는다.</b> 여기서 <i>지우기</i> 는 배열을 비우는 뜻으로
      읽히는데 그 버튼은 <b>항목마다</b> 이미 있다 — 창 안에 뜻이 다른 지우기가 둘이면
      어느 쪽이 무엇을 지우는지 눌러 봐야 안다.
    */
    if (outcome.kind === 'picked') setItems((current) => [...current, outcome.row]);
  }, [open, params.menuCd, params.popupKey]);

  const move = useCallback((index: number, delta: number) => {
    setItems((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const text = (item: unknown) => (params.display ? params.display(item) : String(item));

  return (
    <Modal
      open
      title={params.title}
      /*
        <b>판이 자기 안으로 세는 팝업이다.</b> 없으면 모달을 클릭하는 순간 판이 <i>포커스가
        그리드를 떠났다</i> 고 보고 편집을 끝낸다({@code stopEditingWhenCellsLoseFocus}) —
        날짜 편집기의 달력과 같은 자리다.
      */
      rootClassName="ag-custom-component-popup"
      onCancel={() => close(null)}
      onOk={() => close(items)}
      okText={label(MSG.GRID_CONFIRM_OK)}
      cancelText={label(MSG.COMMON_CANCEL)}
      /*
        <b>읽기 전용이어도 열린다</b>(frontend/grid.md 와 같은 자리) — 배열은 셀에서 다 볼 수 없다.
        고칠 수 없는 칸에서는 확인 버튼을 감춘다: 두면 <i>눌렀는데 아무 일도 없는</i>
        버튼이 된다.
      */
      okButtonProps={{ style: params.readOnly ? { display: 'none' } : undefined }}
      width={520}
      destroyOnHidden
    >
      {!params.readOnly && (
        <Button icon={<PlusOutlined />} onClick={() => void add()} style={{ marginBottom: 8 }}>
          {label(MSG.GRID_LIST_ADD)}
        </Button>
      )}
      {items.length === 0 ? (
        <Empty description={label(MSG.GRID_LIST_EMPTY)} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        /*
          <b>목록이 창을 밀어내지 않는다</b>(2026-09-02 — 실측). 없으면 창 높이가 항목 수에
          따라 자라고, 항목 하나가 41px 이라 <b>스물한 개에서 1,018px</b> 이 된다 —
          1280&times;720 에서 <b>확인 버튼이 화면 밖</b>이고 사용자는 창을 스크롤해 버튼을
          찾는다(누를 것이 있는데 보이지 않는다).

          <b>이것은 상한의 근거가 아니라 창의 결함이었다.</b> 개수 상한을 창이 견디는
          높이로 정하면 <b>화면 해상도가 업무 규칙</b>이 된다 — 상한은 <i>순서를 다룰 수
          있는가</i> 로 정하고(playbook/INDEX.md), 창은 몇 개가 오든 같은 크기로 선다.
        */
        <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          <List
            size="small"
            bordered
            dataSource={items}
            renderItem={(item, index) => (
              <List.Item
                actions={
                  params.readOnly
                    ? undefined
                    : [
                        <Tooltip key="up" title={label(MSG.GRID_LIST_UP)}>
                          <Button
                            type="text"
                            size="small"
                            icon={<ArrowUpOutlined />}
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                          />
                        </Tooltip>,
                        <Tooltip key="down" title={label(MSG.GRID_LIST_DOWN)}>
                          <Button
                            type="text"
                            size="small"
                            icon={<ArrowDownOutlined />}
                            disabled={index === items.length - 1}
                            onClick={() => move(index, 1)}
                          />
                        </Tooltip>,
                        <Tooltip key="remove" title={label(MSG.GRID_LIST_REMOVE)}>
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() =>
                              setItems((current) => current.filter((_item, at) => at !== index))}
                          />
                        </Tooltip>,
                      ]
                }
              >
                {text(item)}
              </List.Item>
            )}
          />
        </div>
      )}
    </Modal>
  );
}
