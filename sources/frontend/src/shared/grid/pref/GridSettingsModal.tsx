import { useState } from 'react';
import { HolderOutlined, PushpinOutlined } from '@ant-design/icons';
import { App, Button, Checkbox, Modal, Tooltip, Typography, theme } from 'antd';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { settableColumns } from '@/shared/grid/pref/gridPref';
import {
  LEFT_LINE,
  RIGHT_LINE,
  linesOf,
  normalize,
  parseSequence,
  pinnedAt,
  sequenceOf,
} from '@/shared/grid/pref/pinLines';
import type { ColumnDef } from '@/shared/grid/types';

/**
 * ③ 그리드 설정 창 — UX-06 · frontend/grid.md. <b>설정 모달(frontend/tabs.md)과 다른 것이다.</b>
 *
 * <p>frontend/tabs.md 이 경계를 그었다 — 저쪽은 <i>전역 표시 속성</i>(글꼴·색·행 높이)이고 여기는
 * <i>이 화면의 컬럼 구성</i>이다.
 *
 * <p><b>제목에 그리드 이름이 붙는다.</b> 마스터-디테일 화면에서는 설정 창이 둘이고
 * 생김새가 같다 — 어느 것을 건드리고 있는지 <b>창이 말하지 않으면 알 수 없다</b>.
 *
 * <p><b>적용과 저장은 다른 일이다.</b> 컬럼을 옮기거나 끄면 <b>그 자리에서 그리드에
 * 반영</b>되고, 저장 버튼은 <b>DB 에 남기는 일</b>만 한다 — <i>껐다 켜보며 맞춘다</i> 는
 * 것이 창을 닫아야 보인다면 맞춰 볼 수가 없다. 저장 버튼이 남는 이유는 저장처가 DB 라
 * 토글마다 API 를 부르면 요청이 폭증하기 때문이다(frontend/grid.md).
 *
 * <p><b>닫는 길이 셋이고 남기는 것이 다 다르다.</b> <b>저장</b>은 DB 에 남기고, <b>적용</b>은
 * <i>화면에만</i> 두며, <b>취소</b>(와 `X`)는 <b>마지막으로 남기기로 한 자리</b>로 되감는다.
 * 취소와 `X` 가 같은 것은 <i>어떻게 닫았느냐</i> 로 결과가 갈리면 그 구분을 사용자가 알
 * 방법이 없기 때문이다.
 *
 * <p><b>적용이 없으면 맞춰 본 것을 들고 나갈 길이 없었다</b>(2026-08-31 — 지시). 고친 것은
 * 이미 화면에 들어가 있는데 닫는 길이 <b>저장하거나 되감거나</b> 둘뿐이라, <i>지금만 이렇게
 * 보고 저장은 하지 않겠다</i> 가 <b>창을 열어 둔 채로만</b> 가능했다 — 창이 그리드를 가리고
 * 있으므로 그것은 보는 것이 아니다.
 *
 * <p><b>그래서 적용이 되감기 자리도 옮긴다.</b> 옮기지 않으면 맞춰 둔 화면이 <b>그 뒤에
 * 창을 열어 무엇 하나만 고치고 취소해도 통째로 날아간다</b> — 되감을 자리가 <i>저장한
 * 것</i> 하나뿐이기 때문이다. 남기기로 한 것과 해 보는 중인 것을 가르는 선은 <b>저장이
 * 아니라 적용</b>이다.
 *
 * <p><b>버튼 넷을 가르는 선은 DB 다.</b> 왼쪽 둘(취소 · 적용)은 DB 를 건드리지 않고, 오른쪽
 * 둘(저장 · 초기화)은 행을 넣거나 지운다 — <i>되돌릴 수 있는가</i> 가 그 선에서 갈린다.
 *
 * <p><b>틀고정은 줄마다 고르지 않고 <i>경계선</i>을 옮긴다</b>(2026-08-30). 컬럼마다
 * <i>좌·없음·우</i> 를 고르게 두면 <b>왼쪽 고정이 가운데 컬럼에 붙는</b> 상태를 만들 수
 * 있는데 그리드에는 그런 자리가 없다 — 고정은 <b>양끝에서 몇 개까지인가</b>이지 컬럼
 * 하나의 속성이 아니다. 선 둘이 그 사실을 그대로 그린다: 위 선보다 <b>위</b>가 왼쪽 고정,
 * 아래 선보다 <b>아래</b>가 오른쪽 고정이며 <b>위 선이 아래 선을 넘지 못한다</b>.
 *
 * <p><b>목록에 없는 것 셋</b>(frontend/grid.md) — 시스템 컬럼(보이지만 끌 수 없다) · `hidden`(처음부터
 * 없다) · 동적 컬럼(데이터가 정한다). 앞의 둘은 `settableColumns` 가 거른다.
 *
 * <p><b>목록이 스크롤한다.</b> 컬럼 수는 화면이 정하므로 상한이 없다 — 창이 화면보다
 * 길어지면 저장 버튼이 아래로 밀려 <b>보이지 않는다.</b> 끌다가 목록 밖으로 나가면
 * 판이 스스로 스크롤하므로(`@dnd-kit` 의 자동 스크롤) <b>한 번에 끝까지</b> 옮길 수 있다.
 */
