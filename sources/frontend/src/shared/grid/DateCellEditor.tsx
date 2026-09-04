import { useCallback, useState } from 'react';
import { DatePicker, theme } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { CustomCellEditorProps } from 'ag-grid-react';
import { datePattern, type DatePrecision } from '@/shared/grid/dateFormat';

/**
 * 날짜 셀의 편집기 — <b>AntD 달력</b>이다(grid-column-contract.md §4.5 · §5).
 *
 * <p><b>판의 기본 편집기는 텍스트 칸</b>이다. 그대로 두면 사람이 {@code 2026-08-31} 을
 * 손으로 치고, 형식이 틀리면 <b>조용히 값이 되지 않는다</b> — 61 §3.8 탭 1 의 시작·종료일이
 * 실물로 그랬다(2026-08-31).
 *
 * <p><b>조회조건과 같은 컴포넌트</b>다. 다르면 같은 화면에서 <b>두 모양의 달력</b>이 뜨고,
 * AntD 쪽만 셸의 색·모드 토큰을 받으므로(main-shell.md §9.7) 다크에서 어긋난다.
 *
 * <h2>정밀도가 달력의 모양과 값을 함께 정한다</h2>
 *
 * <table>
 *   <tr><td>{@code month}</td><td>년월 달력 — 일을 고를 수 없다. 값은 <b>그 달의 1일</b>이다</td></tr>
 *   <tr><td>{@code day}</td><td>일반 달력</td></tr>
 *   <tr><td>{@code second}</td><td>시분초 입력이 붙은 달력</td></tr>
 * </table>
 *
 * <h2>값의 모양은 <b>컬럼 타입</b>이 정한다</h2>
 *
 * <p>{@code date} 는 {@code LocalDate}({@code YYYY-MM-DD})이고 {@code dateTime} 은 오프셋을
 * 포함한 ISO-8601 이다(architecture.md §6-1). <b>표시 형식을 그대로 쓰지 않는다</b> — 시스템 설정이
 * {@code YYYY.MM.DD} 로 바뀌면 서버가 받는 값도 함께 바뀌어 <b>파싱이 깨진다</b>.
 *
 * <h2>드롭다운에 판의 클래스를 붙인다</h2>
 *
 * <p>{@code ag-custom-component-popup} 이 없으면 달력을 클릭하는 순간 판이 <i>포커스가
 * 그리드를 떠났다</i> 고 보고 편집을 끝낸다({@code stopEditingWhenCellsLoseFocus}) —
 * 날짜를 고르기 전에 편집기가 닫힌다. 판이 이 클래스를 <b>자기 안</b>으로 세는 것이
 * 커스텀 팝업의 규약이다.
 *
 * <h2>바탕을 <b>우리가 칠한다</b></h2>
 *
 * <p>{@code cellEditorPopup} 의 껍데기({@code .ag-popup-editor})는 <b>위치만</b> 갖는다 —
 * 배경도 테두리도 없다. 그래서 셀에 이미 그려진 글자가 <b>편집기 아래로 그대로 보였고</b>,
 * 더블 클릭하면 <i>같은 날짜가 두 겹</i>으로 읽혔다(2026-08-31 실물).
 *
 * <p>판의 긴 글 편집기가 멀쩡했던 것은 그쪽이 자기 바탕을 갖기 때문이다({@code .ag-large-text}
 * 에 배경·둥근 모서리·그림자가 붙어 있다). 여기서도 <b>같은 셋</b>을 칠한다 — 색은
 * <b>토큰에서</b> 온다(grid-standard.md §8.4): hex 를 적으면 다크에서 흰 판이 뜬다.
 *
 * <p><b>폭은 셀에서 받는다.</b> 껍데기가 폭을 주지 않으므로 {@code width: 100%} 는 기댈 곳이
 * 없고, 그대로 두면 칸이 <b>글자 길이만큼</b> 줄어 아래 글자가 옆으로 삐져나온다 — 셀 폭에
 * 맞추면 편집기가 <b>그 칸을 덮는다</b>(덮는 것이 이 팝업의 일이다).
 */