interface Props<T> {
  open: boolean;
  /** 그리드 제목의 메시지 키 — 창이 어느 그리드의 것인지 말한다. */
  title: string;
  /** 지금 그리드가 그리고 있는 컬럼 — 저장된 설정이 이미 입혀진 것이다. */
  columns: ColumnDef<T>[];
  /**
   * <b>저장된 개인화가 있는가</b> — <i>초기화</i> 가 이것으로 켜지고 꺼진다.
   *
   * <p>화면이 선언과 다른가가 아니라 <b>DB 에 행이 있는가</b> 다. 저장하지 않은 변경을
   * 물리는 일은 <i>취소</i> 가 맡는다(frontend/grid.md).
   */
  saved: boolean;
  /** 고칠 때마다 부른다 — <b>화면에만</b> 입힌다. 미리보기이지 <i>적용</i> 버튼이 아니다. */
  onApply: (next: ColumnDef<T>[]) => void;
  /** <b>적용</b> — 지금 것을 <b>되감을 자리</b>로 삼는다. DB 에는 가지 않는다. */
  onKeep: (next: ColumnDef<T>[]) => void;
  /** <b>취소</b> · 창의 `X` — 마지막으로 남기기로 한 자리로 되감는다. */
  onCancel: () => void;
  onSave: (next: ColumnDef<T>[]) => Promise<void>;
  onReset: () => Promise<void>;
  onClose: () => void;
}

/** 목록의 최대 높이 — 넘으면 스크롤한다. 창이 화면보다 길어지지 않게 하는 값이다. */
const LIST_MAX_HEIGHT = 380;

/** 버튼 사이의 간격 — 그리드 헤더의 `<Space size={8}>` 과 같은 값이다(frontend/grid.md). */
const BUTTON_GAP = 8;

/**
 * <b>판이 스스로 넣는 버튼 여백을 끈다</b> — 간격은 아래 `footer` 의 {@code gap} 하나가 정한다.
 *
 * <p>판은 <b>버튼이 버튼과 이웃할 때만</b> 8px 를 붙인다(`.ant-btn + .ant-btn`). 그런데 이
 * 창의 마지막 칸은 <b>툴팁이 감싼 `span`</b> 이라 그 규칙에 걸리지 않는다 — 앞의 둘은
 * `gap 8 + 판의 8 = 16`, <b>저장과 초기화 사이만 8</b> 이었다(2026-08-31 실측).
 *
 * <p><b>판의 값을 그대로 쓰지 않고 끄는 쪽</b>을 골랐다. 판에 맡기면 `span` 을 하나 더
 * 감쌀 때마다 같은 어긋남이 돌아오고, 그때 <b>보이는 것은 간격 하나뿐</b>이라 원인을
 * 짚기 어렵다.
 */
const NO_OWN_GAP = { marginInlineStart: 0 } as const;