export function DateCellEditor(props: CustomCellEditorProps<unknown, string | null>) {
  const params = props as CustomCellEditorProps<unknown, string | null> & {
    precision?: DatePrecision;
    /** 값의 모양 — `date` 면 `LocalDate`, `dateTime` 이면 오프셋 ISO 다. */
    valueType?: 'date' | 'dateTime';
  };
  const precision = params.precision ?? 'day';
  const valueType = params.valueType ?? 'date';

  const { token } = theme.useToken();
  // 덮어야 하는 칸의 폭 — 판이 넘겨준 셀 요소가 그 값을 안다.
  const cellWidth = props.eGridCell.getBoundingClientRect().width;

  /*
    <b>열린 채로 시작한다.</b> 판은 이미 <i>편집을 시작한다</i> 는 제스처를 받았으므로
    (더블 클릭 · F2 · Enter) 여기서 한 번 더 누르게 하면 클릭이 둘이다.
  */
  const [open, setOpen] = useState(true);

  const commit = useCallback(
    (picked: Dayjs | null) => {
      props.onValueChange(picked === null ? null : serialize(picked, precision, valueType));
      props.stopEditing();
    },
    [props, precision, valueType],
  );

  const current = props.value ? dayjs(props.value) : null;

  return (
    <div
      style={{
        // 셀의 글자를 <b>가린다</b> — 껍데기가 배경을 갖지 않는다(클래스 주석).
        width: Math.max(cellWidth, MIN_WIDTH),
        background: token.colorBgElevated,
        borderRadius: token.borderRadius,
        boxShadow: token.boxShadowSecondary,
      }}
    >
      <DatePicker
        autoFocus
        open={open}
        // 년월은 일을 고를 수 없다 — 달 판을 그대로 쓴다.
        picker={precision === 'month' ? 'month' : 'date'}
        showTime={precision === 'second'}
        allowClear
        variant="borderless"
        style={{ width: '100%' }}
        format={datePattern(precision)}
        value={current !== null && current.isValid() ? current : null}
        /*
          판이 <b>자기 안으로 세는 팝업</b>이다 — 없으면 고르는 순간 편집이 끝난다.

          <b>{@code getPopupContainer} 로 옮기지 않는다.</b> 달력을 셀 근처의 요소 안에
          넣으면 그 조상의 {@code overflow} 에 잘리는데, 하단 탭처럼 낮은 판에서는 300px
          짜리 달력이 <b>거의 다 잘린다</b>. 몸통에 붙여 두고 <b>클래스로 판에게 알리는</b>
          것이 커스텀 팝업의 규약이다.
        */
        classNames={{ popup: { root: 'ag-custom-component-popup' } }}
        onChange={commit}
        onOpenChange={(next) => {
          setOpen(next);
          /*
            <b>닫혔으면 편집도 끝난다.</b> 고르지 않고 닫은 경우이며({@code Esc} · 바깥
            클릭) 값을 건드리지 않았으므로 원래 값이 남는다 — 빈 편집기가 셀에 남아
            있으면 <i>고쳤는데 저장이 안 된다</i> 로 읽힌다.
          */
          if (!next) props.stopEditing();
        }}
      />
    </div>
  );
}

/**
 * 좁은 컬럼에서도 <b>날짜 하나와 지우기 버튼</b>은 들어가야 한다.
 *
 * <p>셀 폭을 그대로 쓰면 좁은 칸에서 값이 잘리는데, <b>편집기에서 잘린 값</b>은 무엇을
 * 고치는지 모르는 상태다 — 셀보다 조금 넓게 뜨는 편이 낫다(팝업이라 넘칠 수 있다).
 */
const MIN_WIDTH = 180;

/**
 * 서버가 받는 모양으로 — <b>표시 형식과 다른 축이다</b>.
 *
 * <p>년월은 <b>그 달의 1일</b>로 굳힌다. 컬럼의 저장 타입이 {@code LocalDate} 이므로 날짜
 * 하나를 정해야 하고, 1일이 <i>그 달의 시작</i> 이라 기간의 시작·종료 어느 칸에서도 읽는
 * 사람의 기대와 어긋나지 않는다 — 끝을 말일로 굳히면 같은 컬럼이 칸마다 다르게 동작한다.
 */
function serialize(
  picked: Dayjs,
  precision: DatePrecision,
  valueType: 'date' | 'dateTime',
): string {
  const moment = precision === 'month' ? picked.startOf('month') : picked;
  return valueType === 'dateTime' ? moment.toISOString() : moment.format('YYYY-MM-DD');
}