export function GridSettingsModal<T>(props: Props<T>) {
  const { message, modal } = App.useApp();
  const [draft, setDraft] = useState<ColumnDef<T>[]>(() => normalize(props.columns));
  const [busy, setBusy] = useState(false);
  /** 이 창에서 <b>한 번이라도 고쳤는가</b> — 취소가 되감을 것이 있는지를 정한다. */
  const [touched, setTouched] = useState(false);

  // 누르자마자 끌기로 보지 않는다 — 그러면 체크박스를 누르는 클릭이 드래그로 먹힌다.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  /*
    <b>열 때 한 번</b> 지금 상태에서 시작한다.

    {@code props.columns} 를 함께 보지 않는다: 고칠 때마다 그것이 바뀌므로, 보고 있으면
    한 번 고칠 때마다 초안이 초기화된다.
  */
  const [openedAt, setOpenedAt] = useState(props.open);
  if (openedAt !== props.open) {
    setOpenedAt(props.open);
    setDraft(normalize(props.columns));
    setTouched(false);
  }

  const rows = settableColumns(draft);
  const fields = rows.map((column) => column.field);
  const { left, right } = linesOf(rows);

  /** 초안과 화면을 함께 고친다 — 적용은 여기서 끝나고 저장만 남는다. */
  const change = (next: ColumnDef<T>[]) => {
    setDraft(next);
    setTouched(true);
    props.onApply(next);
  };

  /** 순서 + 경계선 자리 → 컬럼 목록. <b>고정은 자리에서 파생</b>한다. */
  const rebuild = (order: string[], nextLeft: number, nextRight: number) => {
    const byField = new Map(rows.map((column) => [column.field, column]));
    const ordered = order
      .map((field) => byField.get(field))
      .filter((column): column is ColumnDef<T> => column !== undefined)
      .map((column, index) => ({ ...column, pinned: pinnedAt(index, nextLeft, nextRight) }));

    // `hidden` 은 목록에 없었으므로 순서에도 없다 — 선언 순서 그대로 뒤에 남긴다.
    change([...ordered, ...draft.filter((column) => column.hidden)]);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const sequence = sequenceOf(fields, left, right);
    const from = sequence.indexOf(String(active.id));
    const to = sequence.indexOf(String(over.id));
    if (from < 0 || to < 0) return;

    const moved = [...sequence];
    moved.splice(to, 0, ...moved.splice(from, 1));
    const parsed = parseSequence(moved, String(active.id));
    rebuild(parsed.fields, parsed.left, parsed.right);
  };

  /**
   * <b>전부 꺼진 채로 남기지 않는다</b> — frontend/grid.md.
   *
   * <p><b>저장과 적용이 함께 본다.</b> 막는 것은 <i>DB 에 넣는 것</i>이 아니라 <b>빈 그리드가
   * 되돌아갈 자리가 되는 것</b>이다 — 적용도 이제 취소가 돌아오는 자리를 옮기므로 저기서만
   * 막으면 <b>취소를 눌러도 빈 판으로 돌아온다</b>.
   *
   * <p>고치는 <b>도중</b>에는 막지 않는다. 미리보기는 마지막 체크를 끄는 순간 이미 빈 판이고,
   * 그때 경고를 내면 <i>지우고 다시 고르는</i> 흔한 순서마다 창이 말을 건다.
   */
  const emptyGrid = () => {
    if (rows.some((column) => column.visible !== false)) return false;
    message.warning(label(MSG.GRID_SETTINGS_NONE_VISIBLE));
    return true;
  };

  const submit = () => {
    if (emptyGrid()) return;
    setBusy(true);
    props
      .onSave(draft)
      .then(() => {
        message.success(label(MSG.GRID_SETTINGS_SAVED));
        props.onClose();
      })
      .catch((error: unknown) =>
        message.error(error instanceof Error ? error.message : String(error)))
      .finally(() => setBusy(false));
  };

  /**
   * <b>취소</b> — 창을 열기 직전으로 되감고 닫는다.
   *
   * <p>고친 것이 없으면 되감지 않는다. 같은 값을 다시 입히는 것뿐이지만, 그러면 저장된
   * 설정이 없던 그리드에 <b>선언과 똑같은 개인화</b>가 하나 생긴다.
   */
  const cancel = () => {
    if (touched) props.onCancel();
    props.onClose();
  };

  /**
   * <b>적용</b> — 고친 것을 화면에 둔 채 닫고, <b>취소가 돌아올 자리를 여기로 옮긴다</b>
   * (frontend/grid.md).
   *
   * <p>화면은 {@code change} 가 이미 매번 입혀 두었으므로 <b>새로 그릴 것이 없다.</b> 이
   * 버튼이 하는 일은 <i>여기까지를 남기겠다</i> 를 말하는 것이며, 그것이 없으면 나중에 창을
   * 열어 <b>무엇 하나만 고치고 취소해도 맞춰 둔 화면이 통째로 날아갔다</b>(2026-08-31 — 지시).
   *
   * <p><b>DB 에는 아무것도 가지 않는다.</b> 그래서 <i>초기화</i> 는 여전히 꺼져 있고, 새로
   * 고침 한 번이면 저장된 것(없으면 선언)으로 돌아간다.
   */
  const apply = () => {
    if (emptyGrid()) return;
    props.onKeep(draft);
    props.onClose();
  };

  const reset = () => {
    modal.confirm({
      title: label(MSG.GRID_SETTINGS_RESET),
      content: label(MSG.GRID_SETTINGS_RESET_CONFIRM),
      okText: label(MSG.GRID_CONFIRM_OK),
      cancelText: label(MSG.COMMON_CANCEL),
      onOk: async () => {
        await props.onReset();
        props.onClose();
      },
    });
  };

  const sequence = sequenceOf(fields, left, right);
  const byField = new Map(rows.map((column) => [column.field, column]));

  return (
    <Modal
      open={props.open}
      // 마스터-디테일이면 창이 둘이고 생김새가 같다 — 어느 것인지 제목이 말해야 한다.
      title={label(MSG.GRID_SETTINGS_TITLE, { grid: label(props.title) })}
      // `X` 도 취소다 — 어떻게 닫았느냐로 결과가 갈리면 그 구분을 사용자가 알 수 없다.
      onCancel={cancel}
      destroyOnHidden
      width={480}
      footer={[
        /*
          <b>가르는 선은 DB 다</b>(2026-08-31 — 지시). 왼쪽 둘(취소 · 적용)은 <b>DB 를 건드리지
          않고</b> 오른쪽 둘(저장 · 초기화)은 <b>행을 넣거나 지운다</b> — 되돌릴 수 있는 것과
          없는 것의 경계이므로, 잘못 눌렀을 때의 값이 그 선에서 갈린다.

          앞서 <i>물리는 일 vs 확정하는 일</i> 로 갈랐을 때는 적용이 오른쪽에 붙었는데,
          그 선은 <b>눈에 보이지 않는다</b> — 적용은 물리지도 확정하지도 않는 자리라 어느
          쪽이라 해도 말이 됐다. DB 는 사용자가 이미 아는 구분이다.

          취소는 <b>언제나 켜져 있다</b> — 고친 것이 없으면 그냥 닫힐 뿐이고, 고쳤다면
          마지막으로 남기기로 한 자리로 되감는다.
        */
        <Button key="cancel" onClick={cancel} style={NO_OWN_GAP}>
          {label(MSG.COMMON_CANCEL)}
        </Button>,
        /*
          <b>강조하지 않는다.</b> 이 창에서 대개 하려는 것은 저장이며, 같은 무게로 둘을
          놓으면 <i>어느 쪽이 남는 것인가</i> 를 매번 읽어야 한다.

          <b>자동 여백이 여기에 붙는다</b> — 왼쪽 무리의 끝이 이 버튼이므로, 오른쪽 무리를
          밀어내는 자리도 여기다.
        */
        <Button key="apply" onClick={apply} style={{ ...NO_OWN_GAP, marginInlineEnd: 'auto' }}>
          {label(MSG.GRID_SETTINGS_APPLY)}
        </Button>,
        <Button key="save" type="primary" loading={busy} onClick={submit} style={NO_OWN_GAP}>
          {label(MSG.GRID_SAVE)}
        </Button>,
        /*
          <b>초기화는 저장된 설정이 있을 때만 켜진다</b> — 지울 행이 있는가이지 화면이
          선언과 다른가가 아니다. 그 구분이 없던 동안 켜진 버튼이 <i>저장됨</i> 으로 읽혔다
          (2026-08-30 실물 — <i>"저장을 안 눌렀는데 자동 저장인가"</i>).

          <b>{@code span} 으로 감싸고 버튼의 포인터 이벤트를 끈다.</b> 꺼진 버튼은 마우스
          이벤트를 내지도 통과시키지도 않아, 감싸기만 하면 겉이 아무 소식도 못 듣는다 —
          툴팁이 영영 뜨지 않았다(2026-08-30 실물).
        */
        <Tooltip key="reset" title={props.saved ? undefined : label(MSG.GRID_SETTINGS_RESET_NONE)}>
          <span
            style={{ display: 'inline-block', cursor: props.saved ? undefined : 'not-allowed' }}
          >
            <Button
              danger
              disabled={!props.saved}
              onClick={reset}
              style={props.saved ? undefined : { pointerEvents: 'none' }}
            >
              {label(MSG.GRID_SETTINGS_RESET)}
            </Button>
          </span>
        </Tooltip>,
      ]}
      /*
        <b>버튼 사이를 그리드 헤더와 같은 값으로 벌린다</b> — 8px(frontend/grid.md 의 `<Space size={8}>`).
        <b>간격을 정하는 것은 이 값 하나</b>이며, 판이 따로 넣는 여백은 버튼마다 `NO_OWN_GAP`
        으로 꺼 둔다 — 그러지 않으면 <b>툴팁이 감싼 초기화 앞에서만 좁아진다</b>.
        왼쪽 무리와 오른쪽 무리를 가르는 것은 <i>적용</i> 의 자동 여백이라 이 값과 무관하다.
      */
      styles={{ footer: { display: 'flex', gap: BUTTON_GAP } }}
    >
      {/*
        스크롤 컨테이너가 여기다 — `@dnd-kit` 은 <b>스크롤 가능한 조상</b>을 찾아 자동으로
        민다. 목록 밖으로 끌고 나가면 알아서 내려가므로 한 번에 끝까지 옮길 수 있다.
      */}
      <div style={{ maxHeight: LIST_MAX_HEIGHT, overflowY: 'auto', paddingInline: 2 }}>
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <SortableContext items={sequence} strategy={verticalListSortingStrategy}>
            {sequence.map((id) => {
              if (id === LEFT_LINE || id === RIGHT_LINE) {
                return <PinLine key={id} id={id} side={id === LEFT_LINE ? 'left' : 'right'} />;
              }
              const column = byField.get(id);
              if (!column) return null;
              return (
                <SortableRow key={id} id={id}>
                  <Checkbox
                    style={{ flex: 1 }}
                    checked={column.visible !== false}
                    onChange={(event) =>
                      change(draft.map((candidate) =>
                        candidate.field === id
                          ? { ...candidate, visible: event.target.checked }
                          : candidate))}
                  >
                    <Typography.Text>{label(column.header)}</Typography.Text>
                  </Checkbox>
                </SortableRow>
              );
            })}
          </SortableContext>
        </DndContext>
      </div>
    </Modal>
  );
}

/**
 * 틀고정 경계선 — 위 선보다 <b>위</b>가 왼쪽 고정, 아래 선보다 <b>아래</b>가 오른쪽 고정.
 *
 * <p><b>둘의 생김새가 같으므로 이름은 툴팁이 낸다.</b> 늘 글자를 붙이면 컬럼 목록 사이에
 * 글자 줄이 끼어 읽는 흐름이 끊긴다 — 대신 압정을 <b>고정되는 쪽 끝</b>에 두어 어느
 * 선인지 보이게 했다.
 */
function PinLine({ id, side }: { id: string; side: 'left' | 'right' }) {
  const { token } = theme.useToken();
  const [hover, setHover] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const color = hover ? token.colorPrimary : token.colorBorder;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform && { ...transform, x: 0 }),
        transition,
      }}
    >
      {/*
        <b>툴팁이 정렬의 ref 를 덮지 않게</b> 한 겹 가른다 — 툴팁은 자식을 복제하며 자기
        ref 를 끼우고, 그 자식이 곧 끌리는 요소이면 <b>끌리지 않는다</b>.
      */}
      <Tooltip
        title={label(side === 'left' ? MSG.GRID_SETTINGS_PIN_LEFT : MSG.GRID_SETTINGS_PIN_RIGHT)}
      >
        <div
          {...attributes}
          {...listeners}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
          style={{
            display: 'flex',
            justifyContent: side === 'left' ? 'flex-start' : 'flex-end',
            alignItems: 'center',
            height: 14,
            cursor: 'grab',
            color,
            // 선 자체가 손잡이다 — 14px 짜리 띠 안에서 3px 선이 가운데를 지난다.
            background: `linear-gradient(${color}, ${color}) center/100% 3px no-repeat`,
          }}
        >
          <PushpinOutlined
            style={{ background: token.colorBgElevated, padding: '0 6px', fontSize: 11 }}
          />
        </div>
      </Tooltip>
    </div>
  );
}

/**
 * 끄는 손잡이는 <b>왼쪽의 점 여섯</b>뿐이다.
 *
 * <p>줄 전체를 손잡이로 두면 체크박스를 <b>누를 수 없다</b> — 6px 만 흔들려도 드래그가
 * 먹는다. 손잡이를 좁게 두는 것이 그것을 살리는 값이다.
 */
function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { token } = theme.useToken();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 0',
        // 세로로만 움직인다 — 목록이 한 줄씩 쌓인 것이라 옆으로 끄는 것은 뜻이 없다.
        transform: CSS.Translate.toString(transform && { ...transform, x: 0 }),
        transition,
        // 끄는 동안 위로 올린다 — 아래 줄에 가려지면 무엇을 끌고 있는지 보이지 않는다.
        zIndex: isDragging ? 1 : undefined,
        position: isDragging ? 'relative' : undefined,
        background: isDragging ? token.colorBgElevated : undefined,
      }}
    >
      <span
        {...attributes}
        {...listeners}
        aria-label={label(MSG.GRID_SETTINGS_DRAG)}
        style={{
          display: 'inline-flex',
          width: 24,
          justifyContent: 'center',
          cursor: 'grab',
          color: token.colorTextQuaternary,
        }}
      >
        <HolderOutlined />
      </span>
      {children}
    </div>
  );
}
